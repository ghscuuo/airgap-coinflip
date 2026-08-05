// ZK_AUTHOR: da70b35cc0c6f82fcaebd10f693405ef1129dc3eb7221ee8fd1ecf77908dd89e
import { EntropyEngine } from 'bip39-entropy-guard';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import QRCode from 'qrcode';

const bip32 = BIP32Factory(ecc);
const TOTAL_BITS = 128;
let currentBits = '';
let isLocked = false;
let generatedMnemonic = '';
let hasPassedGate = false;

// --- MOCK VULNERABILITY DATABASE (Bloom Filter PoC) ---
const COMPROMISED_ENTROPY = [
    "10101010101010101010101010101010101010100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", // Simulated 40-bit PRNG failure
    "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"  // All zeros
];

// Precompute 32-bit prefixes at load time
const VULNERABILITY_PREFIXES = COMPROMISED_ENTROPY.map(bits => {
    const hash = sha512(new TextEncoder().encode(bits));
    return Array.from(hash.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
});


// DOM Elements
const grid = document.getElementById('grid');
const progressBar = document.getElementById('progress-bar');
const bitCount = document.getElementById('bit-count');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');
const errorTitle = document.getElementById('error-title');
const errorMessage = document.getElementById('error-message');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const resetSuccessBtns = document.querySelectorAll('.reset-success-btn');

const gateModal = document.getElementById('gate-modal');
const mainApp = document.getElementById('main-app');
const gateBtn = document.getElementById('gate-btn');
const attestCheckbox = document.getElementById('attest-checkbox');

if (attestCheckbox && gateBtn) {
    attestCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            gateBtn.disabled = false;
            gateBtn.style.background = 'linear-gradient(to right, var(--error), #991b1b)';
            gateBtn.style.color = 'white';
            gateBtn.style.cursor = 'pointer';
            gateBtn.classList.remove('disabled-btn');
        } else {
            gateBtn.disabled = true;
            gateBtn.style.background = '#333';
            gateBtn.style.color = '#888';
            gateBtn.style.cursor = 'not-allowed';
            gateBtn.classList.add('disabled-btn');
        }
    });
}

const dispMnemonic = document.getElementById('disp-mnemonic');
const dispXpub = document.getElementById('disp-xpub');
const dispDescriptor = document.getElementById('disp-descriptor');
const dispAddresses = document.getElementById('disp-addresses');
const dispBip85List = document.getElementById('disp-bip85-list');

const qrSeed = document.getElementById('qr-seed');
const qrXprv = document.getElementById('qr-xprv');
const qrXpub = document.getElementById('qr-xpub');
const qrDesc = document.getElementById('qr-desc');

const qrSeedVal = document.getElementById('qr-seed-val');
const qrXprvVal = document.getElementById('qr-xprv-val');
const qrXpubVal = document.getElementById('qr-xpub-val');
const qrDescVal = document.getElementById('qr-desc-val');

// Pagination controls
const addrStartInput = document.getElementById('addr-start');
const addrCountInput = document.getElementById('addr-count');
const addrPrevBtn = document.getElementById('addr-prev');
const addrNextBtn = document.getElementById('addr-next');

const bip85StartInput = document.getElementById('bip85-start');
const bip85CountInput = document.getElementById('bip85-count');
const bip85PrevBtn = document.getElementById('bip85-prev');
const bip85NextBtn = document.getElementById('bip85-next');

// State holding for pagination derivation
let currentRootNode = null;
let currentAccountNode = null;

// Pagination Handlers
function renderAddresses() {
    if (!currentAccountNode) return;
    const start = Math.max(0, parseInt(addrStartInput.value, 10) || 0);
    const count = Math.min(50, Math.max(1, parseInt(addrCountInput.value, 10) || 5));
    
    // Neuter the node so child derivations do not leak private keys into heap
    const pubNode = currentAccountNode.neutered();
    const receiveNode = pubNode.derive(0);
    
    let addressHTML = '';
    for (let i = start; i < start + count; i++) {
        const childNode = receiveNode.derive(i);
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: childNode.publicKey,
            network: bitcoin.networks.bitcoin
        });
        addressHTML += `<div>[${i}] ${address}</div>`;
    }
    dispAddresses.innerHTML = addressHTML;
}

addrPrevBtn.addEventListener('click', () => {
    let start = parseInt(addrStartInput.value, 10) || 0;
    let count = parseInt(addrCountInput.value, 10) || 5;
    addrStartInput.value = Math.max(0, start - count);
    renderAddresses();
});
addrNextBtn.addEventListener('click', () => {
    let start = parseInt(addrStartInput.value, 10) || 0;
    let count = parseInt(addrCountInput.value, 10) || 5;
    addrStartInput.value = start + count;
    renderAddresses();
});
addrStartInput.addEventListener('change', renderAddresses);
addrCountInput.addEventListener('change', renderAddresses);

