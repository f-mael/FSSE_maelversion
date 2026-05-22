/**
 * Fallout Shelter Save File Inspector
 * READ-ONLY ANALYSIS & INSPECTION TOOL
 */
class SaveFileInspector {
    constructor() { this.fileData = this.fileName = this.encodingType = null; this.fileSize = 0; this.isDecoded = false; this.analysisResults = {}; }

    loadEncodedFile(buffer, name) {
        this.fileName = name; this.fileSize = buffer.byteLength;
        try {
            const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
            if (this.isBase64(text)) { this.encodingType = 'base64'; this.fileData = this.decodeBase64(text); this.isDecoded = true; return true; }
            this.fileData = buffer; this.encodingType = 'binary'; this.isDecoded = true; return true;
        } catch (e) { console.error('Error loading file:', e); return false; }
    }

    isBase64(str) { try { return /^[A-Za-z0-9+/=\s]*$/.test(str) && (str.length % 4 === 0 || str.replace(/\s/g, '').length % 4 === 0); } catch { return false; } }
    
    decodeBase64(str) {
        const bStr = atob(str.replace(/\s/g, '')), bytes = new Uint8Array(bStr.length);
        for (let i = 0; i < bStr.length; i++) bytes[i] = bStr.charCodeAt(i);
        return bytes;
    }

    analyzeHeader() {
        return !this.fileData ? null : { fileSize: this.fileSize, encoding: this.encodingType, firstBytes: this.bytesToHex(this.fileData.slice(0, 16)), lastBytes: this.bytesToHex(this.fileData.slice(-16)), magicBytes: this.identifyMagic(), isCompressed: this.checkCompression(), isLikelyEncrypted: this.checkEncryption() };
    }

