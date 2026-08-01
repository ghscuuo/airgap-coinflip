# Airgap Coinflip: Deterministic Key Generation

> **Transparency Note:** The strict OPSEC threat model, UI macro-architecture, and cryptographic design constraints of this repository were entirely human-directed. However, the human author did not write or review a single line of syntax. The codebase was 100% autonomously constructed, stress-tested, and aggressively red-team audited by a swarm of specialized Gemini Pro AI subagents acting as the execution layer.

A zero-trust, mathematically reproducible, offline deterministic wallet and BIP85 engine.

## The Threat Model
This tool explicitly assumes that:
1. All Silicon Random Number Generators (RNGs) are backdoored, flawed, or compromised.
2. All operating systems and browsers will attempt to cache, leak, or phone home sensitive data.
3. Supply chain attacks on node modules are inevitable.

## Why We Reject the "Industry Standard"
The prevailing cryptographic "industry standard" dictates that entropy should be sourced from `/dev/urandom`, `window.crypto.getRandomValues()`, or a hardware wallet's proprietary silicon RNG. 

**We explicitly reject this standard.**

Silicon RNGs and operating system entropy pools are opaque black boxes. History is littered with catastrophic failures where these systems were either silently compromised by state actors (e.g., Dual_EC_DRBG), suffered from fatal implementation bugs (e.g., Debian OpenSSL bug, recent hardware wallet vulnerabilities), or fell victim to side-channel attacks. 

You cannot mathematically audit the physical silicon inside your hardware wallet. The only universally verifiable source of entropy is physics. 

By forcing the user to manually flip a physical coin 128 times, we shift the root of trust away from unauditable firmware blobs and over to the undeniable laws of physical probability. This is agonizingly tedious for the user, but it is the absolute only way to achieve true zero-trust sovereign key generation.

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
git checkout v0.0.1-rc.1  # Replace with the specific release tag you are auditing
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

MIT License. See [LICENSE](LICENSE) for details.

---
## ⚠️ Absolute Liability Disclaimer

**This software is provided "AS IS", without warranty of any kind, express or implied.**

The human architect, pseudonymous contributors, and AI orchestration engines involved in the creation of this tool assume **absolutely zero liability** for any loss of funds, cryptographic flaws, entropy degradation, or operational failures. 

Generating and managing cryptographic keys requires extreme OPSEC. If you use this tool to generate a wallet and subsequently lose funds due to a bug, a compromised offline device, an undiscovered CVE, or user error, there is no recourse. 

**Do not trust this tool. Verify the source code yourself, compile it yourself, and audit the output against established libraries before committing value to the generated keys.**
