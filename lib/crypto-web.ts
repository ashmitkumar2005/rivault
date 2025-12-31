/**
 * RIVAULT CRYPTO ENGINE (Web Crypto API)
 */

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 256; // bits
const PBKDF2_DIGEST = 'SHA-256';
const AES_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits
const DATA_KEY_LENGTH = 32; // 256 bits

export interface EncryptedBuffer {
    iv: string;         // hex
    ciphertext: string; // hex
    authTag: string;    // hex
}

export interface EncryptedKey {
    iv: string;         // hex
    encryptedKey: string; // hex
    authTag: string;    // hex
}

// Utility: Convert Buffer/ArrayBuffer to Hex String
function buf2hex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

// Utility: Convert Hex String to Uint8Array
function hex2buf(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Derives a master key from a password and salt using PBKDF2.
 */
export async function deriveMasterKey(password: string, saltHex: string): Promise<CryptoKey> {
    const textEncoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password) as any,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const salt = hex2buf(saltHex);

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as any,
            iterations: PBKDF2_ITERATIONS,
            hash: PBKDF2_DIGEST
        },
        passwordKey,
        { name: AES_ALGORITHM, length: PBKDF2_KEYLEN },
        false, // Master key is not extractable
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
}

/**
 * Generates a random 256-bit data key.
 * Returns raw key bytes (for storage/transmission before wrapping) and CryptoKey object.
 */
export async function generateDataKey(): Promise<{ raw: Uint8Array, key: CryptoKey }> {
    const key = await crypto.subtle.generateKey(
        {
            name: AES_ALGORITHM,
            length: 256
        },
        true, // Extractable so we can wrap it or use the raw bytes if needed locally
        ["encrypt", "decrypt"]
    );

    const raw = await crypto.subtle.exportKey("raw", key);
    return { raw: new Uint8Array(raw), key };
}

/**
 * Encrypts data using AES-256-GCM.
 */
export async function encryptData(data: Uint8Array, key: CryptoKey): Promise<EncryptedBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Web Crypto encrypt returns ciphertext + auth tag appended at the end for GCM
    const encryptedContent = await crypto.subtle.encrypt(
        {
            name: AES_ALGORITHM,
            iv: iv as any
        },
        key,
        data as any
    );

    // Split auth tag (last 16 bytes for AES-GCM in strict mode usually, 
    // but WebCrypto 'encryptedContent' includes the tag at the end efficiently.
    // However, Node crypto separates them. To keep compatible structure (iv, ciphertext, tag),
    // we need to slice manually if we want to store them separately.
    // Standard Web Crypto output is concatenation of Ciphertext + Tag.

    const buffer = new Uint8Array(encryptedContent);
    const tagLength = 16;
    const ciphertext = buffer.slice(0, buffer.length - tagLength);
    const authTag = buffer.slice(buffer.length - tagLength);

    return {
        iv: buf2hex(iv.buffer),
        ciphertext: buf2hex(ciphertext.buffer),
        authTag: buf2hex(authTag.buffer)
    };
}

/**
 * Decrypts data using AES-256-GCM.
 */
export async function decryptData(
    encrypted: EncryptedBuffer,
    key: CryptoKey
): Promise<Uint8Array> {
    const iv = hex2buf(encrypted.iv);
    const ciphertext = hex2buf(encrypted.ciphertext);
    const authTag = hex2buf(encrypted.authTag);

    // Combine ciphertext and tag for Web Crypto
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext);
    combined.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: AES_ALGORITHM,
            iv: iv as any
        },
        key,
        combined as any
    );

    return new Uint8Array(decrypted);
}

/**
 * Wraps (encrypts) a Data Key using the Master Key.
 * We manually encrypt the raw key bytes because 'wrapKey' format support varies.
 */
export async function encryptDataKey(dataKeyRaw: Uint8Array, masterKey: CryptoKey): Promise<EncryptedKey> {
    const { iv, ciphertext, authTag } = await encryptData(dataKeyRaw, masterKey);
    return {
        iv,
        encryptedKey: ciphertext,
        authTag
    };
}

/**
 * Unwraps (decrypts) a Data Key using the Master Key.
 */
export async function decryptDataKey(
    encryptedKey: EncryptedKey,
    masterKey: CryptoKey
): Promise<CryptoKey> {
    const encryptedCommon: EncryptedBuffer = {
        iv: encryptedKey.iv,
        ciphertext: encryptedKey.encryptedKey,
        authTag: encryptedKey.authTag
    };

    const rawKeyBytes = await decryptData(encryptedCommon, masterKey);

    return await crypto.subtle.importKey(
        "raw",
        rawKeyBytes as any,
        { name: AES_ALGORITHM },
        true,
        ["encrypt", "decrypt"]
    );
}

// Helper to generate a random hex salt
export function generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return buf2hex(salt.buffer);
}
