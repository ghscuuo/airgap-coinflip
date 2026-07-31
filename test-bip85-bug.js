import { EntropyEngine } from './node_modules/bip39-entropy-guard/entropy.js';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP85 } from 'bip85';

async function run() {
    const bip32 = BIP32Factory(ecc);
    // Non-repetitive 128 bit entropy
    const currentBits = "11001010101110001001011001100101101011001011010011110010010110011100010101011010011100101110010110110010100101010110110101001010"; 
    
    const entropyBuffer = EntropyEngine.generatePure('binary', currentBits);
    const generatedMnemonic = bip39.entropyToMnemonic(new Uint8Array(entropyBuffer), wordlist);
    console.log("Mnemonic:", generatedMnemonic);
    
    const seed = await bip39.mnemonicToSeed(generatedMnemonic);
    const root = bip32.fromSeed(Buffer.from(seed));
    console.log("Root Base58:", root.toBase58());
    
    try {
        console.log("Deriving BIP85...");
        const masterBip85 = BIP85.fromSeed(Buffer.from(seed));
        const child12 = masterBip85.deriveBIP39(0, 12, 0); 
        console.log("BIP85 Child:", child12.toMnemonic());
    } catch (e) {
        console.error("BIP85 Error:", e);
    }
}
run().catch(console.error);
