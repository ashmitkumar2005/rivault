import * as fsEngine from '../core/fs-engine';
import { FSState, File, Chunk } from '../core/models';
import * as gistAdapter from '../persistence/gist-adapter';
import * as telegramAdapter from '../storage/telegram-adapter';
import * as cryptoEngine from '../crypto/crypto-engine';

// Maintain in-memory state
let fsState: FSState | null = null;
let masterKey: Buffer | null = null;
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB match with storage adapter

/**
 * Initializes the service:
 * 1. Loads/Derives Master Key
 * 2. Loads filesystem state
 */
export async function initService(): Promise<void> {
    // 1. Crypto Init
    const password = process.env.RIVAULT_MASTER_PASSWORD;
    const saltHex = process.env.RIVAULT_SALT;

    if (!password || !saltHex) {
        throw new Error('Encryption Configuration Missing: RIVAULT_MASTER_PASSWORD and RIVAULT_SALT must be set.');
    }

    const salt = Buffer.from(saltHex, 'hex');
    if (salt.length !== 32) {
        // It doesn't STRICTLY have to be 32, but good practice. PBKDF2 handles any length.
        // We won't throw on length, just existence.
    }

    masterKey = cryptoEngine.deriveMasterKey(password, salt);

    // 2. State Init
    try {
        fsState = await gistAdapter.loadState();
    } catch (error) {
        // Fallback for first run or if Gist fails
        console.warn("Failed to load state, initializing new FS:", error);
        fsState = fsEngine.initFS();
        try {
            await gistAdapter.saveState(fsState);
        } catch (saveError) {
            console.error("Failed to persist initial state. Running in IN-MEMORY mode.", saveError);
        }
    }
}

export function getState(): FSState {
    if (!fsState) {
        throw new Error('Service not initialized. Call initService() first.');
    }
    return fsState;
}

/**
 * Uploads a file:
 * 1. Uploads chunks to Telegram (Storage)
 * 2. Creates File metadata (FS Engine)
 * 3. Persists state (Persistence)
 */
export async function uploadFile(
    parentId: string,
    buffer: Buffer,
    meta: { name: string; mimeType: string }
): Promise<void> {
    const state = getState();
    if (!masterKey) throw new Error('Master Key not initialized');

    // 1. Encryption
    const dataKey = cryptoEngine.generateDataKey();

    // Encrypt the *entire* buffer first?
    // Optimization: If we encrypt the whole buffer, we must store IV/AuthTag.
    // Envelope: 
    //   - Generate Data Key
    //   - Encrypt Buffer with Data Key -> { iv, ciphertext, authTag }
    //   - Wrap Data Key with Master Key -> { encryptedKey }
    //   - Upload ciphertext
    //   - Save wrapped key + IV + AuthTag in metadata

    const { iv, ciphertext, authTag } = cryptoEngine.encryptBuffer(buffer, dataKey);
    const wrappedKeyParams = cryptoEngine.encryptDataKey(dataKey, masterKey);

    // 2. Storage: Upload Ciphertext
    // Note: We upload 'ciphertext', NOT original 'buffer'
    const chunks: Chunk[] = [];
    const totalSize = ciphertext.length;

    let offset = 0;
    let chunkOrder = 0;

    while (offset < totalSize) {
        const end = Math.min(offset + MAX_CHUNK_SIZE, totalSize);
        const chunkBuf = ciphertext.subarray(offset, end);
        const chunkRef = await telegramAdapter.uploadChunk(chunkBuf);

        chunks.push({
            order: chunkOrder++,
            storageReference: chunkRef.storageReference,
        });
        offset = end;
    }

    // 3. Metadata
    // We store the size of the PLAINTEXT or CIPHERTEXT?
    // FS Contract usually expects size to be "logical" size vs "physical" size.
    // But for a simple file explorer, user cares about original size.
    // However, download needs to know how many bytes to fetch.
    // 'file.size' is used by fs-engine for listings.
    // Let's store ORIGINAL size in `size` (for UI)
    // But we need to verify if `downloadFile` needs `file.size` or just aggregates chunks.
    // `downloadFile` aggregates chunks.
    // So `file.size` is purely cosmetic?
    // Actually, if we store cosmetic size, we need to know ciphertext size implicitly from chunks?
    // Chunks store refs (no size).
    // Let's store `file.size` as original size.
    // We will persist the encryption metadata to reconstruct.

    const file = fsEngine.createFile(state, parentId, {
        name: meta.name,
        size: buffer.length, // logical size
        mimeType: meta.mimeType,
    });

    file.chunks = chunks;

    file.encryption = {
        wrappedKey: {
            iv: wrappedKeyParams.iv.toString('hex'),
            encryptedKey: wrappedKeyParams.encryptedKey.toString('hex'),
            authTag: wrappedKeyParams.authTag.toString('hex'),
        } as any, // Cast to avoid TS error until model update
        salt: process.env.RIVAULT_SALT || '',
        // @ts-ignore
        fileIv: iv.toString('hex'),
        // @ts-ignore
        fileAuthTag: authTag.toString('hex')
    };

    await gistAdapter.saveState(state);
}

