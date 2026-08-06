import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '../dist');
const files = fs.readdirSync(distDir);
const htmlFile = files.find(f => f.startsWith('airgap-coinflip_') && f.endsWith('.html'));

if (!htmlFile) {
    console.error('Compiled HTML file not found in dist/ directory!');
    process.exit(1);
}

const htmlPath = path.join(distDir, htmlFile);
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// JSDOM does not execute `<script type="module">` and runs classic inline scripts synchronously.
// To match the browser's deferred/async module execution, we extract the bundled script content,
// remove it from the head, and inject it as a classic script at the end of the body.
// We use a function replacement callback to avoid special character ($&, $', etc.) translations of minified JS.
const scriptRegex = /<script type="module" crossorigin>([\s\S]*?)<\/script>/;
const match = htmlContent.match(scriptRegex);
if (!match) {
    console.error('Inlined script tag not found in compiled HTML!');
    process.exit(1);
}
const scriptContent = match[1];
const cleanHtml = htmlContent.replace(scriptRegex, '');
const testHtml = cleanHtml.replace('</body>', () => `<script>${scriptContent}</script></body>`);

const testCases = [
    {
        name: "Valid High-Entropy Vector",
        entropy: "10100110100100110110001110010010110011100001101101001011001000010101110110001101101101000110100110001011010110011000011101001110",
        shouldPass: true,
        expectedMnemonic: "pledge only tool order regret mouse involve repair hat food gift oval"
    },
    {
        name: "Yasmarang (Blocked by Coldcard Exploit Firewall)",
        entropy: "00100011001100100110011101111100000011011110101000001001001101000000101101001010100011110010110010110101000100101011000100100100",
        shouldPass: false,
        expectedError: "Input matches known weak RNG signature"
    },
    {
        name: "All Zeros (Blocked by Bloom Firewall)",
        entropy: "0".repeat(128),
        shouldPass: false,
        expectedError: "Input matches known weak RNG signature"
    },
    {
        name: "All Ones (Blocked by Weak RNG Firewall)",
        entropy: "1".repeat(128),
        shouldPass: false,
        expectedError: "Input matches known weak RNG signature"
    }
];

console.log("=== ARTIFACT VERIFICATION: Testing compiled HTML ===");

let passed = true;

async function runTests() {
    for (let test of testCases) {
        try {
            const dom = new JSDOM(testHtml, {
                runScripts: "dangerously",
                resources: "usable"
            });
            
            const { window } = dom;
            
            // Mock URL.createObjectURL since JSDOM doesn't implement it
            window.URL.createObjectURL = () => "blob:mock-url";
            window.URL.revokeObjectURL = () => {};
            
            // Mock HTMLCanvasElement context & methods to avoid node-canvas dependencies
            window.HTMLCanvasElement.prototype.getContext = () => ({
                fillRect: () => {},
                clearRect: () => {},
                getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }),
                putImageData: () => {},
                createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }),
                setTransform: () => {},
                drawImage: () => {},
                save: () => {},
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                translate: () => {},
                scale: () => {},
                rotate: () => {},
                arc: () => {},
                fill: () => {},
                measureText: () => ({ width: 0 }),
                transform: () => {},
                rect: () => {},
                clip: () => {}
            });
            window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,mock";
            
            // Trigger gate bypass
            const attestCheckbox = window.document.getElementById('attest-checkbox');
            const gateBtn = window.document.getElementById('gate-btn');
            
            if (attestCheckbox && gateBtn) {
                attestCheckbox.checked = true;
                const changeEvent = new window.Event('change');
                attestCheckbox.dispatchEvent(changeEvent);
                gateBtn.click();
            } else {
                throw new Error("Gate HTML elements not found!");
            }
            
            // Simulate user keypresses for entropy
            for (let char of test.entropy) {
                const keydownEvent = new window.KeyboardEvent('keydown', { key: char });
                window.dispatchEvent(keydownEvent);
            }
            
            // Sleep briefly for async derivation
            await new Promise(r => setTimeout(r, 250));
            
            if (test.shouldPass) {
                const dispMnemonic = window.document.getElementById('qr-seed-val');
                const resultMnemonic = dispMnemonic ? (dispMnemonic.innerText || dispMnemonic.textContent).trim() : "";
                
                if (resultMnemonic === test.expectedMnemonic) {
                    console.log(`[PASS] ${test.name}`);
                } else {
                    console.error(`[FAIL] ${test.name}`);
                    console.error(`  Expected: ${test.expectedMnemonic}`);
                    console.error(`  Got     : ${resultMnemonic}`);
                    passed = false;
                }
            } else {
                const errorSection = window.document.getElementById('error-section');
                const errorMessage = window.document.getElementById('error-message');
                const isErrorShown = errorSection && !errorSection.classList.contains('hidden');
                const errorText = errorMessage ? (errorMessage.innerText || errorMessage.textContent) : "";
                
                if (isErrorShown && errorText.includes(test.expectedError)) {
                    console.log(`[PASS] ${test.name} (Correctly Blocked)`);
                } else {
                    console.error(`[FAIL] ${test.name} was not blocked or error message was incorrect.`);
                    console.error(`  Error Shown: ${isErrorShown}`);
                    console.error(`  Error Text  : ${errorText}`);
                    passed = false;
                }
            }
            
            window.close();
        } catch (err) {
            console.error(`[ERROR] Exception in ${test.name}: ${err.message}`);
            passed = false;
        }
    }
    
    if (passed) {
        console.log("=== ARTIFACT VERIFICATION SUCCESSFUL ===");
        process.exit(0);
    } else {
        console.error("=== ARTIFACT VERIFICATION FAILED ===");
        process.exit(1);
    }
}

runTests();
