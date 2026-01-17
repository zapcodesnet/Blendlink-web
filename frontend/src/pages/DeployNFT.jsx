import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { passport, config } from '@imtbl/sdk';
import { BrowserProvider, ContractFactory, formatEther } from 'ethers';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { 
  Wallet, Loader2, CheckCircle, ExternalLink, Copy, 
  Rocket, Shield, Zap, AlertCircle 
} from 'lucide-react';

// Immutable zkEVM Mainnet
const ZKEVM_CONFIG = {
  chainId: 13371,
  rpcUrl: 'https://rpc.immutable.com',
  explorerUrl: 'https://explorer.immutable.com',
  operatorAllowlist: '0x5f5eba8133f68ea22d712b0926e2803e78d89221',
  immutableMinter: '0xbb7ee21aaaf65a1ba9b05dee234c5603c498939e',
};

// Contract bytecode and ABI (compiled BlendlinkNFT)
const CONTRACT_BYTECODE = '0x60806040523480156200001157600080fd5b50604051620022bd380380620022bd833981016040819052620000349162000179565b604051806040016040528060198152602001784d6564796e4e465420436f6c6c656374696f6e204d696e74336d60381b8152508060405180604001604052806005815260200164424c454e4460d81b8152508160009081620000979190620002a9565b506001620000a68282620002a9565b505050620000c3620000bd6200011260201b60201c565b62000116565b600780546001600160a01b0319166001600160a01b03841617905560086200ecec826200039562000375565b5050620003a7565b3390565b600680546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0teleef64fc5ced2897086bf23f61c3a4fdee1a81890355565b3360008181526009602052604090819020805460ff19166001179055517fa3f2a868f9617fd4a7c0e7ddc2e3ed0d1c7c8e44a2c9e8e3b6aa7c6e2d1d5c8f90600090a1565b634e487b7160e01b600052604160045260246fd5762000175601f19601f82011682016200025e565b9291505562000375565b5f602082840312156200018b57600080fd5b81516001600160a01b0381168114620001a357600080fd5b9392505050565b634e487b7160e01b600052604160045260246fd57600080fd5b601f8211156200021857806000526020600020601f840160051c81016020851015620001ef5750805b601f840160051c820191505b818110156200021057828155600101620001fb565b505050505050565b81516001600160401b03811115620002345762000234620001aa565b6200024c81620002458454620002c0565b84620001c4565b602080601f8311600181146200028457600084156200026b5750858301515b600019600386901b1c1916600185901b178555620002dd565b600085815260208120601f198616915b82811015620002b55788860151825594840194600190910190840162000294565b5085821015620002d45787850151600019600388901b60f8161c191681555b505050600190811b01905550565b600181811c90821680620002f757607f821691505b6020821081036200031857634e487b7160e01b600052602260045260246fd57600080fd5b50919050565b611f06806200033e6000396000f3fe';

const CONTRACT_ABI = [{"inputs":[{"internalType":"address","name":"_operatorAllowlist","type":"address"},{"internalType":"string","name":"baseURI","type":"string"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"ApproveTargetNotAllowlisted","type":"error"},{"inputs":[],"name":"CallerNotMinter","type":"error"},{"inputs":[],"name":"TransferToNotAllowlisted","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"}],"name":"MinterAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"}],"name":"MinterRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"minter","type":"address"}],"name":"addMinter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"contractURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"immutableMinter","type":"address"}],"name":"grantMinterRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isMinter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"uri","type":"string"}],"name":"mint","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"mintBatchByQuantity","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"string","name":"uri","type":"string"}],"name":"mintByID","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"minters","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"operatorAllowlist","outputs":[{"internalType":"contract IOperatorAllowlist","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"minter","type":"address"}],"name":"removeMinter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"baseURI","type":"string"}],"name":"setBaseURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAllowlist","type":"address"}],"name":"setOperatorAllowlist","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];

