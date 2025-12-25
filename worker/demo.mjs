// demo.mjs
import { spawn } from 'child_process';

const WORKER_URL = 'http://127.0.0.1:8787';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(path, options = {}) {
    const res = await fetch(`${WORKER_URL}${path}`, {
        ...options,
        headers: {
            'X-Rivault-User': 'demo-user',
            ...options.headers
        }
    });
    if (!res.ok) {
        let text = await res.text();
        throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${text}`);
    }
    return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
}

async function run() {
    console.log('🔄 Waiting for Worker to be ready...');
    // Simple retry loop to wait for server
    for (let i = 0; i < 20; i++) {
        try {
            await fetchJson('/api/init');
            break;
        } catch (e) {
            await sleep(1000);
        }
    }

    console.log('\n🚀 Starting Rivault API Demo\n');

    // 1. Initialize / Get Root
    console.log('1. Fetching Root ID...');
    const { rootId } = await fetchJson('/api/init');
    console.log(`   ✅ Root ID: ${rootId}`);

    // 2. Helper to find or create folder
    async function ensureFolder(parentId, name) {
        console.log(`\nChecking folder "${name}"...`);
        // List parent to see if it exists
        const children = await fetchJson(`/api/folders/${parentId}`);
        const existing = children.find(c => c.name === name);
        if (existing) {
            console.log(`   ✅ Found existing: ${existing.id}`);
            return existing;
        }

        console.log(`   Creating "${name}"...`);
        const created = await fetchJson('/api/folders', {
            method: 'POST',
            body: JSON.stringify({ parentId, name })
        });
        console.log(`   ✅ Created: ${created.id}`);
        return created;
    }

    const docsFolder = await ensureFolder(rootId, 'Documents');
    const privateFolder = await ensureFolder(rootId, 'Private');

    // 4. Create File Metadata
    // Clean up old file if exists in either folder (since we move it around)
    async function cleanupFile(filename) {
        // Check Private
        let children = await fetchJson(`/api/folders/${privateFolder.id}`);
        let f = children.find(c => c.name === filename);
        if (f) {
            await fetchJson(`/api/nodes/${f.id}`, { method: 'DELETE' });
            console.log(`   Deleted old ${filename} from Private`);
        }

        // Check Documents
        children = await fetchJson(`/api/folders/${docsFolder.id}`);
        f = children.find(c => c.name === filename);
        if (f) {
            await fetchJson(`/api/nodes/${f.id}`, { method: 'DELETE' });
            console.log(`   Deleted old ${filename} from Documents`);
        }
    }

    await cleanupFile('secret.txt');

    console.log('\n4. Creating File "secret.txt" in Private folder...');
    const file = await fetchJson('/api/files', {
        method: 'POST',
        body: JSON.stringify({
            parentId: privateFolder.id,
            name: 'secret.txt',
            size: 1024,
            mimeType: 'text/plain',
            encryption: { generated: true }
        })
    });
    console.log(`   ✅ Created File: ${file.name} (${file.id})`);

    // 5. List Root
    console.log('\n5. Listing Root Folder...');
    const rootChildren = await fetchJson(`/api/folders/${rootId}`);
    console.log('   📂 Contents:', rootChildren.map(c => `[${c.name}]`).join(', '));

    // 6. Rename "Private" -> "Secrets"
    // Since we re-ran, "Private" might be "Secrets" already if we didn't rename it back?
    // Actually our ensureFolder looked for "Private". If we renamed it to "Secrets", ensureFolder created a NEW "Private".
    // So "Private" exists. "Secrets" might also exist if from prev run.
    // Let's delete "Secrets" if it exists to ensure rename works.
    const secretExists = rootChildren.find(c => c.name === 'Secrets');
    if (secretExists) {
        await fetchJson(`/api/nodes/${secretExists.id}`, { method: 'DELETE' });
        console.log('   Deleted old "Secrets" folder');
    }

    console.log('\n6. Renaming "Private" -> "Secrets"...');
    await fetchJson(`/api/nodes/${privateFolder.id}/rename`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Secrets' })
    });
    console.log('   ✅ Renamed');

    // 7. List Root Again
    console.log('\n7. Verifying Rename...');
    const rootChildren2 = await fetchJson(`/api/folders/${rootId}`);
    console.log('   📂 Contents:', rootChildren2.map(c => `[${c.name}]`).join(', '));

    // 8. Move "secret.txt" to "Documents"
    console.log('\n8. Moving "secret.txt" -> "Documents"...');
    await fetchJson(`/api/nodes/${file.id}/move`, {
        method: 'POST',
        body: JSON.stringify({ newParentId: docsFolder.id })
    });
    console.log('   ✅ Moved');

    // 9. List "Documents"
    console.log('\n9. Listing "Documents" Folder...');
    const docsChildren = await fetchJson(`/api/folders/${docsFolder.id}`);
    console.log('   📂 Contents:', docsChildren.map(c => c.name).join(', '));

    console.log('\n✨ Demo Complete!');
}

run().catch(err => console.error('\n❌ Demo Failed:', err));
