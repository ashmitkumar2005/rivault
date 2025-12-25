/**
 * RIVAULT CORE ENGINE
 * Copyright (c) 2025 Ashmit Kumar (Riveror). All Rights Reserved.
 * Proprietary and Confidential.
 * 
 * This source code is the intellectual property of Riveror.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
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

    // Encryption Metadata (New)
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
    folders: Map<string, Folder>;
    files: Map<string, File>;
}