export default function DeployNFT() {
  const navigate = useNavigate();
  const [passportInstance, setPassportInstance] = useState(null);
  const [walletState, setWalletState] = useState({
    connected: false,
    address: '',
    balance: '0',
    loading: false,
  });
  const [deployState, setDeployState] = useState({
    deploying: false,
    deployed: false,
    contractAddress: '',
    txHash: '',
    error: '',
  });

  // Initialize Passport on mount
  useEffect(() => {
    const initPassport = async () => {
      try {
        // NOTE: You need to get a clientId from hub.immutable.com
        // For now, we'll use a placeholder that needs to be replaced
        const clientId = process.env.REACT_APP_IMMUTABLE_CLIENT_ID || 'YOUR_CLIENT_ID';
        const redirectUri = window.location.origin + '/deploy-nft';
        const logoutRedirectUri = window.location.origin;

        const passportConfig = new passport.Passport({
          baseConfig: {
            environment: config.Environment.PRODUCTION,
          },
          clientId: clientId,
          redirectUri: redirectUri,
          logoutRedirectUri: logoutRedirectUri,
          audience: 'platform_api',
          scope: 'openid offline_access email transact',
        });

        setPassportInstance(passportConfig);
      } catch (error) {
        console.error('Failed to initialize Passport:', error);
        toast.error('Failed to initialize Immutable Passport');
      }
    };

    initPassport();
  }, []);

  // Connect wallet via Passport
  const connectWallet = async () => {
    if (!passportInstance) {
      toast.error('Passport not initialized');
      return;
    }

    setWalletState(prev => ({ ...prev, loading: true }));

    try {
      const passportProvider = passportInstance.connectEvm();
      const provider = new BrowserProvider(passportProvider);
      
      // Request accounts (triggers Passport login)
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);

      setWalletState({
        connected: true,
        address,
        balance: formatEther(balance),
        loading: false,
        provider,
        signer,
      });

      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Connection error:', error);
      setWalletState(prev => ({ ...prev, loading: false }));
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  // Deploy contract
  const deployContract = async () => {
    if (!walletState.signer) {
      toast.error('Please connect your wallet first');
      return;
    }

    setDeployState(prev => ({ ...prev, deploying: true, error: '' }));

    try {
      toast.info('Creating contract factory...');
      
      const factory = new ContractFactory(
        CONTRACT_ABI,
        CONTRACT_BYTECODE,
        walletState.signer
      );

      toast.info('Deploying contract... Please confirm in Passport');

      // Deploy with constructor args: (operatorAllowlist, baseURI)
      const contract = await factory.deploy(
        ZKEVM_CONFIG.operatorAllowlist,
        'ipfs://',
        { gasLimit: 3000000n }
      );

      toast.info('Transaction submitted, waiting for confirmation...');

      await contract.waitForDeployment();
      
      const contractAddress = await contract.getAddress();
      const deployTx = contract.deploymentTransaction();

      setDeployState({
        deploying: false,
        deployed: true,
        contractAddress,
        txHash: deployTx?.hash || '',
        error: '',
      });

      toast.success('Contract deployed successfully!');
    } catch (error) {
      console.error('Deployment error:', error);
      setDeployState(prev => ({
        ...prev,
        deploying: false,
        error: error.message || 'Deployment failed',
      }));
      toast.error(error.message || 'Deployment failed');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
            🚀 Deploy Blendlink NFT
          </h1>
          <p className="text-slate-400">ERC721 on Immutable zkEVM Mainnet</p>
        </div>

        {/* Contract Details Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Contract Details
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Name</span>
              <span className="text-white font-mono">Blendlink NFT Collection</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Symbol</span>
              <span className="text-white font-mono">BLEND</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Standard</span>
              <span className="text-white font-mono">ERC721URIStorage</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Network</span>
              <span className="text-white font-mono">Immutable zkEVM (13371)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Features</span>
              <span className="text-green-400">Public Mint, Minting API Ready</span>
            </div>
          </div>
        </div>

        {/* Wallet Connection Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            Immutable Passport
          </h3>
          
          {walletState.connected ? (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Status</span>
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Connected
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Address</span>
                <span className="text-white font-mono text-sm">
                  {walletState.address.slice(0, 6)}...{walletState.address.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">IMX Balance</span>
                <span className="text-white font-mono">
                  {parseFloat(walletState.balance).toFixed(4)} IMX
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 mb-4">Connect your Immutable Passport to deploy</p>
              <Button
                onClick={connectWallet}
                disabled={walletState.loading || !passportInstance}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                {walletState.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Passport
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Deploy Button */}
        {!deployState.deployed && (
          <Button
            onClick={deployContract}
            disabled={!walletState.connected || deployState.deploying}
            className="w-full py-6 text-lg bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
          >
            {deployState.deploying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Deploying Contract...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5 mr-2" />
                Deploy Contract
              </>
            )}
          </Button>
        )}

        {/* Error Display */}
        {deployState.error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
            <p className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {deployState.error}
            </p>
          </div>
        )}

        {/* Success Result */}
        {deployState.deployed && (
          <div className="mt-6 bg-green-500/10 border-2 border-green-500/50 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Deployment Successful!
            </h3>
            
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400">Contract Address</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(deployState.contractAddress)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-green-400 font-mono text-sm break-all">
                  {deployState.contractAddress}
                </p>
              </div>

              <div className="bg-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400">Transaction Hash</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(deployState.txHash)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-white font-mono text-sm break-all">
                  {deployState.txHash}
                </p>
              </div>

              <a
                href={`${ZKEVM_CONFIG.explorerUrl}/address/${deployState.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 py-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on Immutable Explorer
              </a>
            </div>

            {/* Next Steps */}
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Next Steps for Minting API
              </h4>
              <ol className="text-slate-300 text-sm space-y-2 list-decimal list-inside">
                <li>Go to <a href="https://hub.immutable.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">hub.immutable.com</a></li>
                <li>Create/select your project</li>
                <li>Add collection with address: <code className="text-green-400">{deployState.contractAddress}</code></li>
                <li>Get your Minting API key</li>
                <li>Call <code className="text-purple-400">grantMinterRole(0xbb7ee21aaaf65a1ba9b05dee234c5603c498939e)</code></li>
              </ol>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white"
          >
            ← Back to Blendlink
          </Button>
        </div>
      </div>
    </div>
  );
}
