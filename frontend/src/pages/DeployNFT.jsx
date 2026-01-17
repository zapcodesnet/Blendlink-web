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
const CONTRACT_BYTECODE = '0x60806040523480156200001157600080fd5b50604051620022bd380380620022bd8339810160408190526200003491620001a3565b6040518060400160405280601881526020017f426c656e646c696e6b204e465420436f6c6c656374696f6e000000000000000081525060405180604001604052806005815260200164109311539160da1b815250816000908162000099919062000328565b506001620000a8828262000328565b505050620000c5620000bf6200013760201b60201c565b6200013b565b600980546001600160a01b0319166001600160a01b038416179055600b620000ee828262000328565b50336000818152600a6020526040808220805460ff19166001179055517f6ae172837ea30b801fbfcdd4108aa1d5bf8ff775444fd70256b44e6bf3dfc3f69190a25050620003f4565b3390565b600780546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a35050565b634e487b7160e01b600052604160045260246000fd5b60008060408385031215620001b757600080fd5b82516001600160a01b0381168114620001cf57600080fd5b602084810151919350906001600160401b0380821115620001ef57600080fd5b818601915086601f8301126200020457600080fd5b8151818111156200021957620002196200018d565b604051601f8201601f19908116603f011681019083821181831017156200024457620002446200018d565b8160405282815289868487010111156200025d57600080fd5b600093505b8284101562000281578484018601518185018701529285019262000262565b60008684830101528096505050505050509250929050565b600181811c90821680620002ae57607f821691505b602082108103620002cf57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156200032357600081815260208120601f850160051c81016020861015620002fe5750805b601f850160051c820191505b818110156200031f578281556001016200030a565b5050505b505050565b81516001600160401b038111156200034457620003446200018d565b6200035c8162000355845462000299565b84620002d5565b602080601f8311600181146200039457600084156200037b5750858301515b600019600386901b1c1916600185901b1785556200031f565b600085815260208120601f198616915b82811015620003c557888601518255948401946001909101908401620003a4565b5085821015620003e45787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b611eb980620004046000396000f3fe608060405234801561001057600080fd5b50600436106101cf5760003560e01c8063715018a611610104578063b88d4fde116100a2578063e985e9c511610071578063e985e9c5146103f3578063f2fde38b1461042f578063f3422a1314610442578063f46eccc41461045557600080fd5b8063b88d4fde14610381578063c87b56dd14610394578063d0def521146103a7578063e8a3d485146103ba57600080fd5b806395d89b41116100de57806395d89b411461033a578063983b2d56146102af578063a22cb46514610342578063aa271e1a1461035557600080fd5b8063715018a61461030e57806374c1a9a4146103165780638da5cb5b1461032957600080fd5b806329326f291161017157806342842e0e1161014b57806342842e0e146102c257806355f804b3146102d55780636352211e146102e857806370a08231146102fb57600080fd5b806329326f29146102895780633092afd51461029c5780633dd1eb61146102af57600080fd5b8063095ea7b3116101ad578063095ea7b31461023c57806318160ddd14610251578063199f81431461026357806323b872dd1461027657600080fd5b806301ffc9a7146101d457806306fdde03146101fc578063081812fc14610211575b600080fd5b6101e76101e23660046117da565b610478565b60405190151581526020015b60405180910390f35b6102046104ca565b6040516101f39190611847565b61022461021f36600461185a565b61055c565b6040516001600160a01b0390911681526020016101f3565b61024f61024a36600461188f565b610583565b005b6008545b6040519081526020016101f3565b61024f6102713660046118b9565b610643565b61024f6102843660046118d4565b61066d565b600954610224906001600160a01b031681565b61024f6102aa3660046118b9565b6106ac565b61024f6102bd3660046118b9565b6106fd565b61024f6102d03660046118d4565b610751565b61024f6102e33660046119bc565b61076c565b6102246102f636600461185a565b610780565b6102556103093660046118b9565b6107e0565b61024f610866565b61024f61032436600461188f565b61087a565b6007546001600160a01b0316610224565b610204610901565b61024f6103503660046119ff565b610910565b6101e76103633660046118b9565b6001600160a01b03166000908152600a602052604090205460ff1690565b61024f61038f366004611a36565b6109c1565b6102046103a236600461185a565b6109f9565b6102556103b5366004611ab2565b610afc565b60408051808201909152601c81527f697066733a2f2f516d426c656e646c696e6b436f6c6c656374696f6e000000006020820152610204565b6101e7610401366004611b00565b6001600160a01b03918216600090815260056020908152604080832093909416825291909152205460ff1690565b61024f61043d3660046118b9565b610b30565b61024f610450366004611b33565b610ba9565b6101e76104633660046118b9565b600a6020526000908152604090205460ff1681565b60006001600160e01b031982166380ac58cd60e01b14806104a957506001600160e01b03198216635b5e139f60e01b145b806104c457506301ffc9a760e01b6001600160e01b03198316145b92915050565b6060600080546104d990611b8a565b80601f016020809104026020016040519081016040528092919081815260200182805461050590611b8a565b80156105525780601f1061052757610100808354040283529160200191610552565b820191906000526020600020905b81548152906001019060200180831161053557829003601f168201915b5050505050905090565b600061056782610c06565b506000908152600460205260409020546001600160a01b031690565b6009546001600160a01b0316158015906105a557506001600160a01b03821615155b15610635576009546040516305a3b80960e01b81526001600160a01b038481166004830152909116906305a3b80990602401602060405180830381865afa1580156105f4573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906106189190611bc4565b6106355760405163368656d160e21b815260040160405180910390fd5b61063f8282610c65565b5050565b61064b610d75565b600980546001600160a01b0319166001600160a01b0392909216919091179055565b6106773382610dcf565b61069c5760405162461bcd60e51b815260040161069390611be1565b60405180910390fd5b6106a7838383610e4d565b505050565b6106b4610d75565b6001600160a01b0381166000818152600a6020526040808220805460ff19169055517fe94479a9f7e1952cc78f2d6baab678adc1b772d936c6583def489e524cb666929190a250565b610705610d75565b6001600160a01b0381166000818152600a6020526040808220805460ff19166001179055517f6ae172837ea30b801fbfcdd4108aa1d5bf8ff775444fd70256b44e6bf3dfc3f69190a250565b6106a7838383604051806020016040528060008152506109c1565b610774610d75565b600b61063f8282611c7c565b6000818152600260205260408120546001600160a01b0316806104c45760405162461bcd60e51b8152602060048201526018602482015277115490cdcc8c4e881a5b9d985b1a59081d1bdad95b88125160421b6044820152606401610693565b60006001600160a01b03821661084a5760405162461bcd60e51b815260206004820152602960248201527f4552433732313a2061646472657373207a65726f206973206e6f7420612076616044820152683634b21037bbb732b960b91b6064820152608401610693565b506001600160a01b031660009081526003602052604090205490565b61086e610d75565b6108786000610fbe565b565b336000908152600a602052604090205460ff161580156108a557506007546001600160a01b03163314155b156108c357604051632f771b3d60e11b815260040160405180910390fd5b60005b818110156106a757600880549060006108de83611d3c565b91905055506108ef83600854611010565b806108f981611d3c565b9150506108c6565b6060600180546104d990611b8a565b6009546001600160a01b0316158015906109275750805b156109b7576009546040516305a3b80960e01b81526001600160a01b038481166004830152909116906305a3b80990602401602060405180830381865afa158015610976573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061099a9190611bc4565b6109b75760405163368656d160e21b815260040160405180910390fd5b61063f828261102a565b6109cb3383610dcf565b6109e75760405162461bcd60e51b815260040161069390611be1565b6109f384848484611035565b50505050565b6060610a0482610c06565b60008281526006602052604081208054610a1d90611b8a565b80601f0160208091040260200160405190810160405280929190818152602001828054610a4990611b8a565b8015610a965780601f10610a6b57610100808354040283529160200191610a96565b820191906000526020600020905b815481529060010190602001808311610a7957829003601f168201915b505050505090506000610aa7611068565b90508051600003610ab9575092915050565b815115610aeb578082604051602001610ad3929190611d63565b60405160208183030381529060405292505050919050565b610af484611077565b949350505050565b6008805460009182610b0d83611d3c565b9091555050600854610b1f8482611010565b610b2981846110dd565b9392505050565b610b38610d75565b6001600160a01b038116610b9d5760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b6064820152608401610693565b610ba681610fbe565b50565b336000908152600a602052604090205460ff16158015610bd457506007546001600160a01b03163314155b15610bf257604051632f771b3d60e11b815260040160405180910390fd5b610bfc8383611010565b6106a782826110dd565b6000818152600260205260409020546001600160a01b0316610ba65760405162461bcd60e51b8152602060048201526018602482015277115490cdcc8c4e881a5b9d985b1a59081d1bdad95b88125160421b6044820152606401610693565b6000610c7082610780565b9050806001600160a01b0316836001600160a01b031603610cdd5760405162461bcd60e51b815260206004820152602160248201527f4552433732313a20617070726f76616c20746f2063757272656e74206f776e656044820152603960f91b6064820152608401610693565b336001600160a01b0382161480610cf95750610cf98133610401565b610d6b5760405162461bcd60e51b815260206004820152603d60248201527f4552433732313a20617070726f76652063616c6c6572206973206e6f7420746f60448201527f6b656e206f776e6572206f7220617070726f76656420666f7220616c6c0000006064820152608401610693565b6106a78383611170565b6007546001600160a01b031633146108785760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e65726044820152606401610693565b600080610ddb83610780565b9050806001600160a01b0316846001600160a01b03161480610e2257506001600160a01b0380821660009081526005602090815260408083209388168352929052205460ff165b80610af45750836001600160a01b0316610e3b8461055c565b6001600160a01b031614949350505050565b826001600160a01b0316610e6082610780565b6001600160a01b031614610e865760405162461bcd60e51b815260040161069390611d92565b6001600160a01b038216610ee85760405162461bcd60e51b8152602060048201526024808201527f4552433732313a207472616e7366657220746f20746865207a65726f206164646044820152637265737360e01b6064820152608401610693565b610ef583838360016111de565b826001600160a01b0316610f0882610780565b6001600160a01b031614610f2e5760405162461bcd60e51b815260040161069390611d92565b600081815260046020908152604080832080546001600160a01b03199081169091556001600160a01b0387811680865260038552838620805460001901905590871680865283862080546001019055868652600290945282852080549092168417909155905184937fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4505050565b600780546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a35050565b61063f8282604051806020016040528060008152506112be565b61063f3383836112f1565b611040848484610e4d565b61104c848484846113bf565b6109f35760405162461bcd60e51b815260040161069390611dd7565b6060600b80546104d990611b8a565b606061108282610c06565b600061108c611068565b905060008151116110ac5760405180602001604052806000815250610b29565b806110b6846114c0565b6040516020016110c7929190611d63565b6040516020818303038152906040529392505050565b6000828152600260205260409020546001600160a01b03166111585760405162461bcd60e51b815260206004820152602e60248201527f45524337323155524953746f726167653a2055524920736574206f66206e6f6e60448201526d32bc34b9ba32b73a103a37b5b2b760911b6064820152608401610693565b60008281526006602052604090206106a78282611c7c565b600081815260046020526040902080546001600160a01b0319166001600160a01b03841690811790915581906111a582610780565b6001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45050565b6001600160a01b038416158015906111fe57506001600160a01b03831615155b801561121457506009546001600160a01b031615155b156112b957336001600160a01b0385161480159061129b57506009546040516305a3b80960e01b81523360048201526001600160a01b03909116906305a3b80990602401602060405180830381865afa158015611275573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112999190611bc4565b155b156112b95760405163473bbadd60e11b815260040160405180910390fd5b6109f3565b6112c88383611553565b6112d560008484846113bf565b6106a75760405162461bcd60e51b815260040161069390611dd7565b816001600160a01b0316836001600160a01b0316036113525760405162461bcd60e51b815260206004820152601960248201527f4552433732313a20617070726f766520746f2063616c6c6572000000000000006044820152606401610693565b6001600160a01b03838116600081815260056020908152604080832094871680845294825291829020805460ff191686151590811790915591519182527f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a3505050565b60006001600160a01b0384163b156114b557604051630a85bd0160e11b81526001600160a01b0385169063150b7a0290611403903390899088908890600401611e29565b6020604051808303816000875af192505050801561143e575060408051601f3d908101601f1916820190925261143b91810190611e66565b60015b61149b573d80801561146c576040519150601f19603f3d011682016040523d82523d6000602084013e611471565b606091505b5080516000036114935760405162461bcd60e51b815260040161069390611dd7565b805181602001fd5b6001600160e01b031916630a85bd0160e11b149050610af4565b506001949350505050565b606060006114cd836116ec565b600101905060008167ffffffffffffffff8111156114ed576114ed611910565b6040519080825280601f01601f191660200182016040528015611517576020820181803683370190505b5090508181016020015b600019016f181899199a1a9b1b9c1cb0b131b232b360811b600a86061a8153600a850494508461152157509392505050565b6001600160a01b0382166115a95760405162461bcd60e51b815260206004820181905260248201527f4552433732313a206d696e7420746f20746865207a65726f20616464726573736044820152606401610693565b6000818152600260205260409020546001600160a01b03161561160e5760405162461bcd60e51b815260206004820152601c60248201527f4552433732313a20746f6b656e20616c7265616479206d696e746564000000006044820152606401610693565b61161c6000838360016111de565b6000818152600260205260409020546001600160a01b0316156116815760405162461bcd60e51b815260206004820152601c60248201527f4552433732313a20746f6b656e20616c7265616479206d696e746564000000006044820152606401610693565b6001600160a01b038216600081815260036020908152604080832080546001019055848352600290915280822080546001600160a01b0319168417905551839291907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a45050565b60008072184f03e93ff9f4daa797ed6e38ed64bf6a1f0160401b831061172b5772184f03e93ff9f4daa797ed6e38ed64bf6a1f0160401b830492506040015b6d04ee2d6d415b85acef81000000008310611757576d04ee2d6d415b85acef8100000000830492506020015b662386f26fc10000831061177557662386f26fc10000830492506010015b6305f5e100831061178d576305f5e100830492506008015b61271083106117a157612710830492506004015b606483106117b3576064830492506002015b600a83106104c45760010192915050565b6001600160e01b031981168114610ba657600080fd5b6000602082840312156117ec57600080fd5b8135610b29816117c4565b60005b838110156118125781810151838201526020016117fa565b50506000910152565b600081518084526118338160208601602086016117f7565b601f01601f19169290920160200192915050565b602081526000610b29602083018461181b565b60006020828403121561186c57600080fd5b5035919050565b80356001600160a01b038116811461188a57600080fd5b919050565b600080604083850312156118a257600080fd5b6118ab83611873565b946020939093013593505050565b6000602082840312156118cb57600080fd5b610b2982611873565b6000806000606084860312156118e957600080fd5b6118f284611873565b925061190060208501611873565b9150604084013590509250925092565b634e487b7160e01b600052604160045260246000fd5b600067ffffffffffffffff8084111561194157611941611910565b604051601f8501601f19908116603f0116810190828211818310171561196957611969611910565b8160405280935085815286868601111561198257600080fd5b858560208301376000602087830101525050509392505050565b600082601f8301126119ad57600080fd5b610b2983833560208501611926565b6000602082840312156119ce57600080fd5b813567ffffffffffffffff8111156119e557600080fd5b610af48482850161199c565b8015158114610ba657600080fd5b60008060408385031215611a1257600080fd5b611a1b83611873565b91506020830135611a2b816119f1565b809150509250929050565b60008060008060808587031215611a4c57600080fd5b611a5585611873565b9350611a6360208601611873565b925060408501359150606085013567ffffffffffffffff811115611a8657600080fd5b8501601f81018713611a9757600080fd5b611aa687823560208401611926565b91505092959194509250565b60008060408385031215611ac557600080fd5b611ace83611873565b9150602083013567ffffffffffffffff811115611aea57600080fd5b611af68582860161199c565b9150509250929050565b60008060408385031215611b1357600080fd5b611b1c83611873565b9150611b2a60208401611873565b90509250929050565b600080600060608486031215611b4857600080fd5b611b5184611873565b925060208401359150604084013567ffffffffffffffff811115611b7457600080fd5b611b808682870161199c565b9150509250925092565b600181811c90821680611b9e57607f821691505b602082108103611bbe57634e487b7160e01b600052602260045260246000fd5b50919050565b600060208284031215611bd657600080fd5b8151610b29816119f1565b6020808252602d908201527f4552433732313a2063616c6c6572206973206e6f7420746f6b656e206f776e6560408201526c1c881bdc88185c1c1c9bdd9959609a1b606082015260800190565b601f8211156106a757600081815260208120601f850160051c81016020861015611c555750805b601f850160051c820191505b81811015611c7457828155600101611c61565b505050505050565b815167ffffffffffffffff811115611c9657611c96611910565b611caa81611ca48454611b8a565b84611c2e565b602080601f831160018114611cdf5760008415611cc75750858301515b600019600386901b1c1916600185901b178555611c74565b600085815260208120601f198616915b82811015611d0e57888601518255948401946001909101908401611cef565b5085821015611d2c5787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b600060018201611d5c57634e487b7160e01b600052601160045260246000fd5b5060010190565b60008351611d758184602088016117f7565b835190830190611d898183602088016117f7565b01949350505050565b60208082526025908201527f4552433732313a207472616e736665722066726f6d20696e636f72726563742060408201526437bbb732b960d91b606082015260800190565b60208082526032908201527f4552433732313a207472616e7366657220746f206e6f6e20455243373231526560408201527131b2b4bb32b91034b6b83632b6b2b73a32b960711b606082015260800190565b6001600160a01b0385811682528416602082015260408101839052608060608201819052600090611e5c9083018461181b565b9695505050505050565b600060208284031215611e7857600080fd5b8151610b29816117c456fea2646970667358221220c50b99e3d43302a6b14198771bea3c5fd8d7e889a8e88b4536ed1a4d2544b4c864736f6c63430008130033';

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
