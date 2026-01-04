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
    lockPassword?: string;
    type?: 'folder'; // Explicit discriminator
}

export interface Drive {
    id: string;
    parentId: string | null; // Usually system root
    name: string;
    createdAt: number;
    type: 'drive';
    quota: number;
    usage: number;
    locked?: boolean; // Drives could hypothetically be locked too? Let's keep it optional.
    lockPassword?: string;
    hidden?: boolean;
    accessCode?: string; // Custom code for hidden drives
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
