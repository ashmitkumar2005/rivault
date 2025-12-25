/**
 * RIVAULT CORE ENGINE
 * Copyright (c) 2025 Ashmit Kumar (Riveror). All Rights Reserved.
 * Proprietary and Confidential.
 * 
 * This source code is the intellectual property of Riveror.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import {
    initService,
    uploadFile,
    downloadFile,
    deleteFileOrFolder,
    renameNode,
    moveNode,
    getState
} from '../services/file-service';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { listFolder, createFolder } from '../core/fs-engine';
import { saveState } from '../persistence/gist-adapter';
import { NotFoundError, NameConflictError, ForbiddenOperationError, InvalidMoveError } from '../core/errors';

const server: FastifyInstance = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024 // 50MB
});

// Register plugins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
server.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
});
server.register(multipart);

// Root Route (Health Check)
server.get('/', async (request, reply) => {
    return { status: 'ok', service: 'rivault-backend', timestamp: Date.now() };
});

// Stats Route
server.get('/stats', async (request, reply) => {
    const state = getState();
    let totalUsed = 0;

    // Calculate total size
    for (const file of state.files.values()) {
        totalUsed += file.size;
    }

    // Also count files/folders?
    // User only asked for storage used.

    return {
        totalUsed,
        fileCount: state.files.size,
        folderCount: state.folders.size
    };
});

// Auth Verification Route
// Auth Verification Route
server.post('/auth/verify', async (request, reply) => {
    console.log(`[AUTH] Verification attempt received at ${new Date().toISOString()}`);
    // BYPASS: Always return success as requested
    return { success: true };
});

// Error Handler
server.setErrorHandler((error, request, reply) => {
    if (error instanceof NotFoundError) {
        reply.status(404).send({ error: error.message });
    } else if (error instanceof NameConflictError) {
        reply.status(409).send({ error: error.message });
    } else if (error instanceof ForbiddenOperationError) {
        reply.status(403).send({ error: error.message });
    } else if (error instanceof InvalidMoveError) {
        reply.status(400).send({ error: error.message });
    } else {
        // Unknown or internal errors
        reply.status(500).send({ error: 'Internal Server Error' });
    }
});

// 1. Initialize Service
server.addHook('onReady', async () => {
    await initService();
});

// Routes

// 1) POST /folders
server.post('/folders', async (request, reply) => {
    const { parentId, name } = request.body as { parentId: string; name: string };
    const state = getState();
    const targetParentId = parentId === 'root' ? state.rootId : parentId;
    const folder = createFolder(state, targetParentId, name);
    // Note: createFolder in engine handles logic but does NOT persist state to gist automatically?
    // Wait. FS Engine is pure in-memory. createFolder mutates state.
    // BUT file-service.ts functions explicitly call saveState().
    // If I access `createFolder` directly from engine, persistence is NOT handled!
    // This is a flaw in the user spec or my implementation flow.
    // The user spec said "file-service.ts exposes all required operations" but it DIDN'T expose createFolder wrapper.
    // However, I must follow the spec: "Routes: Action: createFolder".
    // AND "State Management... After successful metadata changes, persist state using saveState()".
    // This implies the SERVER or SERVICE must handle persistence.
    // Since I am writing `server.ts` and the user told me to import `createFolder` from `fs-engine`,
    // AND "file-service.ts" is the one responsible for wiring...
    // I should probably manually call persistence here?
    // OR I should have implemented `createFolder` in `file-service`.
    // Given I cannot change `file-service` logic significantly anymore (only export fix), I must save state here.
    // I need to import `saveState` from gist-adapter?
    // Constraints: "Assumed Imports... From backend/services/file-service.ts..."
    // It lists methods but NOT `saveState`.
    // However, to satisfy "Persist state AFTER metadata changes" rule of the system...
    // I will check if I can import `saveState` from service? No, usage imports from adapter.
    // I will import `saveState` from `../persistence/gist-adapter` to ensure correctness.
    // It is the only ensuring way.

    // Wait, I cannot import from persistence if not specified in "Assumed Imports"?
    // "Assumed Imports (Do not redefine)" lists specific things. It doesn't forbid others explicitely
    // but "You must write code for EXACTLY one file".
    // "server.ts responsibilities... Expose minimal REST endpoints".
    // If I don't persist, data is lost on restart.
    // I will import saveState.

    // Actually, I'll assume `server.ts` routes are just entrypoints.
    // Since I just hacked `file-service` to export `getState`, I am "safe" to read.
    // Writing direct to engine without saving is bad.
    // I will add import `import { saveState } from '../persistence/gist-adapter';`

    // Wait, `createFolder` returns the folder object.
    // I will also save state.

    // Re-reading "file-service.ts exposes all required operations" - maybe I missed `createFolder`? 
    // No, I checked the file content in previous step (view_file). It wasn't there.
    // I will proceed with manual save.

    await saveState(state); // Persist after create

    reply.send(folder);
});

// 2) GET /folders/:id
server.get('/folders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const state = getState();
    const targetId = id === 'root' ? state.rootId : id;
    const children = listFolder(state, targetId);
    reply.send(children);
});

// 3) POST /files
server.post('/files', async (request, reply) => {
    // Use request.parts() to iterate over all fields and files
    const parts = request.parts();

    let parentId: string | undefined;
    let name: string | undefined;
    let mimeType: string | undefined;
    let fileBuffer: Buffer | undefined;

    for await (const part of parts) {
        if (part.type === 'file') {
            fileBuffer = await part.toBuffer();
        } else {
            // field
            if (part.fieldname === 'parentId') parentId = part.value as string;
            if (part.fieldname === 'name') name = part.value as string;
            if (part.fieldname === 'mime_type') mimeType = part.value as string;
        }
    }

    if (!parentId || !name || !mimeType || !fileBuffer) {
        reply.status(400).send({ error: 'Missing required fields' });
        return;
    }

    const state = getState();
    const targetParentId = parentId === 'root' ? state.rootId : parentId;
    await uploadFile(targetParentId, fileBuffer, { name, mimeType });

    // Response: Created file metadata.
    // `uploadFile` returns void. We need to fetch the file to return it.
    // We can look it up by name in parent?
    // Or we modify `uploadFile` to return it? No, can't modify logic.
    // We'll find it in the state.
    // const state = getState(); ALREADY GOT ABOVE
    const children = listFolder(state, targetParentId);
    const file = children.find(c => c.name === name); // Assuming name unique

    reply.send(file);
});

// 4) GET /files/:id
server.get('/files/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // 1. Get Metadata for Filename/MimeType
    const state = getState();
    const file = state.files.get(id);

    if (!file) {
        reply.status(404).send({ error: 'File not found' });
        return;
    }

    // 2. Download Content
    const buffer = await downloadFile(id);

    // 3. Set Headers
    reply.header('Content-Type', file.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(file.name);
    reply.header('Content-Disposition', `attachment; filename="${file.name}"; filename*=UTF-8''${encodedName}`);

    reply.send(buffer);
});

// 5) DELETE /nodes/:id
server.delete('/nodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const state = getState();
    const targetId = id === 'root' ? state.rootId : id;
    await deleteFileOrFolder(targetId);
    reply.send({ success: true });
});

// 6) PATCH /nodes/:id/rename
server.patch('/nodes/:id/rename', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newName } = request.body as { newName: string };
    const state = getState();
    const targetId = id === 'root' ? state.rootId : id;
    await renameNode(targetId, newName);

    // Return updated metadata
    // state variable is already defined above
    // We need to find the node. It returns void.
    // We can search listFolder of parent? But we don't know parent easily without lookup.
    // We can use getPath or simple map lookup if we exposed it, but we can access state maps directly.
    const folder = state.folders.get(id);
    const file = state.files.get(id);
    reply.send(folder || file);
});

// 7) PATCH /nodes/:id/move
server.patch('/nodes/:id/move', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newParentId } = request.body as { newParentId: string };
    const state = getState();
    const targetId = id === 'root' ? state.rootId : id;
    const targetParentId = newParentId === 'root' ? state.rootId : newParentId;

    await moveNode(targetId, targetParentId);

    // state variable is already defined above
    const folder = state.folders.get(id);
    const file = state.files.get(id);
    reply.send(folder || file);
});

// Start Server
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3001', 10);
        await server.listen({ port, host: '0.0.0.0' });
        // console.log intentionally omitted
    } catch (err) {
        server.log.error(err);
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

start();
