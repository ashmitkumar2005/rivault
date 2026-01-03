/**
 * RIVAULT SHARED TYPES
 * Adapted for Cloudflare Workers
 */

export interface Chunk {
    order: number;
    storageReference: string;
}

export interface Folder {
    id: string;
    parentId: string | null;
    name: string;
    createdAt: number;
    locked?: boolean;
    lockPassword?: string; // Clear text for now as per plan (or hashed if preferred, plan said password)
}

export interface File {
    id: string;
    parentId: string;
    name: string;
    size: number;
    chunkSize: number; // usually 20MB
    chunks: Chunk[];
    mimeType: string;
    createdAt: number;
    updatedAt: number;
    locked?: boolean;
    lockPassword?: string;

    // Encryption Metadata
    encryption?: {
        wrappedKey: {
            iv: string; // hex
            encryptedKey: string; // hex
            authTag: string; // hex
        };
        salt: string; // hex
        fileIv: string; // hex (IV used for the file content)
        fileAuthTag: string; // hex (Auth Tag for the file content)
    };
}

export interface FSState {
    rootId: string;
    // Note: in Durable Objects, we might not store these as full Maps in memory
    // but we use these interfaces for API responses.
    folders: Record<string, Folder>;
    files: Record<string, File>;
}
