import { describe, it, expect } from 'vitest';
import * as bip39 from 'bip39';
import { EntropyEngine } from '../entropy.js';

describe('BIP39 Modern Entropy Engine', () => {


  describe('BIP39 Modern Entropy Engine (Strict 128-Bit)', () => {

    it('Fails safely on insufficient entropy (<128 bits)', () => {
      const hexEntropy = '0000000000000000'; // Only 16 hex chars = 64 bits
      expect(() => {
        EntropyEngine.generatePure('hex', hexEntropy);
      }).toThrow(/Fatal/);
    });

    it('Parses exact 128-bit Hex string via literal byte extraction', () => {
      const hexEntropy = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // Exactly 32 chars = 128 bits, non-repetitive
      const buffer = EntropyEngine.generatePure('hex', hexEntropy);
      expect(buffer.length).toBe(16);
      expect(Buffer.from(buffer).toString('hex')).toBe(hexEntropy);
    });

    it('Parses exact 128-bit Binary string via literal byte extraction', () => {
      const binEntropy = '10101011110011011110111100000001001000110100010101100111100010011010101111001101111011110000000100100011010001010110011110001001'; // 128 bits
      const buffer = EntropyEngine.generatePure('binary', binEntropy);
      expect(buffer.length).toBe(16);
      
      let hexResult = '';
      for (let i = 0; i < 16; i++) {
        hexResult += buffer[i].toString(16).padStart(2, '0');
      }
      
      let expectedHex = '';
      for (let i = 0; i < binEntropy.length; i += 8) {
        expectedHex += parseInt(binEntropy.substring(i, i + 8), 2).toString(16).padStart(2, '0');
      }
      
      expect(hexResult).toBe(expectedHex);
    });

    it('Hashes >128 bits of Hex to a 16-byte Buffer (128 bits)', () => {
      const input = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 64 hex chars = 256 bits
      const buffer = EntropyEngine.generatePure('hex', input);
      expect(buffer.length).toBe(16); // Strict 128-bit output
    });

    it('Hashes >128 bits of Binary to a 16-byte Buffer (128 bits)', () => {
      const binEntropy = '101010111100110111101111000000010010001101000101011001111000100110101011110011011110111100000001001000110100010101100111100010011010'; // > 128 bits
      const buffer = EntropyEngine.generatePure('binary', binEntropy);
      expect(buffer.length).toBe(16); // Strict 128-bit output
    });

});

});