function renderBip85() {
    if (!currentRootNode) return;
    const start = parseInt(bip85StartInput.value, 10) || 0;
    const count = parseInt(bip85CountInput.value, 10) || 5;
    
    let html = '';
    for (let i = start; i < start + count; i++) {
        let n1, n2, n3, n4, bip85ChildNode, bip85Hash, bip85Entropy;
        try {
            // m/83696968'/39'/0'/12'/${i}'
            n1 = currentRootNode.deriveHardened(83696968);
            n2 = n1.deriveHardened(39);
            n3 = n2.deriveHardened(0);
            n4 = n3.deriveHardened(12);
            bip85ChildNode = n4.deriveHardened(i);
            
            bip85Hash = hmac(sha512, new TextEncoder().encode('bip-entropy-from-k'), bip85ChildNode.privateKey);
            bip85Entropy = bip85Hash.slice(0, 16);
            const bip85Mnemonic = bip39.entropyToMnemonic(bip85Entropy, wordlist);
            html += `<div>[Index ${i}] ${bip85Mnemonic}</div>`;
        } finally {
            if (bip85Hash) bip85Hash.fill(0);
            if (bip85Entropy) bip85Entropy.fill(0);
            if (bip85ChildNode && bip85ChildNode.privateKey) bip85ChildNode.privateKey.fill(0);
            if (bip85ChildNode && bip85ChildNode.chainCode) bip85ChildNode.chainCode.fill(0);
            
            // Wipe intermediate nodes
            if (n1 && n1.privateKey) n1.privateKey.fill(0); if (n1 && n1.chainCode) n1.chainCode.fill(0);
            if (n2 && n2.privateKey) n2.privateKey.fill(0); if (n2 && n2.chainCode) n2.chainCode.fill(0);
            if (n3 && n3.privateKey) n3.privateKey.fill(0); if (n3 && n3.chainCode) n3.chainCode.fill(0);
            if (n4 && n4.privateKey) n4.privateKey.fill(0); if (n4 && n4.chainCode) n4.chainCode.fill(0);
        }
    }
    dispBip85List.innerHTML = html;
}

bip85PrevBtn.addEventListener('click', () => {
    let start = parseInt(bip85StartInput.value, 10) || 0;
    let count = parseInt(bip85CountInput.value, 10) || 5;
    bip85StartInput.value = Math.max(0, start - count);
    renderBip85();
});
bip85NextBtn.addEventListener('click', () => {
    let start = parseInt(bip85StartInput.value, 10) || 0;
    let count = parseInt(bip85CountInput.value, 10) || 5;
    bip85StartInput.value = start + count;
    renderBip85();
});
bip85StartInput.addEventListener('change', renderBip85);
bip85CountInput.addEventListener('change', renderBip85);

// Tabs logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.add('hidden'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

// Gate logic
gateBtn.addEventListener('click', () => {
    hasPassedGate = true;
    gateModal.classList.add('hidden');
    mainApp.classList.remove('hidden');
});

function initGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < TOTAL_BITS; i++) {
        const box = document.createElement('div');
        box.className = 'bit-box';
        box.id = `bit-${i}`;
        grid.appendChild(box);
    }
}

function updateUI() {
    bitCount.innerText = `${currentBits.length} / ${TOTAL_BITS} bits`;
    progressBar.style.width = `${(currentBits.length / TOTAL_BITS) * 100}%`;

    for (let i = 0; i < TOTAL_BITS; i++) {
        const box = document.getElementById(`bit-${i}`);
        if (i < currentBits.length) {
            box.innerText = currentBits[i];
            box.className = `bit-box filled-${currentBits[i]}`;
        } else {
            box.innerText = '';
            box.className = 'bit-box';
        }
    }
}

