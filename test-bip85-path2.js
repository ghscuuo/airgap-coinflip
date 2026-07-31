import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { BIP85 } from 'bip85';

async function run() {
    const bip32 = BIP32Factory(ecc);
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(Buffer.from(seed));
    
    const masterBip85 = BIP85.fromSeed(Buffer.from(seed));
    const child12 = masterBip85.deriveBIP39(0, 12, 0); 
    const entropyHexBip85 = child12.toEntropy();
    console.log("bip85 library:", entropyHexBip85);
    
    // m/83696968'/39'/language'/words'/index'
    const child = root.derivePath("m/83696968'/39'/0'/12'/0'");
    
    let pkHex = "";
    for (let i = 0; i < child.privateKey.length; i++) {
        pkHex += child.privateKey[i].toString(16).padStart(2, '0');
    }
    
    console.log("manual derive:", pkHex.slice(0, 32));
    
    const childMnemonic = bip39.entropyToMnemonic(child.privateKey.slice(0, 16), wordlist);
    console.log("bip85 library mnemonic:", child12.toMnemonic());
    console.log("manual mnemonic       :", childMnemonic);
}
run().catch(console.error);
