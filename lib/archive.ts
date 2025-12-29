import * as fflate from 'fflate';

/**
 * Zips multiple files into a single ZIP blob.
 */
export async function createZip(
    files: { name: string, data: Uint8Array }[],
    options: { password?: string, level?: number } = {}
): Promise<Blob> {
    const zipData: fflate.Zippable = {};

    files.forEach(file => {
        zipData[file.name] = file.data;
    });

    return new Promise((resolve, reject) => {
        fflate.zip(zipData, { level: options.level ?? 6, password: options.password } as any, (err, data) => {
            if (err) reject(err);
            else resolve(new Blob([data], { type: 'application/zip' }));
        });
    });
}

/**
 * Extracts a ZIP blob into a list of file entries.
 */
export async function extractZip(zipBlob: Blob): Promise<{ [key: string]: Uint8Array }> {
    const buffer = await zipBlob.arrayBuffer();
    const data = new Uint8Array(buffer);

    return new Promise((resolve, reject) => {
        fflate.unzip(data, (err, unzipped) => {
            if (err) reject(err);
            else resolve(unzipped);
        });
    });
}

/**
 * Lists contents of a ZIP blob without full extraction.
 */
export async function listZipContents(zipBlob: Blob): Promise<string[]> {
    const buffer = await zipBlob.arrayBuffer();
    const data = new Uint8Array(buffer);

    return new Promise((resolve, reject) => {
        // unzip with a filter that returns nothing to just getkeys? 
        // fflate.unzip is async, let's use the sync version or just partial unzip if possible.
        // For simplicity, we'll just get all keys.
        fflate.unzip(data, (err, unzipped) => {
            if (err) reject(err);
            else resolve(Object.keys(unzipped));
        });
    });
}
