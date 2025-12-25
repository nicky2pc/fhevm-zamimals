#!/usr/bin/env node
/**
 * CLI для тестирования ConfidentialTrophyNFT контракта
 * 
 * Usage:
 *   node testContract.js mint <score> <recipient>
 *   node testContract.js balance <address>
 *   node testContract.js decrypt <tokenId> <ownerPrivateKey>
 */

import { ethers } from 'ethers';
import { createInstance } from '@zama-fhe/relayer-sdk/node';
import dotenv from 'dotenv';

dotenv.config();

// Конфигурация
const RPC_URL = 'rpc';
const PRIVATE_KEY = "0x"
const CONTRACT_ADDRESS = '0x';

const CONTRACT_ABI = [
  'function mintWithConfidentialScore(address to, string memory uri, bytes32 encryptedScore, bytes calldata inputProof) external',
  'function getEncryptedScore(uint256 tokenId) external view returns (bytes32)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string memory)'
];

// Создание провайдера и wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// EIP-1193 provider для FHEVM
const eip1193Provider = {
  request: async ({ method, params }) => {
    switch (method) {
      case 'eth_accounts':
        return [wallet.address];
      case 'eth_chainId':
        return '0xaa36a7'; // Sepolia
      case 'personal_sign':
        return wallet.signMessage(params[0]);
      case 'eth_sign':
        return wallet.signMessage(params[1]);
      case 'eth_signTypedData_v4':
        return wallet.signTypedData(
          params[1].domain,
          params[1].types,
          params[1].message
        );
      default:
        return provider.send(method, params ?? []);
    }
  }
};

// Инициализация FHEVM
let fheInstance;

async function initFHE() {
  if (fheInstance) return fheInstance;
  
  console.log('🔐 Initializing FHEVM...');
  
  fheInstance = await createInstance({
    aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
    kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
    inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
    verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
    verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
    chainId: 11155111,
    gatewayChainId: 10901,
    network: eip1193Provider,
    relayerUrl: 'https://relayer.testnet.zama.org'
  });
  
  console.log('✅ FHEVM initialized\n');
  return fheInstance;
}

// Конвертация handle в bytes32
function toBytes32(handle) {
  if (typeof handle === 'string' && handle.startsWith('0x') && handle.length === 66) {
    return handle;
  }
  
  if (Array.isArray(handle)) {
    if (handle.length !== 32) throw new Error('Array must be 32 bytes');
    return '0x' + Buffer.from(handle).toString('hex');
  }
  
  if (typeof handle === 'object') {
    const keys = Object.keys(handle).map(k => parseInt(k)).sort((a, b) => a - b);
    const bytes = keys.map(k => handle[k]);
    if (bytes.length !== 32) throw new Error('Object must represent 32 bytes');
    return '0x' + Buffer.from(bytes).toString('hex');
  }
  
  throw new Error('Cannot convert to bytes32');
}

// Конвертация proof в bytes
function toBytes(proof) {
  if (typeof proof === 'string' && proof.startsWith('0x')) {
    return proof;
  }
  
  if (Array.isArray(proof)) {
    return '0x' + Buffer.from(proof).toString('hex');
  }
  
  if (typeof proof === 'object') {
    const keys = Object.keys(proof).map(k => parseInt(k)).sort((a, b) => a - b);
    const bytes = keys.map(k => proof[k]);
    return '0x' + Buffer.from(bytes).toString('hex');
  }
  
  throw new Error('Cannot convert to bytes');
}

// Команда: mint
async function mint(score, recipient) {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   🎮 MINTING CONFIDENTIAL TROPHY NFT');
    console.log('═══════════════════════════════════════════════════════\n');

    const tokenURI = 'ipfs://bafkreifxdgxalrmctuytadma3avj43mjlojsunrtho2cxxahwm5sljhxvu';
    
    const fhe = await initFHE();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    // 1. Шифруем скор
    console.log(`🔒 Encrypting score: ${score}`);
    const input = fhe.createEncryptedInput(CONTRACT_ADDRESS, wallet.address);
    input.add32(score);
    const encrypted = await input.encrypt();
    console.log('✅ Score encrypted\n');
    
    // 2. Конвертируем данные
    const encryptedScore = toBytes32(encrypted.handles[0]);
    const inputProof = toBytes(encrypted.inputProof);
    
    console.log('📝 Transaction data:');
    console.log(`   Recipient: ${recipient}`);
    console.log(`   URI: s:${tokenURI}`);
    console.log(`   Encrypted Score: ${encryptedScore.slice(0, 10)}...${encryptedScore.slice(-8)}`);
    console.log(`   Proof length: ${inputProof.length} chars\n`);
    
    // 3. Estimate gas

    

    console.log('⛽ Estimating gas...');
    const estimatedGas = await contract.mintWithConfidentialScore.estimateGas(
      recipient,
      tokenURI,
      encryptedScore,
      inputProof
    );
    const gasLimit = Math.min(Math.floor(Number(estimatedGas) * 1.5), 50_000_000);
    console.log(`   Estimated: ${estimatedGas.toString()}`);
    console.log(`   Using limit: ${gasLimit}\n`);
    
    // 4. Отправляем транзакцию
    console.log('🚀 Sending transaction...');
    const tx = await contract.mintWithConfidentialScore(
      recipient,
      tokenURI,
      encryptedScore,
      inputProof,
      { gasLimit }
    );
    
    console.log(`✅ Transaction sent!`);
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   Explorer: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
    
    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    
    console.log('✅ Transaction confirmed!');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);
    
    // Получаем tokenId из событий
    const transferEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'Transfer';
      } catch { return false; }
    });
    
    if (transferEvent) {
      const parsed = contract.interface.parseLog(transferEvent);
      console.log(`🎉 NFT Minted!`);
      console.log(`   Token ID: ${parsed.args[2].toString()}`);
      console.log(`   Owner: ${parsed.args[1]}`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    process.exit(1);
  }
}

