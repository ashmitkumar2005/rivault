const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB

interface ChunkRef {
    storageReference: string;
    size: number;
}

function validateEnv(): void {
    if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
    if (!CHAT_ID) throw new Error('Missing TELEGRAM_CHAT_ID');
}

/**
 * Uploads a buffer to Telegram as a document.
 * Returns a ChunkRef containing a combined storage reference (messageId:fileId).
 */
export async function uploadChunk(buffer: Buffer): Promise<ChunkRef> {
    validateEnv();

    if (buffer.length > MAX_CHUNK_SIZE) {
        throw new Error(`Chunk size ${buffer.length} exceeds limit of ${MAX_CHUNK_SIZE}`);
    }

    const formData = new FormData();
    formData.append('chat_id', CHAT_ID!);
    // Create a Blob from the buffer. MIME type 'application/octet-stream' is generic.
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' });
    formData.append('document', blob, 'chunk.bin');

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Telegram upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
    }

    const messageId = result.result.message_id;
    const document = result.result.document;

    if (!document || !document.file_id) {
        throw new Error('Invalid Telegram response: missing document info');
    }

    // Combine message_id and file_id for storage reference.
    // Format: "messageId:fileId"
    const storageReference = `${messageId}:${document.file_id}`;

    return {
        storageReference,
        size: buffer.length,
    };
}

/**
 * Downloads a chunk from Telegram using the storage reference.
 */
export async function downloadChunk(storageReference: string): Promise<Buffer> {
    validateEnv();

    const [_, fileId] = storageReference.split(':');
    if (!fileId) {
        throw new Error('Invalid storage reference format');
    }

    // Step 1: Get file path
    const pathResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    if (!pathResponse.ok) {
        throw new Error(`Failed to get file path: ${pathResponse.status}`);
    }

    const pathResult = await pathResponse.json();
    if (!pathResult.ok || !pathResult.result.file_path) {
        throw new Error(`Telegram API error (getFile): ${pathResult.description}`);
    }

    const filePath = pathResult.result.file_path;

    // Step 2: Download content
    const contentResponse = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!contentResponse.ok) {
        throw new Error(`Failed to download file content: ${contentResponse.status}`);
    }

    const arrayBuffer = await contentResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Deletes a chunk (message) from Telegram.
 * Best-effort: swallows errors essentially/doesn't throw on API failure logic if message missing, 
 * but contract says "explicit errors" for network/API failures.
 * BUT rules say "deleteChunk is best-effort (failures should not break the system)".
 * So we will try-catch and return void.
 */
export async function deleteChunk(storageReference: string): Promise<void> {
    validateEnv();

    try {
        const [messageIdStr] = storageReference.split(':');
        const messageId = parseInt(messageIdStr, 10);

        if (isNaN(messageId)) {
            // Invalid ref, assume already gone or bad data.
            return;
        }

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                message_id: messageId
            })
        });

        // If response is not ok, we just ignore it as per "best-effort".
        // Detailed logging is forbidden.
    } catch (error) {
        // Ignore all errors
    }
}
