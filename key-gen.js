



import fs from 'fs'
import  bs58  from 'bs58' // make sure bs58 is installed: npm install bs58

const privateKeyBase58Encoded = '';

// decode the base58 string
const decoded = bs58.decode(privateKeyBase58Encoded);

// create a Uint8Array to match Solana keypair format
const keypairArray = Array.from(decoded);

// write to JSON file
fs.writeFileSync('key.json', JSON.stringify(keypairArray));

console.log('Keypair JSON saved to key.json');