export async function downloadFile(fileId: string): Promise<Buffer> {
    const state = getState();
    if (!masterKey) throw new Error('Master Key not initialized');

    const file = state.files.get(fileId);
    if (!file) throw new Error(`File with ID ${fileId} not found`);

    // 1. Download Ciphertext
    const sortedChunks = [...file.chunks].sort((a, b) => a.order - b.order);
    const buffers: Buffer[] = [];
    for (const chunk of sortedChunks) {
        buffers.push(await telegramAdapter.downloadChunk(chunk.storageReference));
    }
    const ciphertext = Buffer.concat(buffers);

    // 2. Decrypt
    if (file.encryption) {
        // @ts-ignore
        const { wrappedKey, fileIv, fileAuthTag } = file.encryption;

        // Unwrap Data Key
        const dataKey = cryptoEngine.decryptDataKey({
            iv: Buffer.from(wrappedKey.iv, 'hex'),
            encryptedKey: Buffer.from(wrappedKey.encryptedKey, 'hex'),
            authTag: Buffer.from(wrappedKey.authTag, 'hex')
        }, masterKey);

        // Decrypt Content
        return cryptoEngine.decryptBuffer({
            iv: Buffer.from(fileIv, 'hex'),
            ciphertext,
            authTag: Buffer.from(fileAuthTag, 'hex')
        }, dataKey);
    } else {
        // Legacy/Plaintext support (if needed, or just return buffer)
        return ciphertext;
    }
}

export async function deleteFileOrFolder(nodeId: string): Promise<void> {
    const state = getState();

    // Collect chunks to delete *before* metadata is gone? 
    // No, if we delete metadata first and persist, then strictly the file is "gone" from consumer view.
    // Then we clean up storage. (Best-effort).
    // Need to gather all chunks recursively if it's a folder.

    // Create a helper to collect all IDs to be deleted (mock deletion traversal)
    // Or just traverse the state before calling fsEngine.deleteNode
    // Actually fsEngine.deleteNode modifies state immediately.
    // So we should verify what is being deleted first.

    const chunksToDelete: string[] = [];

    const collectChunks = (id: string) => {
        if (state.files.has(id)) {
            const f = state.files.get(id);
            f?.chunks.forEach(c => chunksToDelete.push(c.storageReference));
        } else if (state.folders.has(id)) {
            // Recursive find children
            // We can iterate the map or use listFolder if we haven't deleted yet.
            // listFolder requires the folder ID.
            // Since `listFolder` implementation in fs-engine iterates maps, it's safe.
            try {
                const children = fsEngine.listFolder(state, id);
                children.forEach(c => collectChunks(c.id));
            } catch (e) {
                // Ignore if folder not found during recursion (race condition safety)
            }
        }
    };

    collectChunks(nodeId);

    // 1. Delete Metadata
    fsEngine.deleteNode(state, nodeId);

    // 2. Persist State
    await gistAdapter.saveState(state);

    // 3. Storage Cleanup (Best-effort)
    // We do not await this or we do? Prompt says "Attempt best-effort deletion... (do not fail operation)".
    // So we catch errors.
    Promise.allSettled(chunksToDelete.map(ref => telegramAdapter.deleteChunk(ref)));
}

export async function renameNode(nodeId: string, newName: string): Promise<void> {
    const state = getState();
    fsEngine.renameNode(state, nodeId, newName);
    await gistAdapter.saveState(state);
}

export async function moveNode(nodeId: string, newParentId: string): Promise<void> {
    const state = getState();
    fsEngine.moveNode(state, nodeId, newParentId);
    await gistAdapter.saveState(state);
}
