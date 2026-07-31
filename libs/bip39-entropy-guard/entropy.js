import { analyzeEntropyQuality } from './entropy-health.js';

export class EntropyEngine {
    static generatePure(type, str) {
        const health = analyzeEntropyQuality(str, type);
        if (health.status === 'flawed') {
            throw new Error(`Fatal: Entropy quality is severely flawed (e.g., <128 bits or extreme repetition). Hard-blocking derivation to prevent catastrophic funds loss.`);
        }

        let cleanedStr = '';
        let bitsCount = 0;

        if (type === 'binary') {
            const safeStr = str.replace(/0b/gi, '');
            const matches = safeStr.match(/[0-1]/g) || [];
            if (!matches.length) throw new Error("No valid binary found");
            cleanedStr = matches.join("");
            bitsCount = matches.length;
        } 
        else if (type === 'hex') {
            const safeStr = str.replace(/0x/gi, '');
            const matches = safeStr.match(/[0-9A-F]/gi) || [];
            if (!matches.length) throw new Error("No valid hex found");
            cleanedStr = matches.join("").toLowerCase();
            bitsCount = matches.length * 4;
        }

        let binStr = cleanedStr;
        if (type === 'hex') {
            binStr = cleanedStr.split('').map(x => parseInt(x, 16).toString(2).padStart(4, '0')).join('');
        }

        if (bitsCount !== 128) {
            throw new Error(`Strict Mode: Only exactly 128 bits of entropy are supported. You provided ${bitsCount} bits.`);
        }

        const buffer = new Uint8Array(16);
        for (let i = 0; i < 128; i += 8) {
            buffer[i / 8] = parseInt(binStr.substring(i, i + 8), 2);
        }
        return buffer;
    }
}
