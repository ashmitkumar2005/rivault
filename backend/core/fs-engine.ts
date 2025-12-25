/**
 * RIVAULT CORE ENGINE
 * Copyright (c) 2025 Ashmit Kumar (Riveror). All Rights Reserved.
 * Proprietary and Confidential.
 * 
 * This source code is the intellectual property of Riveror.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { FSState, Folder, File, Chunk } from './models';
import {
    NotFoundError,
    NameConflictError,
    InvalidMoveError,
    ForbiddenOperationError,
} from './errors';

// Simple ID generator
function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function initFS(): FSState {
    const rootId = generateId();
    const rootFolder: Folder = {
        id: rootId,
        parentId: null,
        name: 'Rivault',
        createdAt: Date.now(),
    };

    return {
        rootId,
        folders: new Map([[rootId, rootFolder]]),
        files: new Map(),
    };
}

export function listFolder(state: FSState, folderId: string): (Folder | File)[] {
    if (!state.folders.has(folderId)) {
        throw new NotFoundError(`Folder with ID ${folderId} not found`);
    }

    const result: (Folder | File)[] = [];

    for (const folder of state.folders.values()) {
        if (folder.parentId === folderId) {
            result.push(folder);
        }
    }

    for (const file of state.files.values()) {
        if (file.parentId === folderId) {
            result.push(file);
        }
    }

    return result;
}

export function createFolder(state: FSState, parentId: string, name: string): Folder {
    if (!state.folders.has(parentId)) {
        throw new NotFoundError(`Parent folder with ID ${parentId} not found`);
    }

    // Check unique sibling name
    const children = listFolder(state, parentId);
    for (const child of children) {
        if (child.name === name) {
            throw new NameConflictError(`Name "${name}" already exists in folder ${parentId}`);
        }
    }

    const id = generateId();
    const newFolder: Folder = {
        id,
        parentId,
        name,
        createdAt: Date.now(),
    };

    state.folders.set(id, newFolder);
    return newFolder;
}

export function createFile(
    state: FSState,
    parentId: string,
    fileMeta: { name: string; size: number; mimeType: string }
): File {
    if (!state.folders.has(parentId)) {
        throw new NotFoundError(`Parent folder with ID ${parentId} not found`);
    }

    const children = listFolder(state, parentId);
    for (const child of children) {
        if (child.name === fileMeta.name) {
            throw new NameConflictError(`Name "${fileMeta.name}" already exists in folder ${parentId}`);
        }
    }

    const id = generateId();
    const newFile: File = {
        id,
        parentId,
        name: fileMeta.name,
        size: fileMeta.size,
        chunkSize: 20 * 1024 * 1024, // 20MB Default
        mimeType: fileMeta.mimeType,
        chunks: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    state.files.set(id, newFile);
    return newFile;
}

export function renameNode(state: FSState, nodeId: string, newName: string): void {
    const folder = state.folders.get(nodeId);
    const file = state.files.get(nodeId);
    const node = folder || file;

    if (!node) {
        throw new NotFoundError(`Node with ID ${nodeId} not found`);
    }

    if (node.id === state.rootId) {
        throw new ForbiddenOperationError("Cannot rename root folder");
    }

    // Use '!' because only Root has null parentId, and we checked it's not root above.
    const parentId = node.parentId!;

    const siblings = listFolder(state, parentId);
    for (const sibling of siblings) {
        if (sibling.id !== nodeId && sibling.name === newName) {
            throw new NameConflictError(`Name "${newName}" already exists in destination`);
        }
    }

    node.name = newName;
}

export function moveNode(state: FSState, nodeId: string, newParentId: string): void {
    const folder = state.folders.get(nodeId);
    const file = state.files.get(nodeId);
    const node = folder || file;

    if (!node) {
        throw new NotFoundError(`Node with ID ${nodeId} not found`);
    }

    if (!state.folders.has(newParentId)) {
        throw new NotFoundError(`Destination folder ${newParentId} not found`);
    }

    if (node.id === state.rootId) {
        throw new ForbiddenOperationError("Cannot move root folder");
    }

    // Cycle detection for folders
    if (folder) {
        let currentAncestorId: string | null = newParentId;
        while (currentAncestorId) {
            if (currentAncestorId === nodeId) {
                throw new InvalidMoveError("Cannot move folder into its own descendant");
            }
            const ancestor = state.folders.get(currentAncestorId);
            currentAncestorId = ancestor ? ancestor.parentId : null;
        }
    }

    // Name uniqueness in destination
    const siblings = listFolder(state, newParentId);
    for (const sibling of siblings) {
        if (sibling.name === node.name) {
            throw new NameConflictError(`Name "${node.name}" collision in destination folder`);
        }
    }

    node.parentId = newParentId;
}

export function deleteNode(state: FSState, nodeId: string): void {
    if (nodeId === state.rootId) {
        throw new ForbiddenOperationError("Cannot delete root folder");
    }

    if (state.files.has(nodeId)) {
        state.files.delete(nodeId);
        return;
    }

    if (state.folders.has(nodeId)) {
        // Recursive delete
        // We should find all children first
        const children = listFolder(state, nodeId);
        for (const child of children) {
            deleteNode(state, child.id);
        }
        state.folders.delete(nodeId);
        return;
    }

    throw new NotFoundError(`Node with ID ${nodeId} not found`);
}

export function getPath(state: FSState, nodeId: string): string {
    let currentId: string | null = nodeId;
    const pathSegments: string[] = [];

    while (currentId) {
        const folder = state.folders.get(currentId);
        const file = state.files.get(currentId);
        const node = folder || file;

        if (!node) {
            // This indicates a broken parent link or deleted ancestor if we are traversing up
            throw new NotFoundError(`Broken path: Node ${currentId} not found`);
        }

        pathSegments.unshift(node.name);

        if (folder) {
            currentId = folder.parentId;
        } else if (file) {
            currentId = file.parentId;
        }
    }

    return "/" + pathSegments.join("/");
}
