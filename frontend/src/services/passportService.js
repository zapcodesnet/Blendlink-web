/**
 * Immutable Passport Integration for Blendlink
 * Handles wallet connection and NFT contract deployment on zkEVM Mainnet
 */

import { passport, config } from '@imtbl/sdk';
import { BrowserProvider, ContractFactory, formatEther } from 'ethers';

// Immutable zkEVM Mainnet Configuration
export const ZKEVM_CONFIG = {
  chainId: 13371,
  chainIdHex: '0x343b',
  rpcUrl: 'https://rpc.immutable.com',
  explorerUrl: 'https://explorer.immutable.com',
  operatorAllowlist: '0x5f5eba8133f68ea22d712b0926e2803e78d89221',
  immutableMinter: '0xbb7ee21aaaf65a1ba9b05dee234c5603c498939e',
};

// Passport instance (singleton)
let passportInstance = null;
let passportProvider = null;

/**
 * Initialize Immutable Passport
 * @param {string} clientId - Your Immutable Hub client ID
 * @param {string} redirectUri - OAuth redirect URI (your app URL)
 * @param {string} logoutRedirectUri - Logout redirect URI
 */
export const initializePassport = (clientId, redirectUri, logoutRedirectUri) => {
  if (passportInstance) return passportInstance;

  passportInstance = new passport.Passport({
    baseConfig: {
      environment: config.Environment.PRODUCTION,
      publishableKey: clientId, // In production, use actual publishable key
    },
    clientId: clientId,
    redirectUri: redirectUri,
    logoutRedirectUri: logoutRedirectUri,
    audience: 'platform_api',
    scope: 'openid offline_access email transact',
  });

  return passportInstance;
};

/**
 * Connect to Passport and get zkEVM provider
 */
export const connectPassport = async () => {
  if (!passportInstance) {
    throw new Error('Passport not initialized. Call initializePassport first.');
  }

  try {
    // Connect to zkEVM
    passportProvider = passportInstance.connectEvm();
    
    // Create ethers provider
    const provider = new BrowserProvider(passportProvider);
    
    // Request accounts (triggers login if not logged in)
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);

    return {
      provider,
      signer,
      address,
      balance: formatEther(balance),
      connected: true,
    };
  } catch (error) {
    console.error('Passport connection error:', error);
    throw error;
  }
};

/**
 * Get user info from Passport
 */
export const getPassportUser = async () => {
  if (!passportInstance) return null;
  
  try {
    const userInfo = await passportInstance.getUserInfo();
    return userInfo;
  } catch (error) {
    console.error('Get user info error:', error);
    return null;
  }
};

/**
 * Logout from Passport
 */
export const logoutPassport = async () => {
  if (!passportInstance) return;
  
  try {
    await passportInstance.logout();
    passportProvider = null;
  } catch (error) {
    console.error('Logout error:', error);
  }
};

/**
 * Deploy NFT contract on zkEVM
 * @param {object} signer - Ethers signer from Passport
 * @param {string} bytecode - Contract bytecode
 * @param {array} abi - Contract ABI
 * @param {array} constructorArgs - Constructor arguments
 */
export const deployNFTContract = async (signer, bytecode, abi, constructorArgs = []) => {
  try {
    const factory = new ContractFactory(abi, bytecode, signer);
    
    // Deploy with gas limit
    const contract = await factory.deploy(...constructorArgs, {
      gasLimit: 3000000n,
    });

    // Wait for deployment
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();

    return {
      success: true,
      address,
      transactionHash: deployTx?.hash,
      explorerUrl: `${ZKEVM_CONFIG.explorerUrl}/address/${address}`,
    };
  } catch (error) {
    console.error('Contract deployment error:', error);
    throw error;
  }
};

/**
 * Grant minter role to Immutable Minting API
 * @param {object} contract - Deployed contract instance
 */
export const grantImmutableMinterRole = async (contract) => {
  try {
    const tx = await contract.grantMinterRole(ZKEVM_CONFIG.immutableMinter);
    await tx.wait();
    return {
      success: true,
      transactionHash: tx.hash,
    };
  } catch (error) {
    console.error('Grant minter role error:', error);
    throw error;
  }
};

export default {
  initializePassport,
  connectPassport,
  getPassportUser,
  logoutPassport,
  deployNFTContract,
  grantImmutableMinterRole,
  ZKEVM_CONFIG,
};
