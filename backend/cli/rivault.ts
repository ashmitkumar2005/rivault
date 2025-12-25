#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
// Note: fetch, Blob, FormData are global in Node.js 18+

const API_URL = process.env.RIVAULT_API_URL || 'http://localhost:3001';

// Types
interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}
interface File {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
}
type NodeItem = Folder | File;

// Helpers
function printError(msg: string) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(ts: number) {
  return new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
}

// API Wrappers
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (!res.ok) {
      // Try to parse error message
      let errorText = res.statusText;
      try {
        const json = await res.json();
        if (json.error) errorText = json.error;
      } catch (e) {
        // ignore JSON parse error
      }
      printError(`API Request Failed: ${res.status} ${errorText}`);
    }
    return res;
  } catch (err: any) {
    printError(`Network Error: ${err.message}`);
    // Unreachable due to printError exiting, but typescript needs return
    throw err;
  }
}

// Commands
async function cmdLs(folderId: string) {
  if (!folderId) printError('Usage: rivault ls <folderId>');

  const res = await apiFetch(`/folders/${folderId}`);
  const items: NodeItem[] = await res.json();

  console.log(`Contents of folder: ${folderId}\n`);

  if (items.length === 0) {
    console.log('(empty)');
    return;
  }

  // Simple formatting
  console.log('ID'.padEnd(20) + 'TYPE'.padEnd(10) + 'SIZE'.padEnd(12) + 'UPDATED'.padEnd(22) + 'NAME');
  console.log('-'.repeat(80));

  for (const item of items) {
    const isFolder = !('size' in item);
    const type = isFolder ? 'DIR' : 'FILE';
    const size = isFolder ? '-' : formatSize((item as File).size);
    const date = formatDate(item.createdAt);
    const id = item.id.substring(0, 18) + '..'; // Truncate ID for view

    console.log(
      id.padEnd(20) +
      type.padEnd(10) +
      size.padEnd(12) +
      date.padEnd(22) +
      item.name
    );
  }
}

async function cmdUpload(folderId: string, filePath: string) {
  if (!folderId || !filePath) printError('Usage: rivault upload <folderId> <filePath>');

  if (!fs.existsSync(filePath)) {
    printError(`File not found: ${filePath}`);
  }

  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);

  // Basic mime type detection
  const ext = path.extname(fileName).toLowerCase();
  let mimeType = 'application/octet-stream';
  if (ext === '.txt') mimeType = 'text/plain';
  else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.pdf') mimeType = 'application/pdf';
  else if (ext === '.json') mimeType = 'application/json';

  const formData = new FormData();
  formData.append('parentId', folderId);
  formData.append('name', fileName);
  formData.append('mime_type', mimeType);

  // Convert buffer to Blob
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, fileName);

  console.log(`Uploading ${fileName}...`);
  const res = await apiFetch('/files', {
    method: 'POST',
    body: formData
  });

  const file: File = await res.json();
  console.log(`Success! File ID: ${file.id}`);
}

async function cmdDownload(fileId: string, outputPath: string) {
  if (!fileId || !outputPath) printError('Usage: rivault download <fileId> <outputPath>');

  console.log(`Downloading file ${fileId}...`);
  const res = await apiFetch(`/files/${fileId}`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved to ${outputPath}`);
}

async function cmdRm(nodeId: string) {
  if (!nodeId) printError('Usage: rivault rm <nodeId>');

  await apiFetch(`/nodes/${nodeId}`, {
    method: 'DELETE'
  });
  console.log(`Deleted node ${nodeId}`);
}

async function cmdRename(nodeId: string, newName: string) {
  if (!nodeId || !newName) printError('Usage: rivault rename <nodeId> <newName>');

  const res = await apiFetch(`/nodes/${nodeId}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName })
  });
  const item: NodeItem = await res.json();
  console.log(`Renamed to: ${item.name}`);
}

async function cmdMv(nodeId: string, newParentId: string) {
  if (!nodeId || !newParentId) printError('Usage: rivault mv <nodeId> <newParentId>');

  const res = await apiFetch(`/nodes/${nodeId}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newParentId })
  });
  const item: NodeItem = await res.json();
  console.log(`Moved ${item.name} to ${newParentId}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
Rivault CLI
Usage: rivault <command> [args]

Commands:
  ls <folderId>             List folder contents
  upload <folderId> <file>  Upload file
  download <fileId> <path>  Download file
  rm <nodeId>               Delete file or folder
  rename <nodeId> <name>    Rename node
  mv <nodeId> <folderId>    Move node
    `);
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'ls':
        await cmdLs(args[1]);
        break;
      case 'upload':
        await cmdUpload(args[1], args[2]);
        break;
      case 'download':
        await cmdDownload(args[1], args[2]);
        break;
      case 'rm':
        await cmdRm(args[1]);
        break;
      case 'rename':
        await cmdRename(args[1], args[2]);
        break;
      case 'mv':
        await cmdMv(args[1], args[2]);
        break;
      default:
        printError(`Unknown command: ${command}`);
    }
  } catch (err: any) {
    printError(`Unexpected Error: ${err.message}`);
  }
}

main();