function resetApp() {
    currentBits = '';
    isLocked = false;
    generatedMnemonic = '';
    
    try {
        if (currentRootNode && currentRootNode.privateKey) currentRootNode.privateKey.fill(0);
        if (currentRootNode && currentRootNode.chainCode) currentRootNode.chainCode.fill(0);
    } finally {
        try {
            if (currentAccountNode && currentAccountNode.privateKey) currentAccountNode.privateKey.fill(0);
            if (currentAccountNode && currentAccountNode.chainCode) currentAccountNode.chainCode.fill(0);
        } finally {
            currentRootNode = null;
            currentAccountNode = null;
        }
    }
    
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    
    dispAddresses.innerHTML = '';
    dispBip85List.innerHTML = '';
    
    document.getElementById('health-warnings-list').innerHTML = '';
    document.getElementById('health-warnings').classList.add('hidden');
    errorTitle.innerText = '';
    errorMessage.innerText = '';
    
    // Reset gate
    hasPassedGate = false;
    gateModal.style.display = '';
    gateModal.classList.remove('hidden');
    mainApp.classList.add('hidden');
    if (attestCheckbox) {
        attestCheckbox.checked = false;
        gateBtn.disabled = true;
        gateBtn.style.background = '#333';
        gateBtn.style.color = '#888';
        gateBtn.style.cursor = 'not-allowed';
        gateBtn.classList.add('disabled-btn');
    }
    
    qrSeed.src = ''; qrXprv.src = ''; qrXpub.src = ''; qrDesc.src = '';
    qrSeedVal.innerText = ''; qrXprvVal.innerText = ''; qrXpubVal.innerText = ''; qrDescVal.innerText = '';
    addrStartInput.value = 0;
    bip85StartInput.value = 0;
    addrCountInput.value = 5;
    bip85CountInput.value = 5;
    
    document.body.classList.remove('dev-mode');
    
    // Reset tabs
    tabBtns[0].click();
    updateUI();
}

async function processEntropy() {
    // --- VULNERABILITY FIREWALL (Bloom Filter PoC) ---
    const inputHash = sha512(new TextEncoder().encode(currentBits));
    const inputPrefix = Array.from(inputHash.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (VULNERABILITY_PREFIXES.includes(inputPrefix)) {
        errorTitle.innerText = 'ENTROPY_QUALITY_HARD_BLOCK';
        errorMessage.innerText = 'Input matches known firmware vulnerability signature (CVE prefix collision). Key derivation aborted to prevent funds loss.';
        errorSection.classList.remove('hidden');
        return;
    }

    // Clear existing nodes from previous clicks to avoid orphaning (Class 2 bug)
    try {
        if (currentRootNode && currentRootNode.privateKey) currentRootNode.privateKey.fill(0);
        if (currentRootNode && currentRootNode.chainCode) currentRootNode.chainCode.fill(0);
    } finally {
        try {
            if (currentAccountNode && currentAccountNode.privateKey) currentAccountNode.privateKey.fill(0);
            if (currentAccountNode && currentAccountNode.chainCode) currentAccountNode.chainCode.fill(0);
        } finally {
            currentRootNode = null;
            currentAccountNode = null;
        }
    }

    let entropyBuffer = null;
    let seed = null;
    let p1 = null;
    let p2 = null;
    try {
        entropyBuffer = EntropyEngine.generatePure('binary', currentBits);
        generatedMnemonic = bip39.entropyToMnemonic(entropyBuffer, wordlist);
        
        // Derive keys
        seed = await bip39.mnemonicToSeed(generatedMnemonic);
        currentRootNode = bip32.fromSeed(seed);
        
        // Native Segwit path: m/84'/0'/0'
        p1 = currentRootNode.deriveHardened(84);
        p2 = p1.deriveHardened(0);
        currentAccountNode = p2.deriveHardened(0);
        
        const xprv = currentAccountNode.toBase58();
        const xpub = currentAccountNode.neutered().toBase58();
        
        // Convert fingerprint Uint8Array to hex safely
        const fp = currentRootNode.fingerprint;
        let fingerprint = '';
        for (let i = 0; i < fp.length; i++) {
            fingerprint += fp[i].toString(16).padStart(2, '0');
        }
        
        const descriptor = `wpkh([${fingerprint}/84'/0'/0']${xpub}/0/*)`;
        
        // --- Entropy Health Checks (Non-Fatal) ---
        const warnings = [];
        const words = generatedMnemonic.split(' ');
        
        // 1. Duplicate words
        const uniqueWords = new Set(words);
        if (uniqueWords.size < words.length) {
            warnings.push(`Duplicate words detected (${words.length - uniqueWords.size} duplicates).`);
        }
        
        // 2. High concentration of leading letters
        const letterCounts = {};
        for (const w of words) {
            const letter = w[0];
            letterCounts[letter] = (letterCounts[letter] || 0) + 1;
        }
        for (const [letter, count] of Object.entries(letterCounts)) {
            if (count >= 4) {
                warnings.push(`High concentration of words starting with '${letter}' (${count} words).`);
            }
        }
        
        // 3. Binary bias (e.g. human flipped heads way too often)
        const ones = (currentBits.match(/1/g) || []).length;
        const zeros = (currentBits.match(/0/g) || []).length;
        const biasRatio = Math.max(ones, zeros) / currentBits.length;
        if (biasRatio > 0.60) {
            warnings.push(`Coin flips are severely biased. You flipped ${Math.round(biasRatio * 100)}% ${ones > zeros ? 'Heads (1)' : 'Tails (0)'}. Real coins land ~50/50.`);
        }
        
        const healthWarningsDiv = document.getElementById('health-warnings');
        const healthWarningsList = document.getElementById('health-warnings-list');
        if (warnings.length > 0) {
            healthWarningsList.innerHTML = warnings.map(w => `<li>${w}</li>`).join('');
            healthWarningsDiv.classList.remove('hidden');
        } else {
            healthWarningsDiv.classList.add('hidden');
        }
        
        // Generate initial paginated data
        renderAddresses();
        renderBip85();
        
        // Generate QRs
        const qrOpts = { errorCorrectionLevel: 'M', margin: 2, scale: 6 };
        qrSeed.src = await QRCode.toDataURL(generatedMnemonic, qrOpts);
        qrSeedVal.innerText = generatedMnemonic;
        
        qrXprv.src = await QRCode.toDataURL(xprv, qrOpts);
        qrXprvVal.innerText = xprv;
        
        qrXpub.src = await QRCode.toDataURL(xpub, qrOpts);
        qrXpubVal.innerText = xpub;
        
        qrDesc.src = await QRCode.toDataURL(descriptor, qrOpts);
        qrDescVal.innerText = descriptor;
        
        resultSection.classList.remove('hidden');
    } catch (err) {
        errorTitle.innerText = 'Derivation Failed';
        errorMessage.innerText = err.message;
        errorSection.classList.remove('hidden');
    } finally {
        if (p1 && p1.privateKey) p1.privateKey.fill(0); if (p1 && p1.chainCode) p1.chainCode.fill(0);
        if (p2 && p2.privateKey) p2.privateKey.fill(0); if (p2 && p2.chainCode) p2.chainCode.fill(0);
        if (entropyBuffer) entropyBuffer.fill(0);
        if (seed) seed.fill(0);
    }
}

function generateSparrowWalletJSON(mnemonic) {
    const walletConfig = {
        name: "Airgap_Coinflip_Wallet",
        policyType: "SINGLE",
        scriptType: "P2WPKH",
        keystores: [
            { type: "BIP39", source: "SW", seed: mnemonic, passphrase: "", derivation: "m/84'/0'/0'" }
        ]
    };
    return JSON.stringify(walletConfig, null, 2);
}

window.addEventListener('beforeunload', (e) => {
    if (currentBits.length > 0 && !isLocked) {
        e.preventDefault();
        e.returnValue = ''; // Required for modern browsers to show the warning
    }
});

window.addEventListener('keydown', (e) => {
    if (isLocked || !hasPassedGate) return;
    
    if (e.key === '0' || e.key === '1') {
        currentBits += e.key;
        updateUI();

        if (currentBits.length === TOTAL_BITS) {
            isLocked = true;
            setTimeout(processEntropy, 50);
        }
    } else if (e.key === 'Backspace') {
        e.preventDefault(); // Prevent "Navigate Back" browser action
        if (currentBits.length > 0) {
            currentBits = currentBits.slice(0, -1);
            updateUI();
        }
    } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); // Prevent page scrolling or accidental button clicks
    }
});

