/**
 * ENTROPY QUALITY DIAGNOSTIC & HEALTH ENGINE
 * Mode: Binary & Hex Only (Dice & Cards explicit WONTDO)
 * Policy: Alert user prominently on dangerous entropy without hard-blocking key derivation.
 */

export function calculateShannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function detectRepetitivePatterns(str) {
  if (!str || str.length < 4) return false;
  if (/^(.)\1+$/.test(str)) return true;
  for (let len = 2; len <= 4; len++) {
    const sub = str.slice(0, len);
    const regex = new RegExp(`^(${sub})+${sub.slice(0, str.length % len)}$`);
    if (regex.test(str) && str.length >= len * 3) return true;
  }
  return false;
}

export function detectKeyboardPatterns(str) {
  const lower = str.toLowerCase();
  const commonPatterns = ['qwerty', 'asdfgh', 'zxcvbn', '123456', '654321'];
  return commonPatterns.some(p => lower.includes(p));
}

export function analyzeEntropyQuality(inputStr, mode = 'hex') {
  const cleaned = (inputStr || '').trim();
  const warnings = [];

  if (cleaned.length === 0) {
    return {
      status: 'flawed',
      bitLength: 0,
      shannonEntropy: 0,
      warnings: ['No entropy entered.'],
      canDerive: false
    };
  }

  let bitLength = 0;
  if (mode === 'binary') {
    const nonBinary = cleaned.replace(/[01]/g, '');
    if (nonBinary.length > 0) {
      warnings.push(`Invalid binary characters detected: '${nonBinary.slice(0, 5)}...'. Binary mode accepts only 0 and 1.`);
    }
    bitLength = cleaned.replace(/[^01]/g, '').length;
  } else {
    // Hex mode
    const nonHex = cleaned.replace(/[0-9a-fA-F]/g, '');
    if (nonHex.length > 0) {
      warnings.push(`Invalid hex characters detected: '${nonHex.slice(0, 5)}...'. Hex mode accepts only 0-9 and a-f.`);
    }
    bitLength = cleaned.replace(/[^0-9a-fA-F]/g, '').length * 4;
  }

  const shannon = calculateShannonEntropy(cleaned);
  const isRepetitive = detectRepetitivePatterns(cleaned);
  const isKeyboard = detectKeyboardPatterns(cleaned);

  if (isRepetitive) {
    warnings.push('⚠️ DANGEROUS ENTROPY: Highly repetitive pattern detected (e.g., 1111... or abcabc...). Attackers can instantly predict this sequence.');
  }

  if (isKeyboard) {
    warnings.push('⚠️ DANGEROUS ENTROPY: Common keyboard pattern detected (e.g., qwerty, 123456). Human keyboard walks are easily guessable.');
  }

  if (bitLength < 128) {
    warnings.push(`⚠️ INSUFFICIENT ENTROPY: ${bitLength} / 128 minimum required bits. Your seed is vulnerable to brute-force recovery.`);
  }

  if (bitLength > 128) {
    warnings.push(`⚠️ EXCESS ENTROPY: You provided ${bitLength} bits. The engine always safely hashes and truncates excess input down to exactly 128 bits (16 bytes, 12 words).`);
  }

  let status = 'strong';

  if (bitLength < 128 || isRepetitive || isKeyboard || warnings.length > 0) {
    if (bitLength < 128 || isRepetitive) {
      status = 'flawed';
    } else {
      status = 'weak';
    }
  }

  // Policy: Alert user prominently, but NEVER hard-block derivation if syntax is parseable
  const canDerive = (mode === 'binary' ? cleaned.replace(/[^01]/g, '').length > 0 : cleaned.replace(/[^0-9a-fA-F]/g, '').length > 0);

  return {
    status,
    bitLength,
    shannonEntropy: Math.round(shannon * 100) / 100,
    warnings,
    canDerive
  };
}

export function fixEntropyWithCSPRNG(inputStr) {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(inputStr || '');
  const randomBytes = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    throw new Error("Fatal: window.crypto.getRandomValues is unavailable. Cannot securely generate CSPRNG entropy.");
  }

  const combined = new Uint8Array(inputBytes.length + randomBytes.length);
  combined.set(inputBytes);
  combined.set(randomBytes, inputBytes.length);
  return combined;
}
