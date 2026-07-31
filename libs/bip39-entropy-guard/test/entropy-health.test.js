import { describe, it, expect } from 'vitest';
import { analyzeEntropyQuality, calculateShannonEntropy, detectRepetitivePatterns, detectKeyboardPatterns } from '../entropy-health.js';

describe('Entropy Quality Diagnostic Engine', () => {
  it('should detect low Shannon entropy and repetitive patterns', () => {
    expect(detectRepetitivePatterns('111111111111')).toBe(true);
    expect(detectRepetitivePatterns('abcabcabcabc')).toBe(true);
    expect(detectRepetitivePatterns('4a8f9b2c1d0e3f5a7b8c9d0e1f2a3b4c')).toBe(false);
  });

  it('should detect common keyboard patterns', () => {
    expect(detectKeyboardPatterns('my-qwerty-secret')).toBe(true);
    expect(detectKeyboardPatterns('x89f7a6b2c1d0e')).toBe(false);
  });

  it('should diagnose flawed entropy when bit-length is under 128 bits without hard-blocking derivation', () => {
    const result = analyzeEntropyQuality('000011112222', 'hex');
    expect(result.status).toBe('flawed');
    expect(result.canDerive).toBe(true);
    expect(result.warnings.some(w => w.includes('INSUFFICIENT ENTROPY'))).toBe(true);
  });

  it('should diagnose strong entropy when bit-length >= 128 and high quality', () => {
    const result = analyzeEntropyQuality('4a8f9b2c1d0e3f5a7b8c9d0e1f2a3b4c', 'hex');
    expect(result.status).toBe('strong');
    expect(result.canDerive).toBe(true);
    expect(result.bitLength).toBe(128);
  });
});
