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

        // Stats Endpoint
        if (url.pathname === '/api/stats' && request.method === 'GET') {
            const userId = request.headers.get('X-Rivault-User') || 'default';
            const id = env.FS_DO.idFromName(userId);
            const stub = env.FS_DO.get(id);

            // Forward to DO
            // Note: URL must be correct for DO routing
            const newRequest = new Request(url.toString(), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const response = await stub.fetch(newRequest);

            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            return newResponse;
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

                // BULLETPROOF FIX:
                // Instead of trying to clone/proxy the response object (which can be flaky),
                // we just check the result and return a fresh, clean Response.
                if (!doRes.ok) {
                    const errorText = await doRes.text();
                    return new Response(`DO Error: ${errorText}`, { status: doRes.status, headers: corsHeaders });
                }

                return new Response(null, { status: 200, headers: corsHeaders });

            } catch (err: any) {
                return new Response(`Upload error: ${err.message}`, { status: 500, headers: corsHeaders });
            }
        }

        // --- Handle File Download ---
        // GET /api/files/:id/download
        if (request.method === 'GET' && url.pathname.includes('/download')) {
            const fileId = url.pathname.split('/')[3];

            if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
                return new Response('Server unconfigured', { status: 503, headers: corsHeaders });
            }

            // 1. Get File Metadata from DO
            const metaReq = new Request(url.toString().replace('/download', ''), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const metaRes = await stub.fetch(metaReq);

            if (!metaRes.ok) {
                return new Response('File not found', { status: 404, headers: corsHeaders });
            }

            const file: any = await metaRes.json();
            const chunks = file.chunks || [];

            if (chunks.length === 0) {
                return new Response('File has no content', { status: 404, headers: corsHeaders });
            }

            // 2. Stream Response
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            // Background streaming task
            ctx.waitUntil((async () => {
                try {
                    // Sort chunks by order just in case
                    chunks.sort((a: any, b: any) => a.order - b.order);

                    for (const chunk of chunks) {
                        const stream = await import('./telegram').then(m => m.downloadChunk(chunk.storageReference, {
                            botToken: env.TELEGRAM_BOT_TOKEN,
                            chatId: env.TELEGRAM_CHAT_ID
                        }));

                        if (stream) {
                            // Pipe chunk stream to main response stream
                            const reader = stream.getReader();
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                await writer.write(value);
                            }
                        }
                    }
                    await writer.close();
                } catch (e) {
                    console.error('Download stream error:', e);
                    await writer.abort(e);
                }
            })());

            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set('Content-Disposition', `attachment; filename="${file.name}"`);
            responseHeaders.set('Content-Type', file.mimeType || 'application/octet-stream');
            if (file.size) {
                responseHeaders.set('Content-Length', file.size.toString());
            }

            return new Response(readable, {
                headers: responseHeaders
            });
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
