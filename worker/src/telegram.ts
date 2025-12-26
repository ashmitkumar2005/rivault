/**
 * TELEGRAM ADAPTER (Worker Compatible)
 */

export interface TelegramConfig {
    botToken: string;
    chatId: string;
}

export interface ChunkRef {
    storageReference: string;
    size: number;
}

export async function uploadChunk(
    data: Uint8Array,
    config: TelegramConfig
): Promise<ChunkRef> {
    const formData = new FormData();
    formData.append('chat_id', config.chatId);

    // Create Blob from Uint8Array
    const blob = new Blob([data as any], { type: 'application/octet-stream' });
    formData.append('document', blob, 'chunk.bin');

    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
        method: 'POST',
        body: formData
    });

    if (!res.ok) {
        throw new Error(`Telegram upload failed: ${res.status}`);
    }

    const result: any = await res.json();
    if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
    }

    const messageId = result.result.message_id;
    const fileId = result.result.document.file_id;

    return {
        storageReference: `${messageId}:${fileId}`,
        size: data.length
    };
}

export async function downloadChunk(
    storageReference: string,
    config: TelegramConfig
): Promise<ReadableStream | null> {
    const fileId = storageReference.split(':')[1];

    // 1. Get File Path
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getFile?file_id=${fileId}`);
    if (!res.ok) return null;

    const json: any = await res.json();
    if (!json.ok) return null;

    const filePath = json.result.file_path;

    // 2. Download Stream
    const fileRes = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`);
    if (!fileRes.ok || !fileRes.body) return null;

    return fileRes.body;
}