const devTestBtn = document.getElementById('dev-test-vector');
if (devTestBtn) {
    devTestBtn.addEventListener('click', () => {
        if (isLocked || !hasPassedGate) return;
        if (!confirm("⚠️ OVERWRITE WARNING\nAre you sure you want to overwrite your progress with a test vector? DO NOT USE TEST VECTORS FOR REAL FUNDS.")) return;
        
        // Obvious repeating test vector
        currentBits = "00001111000011110000111100001111000011110000111100001111000011110000111100001111000011110000111100001111000011110000111100001111";
        document.body.classList.add('dev-mode');
        updateUI();
        isLocked = true;
        processEntropy();
    });
}

const devCveBtn = document.getElementById('dev-cve-vector');
if (devCveBtn) {
    devCveBtn.addEventListener('click', () => {
        if (isLocked || !hasPassedGate) return;
        if (!confirm("⚠️ TRIGGER FIREWALL WARNING\nThis will inject the simulated 40-bit PRNG failure to test the Bloom Filter firewall.")) return;
        
        // 40-bit PRNG failure simulated collapse
        currentBits = "10101010101010101010101010101010101010100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        document.body.classList.add('dev-mode');
        updateUI();
        isLocked = true;
        processEntropy();
    });
}

exportBtn.addEventListener('click', () => {
    if (!generatedMnemonic) return;
    const json = generateSparrowWalletJSON(generatedMnemonic);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airgap_sparrow_wallet.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', resetApp);
resetSuccessBtns.forEach(btn => btn.addEventListener('click', resetApp));

initGrid();
