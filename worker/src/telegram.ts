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
