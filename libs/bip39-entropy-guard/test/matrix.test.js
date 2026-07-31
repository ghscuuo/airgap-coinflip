import { describe, it, expect } from 'vitest';
import { EntropyEngine } from '../entropy.js';
import * as bip39 from 'bip39';

const permutations = [
  { type: 'binary', bits: 128, input: '10101011110011011110111100000001001000110100010101100111100010011010101111001101111011110000000100100011010001010110011110001001' },
  { type: 'hex', bits: 128, input: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }
];

describe('Entropy Engine Matrix (Pure vs Legacy)', () => {
  describe('Pure Mode (Unbiased SHA-256)', () => {
    permutations.forEach(({ type, bits, input }) => {
      it(`Generates 128-bit entropy from ${type}`, () => {
        const buffer = EntropyEngine.generatePure(type, input);
        expect(buffer).toBeDefined();
        expect(buffer.length * 8).toBe(128);
        
        const mnemonic = bip39.entropyToMnemonic(buffer);
        expect(mnemonic.split(' ').length).toBe(12);
      });
    });
  });
});