    bytesToHex(bytes) { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '); }

    identifyMagic() {
        const sigs = { 'gzip': [0x1f, 0x8b], 'zlib': [0x78, 0x9c], 'zip': [0x50, 0x4b], 'json': [0x7b, 0x22], 'json-array': [0x5b], 'png': [0x89, 0x50, 0x4e, 0x47] };
        for (const [type, sig] of Object.entries(sigs)) if (this.bytesMatch(sig)) return type;
        return 'unknown';
    }

    bytesMatch(sig) {
        if (this.fileData.length < sig.length) return false;
        for (let i = 0; i < sig.length; i++) if (this.fileData[i] !== sig[i]) return false;
        return true;
    }

    checkCompression() { return ['gzip', 'zlib', 'zip'].includes(this.identifyMagic()); }
    checkEncryption() { return this.calculateEntropy(this.fileData.slice(0, Math.min(1000, this.fileData.length))) > 7.0; }

    calculateEntropy(bytes) {
        const freq = new Map();
        for (let i = 0; i < bytes.length; i++) freq.set(bytes[i], (freq.get(bytes[i]) || 0) + 1);
        let ent = 0;
        for (const count of freq.values()) { const p = count / bytes.length; ent -= p * Math.log2(p); }
        return ent;
    }

    extractStrings(minLen = 4) {
        if (!this.fileData) return [];
        const strings = []; let cur = '', start = 0;
        for (let i = 0; i < this.fileData.length; i++) {
            const b = this.fileData[i];
            if (b >= 32 && b <= 126) { if (cur === '') start = i; cur += String.fromCharCode(b); }
            else { if (cur.length >= minLen) strings.push({ string: cur, offset: start, length: cur.length }); cur = ''; }
        }
        if (cur.length >= minLen) strings.push({ string: cur, offset: start, length: cur.length });
        return strings;
    }

    generateReport() {
        const h = this.analyzeHeader(), strs = this.extractStrings();
        return { fileName: this.fileName, fileSize: this.fileSize, encoding: this.encodingType, analysis: h, readableStrings: strs.slice(0, 50), statistics: { totalStrings: strs.length, largestString: strs.length ? Math.max(...strs.map(s => s.length)) : 0, entropy: this.calculateEntropy(this.fileData.slice(0, Math.min(10000, this.fileData.length))) }, warnings: this.generateWarnings(h), dataTypes: this.identifyDataTypes() };
    }

    generateWarnings(h) {
        const w = [];
        if (h.isLikelyEncrypted) w.push('⚠️ File appears to be encrypted or heavily compressed', '→ Cannot safely analyze internal structure', '→ Format may be proprietary');
        if (h.magicBytes === 'unknown') w.push('⚠️ Unknown file format signature', '→ Not standard gzip, zlib, JSON, or ZIP', '→ Likely custom or proprietary format');
        w.push('⚠️ This is a READ-ONLY analysis tool', '→ No modifications are performed', '→ No paid content can be unlocked', '→ Educational purposes only');
        return w;
    }

    identifyDataTypes() { return { likelyNumbers: this.countLikelyNumbers(), likelyStrings: this.extractStrings().length, compressedBlocks: this.countPossibleCompressedBlocks() }; }

    countLikelyNumbers() {
        if (!this.fileData) return 0;
        let c = 0; const s = this.fileData.slice(0, Math.min(5000, this.fileData.length));
        for (let i = 0; i < s.length - 3; i++) if (s[i] < 100 && s[i + 1] < 100) c++;
        return Math.floor(c / 10);
    }

    countPossibleCompressedBlocks() {
        let c = 0; const s = this.fileData.slice(0, Math.min(10000, this.fileData.length));
        for (let i = 0; i < s.length - 10; i++) if (this.calculateEntropy(s.slice(i, i + 32)) > 6.5) c++;
        return c;
    }

    exportJSON() { return JSON.stringify(this.generateReport(), null, 2); }

    exportHTML() {
        const r = this.generateReport();
        return `<html><head><title>Fallout Shelter Save File Analysis</title><style>body{font-family:monospace;margin:20px;background:#1e1e1e;color:#d4d4d4}.header{background:#0e639c;padding:15px;margin-bottom:20px;border-radius:5px}.section{background:#252526;padding:15px;margin:15px 0;border-left:4px solid #0e639c}.warning{color:#ff9800;font-weight:bold}.info{color:#4fc3f7}.stat{color:#81c784}table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #404040;text-align:left}code{background:#1e1e1e;padding:2px 6px;border-radius:3px}</style></head><body><div class="header"><h1>Fallout Shelter Save File Analysis</h1><p class="info">READ-ONLY EDUCATIONAL INSPECTION</p></div><div class="section"><h2>File Information</h2><p><strong>File Name:</strong> ${r.fileName}</p><p><strong>File Size:</strong> ${(r.fileSize/1024).toFixed(2)} KB</p><p><strong>Encoding:</strong> ${r.encoding}</p></div><div class="section"><h2>Analysis Results</h2><table><tr><th>Property</th><th>Value</th></tr><tr><td>Magic Bytes</td><td><code>${r.analysis.magicBytes}</code></td></tr><tr><td>Likely Encrypted</td><td class="stat">${r.analysis.isLikelyEncrypted?'✓ YES':'✗ NO'}</td></tr><tr><td>Likely Compressed</td><td class="stat">${r.analysis.isCompressed?'✓ YES':'✗ NO'}</td></tr><tr><td>Entropy (0-8)</td><td class="stat">${r.statistics.entropy.toFixed(2)}</td></tr></table></div><div class="section"><h2>Warnings & Notes</h2><ul>${r.warnings.map(w=>`<li class="warning">${w}</li>`).join('')}</ul></div><div class="section"><h2>Readable Strings Found (First 50)</h2><table><tr><th>Offset</th><th>Length</th><th>String</th></tr>${r.readableStrings.slice(0,50).map(s=>`<tr><td>0x${s.offset.toString(16).toUpperCase().padStart(8,'0')}</td><td>${s.length}</td><td><code>${s.string}</code></td></tr>`).join('')}</table></div><div class="section"><h2>Statistics</h2><p class="info">Total Readable Strings: ${r.statistics.totalStrings}</p><p class="info">Largest String: ${r.statistics.largestString} characters</p><p class="info">Estimated Numeric Blocks: ${r.dataTypes.likelyNumbers}</p></div><div class="section" style="background:#3f3f00;border-left-color:#ff9800"><h2>⚠️ IMPORTANT NOTICE</h2><p>This analysis is for <strong>EDUCATIONAL PURPOSES ONLY</strong>.</p><ul><li>✅ Read-only inspection tool</li><li>✅ Understanding game file structures</li><li>❌ Do NOT modify paid content</li><li>❌ Do NOT bypass license restrictions</li><li>❌ Respect Terms of Service</li></ul></div></body></html>`;
    }
}
if (typeof module !== 'undefined' && module.exports) module.exports = SaveFileInspector;