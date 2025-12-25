export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

export type APIFolder = {
    id: string;
    parentId: string;
    name: string;
    createdAt: number;
};

export type APIFile = {
    id: string;
    parentId: string;
    name: string;
    size: number;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
};

export type APINode = APIFolder | APIFile;

export function isFolder(node: any): node is APIFolder {
    return !('size' in node);
}

function getHeaders() {
    return {
        'X-Rivault-User': 'default' // Consistent user ID
    };
}

export async function listFolder(folderId: string): Promise<APINode[]> {
    const res = await fetch(`${API_URL}/folders/${folderId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to list folder: ${res.statusText}`);
    return res.json();
}

export async function createFolder(parentId: string, name: string): Promise<APIFolder> {
    const res = await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ parentId, name }),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    return res.json();
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export async function uploadFile(
    parentId: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<APIFile> {
    // 1. Create File Metadata
    const initRes = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({
            parentId,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream'
        })
    });

    if (!initRes.ok) throw new Error('Failed to init file upload');
    const fileMeta: APIFile = await initRes.json();
    const fileId = fileMeta.id;

    // 2. Upload Chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk
        const res = await fetch(`${API_URL}/files/${fileId}/chunks?order=${i}`, {
            method: 'POST',
            headers: {
                ...getHeaders(),
                'Content-Type': 'application/octet-stream'
            },
            body: chunk
        });

        if (!res.ok) throw new Error(`Chunk ${i} upload failed`);

        if (onProgress) {
            onProgress(((i + 1) / totalChunks) * 100);
        }
    }

    return fileMeta;
}

export function getDownloadUrl(fileId: string): string {
    // TODO: Implement download via Worker proxy if needed, or direct link
    // For now, pointing to API which might redirect or stream
    return `${API_URL}/files/${fileId}/download`;
}

export async function deleteNode(nodeId: string): Promise<void> {
    const res = await fetch(`${API_URL}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete item');
}

export async function renameNode(nodeId: string, newName: string): Promise<void> {
    const res = await fetch(`${API_URL}/nodes/${nodeId}/rename`, {
        method: 'POST', // Changed from PATCH to match Worker router
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ name: newName }), // "name" not "newName" in Worker
    });
    if (!res.ok) throw new Error('Failed to rename item');
}

export async function moveNode(nodeId: string, newParentId: string): Promise<void> {
    const res = await fetch(`${API_URL}/nodes/${nodeId}/move`, {
        method: 'POST', // Changed from PATCH
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ newParentId }),
    });
    if (!res.ok) throw new Error('Failed to move item');
}

export async function getStorageStats(): Promise<any> {
    // Not implemented in Worker yet, stubbing
    return { totalUsed: 0, fileCount: 0, folderCount: 0 };
}
