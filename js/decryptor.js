/**
 * Fallout Shelter Save File Decryption/Encryption
 * Based on https://github.com/rakion99/shelter-editor
 * Uses AES-CBC encryption with SJCL library
 */

const SHELTER_KEY = [2815074099, 1725469378, 4039046167, 874293617, 3063605751, 3133984764, 4097598161, 3620741625];
const SHELTER_IV = sjcl.codec.hex.toBits("7475383967656A693334307438397532");

// Enable CBC mode warning suppression
sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();

class SaveDecryptor {
    /**
     * Decrypt a Fallout Shelter save file
     * @param {string} base64String - Base64 encoded encrypted data
     * @param {string} fileName - Original filename
     * @returns {object} { success: boolean, data: object|null, error: string|null }
     */
    static decrypt(base64String, fileName) {
        try {
            const plainBits = sjcl.mode.cbc.decrypt(
                new sjcl.cipher.aes(SHELTER_KEY),
                sjcl.codec.base64.toBits(base64String),
                SHELTER_IV
            );
            return { success: true, data: JSON.parse(sjcl.codec.utf8String.fromBits(plainBits)), error: null };
        } catch (error) {
            return { success: false, data: null, error: `Decryption failed: ${error.message}` };
        }
    }

    /**
     * Encrypt data back to Fallout Shelter save file format
     * @param {object} jsonData - The save file data as object
     * @returns {object} { success: boolean, data: string|null, error: string|null }
     */
    static encrypt(jsonData) {
        try {
            const cipherBits = sjcl.mode.cbc.encrypt(
                new sjcl.cipher.aes(SHELTER_KEY),
                sjcl.codec.utf8String.toBits(JSON.stringify(jsonData)),
                SHELTER_IV
            );
            return { success: true, data: sjcl.codec.base64.fromBits(cipherBits), error: null };
        } catch (error) {
            return { success: false, data: null, error: `Encryption failed: ${error.message}` };
        }
    }

    /**
     * Instance method for compatibility
     */
    attemptDecrypt(buffer, fileName) {
        try {
            const base64Str = buffer instanceof ArrayBuffer 
                ? new TextDecoder().decode(buffer) 
                : buffer;
            return SaveDecryptor.decrypt(base64Str, fileName);
        } catch (error) {
            return { success: false, data: null, error: `Error: ${error.message}` };
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaveDecryptor;
}
