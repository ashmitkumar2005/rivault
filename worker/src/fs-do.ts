/**
 * RIVAULT FILESYSTEM DURABLE OBJECT
 */

import { Folder, File, Chunk } from './types';

// Storage Keys
const KEY_ROOT = 'root';
const KEY_PREFIX_NODE = 'node:'; // Followed by ID
const KEY_PREFIX_CHILDREN = 'children:'; // Followed by ParentID

// Errors
class ClientError extends Error {
    constructor(message: string, public status: number = 400) {
        super(message);
    }
}

export class FileSystemDO {
    private state: DurableObjectState;
    private rootId: string | null = null; // Cache root ID

    constructor(state: DurableObjectState, env: any) {
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            await this.ensureInitialized();

            // API Routing
            if (method === 'GET' && path.startsWith('/api/folders/')) {
                // List Folder
                let id = path.split('/').pop()!;
                if (id === 'root') id = this.rootId!;
                const children = await this.listFolder(id);
                return Response.json(children);
            }

            if (method === 'POST' && path === '/api/folders') {
                // Create Folder
                const body = await request.json() as { parentId: string, name: string };
                let { parentId, name } = body;
                if (parentId === 'root') parentId = this.rootId!;
                const folder = await this.createFolder(parentId, name);
                return Response.json(folder);
            }

            if (method === 'POST' && path === '/api/files') {
                // Create File
                const body = await request.json() as { parentId: string, name: string, size: number, mimeType: string, encryption?: any };
                let { parentId } = body;
                if (parentId === 'root') parentId = this.rootId!;
                const file = await this.createFile(parentId, body);
                return Response.json(file);
            }

            if (method === 'POST' && path.startsWith('/api/nodes/') && path.endsWith('/move')) { // /api/nodes/:id/move
                // Move Node
                const id = path.split('/')[3]; // /api/nodes/[id]/move
                const body = await request.json() as { newParentId: string };
                let { newParentId } = body;
                if (newParentId === 'root') newParentId = this.rootId!;
                await this.moveNode(id, newParentId);
                return new Response(null, { status: 200 }); // OK
            }

            if (method === 'POST' && path.startsWith('/api/nodes/') && path.endsWith('/rename')) {
                const id = path.split('/')[3];
                const body = await request.json() as { name: string };
                await this.renameNode(id, body.name);
                return new Response(null, { status: 200 });
            }

            if (method === 'DELETE' && path.startsWith('/api/nodes/')) {
                const id = path.split('/').pop()!;
                await this.deleteNode(id);
                return new Response(null, { status: 200 });
            }

            if (method === 'GET' && path === '/api/init') {
                return Response.json({ rootId: this.rootId });
            }

            // Chunk Upload (Update File Metadata)
            if (method === 'POST' && path.startsWith('/api/files/') && path.endsWith('/chunks')) {
                const id = path.split('/')[3];
                const body = await request.json() as { chunk: Chunk };
                await this.addChunk(id, body.chunk);
                return new Response(null, { status: 200 });
            }

            return new Response('Not Found', { status: 404 });

        } catch (err: any) {
            if (err instanceof ClientError) {
                return new Response(err.message, { status: err.status });
            }
            return new Response(err.message || 'Internal Server Error', { status: 500 });
        }
    }

    // --- Core Logic ---

    // 1. Initialization
    private async ensureInitialized() {
        if (this.rootId) return;

        this.rootId = await this.state.storage.get<string>(KEY_ROOT) || null;

        if (!this.rootId) {
            // First time boot
            const rootId = this.generateId();
            const rootFolder: Folder = {
                id: rootId,
                parentId: null,
                name: 'Rivault',
                createdAt: Date.now(),
            };

            await this.state.storage.put(KEY_ROOT, rootId);
            await this.saveNode(rootFolder);
            this.rootId = rootId;
        }
    }

    // 2. Helpers
    private generateId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    private async getNode(id: string): Promise<Folder | File | undefined> {
        return await this.state.storage.get<Folder | File>(`${KEY_PREFIX_NODE}${id}`);
    }

    private async saveNode(node: Folder | File) {
        await this.state.storage.put(`${KEY_PREFIX_NODE}${node.id}`, node);
    }

    private async getChildrenIds(folderId: string): Promise<string[]> {
        return await this.state.storage.get<string[]>(`${KEY_PREFIX_CHILDREN}${folderId}`) || [];
    }

    private async addChild(parentId: string, childId: string) {
        const children = await this.getChildrenIds(parentId);
        if (!children.includes(childId)) {
            children.push(childId);
            await this.state.storage.put(`${KEY_PREFIX_CHILDREN}${parentId}`, children);
        }
    }

    private async removeChild(parentId: string, childId: string) {
        const children = await this.getChildrenIds(parentId);
        const index = children.indexOf(childId);
        if (index !== -1) {
            children.splice(index, 1);
            await this.state.storage.put(`${KEY_PREFIX_CHILDREN}${parentId}`, children);
        }
    }

    // 3. Filesystem Operations

    async listFolder(folderId: string): Promise<(Folder | File)[]> {
        const childrenIds = await this.getChildrenIds(folderId);
        if (childrenIds.length === 0) return [];

        // Batch get
        const keys = childrenIds.map(id => `${KEY_PREFIX_NODE}${id}`);
        const nodesMap = await this.state.storage.get<Folder | File>(keys);
        return Array.from(nodesMap.values());
    }

    async createFolder(parentId: string, name: string): Promise<Folder> {
        const parent = await this.getNode(parentId);
        if (!parent || !('createdAt' in parent)) { // exists and is a folder? (Files also have createdAt, but checking type is harder here without 'parentId' logic, assuming parentId points to folder)
            // Strictly check if it is a folder by checking it DOES NOT have 'chunks'
            if (!parent) throw new ClientError(`Parent ${parentId} not found`, 404);
            if ('chunks' in parent) throw new ClientError(`Parent ${parentId} is a file`, 400);
        }

        // Uniqueness check
        const siblings = await this.listFolder(parentId);
        if (siblings.some(s => s.name === name)) {
            throw new ClientError(`Name "${name}" already exists`, 409);
        }

        const id = this.generateId();
        const newFolder: Folder = {
            id,
            parentId,
            name,
            createdAt: Date.now(),
        };

        // Transactional-ish: Put node AND update parent's children list
        // DO puts are atomic per call, but mult-key puts are atomic.
        // We need to read children, modify, write children AND write node.
        // The read-modify-write on children list is safe because DO is single-threaded for this object instance.

        await this.state.blockConcurrencyWhile(async () => {
            await this.saveNode(newFolder);
            await this.addChild(parentId, id);
        });

        return newFolder;
    }

    async createFile(parentId: string, meta: { name: string, size: number, mimeType: string, encryption?: any }): Promise<File> {
        const parent = await this.getNode(parentId);
        if (!parent || 'chunks' in parent) throw new ClientError(`Invalid parent folder`, 400); // Check if folder

        const siblings = await this.listFolder(parentId);
        if (siblings.some(s => s.name === meta.name)) {
            throw new ClientError(`Name "${meta.name}" already exists`, 409);
        }

        const id = this.generateId();
        const newFile: File = {
            id,
            parentId,
            name: meta.name,
            size: meta.size,
            chunkSize: 20 * 1024 * 1024,
            mimeType: meta.mimeType,
            chunks: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            encryption: meta.encryption
        };

        await this.state.blockConcurrencyWhile(async () => {
            await this.saveNode(newFile);
            await this.addChild(parentId, id);
        });

        return newFile;
    }

    async addChunk(fileId: string, chunk: Chunk) {
        const file = await this.getNode(fileId) as File;
        if (!file || !('chunks' in file)) throw new ClientError('File not found', 404);

        file.chunks.push(chunk);
        file.updatedAt = Date.now();
        await this.saveNode(file);
    }

    async renameNode(id: string, newName: string) {
        if (id === this.rootId) throw new ClientError("Cannot rename root", 403);

        const node = await this.getNode(id);
        if (!node) throw new ClientError("Node not found", 404);

        if (!node.parentId) throw new ClientError("Node has no parent (corruption?)", 500);

        const siblings = await this.listFolder(node.parentId);
        if (siblings.some(s => s.id !== id && s.name === newName)) {
            throw new ClientError("Name conflict", 409);
        }

        node.name = newName;
        await this.saveNode(node);
    }

    async moveNode(id: string, newParentId: string) {
        if (id === this.rootId) throw new ClientError("Cannot move root", 403);

        const node = await this.getNode(id);
        if (!node) throw new ClientError("Node not found", 404);

        const newParent = await this.getNode(newParentId);
        if (!newParent || 'chunks' in newParent) throw new ClientError("Destination not a folder", 400);

        // Cycle Check (only if node is folder)
        if (!('chunks' in node)) { // is Folder
            let current: any = newParent;
            while (current.id !== this.rootId && current.parentId) {
                if (current.id === id) throw new ClientError("Cycle detected", 400);
                const next = await this.getNode(current.parentId);
                if (!next) break; // Should not happen
                current = next;
            }
        }

        // Name check
        const destSiblings = await this.listFolder(newParentId);
        if (destSiblings.some(s => s.name === node.name)) {
            throw new ClientError("Name conflict in destination", 409);
        }

        const oldParentId = node.parentId!;
        node.parentId = newParentId;

        await this.state.blockConcurrencyWhile(async () => {
            await this.removeChild(oldParentId, id);
            await this.addChild(newParentId, id);
            await this.saveNode(node);
        });
    }

    async deleteNode(id: string) {
        if (id === this.rootId) throw new ClientError("Cannot delete root", 403);

        const node = await this.getNode(id);
        if (!node) return; // Idempotent

        // If folder, modify children recursively
        if (!('chunks' in node)) { // Folder
            const childrenIds = await this.getChildrenIds(id);
            for (const childId of childrenIds) {
                await this.deleteNode(childId);
            }
            // Delete children list
            await this.state.storage.delete(`${KEY_PREFIX_CHILDREN}${id}`);
        }

        // Remove from parent list
        if (node.parentId) {
            await this.removeChild(node.parentId, id);
        }

        // Delete self
        await this.state.storage.delete(`${KEY_PREFIX_NODE}${id}`);
    }
}
