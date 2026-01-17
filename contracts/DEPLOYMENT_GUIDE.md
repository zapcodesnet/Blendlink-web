# Blendlink NFT Deployment Guide - Immutable zkEVM Mainnet

## Contract Details
- **Name:** Blendlink NFT Collection
- **Symbol:** BLEND  
- **Standard:** ERC721URIStorage
- **Network:** Immutable zkEVM Mainnet (Chain ID: 13371)

## Network Configuration for MetaMask

Add this network to MetaMask:
| Field | Value |
|-------|-------|
| Network Name | Immutable zkEVM Mainnet |
| RPC URL | https://rpc.immutable.com |
| Chain ID | 13371 |
| Currency Symbol | IMX |
| Block Explorer | https://explorer.immutable.com |

## Deployment Steps

### Step 1: Open Remix IDE
Go to: https://remix.ethereum.org

### Step 2: Create Contract File
1. In File Explorer, create new file: `BlendlinkNFT.sol`
2. Copy the contract code from `/app/contracts/BlendlinkNFT.sol`

### Step 3: Compile
1. Go to "Solidity Compiler" tab (left sidebar)
2. Select compiler version: `0.8.19`
3. Enable optimization: `200 runs`
4. Click "Compile BlendlinkNFT.sol"

### Step 4: Deploy
1. Go to "Deploy & Run Transactions" tab
2. Environment: Select **"Injected Provider - MetaMask"**
3. Make sure MetaMask is connected to **Immutable zkEVM Mainnet**
4. Contract: Select **"BlendlinkNFT"**
5. Constructor Parameters:
   - `_operatorAllowlist`: `0x5f5eba8133f68ea22d712b0926e2803e78d89221`
   - `baseURI`: `ipfs://` (or your IPFS base URI)
6. Click **"Deploy"**
7. Confirm transaction in MetaMask (~0.001-0.01 IMX gas)

### Step 5: After Deployment
1. Copy the deployed contract address
2. Verify on explorer: https://explorer.immutable.com/address/YOUR_CONTRACT_ADDRESS

## Post-Deployment: Enable Minting API

To enable gasless mints via Immutable Minting API:

1. Call `grantMinterRole()` with Immutable's minter address:
   - Mainnet Minter: `0xbb7ee21aaaf65a1ba9b05dee234c5603c498939e`

2. In Remix, after deployment:
   - Find your deployed contract in "Deployed Contracts"
   - Expand it and find `grantMinterRole`
   - Enter: `0xbb7ee21aaaf65a1ba9b05dee234c5603c498939e`
   - Click "transact" and confirm in MetaMask

## Contract Functions

| Function | Description |
|----------|-------------|
| `mint(to, tokenURI)` | Public mint - anyone can mint |
| `mintByID(to, tokenId, tokenURI)` | Mint specific ID (minter only) |
| `mintBatch(to, tokenURIs[])` | Batch mint multiple NFTs |
| `mintBatchByQuantity(to, quantity)` | Batch mint without URIs (minter only) |
| `addMinter(address)` | Add minter role (owner only) |
| `grantMinterRole(address)` | Grant Immutable Minting API access |
| `setBaseURI(uri)` | Update base metadata URI |
| `totalSupply()` | Get total minted count |

## Important Addresses

| Address Type | Address |
|--------------|---------|
| Operator Allowlist (Mainnet) | `0x5f5eba8133f68ea22d712b0926e2803e78d89221` |
| Immutable Minter (Mainnet) | `0xbb7ee21aaaf65a1ba9b05dee234c5603c498939e` |
| Block Explorer | https://explorer.immutable.com |

## Estimated Gas Cost
- Deployment: ~0.005-0.01 IMX (varies)
- Mint: ~0.001-0.003 IMX per token
- Your balance: $6.85 IMX ✅ (more than enough)
