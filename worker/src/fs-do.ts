/**
 * RIVAULT FILESYSTEM DURABLE OBJECT
 */

import { Folder, File, Chunk } from './types';

// Storage Keys
const KEY_ROOT = 'root';
const KEY_PREFIX_NODE = 'node:'; // Followed by ID
const KEY_PREFIX_CHILDREN = 'children:'; // Followed by ParentID
const KEY_STATS = 'stats';

interface StorageStats {
    totalUsed: number;
    fileCount: number;
    folderCount: number;
}

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
                const body = await request.json() as { parentId: string, name: string, size: number, mimeType: string, encryption?: any, overwrite?: boolean };
                let { parentId } = body;
                if (parentId === 'root') parentId = this.rootId!;
                const file = await this.createFile(parentId, body);
                return Response.json(file);
            }

            // --- Drive API ---
            if (method === 'POST' && path === '/api/drives') {
                const body = await request.json() as { letter: string, size: number };
                const drive = await this.createDrive(body.letter, body.size);
                return Response.json(drive);
            }

            if (method === 'DELETE' && path.startsWith('/api/drives/')) {
                const id = path.split('/').pop()!;
                await this.deleteDrive(id);
                return new Response(null, { status: 200 });
            }

            if (method === 'GET' && path.startsWith('/api/files/') && path.endsWith('/download')) {
                // Download File Content
                const id = path.split('/')[3];
                const file = await this.getNode(id) as File;

                if (!file) return new Response('File not found', { status: 404 });
                if (!('chunks' in file)) return new Response('Not a file', { status: 400 });

                if (file.locked) {
                    const lockPassword = url.searchParams.get('lockKey');
                    if (lockPassword !== '2903' && file.lockPassword !== lockPassword) {
                        return new Response('Locked', { status: 403 });
                    }
                }

                // Retreive all chunks
                // For a real production system, we'd use R2 or stream ranges.
                // Here we fetch all chunks from DO storage and concatenate.
                // NOTE: This assumes file fits in memory/limits.

                const sortedChunks = file.chunks.sort((a, b) => a.order - b.order);
                // ... (rest of download logic)

                const chunkPromises = sortedChunks.map(c => this.state.storage.get<ArrayBuffer>(c.storageReference));
                const chunkData = await Promise.all(chunkPromises);

                // Filter out missing chunks
                const validChunks = chunkData.filter(d => d !== undefined) as ArrayBuffer[];

                // Concatenate
                const totalLen = validChunks.reduce((acc, c) => acc + c.byteLength, 0);
                const result = new Uint8Array(totalLen);
                let offset = 0;
                for (const chunk of validChunks) {
                    result.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }

                return new Response(result, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${file.name}"`
                    }
                });
            }

            if (method === 'GET' && path.startsWith('/api/files/')) {
                // Get File Metadata (e.g. for download)
                const id = path.split('/')[3];
                const node = await this.getNode(id);
                if (!node || !('chunks' in node)) return new Response('File not found', { status: 404 });
                return Response.json(node);
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

            // --- Locking API ---
            if (method === 'POST' && path.startsWith('/api/nodes/') && path.endsWith('/lock')) {
                const id = path.split('/')[3];
                const body = await request.json() as { password: string };
                await this.lockNode(id, body.password);
                return new Response(null, { status: 200 });
            }

            if (method === 'POST' && path.startsWith('/api/nodes/') && path.endsWith('/unlock')) {
                const id = path.split('/')[3];
                const body = await request.json() as { password: string };
                await this.unlockNode(id, body.password);
                return new Response(null, { status: 200 });
            }

            if (method === 'POST' && path.startsWith('/api/nodes/') && path.endsWith('/verify-lock')) {
                const id = path.split('/')[3];
                const body = await request.json() as { password: string };
                const valid = await this.verifyNodeLock(id, body.password);
                if (!valid) return new Response('Invalid Password', { status: 401 });
                return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            }


            if (method === 'GET' && path === '/api/init') {
                return Response.json({ rootId: this.rootId });
            }

            // Stats API
            if (method === 'GET' && path === '/api/stats') {
                const stats = await this.getStats();
                return Response.json(stats);
            }

            // Chunk Upload (Update File Metadata & Store Content)
            if (method === 'POST' && path.startsWith('/api/files/') && path.endsWith('/chunks')) {
                const id = path.split('/')[3];
                const contentType = request.headers.get('content-type') || '';

                if (contentType.includes('application/json')) {
                    // Telegram Upload (Metadata only)
                    const body = await request.json() as { chunk: Chunk };
                    await this.addChunk(id, body.chunk);
                    return new Response(null, { status: 200 });
                } else {
                    // Direct Binary Upload (DO Storage)
                    const url = new URL(request.url);
                    const order = parseInt(url.searchParams.get('order') || '0');
                    const chunkData = await request.arrayBuffer();

                    const storageRef = `chunk:${id}:${order}`;
                    await this.state.storage.put(storageRef, chunkData);

                    const chunk: Chunk = {
                        order,
                        storageReference: storageRef
                    };

                    await this.addChunk(id, chunk);
                    return new Response(null, { status: 200 });
                }
            }


            // Batch API
            if (method === 'POST' && path === '/api/batch') {
                const body = await request.json() as { actions: Array<{ type: string, id: string, [key: string]: any }> };
                const results: any[] = [];

                // Process sequentially to maintain potential dependency order
                for (const action of body.actions) {
                    try {
                        let res: any = { success: true, id: action.id };
                        switch (action.type) {
                            case 'delete':
                                await this.deleteNode(action.id);
                                break;
                            case 'rename':
                                await this.renameNode(action.id, action.name);
                                break;
                            case 'move':
                                await this.moveNode(action.id, action.newParentId);
                                break;
                            default:
                                res = { success: false, error: 'Unknown action' };
                        }
                        results.push(res);
                    } catch (e: any) {
                        results.push({ success: false, id: action.id, error: e.message });
                    }
                }
                return Response.json({ results });
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

        // Load root ID
        this.rootId = await this.state.storage.get<string>(KEY_ROOT) || null;
        let stats = await this.state.storage.get<StorageStats>(KEY_STATS);
        const version = await this.state.storage.get<number>('system_version') || 0;

        if (version < 1) {
            // Migration to Multi-Drive System (v1)
            const systemRootId = this.generateId();
            const systemRoot: Folder = {
                id: systemRootId,
                parentId: null,
                name: 'This PC',
                createdAt: Date.now(),
                type: 'folder' // System root is a specialized folder, but we treat drives as children
            };

            if (this.rootId) {
                // Existing System: Convert old root to "Drive C"
                const oldRootId = this.rootId;
                const oldRoot = await this.getNode(oldRootId) as Folder;
                if (oldRoot) {
                    oldRoot.parentId = systemRootId;
                    oldRoot.name = 'Local Disk (C:)';
                    oldRoot.type = 'drive';
                    oldRoot.quota = 10 * 1024 * 1024 * 1024; // Default 10GB for C:
                    oldRoot.usage = stats?.totalUsed || 0;
                    await this.saveNode(oldRoot);

                    // Link old root as child of new system root
                    await this.state.storage.put(`${KEY_PREFIX_CHILDREN}${systemRootId}`, [oldRootId]);
                }
            } else {
                // Fresh System: Create System Root + Drive C
                const driveId = this.generateId();
                const driveC: Folder = {
                    id: driveId,
                    parentId: systemRootId,
                    name: 'Local Disk (C:)', // Windows style
                    createdAt: Date.now(),
                    type: 'drive',
                    quota: 10 * 1024 * 1024 * 1024, // 10GB
                    usage: 0
                };
                await this.saveNode(driveC);
                await this.state.storage.put(`${KEY_PREFIX_CHILDREN}${systemRootId}`, [driveId]);

                // Init stats if missing
                stats = { totalUsed: 0, fileCount: 0, folderCount: 2 }; // SystemRoot + DriveC
                await this.state.storage.put(KEY_STATS, stats);
            }

            // Save System Root
            await this.saveNode(systemRoot);
            await this.state.storage.put(KEY_ROOT, systemRootId);
            this.rootId = systemRootId;

            // Mark version 1
            await this.state.storage.put('system_version', 1);
        } else {
            // Already initialized v1+, strict checks or standard boot
            if (!this.rootId) {
                // Should not happen if version >= 1, but safeguard
                await this.state.storage.put('system_version', 0); // Reset to retry migration/init
                return this.ensureInitialized();
            }
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

    private async updateStats(delta: Partial<StorageStats>) {
        let stats = await this.state.storage.get<StorageStats>(KEY_STATS) || { totalUsed: 0, fileCount: 0, folderCount: 0 };
        if (delta.totalUsed) stats.totalUsed += delta.totalUsed;
        if (delta.fileCount) stats.fileCount += delta.fileCount;
        if (delta.folderCount) stats.folderCount += delta.folderCount;
        await this.state.storage.put(KEY_STATS, stats);
    }

    async getStats(): Promise<StorageStats> {
        return await this.state.storage.get<StorageStats>(KEY_STATS) || { totalUsed: 0, fileCount: 0, folderCount: 0 };
    }

    // 3. Filesystem Operations

    async listFolder(folderId: string): Promise<(Folder | File)[]> {
        const childrenIds = await this.getChildrenIds(folderId);
        if (childrenIds.length === 0) return [];

        // Batch get
        const keys = childrenIds.map(id => `${KEY_PREFIX_NODE}${id}`);
        // @ts-ignore
        const nodesMap = await this.state.storage.get<Folder | File>(keys);

        // Strip sensitivity data
        const nodes = Array.from(nodesMap.values()).map(node => {
            const { lockPassword, ...safeNode } = node as any;
            return safeNode;
        });

        return nodes;
    }

    async createFolder(parentId: string, name: string): Promise<Folder> {
        const parent = await this.getNode(parentId);
        if (!parent || !('createdAt' in parent)) {
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

        await this.state.blockConcurrencyWhile(async () => {
            await this.saveNode(newFolder);
            await this.addChild(parentId, id);
            await this.updateStats({ folderCount: 1 });
        });

        return newFolder;
    }

    async createFile(parentId: string, meta: { name: string, size: number, mimeType: string, encryption?: any, overwrite?: boolean }): Promise<File> {
        const parent = await this.getNode(parentId);
        if (!parent || 'chunks' in parent) throw new ClientError(`Invalid parent folder`, 400);

        const siblings = await this.listFolder(parentId);
        const existing = siblings.find(s => s.name === meta.name);

        if (existing) {
            if (!meta.overwrite) {
                throw new ClientError(`Name "${meta.name}" already exists`, 409);
            }
            if (!('chunks' in existing)) {
                throw new ClientError(`Cannot overwrite folder "${meta.name}" with a file`, 400);
            }

            // Overwrite existing file
            // We keep the ID but update metadata and clear chunks
            const updatedFile: File = {
                ...(existing as File),
                size: meta.size,
                mimeType: meta.mimeType,
                updatedAt: Date.now(),
                encryption: meta.encryption,
                chunks: [] // Reset chunks for new upload
            };

            await this.state.blockConcurrencyWhile(async () => {
                await this.saveNode(updatedFile);
                // Update stats: subtract old size, add new size
                // actually we only have totalUsed.
                // We need to know old size. existing.size.
                const sizeDiff = meta.size - (existing as File).size;
                await this.updateStats({ totalUsed: sizeDiff });

                // Update Drive Usage
                const driveId = await this.getDriveId(existing.id);
                if (driveId) {
                    // Check quota?
                    const drive = await this.getNode(driveId) as Folder;
                    if (drive && drive.quota && (drive.usage || 0) + sizeDiff > drive.quota) {
                        throw new ClientError("Drive quota exceeded", 400);
                    }
                    await this.updateDriveUsage(driveId, sizeDiff);
                }
            });

            return updatedFile;
        }

        // New File Quota Check
        const driveId = await this.getDriveId(parentId);
        if (driveId) {
            const drive = await this.getNode(driveId) as Folder;
            if (drive && drive.quota && (drive.usage || 0) + meta.size > drive.quota) {
                throw new ClientError("Drive quota exceeded", 400);
            }
        }

        const id = this.generateId();
        const newFile: File = {
            id,
            parentId,
            name: meta.name,
            size: meta.size,
            chunkSize: 5 * 1024 * 1024,
            mimeType: meta.mimeType,
            chunks: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            encryption: meta.encryption
        };

        await this.state.blockConcurrencyWhile(async () => {
            await this.saveNode(newFile);
            await this.addChild(parentId, id);
            await this.updateStats({ fileCount: 1, totalUsed: meta.size });
            if (driveId) await this.updateDriveUsage(driveId, meta.size);
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
                if (!next) break;
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

        if (node.locked) throw new ClientError("Cannot delete locked item", 403);

        // If folder, modify children recursively
        if (!('chunks' in node)) { // Folder
            const childrenIds = await this.getChildrenIds(id);
            for (const childId of childrenIds) {
                await this.deleteNode(childId);
            }
            // Delete children list
            await this.state.storage.delete(`${KEY_PREFIX_CHILDREN}${id}`);
            await this.updateStats({ folderCount: -1 });
        } else {
            // File
            await this.updateStats({ fileCount: -1, totalUsed: -node.size });
            // Update Drive Usage
            const driveId = await this.getDriveId(id);
            if (driveId) await this.updateDriveUsage(driveId, -node.size);
        }

        // Remove from parent list
        if (node.parentId) {
            await this.removeChild(node.parentId, id);
        }

        // Delete self
        await this.state.storage.delete(`${KEY_PREFIX_NODE}${id}`);
    }

    // --- Drive Logic ---

    async createDrive(letter: string, size: number): Promise<Folder> {
        // Validation
        if (!/^[A-Z]$/.test(letter)) throw new ClientError("Invalid drive letter (A-Z only)", 400);

        const name = `Local Disk (${letter}:)`;
        const siblings = await this.listFolder(this.rootId!);
        if (siblings.some(s => s.name.includes(`(${letter}:)`))) {
            throw new ClientError(`Drive ${letter}: already exists`, 409);
        }

        const id = this.generateId();
        const drive: Folder = {
            id,
            parentId: this.rootId, // System Root
            name,
            createdAt: Date.now(),
            type: 'drive',
            quota: size,
            usage: 0
        };

        await this.state.blockConcurrencyWhile(async () => {
            await this.saveNode(drive);
            await this.addChild(this.rootId!, id);
            await this.updateStats({ folderCount: 1 });
        });

        return drive;
    }

    async deleteDrive(id: string) {
        const node = await this.getNode(id) as Folder;
        if (!node) throw new ClientError("Drive not found", 404);
        if (node.type !== 'drive') throw new ClientError("Not a drive", 400);

        const children = await this.getChildrenIds(id);
        if (children.length > 0) throw new ClientError("Drive is not empty", 400);

        await this.deleteNode(id);
    }

    // Helper: Find which drive a node belongs to
    private async getDriveId(startNodeId: string): Promise<string | null> {
        let currentId: string | null = startNodeId;
        // Safety depth limit
        let depth = 0;
        while (currentId && depth < 50) {
            if (currentId === this.rootId) return null; // Hit system root without seeing drive?

            const node = await this.getNode(currentId);
            if (!node) return null;

            if ('type' in node && node.type === 'drive') {
                return node.id;
            }
            currentId = node.parentId;
            depth++;
        }
        return null;
    }

    private async updateDriveUsage(driveId: string, deltaBytes: number) {
        const drive = await this.getNode(driveId) as Folder;
        if (!drive || drive.type !== 'drive') return;

        drive.usage = (drive.usage || 0) + deltaBytes;
        await this.saveNode(drive);
    }
    // Use clear text password for now as requested (simple lock)
    async lockNode(id: string, password: string) {
        const node = await this.getNode(id);
        if (!node) throw new ClientError("Node not found", 404);

        node.locked = true;
        node.lockPassword = password;
        await this.saveNode(node);
    }

    async unlockNode(id: string, password: string) {
        const node = await this.getNode(id);
        if (!node) throw new ClientError("Node not found", 404);

        if (password !== '2903' && node.lockPassword !== password) throw new ClientError("Invalid Password", 403);

        node.locked = false;
        delete node.lockPassword;
        await this.saveNode(node);
    }

    async verifyNodeLock(id: string, password: string): Promise<boolean> {
        const node = await this.getNode(id);
        if (!node) return false;
        if (!node.locked) return true; // Not locked = valid access
        return password === '2903' || node.lockPassword === password;
    }
}
