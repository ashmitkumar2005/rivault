/**
 * RIVAULT WORKER ENTRY POINT
 */

import { FileSystemDO } from './fs-do';
import { uploadChunk } from './telegram';

export { FileSystemDO };

export interface Env {
    FS_DO: DurableObjectNamespace;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        let url = new URL(request.url);

        // CONFIGURATION FIX:
        // If the user forgot to add "/api" to their NEXT_PUBLIC_API_URL, 
        // requests will come in as "/auth/verify" instead of "/api/auth/verify".
        // We auto-fix this here to prevent "Invalid Password" (404) errors.
        if (!url.pathname.startsWith('/api/')) {
            const newUrl = new URL(request.url);
            newUrl.pathname = '/api' + url.pathname;
            url = newUrl; // Use this normalized URL for everything
        }

        // Fix double slashes (e.g. /api//auth/verify) caused by trailing slash in config
        if (url.pathname.includes('//')) {
            const newUrl = new URL(request.url);
            newUrl.pathname = url.pathname.replace(/\/+/g, '/');
            url = newUrl;
        }

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // For dev. In prod, lock this down.
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, X-Rivault-User',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Auth Endpoint (Stub)
        if (url.pathname === '/api/auth/verify' && request.method === 'POST') {
            // In real app, check hash. Here just say yes.
            const response = new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
            // Add CORS
            response.headers.set('Access-Control-Allow-Origin', '*');
            return response;
        }

        // Identify User
        const userId = request.headers.get('X-Rivault-User') || 'default';

        // Get Durable Object for this user
        const id = env.FS_DO.idFromName(userId);
        const stub = env.FS_DO.get(id);

        // --- Handle Chunk Upload (Intercept before DO) ---
        // --- Handle Chunk Upload (Intercept before DO) ---
        // POST /api/files/:id/chunks?order=0
        if (request.method === 'POST' && url.pathname.includes('/chunks')) {
            const fileId = url.pathname.split('/')[3];
            const order = parseInt(url.searchParams.get('order') || '0');

            // Read body as ArrayBuffer (the chunk)
            const chunkData = await request.arrayBuffer();
            const chunkBytes = new Uint8Array(chunkData);

            if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
                return new Response('Server unconfigured (Missing Telegram creds)', { status: 503, headers: corsHeaders });
            }

            try {
                // Upload to Telegram
                const { storageReference, size } = await uploadChunk(chunkBytes, {
                    botToken: env.TELEGRAM_BOT_TOKEN,
                    chatId: env.TELEGRAM_CHAT_ID
                });

                // Call DO to record the chunk
                // We forward a request to the DO with the METADATA of the chunk
                const doReq = new Request(url.toString(), {
                    method: 'POST',
                    body: JSON.stringify({
                        chunk: {
                            order,
                            storageReference,
                            size
                        }
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                const doRes = await stub.fetch(doReq);
                const newDoRes = new Response(doRes.body, doRes);
                newDoRes.headers.set('Access-Control-Allow-Origin', '*');
                return newDoRes;

            } catch (err: any) {
                return new Response(`Upload error: ${err.message}`, { status: 500, headers: corsHeaders });
            }
        }

        // Forward other requests
        // IMPORTANT: We must pass the normalized URL (with /api) to the Durable Object
        const newRequest = new Request(url.toString(), request);
        const response = await stub.fetch(newRequest);

        // Re-wrap response to add CORS
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        return newResponse;
    }
};
