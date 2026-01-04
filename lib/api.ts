import { deriveMasterKey, generateDataKey, encryptDataKey, encryptData, decryptDataKey, decryptData, generateSalt, EncryptedBuffer } from './crypto-web';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

export type APIFolder = {
    id: string;
    parentId: string;
    name: string;
    createdAt: number;
    locked?: boolean;
    type?: 'folder';
};

export type APIDrive = {
    id: string;
    parentId: string;
    name: string;
    createdAt: number;
    type: 'drive';
    quota: number;
    usage: number;
    locked?: boolean;
    hidden?: boolean;
};

export type APIFile = {
    id: string;
    parentId: string;
    name: string;
    size: number;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
    locked?: boolean;
    type: 'file'; // Discriminator
};

export type APINode = APIFolder | APIFile | APIDrive;

export function isFolder(node: any): node is APIFolder {
    return node && !('size' in node) && (!node.type || node.type === 'folder');
}

export function isDrive(node: any): node is APIDrive {
    return node && node.type === 'drive';
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
    password?: string, // Password optional but required for E2EE
    onProgress?: (progress: number) => void,
    overwrite: boolean = false
): Promise<APIFile> {
    let encryptionMeta: any = undefined;
    let dataKey: CryptoKey | null = null;

    if (password) {
        // 1. Setup E2EE
        const salt = generateSalt();
        const masterKey = await deriveMasterKey(password, salt);
        const { raw: dataKeyRaw, key } = await generateDataKey();
        dataKey = key;
        const wrappedKey = await encryptDataKey(dataKeyRaw, masterKey);

        encryptionMeta = {
            salt,
            wrappedKey,
            // Per-file IV isn't strictly necessary if chunks have their own IVs, 
            // but we can store one if we want to follow our proposed types.ts structure.
            // Actually, we'll prepend IV to chunks.
        };
    }

    // 2. Create File Metadata
    const initRes = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({
            parentId,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            encryption: encryptionMeta,
            overwrite
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

        let body: ArrayBuffer = await chunk.arrayBuffer();

        if (dataKey) {
            // Encrypt Chunk
            const { iv, ciphertext, authTag } = await encryptData(new Uint8Array(body), dataKey);
            const ivBuf = hex2buf(iv);
            const tagBuf = hex2buf(authTag);
            const cipherBuf = hex2buf(ciphertext);

            // Prepend IV (12) and AuthTag (16)
            const combined = new Uint8Array(ivBuf.length + tagBuf.length + cipherBuf.length);
            combined.set(ivBuf, 0);
            combined.set(tagBuf, ivBuf.length);
            combined.set(cipherBuf, ivBuf.length + tagBuf.length);
            body = combined.buffer;
        }

        // Upload chunk
        const res = await fetch(`${API_URL}/files/${fileId}/chunks?order=${i}`, {
            method: 'POST',
            headers: {
                ...getHeaders(),
                'Content-Type': 'application/octet-stream'
            },
            body: body
        });

        if (!res.ok) throw new Error(`Chunk ${i} upload failed`);

        if (onProgress) {
            onProgress(((i + 1) / totalChunks) * 100);
        }
    }

    return fileMeta;
}

export function getDownloadUrl(fileId: string, lockPassword?: string): string {
    const url = `${API_URL}/files/${fileId}/download`;
    if (lockPassword) {
        return `${url}?lockKey=${encodeURIComponent(lockPassword)}`;
    }
    return url;
}

// Helper: Convert Hex String to Uint8Array (Duplicated from crypto-web if internal only there, 
// let's export it from crypto-web or just re-define if needed. Best to export.)
// Helper: Convert Hex String to Uint8Array
function hex2buf(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

export async function downloadAndDecryptFile(
    fileMeta: APIFile & { encryption?: any },
    password?: string,
    lockPassword?: string
): Promise<Blob> {
    // 1. If not encrypted, just download normally (or via proxy)
    if (!fileMeta.encryption || !password) {
        const res = await fetch(getDownloadUrl(fileMeta.id, lockPassword));
        if (!res.ok) throw new Error('Download failed');
        return await res.blob();
    }

    // 2. Setup Decryption
    const { salt, wrappedKey } = fileMeta.encryption;
    const masterKey = await deriveMasterKey(password, salt);
    const dataKey = await decryptDataKey(wrappedKey, masterKey);

    // 3. Fetch Chunks and Decrypt
    // For now, we'll fetch the whole stream or individual chunks if possible.
    // The current server returns a stream of concatenated raw chunks.
    // BUT we need to decrypt chunk by chunk because AES-GCM needs separate IV/Tag.
    // So the server proxy GET /download should ideally return the raw stream of encrypted chunks.
    // Our encryption prepends IV(12) and Tag(16) to each chunk.

    // FETCH THE RAW STREAM
    const res = await fetch(getDownloadUrl(fileMeta.id, lockPassword));
    if (!res.ok) throw new Error('Download failed');
    if (!res.body) throw new Error('No body in response');

    const decryptedChunks: Uint8Array[] = [];

    // We need to buffer the response to identify chunk boundaries or just process it as a continuous stream
    // Since we know our chunk size roughly, but more importantly we know the structure: [IV(12)][Tag(16)][Ciphertext(CHUNK_SIZE)]
    // Actually, CHUNK_SIZE refers to the original data size. The encrypted chunk will be 28 bytes larger.

    // SIMPLIFIED FOR PROOF: 
    // In a production app, we would handle the stream precisely. 
    // For now, let's read the whole thing if it's small enough, or just process segments.
    // Let's assume we can get segments.

    const fullBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(fullBuffer);

    let offset = 0;
    // We need a way to know where chunks end. 
    // Since CHUNK_SIZE is 5MB, we can use that to slice.
    // BUT the last chunk might be smaller.
    // Safe approach: The metadata should probably store chunk sizes if they vary, 
    // but here we know each encrypted segment is (OriginalChunkSize + 28).

    // Wait, the concatenated stream in the worker download proxy:
    // It just writes value by value.

    // A better way: The worker download proxy should probably not be used if we want precise segment decryption,
    // OR it should be used and we just parse the markers.

    // Let's assume for now we can decrypt the whole concatenated buffer if we knew the sequence.
    // Actually, each 5MB segment (plus overhead) is decoratable.

    const OVERHEAD = 12 + 16;
    const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + OVERHEAD;

    while (offset < bytes.length) {
        // Calculate current segment length
        // This is tricky if it's the last chunk.
        // If it's not the last chunk, it's ENCRYPTED_CHUNK_SIZE.
        // If it is, it's the remainder.

        let segmentLen = ENCRYPTED_CHUNK_SIZE;
        if (offset + segmentLen > bytes.length) {
            segmentLen = bytes.length - offset;
        }

        const segment = bytes.slice(offset, offset + segmentLen);
        const iv = segment.slice(0, 12);
        const tag = segment.slice(12, 28);
        const ciphertext = segment.slice(28);

        const decrypted = await decryptData({
            iv: buf2hex(iv),
            authTag: buf2hex(tag),
            ciphertext: buf2hex(ciphertext)
        }, dataKey);

        decryptedChunks.push(decrypted);
        offset += segmentLen;
    }

    return new Blob(decryptedChunks as any, { type: fileMeta.mimeType });
}

function buf2hex(data: ArrayBuffer | Uint8Array): string {
    const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
    return Array.from(arr)
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
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
    const res = await fetch(`${API_URL}/stats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to get stats');
    return res.json();
}

export async function lockNode(nodeId: string, password: string): Promise<void> {
    const res = await fetch(`${API_URL}/nodes/${nodeId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error('Failed to lock item');
}

export async function unlockNode(nodeId: string, password: string): Promise<void> {
    const res = await fetch(`${API_URL}/nodes/${nodeId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error('Failed to unlock item');
}

export async function verifyLock(nodeId: string, password: string): Promise<boolean> {
    const res = await fetch(`${API_URL}/nodes/${nodeId}/verify-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ password })
    });
    return res.ok;
}

export async function createDrive(letter: string, size: number, hidden: boolean = false): Promise<APIDrive> {
    const res = await fetch(`${API_URL}/drives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ letter, size, hidden })
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to create drive');
    }
    return res.json();
}

export async function deleteDrive(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/drives/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to delete drive');
    }
}

export async function resizeDrive(id: string, size: number): Promise<void> {
    const res = await fetch(`${API_URL}/drives/${id}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ size })
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to resize drive');
    }
}

