import { FSState, Folder, File } from '../core/models';

const GIST_ID = process.env.RIVAULT_GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME = 'rivault-fs.json';

interface PersistedFolder extends Folder { }
interface PersistedFile extends File { }

interface PersistedFSState {
    version: number;
    rootId: string;
    folders: Record<string, PersistedFolder>;
    files: Record<string, PersistedFile>;
    lastUpdated: number;
}

function validateEnv(): void {
    if (!GIST_ID) {
        throw new Error('Missing RIVAULT_GIST_ID environment variable');
    }
    if (!GITHUB_TOKEN) {
        throw new Error('Missing GITHUB_TOKEN environment variable');
    }
}

function mapToRecord<T>(map: Map<string, T>): Record<string, T> {
    const record: Record<string, T> = {};
    for (const [key, value] of map) {
        record[key] = value;
    }
    return record;
}

function recordToMap<T>(record: Record<string, T>): Map<string, T> {
    const map = new Map<string, T>();
    for (const key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            map.set(key, record[key]);
        }
    }
    return map;
}

export async function loadState(): Promise<FSState> {
    validateEnv();

    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Gist: ${response.status} ${response.statusText}`);
    }

    const gist = await response.json();
    const file = gist.files ? gist.files[GIST_FILENAME] : null;

    if (!file || !file.content) {
        throw new Error(`Gist file '${GIST_FILENAME}' not found or empty`);
    }

    if (file.truncated) {
        // If truncated, we would need to fetch the raw_url, but for this specific constraint we handle content directly for now
        // or assume we need to handle it. Given simplicity constraints, we'll try to use raw_url if content is missing/truncated logically
        // but the prompt implies simple API usage. If content is truncated, we must error or fetch raw.
        // Let's check raw_url if content seems invalid or just parse content.
        // Ideally we fetch raw content to be safe.
        const rawResponse = await fetch(file.raw_url);
        if (!rawResponse.ok) {
            throw new Error(`Failed to fetch raw Gist content: ${rawResponse.status}`);
        }
        const rawData = await rawResponse.json() as PersistedFSState;
        return parseState(rawData);
    }

    let data: PersistedFSState;
    try {
        data = JSON.parse(file.content);
    } catch (e) {
        throw new Error('Failed to parse Gist content as JSON');
    }

    return parseState(data);
}

function parseState(data: PersistedFSState): FSState {
    if (!data.version || !data.rootId || !data.folders || !data.files) {
        throw new Error('Invalid filesystem state format');
    }

    return {
        rootId: data.rootId,
        folders: recordToMap(data.folders),
        files: recordToMap(data.files),
    };
}

export async function saveState(state: FSState): Promise<void> {
    validateEnv();

    const persistedState: PersistedFSState = {
        version: 1,
        rootId: state.rootId,
        folders: mapToRecord(state.folders),
        files: mapToRecord(state.files),
        lastUpdated: Date.now(),
    };

    const content = JSON.stringify(persistedState, null, 2);

    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: {
                [GIST_FILENAME]: {
                    content: content,
                },
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to save Gist: ${response.status} ${response.statusText}`);
    }
}
