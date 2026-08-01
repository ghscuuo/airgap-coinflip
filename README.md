# Airgap Coinflip: Deterministic Key Generation

> **Transparency Note:** The strict OPSEC threat model, UI macro-architecture, and cryptographic design constraints of this repository were entirely human-directed. However, the human author did not write or review a single line of syntax. The codebase was 100% autonomously constructed, stress-tested, and aggressively red-team audited by a swarm of specialized Gemini Pro AI subagents acting as the execution layer.

A zero-trust, mathematically reproducible, offline deterministic wallet and BIP85 engine.

## The Threat Model
Trusting silicon to generate your cryptographic secrets is the single greatest vulnerability in deep cold storage. Supply chain attacks, PRNG software flaws (e.g., the historical Coldcard seed generation bug), and firmware entropy poisoning are silent and catastrophic. 

This engine forces you to bypass silicon entirely. You generate the master root entropy physically (by flipping 128 pennies), and the engine derives the key tree using strictly audited mathematical primitives. 

## The Hermetic Seal Architecture
1. **Airgapped Design:** This tool is designed to be executed on a freshly wiped, Live OS (e.g., Tails, Ubuntu Live USB) running entirely in volatile RAM without network interfaces active. 
2. **Aggressive Memory Hygiene:** Private key material and intermediate BIP32 chain codes are explicitly zeroed out (`.fill(0)`) to prevent residue from lingering in the JavaScript Garbage Collector. 
3. **Strict Content Security Policy:** The single-file HTML compilation is sealed with a `default-src 'none'` CSP, completely disabling all external network IO, tracking, or resource fetching. 

## Deterministic Build Auditing
This codebase leverages `vite-plugin-singlefile` and `SOURCE_DATE_EPOCH` to guarantee 100% byte-for-byte reproducibility. Anyone can clone this repository, run the exact same build command, and mathematically verify the SHA-256 fingerprint in the filename.

**To verify the build yourself:**
```bash
git clone https://github.com/ghscuuo/airgap-coinflip.git
cd airgap-coinflip
npm ci

# Enforce deterministic timestamps and compile
export SOURCE_DATE_EPOCH=1700000000 
export TZ=UTC 
npm run build

# Verify the hash matches the release
sha256sum dist/*.html
```

## Zero-Knowledge Authorship Proof
To mitigate physical vectors ($5 wrench attacks) against developers, this repository is published pseudonymously. Authorship is mathematically proven via a SHA-256 pre-image hash embedded in the repository, rather than exposing PII in Git signatures.

`Authorship Hash: 3c16a3a41e9df6469cf361005fbc5730ce9e09dff6045d947cb2ccceb3b24f5a`

## License
In alignment with the open-source ethos of the Bitcoin mission, this engine is released under the MIT License. Verify, don't trust.
