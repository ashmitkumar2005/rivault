import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const STORAGE_DIR = process.env.RIVAULT_LOCAL_STORAGE_PATH || path.join(process.cwd(), '.rivault_storage');
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB

interface ChunkRef {
    storageReference: string;
    size: number;
}

async function ensureStorageDir(): Promise<void> {
    try {
        await fs.access(STORAGE_DIR);
    } catch {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
}

export async function uploadChunk(buffer: Buffer): Promise<ChunkRef> {
    if (buffer.length > MAX_CHUNK_SIZE) {
        throw new Error(`Chunk size ${buffer.length} exceeds limit of ${MAX_CHUNK_SIZE}`);
    }

    await ensureStorageDir();

    const fileId = crypto.randomUUID();
    const filePath = path.join(STORAGE_DIR, fileId);

    await fs.writeFile(filePath, buffer);

    return {
        storageReference: fileId,
        size: buffer.length,
    };
}

export async function downloadChunk(storageReference: string): Promise<Buffer> {
    const filePath = path.join(STORAGE_DIR, storageReference);
    
    try {
        const buffer = await fs.readFile(filePath);
        return buffer;
    } catch (error: any) {
        throw new Error(`Failed to read chunk ${storageReference} from local disk: ${error.message}`);
    }
}

export async function deleteChunk(storageReference: string): Promise<void> {
    const filePath = path.join(STORAGE_DIR, storageReference);
    
    try {
        await fs.unlink(filePath);
    } catch (error) {
        // Ignore all errors as per "best-effort" deletion
    }
}
