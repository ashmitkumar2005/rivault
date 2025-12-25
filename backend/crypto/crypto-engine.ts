import * as crypto from 'crypto';

// Constants
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32; // 256 bits
const PBKDF2_DIGEST = 'sha256';
const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const DATA_KEY_LENGTH = 32; // 256 bits

// Types
export interface EncryptedBuffer {
    iv: Buffer;
    ciphertext: Buffer;
    authTag: Buffer;
}

export interface EncryptedKey {
    iv: Buffer;
    encryptedKey: Buffer;
    authTag: Buffer;
}

/**
 * Derives a master key from a password and salt using PBKDF2.
 * @param password User provided password
 * @param salt Externally provided salt
 * @returns 32-byte Master Key
 */
export function deriveMasterKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
        password,
        salt,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST
    );
}

/**
 * Generates a random 256-bit data key.
 * @returns 32-byte Data Key
 */
export function generateDataKey(): Buffer {
    return crypto.randomBytes(DATA_KEY_LENGTH);
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * @param buffer Data to encrypt
 * @param key Encryption key (must be 32 bytes)
 * @returns EncryptedBuffer object containing IV, ciphertext, and authTag
 */
export function encryptBuffer(buffer: Buffer, key: Buffer): EncryptedBuffer {
    if (key.length !== 32) {
        throw new Error('Invalid key length: must be 32 bytes');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
        iv,
        ciphertext,
        authTag
    };
}

/**
 * Decrypts a buffer using AES-256-GCM.
 * @param encrypted EncryptedBuffer object
 * @param key Decryption key (must be 32 bytes)
 * @returns Decrypted plaintext Buffer
 */
export function decryptBuffer(
    encrypted: EncryptedBuffer,
    key: Buffer
): Buffer {
    if (key.length !== 32) {
        throw new Error('Invalid key length: must be 32 bytes');
    }

    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, encrypted.iv);
    decipher.setAuthTag(encrypted.authTag);

    const plaintext = Buffer.concat([
        decipher.update(encrypted.ciphertext),
        decipher.final()
    ]);

    return plaintext;
}

/**
 * Encrypts a Data Key using the Master Key (Key Wrapping).
 * @param dataKey The data key to wrap
 * @param masterKey The master wrapping key
 * @returns EncryptedKey object
 */
export function encryptDataKey(dataKey: Buffer, masterKey: Buffer): EncryptedKey {
    const { iv, ciphertext, authTag } = encryptBuffer(dataKey, masterKey);
    return {
        iv,
        encryptedKey: ciphertext,
        authTag
    };
}

/**
 * Decrypts a Data Key using the Master Key (Key Unwrapping).
 * @param encryptedKey The wrapped key object
 * @param masterKey The master wrapping key
 * @returns The original Data Key
 */
export function decryptDataKey(
    encryptedKey: EncryptedKey,
    masterKey: Buffer
): Buffer {
    // Reconstruct input format for decryptBuffer
    const encryptedBuffer: EncryptedBuffer = {
        iv: encryptedKey.iv,
        ciphertext: encryptedKey.encryptedKey,
        authTag: encryptedKey.authTag
    };

    return decryptBuffer(encryptedBuffer, masterKey);
}