// Команда: balance
async function checkBalance(address) {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   📊 CHECKING NFT BALANCE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    const balance = await contract.balanceOf(address);
    
    console.log(`Address: ${address}`);
    console.log(`Balance: ${balance.toString()} NFTs\n`);
    
    if (balance > 0) {
      console.log('Token IDs owned by this address:');
      // Примечание: Для получения всех tokenId нужен дополнительный функционал
      console.log('(Use tokenOfOwnerByIndex if implemented)\n');
    }
    
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Команда: decrypt
async function decryptScore(tokenId, ownerPrivateKey) {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   🔓 DECRYPTING SCORE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const fhe = await initFHE();
    
    // Создаем wallet владельца
    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ownerWallet);
    
    console.log(`Token ID: ${tokenId}`);
    console.log(`Owner: ${ownerWallet.address}\n`);
    
    // Получаем зашифрованный скор
    console.log('📥 Getting encrypted score...');
    const encryptedScore = await contract.getEncryptedScore(tokenId);
    console.log(`✅ Encrypted score retrieved: ${encryptedScore}\n`);
    
    // Расшифровываем
    console.log('🔓 Decrypting...');
    const decrypted = await fhe.decrypt(
      encryptedScore,
      CONTRACT_ADDRESS,
      ownerWallet.address
    );
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   🎯 DECRYPTED SCORE: ${decrypted}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('Not owner')) {
      console.error('💡 Hint: Only the NFT owner can decrypt the score');
    }
    process.exit(1);
  }
}

// Команда: info
async function info(tokenId) {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   ℹ️  NFT INFO');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    const owner = await contract.ownerOf(tokenId);
    const uri = await contract.tokenURI(tokenId);
    
    console.log(`Token ID: ${tokenId}`);
    console.log(`Owner: ${owner}`);
    console.log(`URI: ${uri}`);
    console.log(`\n💡 To decrypt score, use:`);
    console.log(`   node testContract.js decrypt ${tokenId} <owner_private_key>\n`);
    
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!PRIVATE_KEY && command !== 'balance' && command !== 'info') {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
  }
  
  switch (command) {
    case 'mint':
      const score = parseInt(args[1]);
      const recipient = args[2] || wallet.address;
      if (!score || isNaN(score)) {
        console.error('Usage: node testContract.js mint <score> [recipient]');
        process.exit(1);
      }
      await mint(score, recipient);
      break;
      
    case 'balance':
      const address = args[1];
      if (!address) {
        console.error('Usage: node testContract.js balance <address>');
        process.exit(1);
      }
      await checkBalance(address);
      break;
      
    case 'decrypt':
      const tokenId = args[1];
      const ownerPrivateKey = args[2];
      if (!tokenId || !ownerPrivateKey) {
        console.error('Usage: node testContract.js decrypt <tokenId> <ownerPrivateKey>');
        process.exit(1);
      }
      await decryptScore(tokenId, ownerPrivateKey);
      break;
      
    case 'info':
      const infoTokenId = args[1];
      if (!infoTokenId) {
        console.error('Usage: node testContract.js info <tokenId>');
        process.exit(1);
      }
      await info(infoTokenId);
      break;
      
    default:
      console.log('Available commands:');
      console.log('  mint <score> [recipient]    - Mint NFT with encrypted score');
      console.log('  balance <address>           - Check NFT balance');
      console.log('  decrypt <tokenId> <privKey> - Decrypt score (owner only)');
      console.log('  info <tokenId>              - Get NFT info');
      console.log('\nExamples:');
      console.log('  node testContract.js mint 1337');
      console.log('  node testContract.js mint 9999 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
      console.log('  node testContract.js balance 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
      console.log('  node testContract.js decrypt 0 0xYourPrivateKey');
      console.log('  node testContract.js info 0');
      process.exit(1);
  }
}

main().catch(console.error);