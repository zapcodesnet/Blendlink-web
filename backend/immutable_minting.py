"""
Immutable zkEVM NFT Minting Service for Blendlink
- Gasless minting via Immutable Minting API
- ERC-721 support for photos, videos, music NFTs
- Contract: 0x0116c46e3c84e39c2c38ad5a3273b51d68d6e4bb
"""

import os
import httpx
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Configuration
IMMUTABLE_CONFIG = {
    "contract_address": os.environ.get("IMMUTABLE_NFT_CONTRACT", "0x0116c46e3c84e39c2c38ad5a3273b51d68d6e4bb"),
    "api_key": os.environ.get("IMMUTABLE_MINTING_API_KEY", ""),
    "chain_id": os.environ.get("IMMUTABLE_CHAIN_ID", "eip155:13371"),
    "api_base": "https://api.immutable.com/v1",
    "explorer_url": "https://explorer.immutable.com",
}

# Pydantic Models
class NFTMetadata(BaseModel):
    name: str
    description: Optional[str] = ""
    image: str  # IPFS URI or HTTPS URL
    animation_url: Optional[str] = None  # For videos/music
    external_url: Optional[str] = None
    attributes: Optional[List[Dict[str, Any]]] = []

class MintRequest(BaseModel):
    owner_address: str
    token_id: str
    metadata: NFTMetadata

class MintResponse(BaseModel):
    success: bool
    mint_request_id: Optional[str] = None
    token_id: Optional[str] = None
    transaction_hash: Optional[str] = None
    error: Optional[str] = None

class ImmutableMintingService:
    """Service for minting NFTs via Immutable Minting API"""
    
    def __init__(self):
        self.contract_address = IMMUTABLE_CONFIG["contract_address"]
        self.api_key = IMMUTABLE_CONFIG["api_key"]
        self.chain_id = IMMUTABLE_CONFIG["chain_id"]
        self.api_base = IMMUTABLE_CONFIG["api_base"]
        
        if not self.api_key:
            logger.warning("Immutable Minting API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API request headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "x-immutable-api-key": self.api_key,
        }
    
    async def mint_nft(
        self,
        owner_address: str,
        token_id: str,
        metadata: NFTMetadata
    ) -> MintResponse:
        """
        Mint a single NFT via Immutable Minting API (gasless)
        
        Args:
            owner_address: Wallet address to receive the NFT
            token_id: Unique token ID for this NFT
            metadata: NFT metadata (name, image, description, etc.)
        
        Returns:
            MintResponse with success status and details
        """
        if not self.api_key:
            return MintResponse(success=False, error="Minting API key not configured")
        
        url = f"{self.api_base}/chains/{self.chain_id}/collections/{self.contract_address}/nfts/mint-requests"
        
        payload = {
            "assets": [{
                "owner_address": owner_address,
                "token_id": token_id,
                "metadata": metadata.dict(exclude_none=True)
            }]
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                
                if response.status_code == 200 or response.status_code == 202:
                    data = response.json()
                    return MintResponse(
                        success=True,
                        mint_request_id=data.get("id") or data.get("mint_request_id"),
                        token_id=token_id,
                    )
                else:
                    error_msg = response.text
                    logger.error(f"Mint failed: {response.status_code} - {error_msg}")
                    return MintResponse(success=False, error=f"API Error: {response.status_code} - {error_msg}")
                    
        except Exception as e:
            logger.error(f"Mint exception: {str(e)}")
            return MintResponse(success=False, error=str(e))
    
    async def mint_batch(
        self,
        mint_requests: List[MintRequest]
    ) -> Dict[str, Any]:
        """
        Batch mint multiple NFTs (up to 100 per request)
        
        Args:
            mint_requests: List of MintRequest objects
        
        Returns:
            Dict with success status and results
        """
        if not self.api_key:
            return {"success": False, "error": "Minting API key not configured"}
        
        if len(mint_requests) > 100:
            return {"success": False, "error": "Maximum 100 NFTs per batch request"}
        
        url = f"{self.api_base}/chains/{self.chain_id}/collections/{self.contract_address}/nfts/mint-requests"
        
        payload = {
            "assets": [
                {
                    "owner_address": req.owner_address,
                    "token_id": req.token_id,
                    "metadata": req.metadata.dict(exclude_none=True)
                }
                for req in mint_requests
            ]
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                
                if response.status_code in [200, 202]:
                    data = response.json()
                    return {
                        "success": True,
                        "mint_request_id": data.get("id"),
                        "count": len(mint_requests),
                    }
                else:
                    return {"success": False, "error": f"API Error: {response.status_code} - {response.text}"}
                    
        except Exception as e:
            logger.error(f"Batch mint exception: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_mint_status(self, mint_request_id: str) -> Dict[str, Any]:
        """
        Check status of a mint request
        
        Args:
            mint_request_id: The ID returned from mint request
        
        Returns:
            Status information including transaction hash when complete
        """
        url = f"{self.api_base}/chains/{self.chain_id}/collections/{self.contract_address}/nfts/mint-requests/{mint_request_id}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._get_headers())
                
                if response.status_code == 200:
                    return {"success": True, "data": response.json()}
                else:
                    return {"success": False, "error": f"API Error: {response.status_code}"}
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_collection_info(self) -> Dict[str, Any]:
        """Get collection information from the contract"""
        url = f"{self.api_base}/chains/{self.chain_id}/collections/{self.contract_address}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._get_headers())
                
                if response.status_code == 200:
                    return {"success": True, "data": response.json()}
                else:
                    return {"success": False, "error": f"API Error: {response.status_code}"}
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_explorer_url(self, token_id: str) -> str:
        """Get explorer URL for a specific token"""
        return f"{IMMUTABLE_CONFIG['explorer_url']}/token/{self.contract_address}/instance/{token_id}"
    
    def get_contract_url(self) -> str:
        """Get explorer URL for the contract"""
        return f"{IMMUTABLE_CONFIG['explorer_url']}/address/{self.contract_address}"


# Singleton instance
minting_service = ImmutableMintingService()


# Helper function for generating unique token IDs
def generate_token_id(user_id: str, listing_id: str) -> str:
    """Generate a unique token ID based on user and listing"""
    import hashlib
    combined = f"{user_id}:{listing_id}:{datetime.now(timezone.utc).timestamp()}"
    hash_hex = hashlib.sha256(combined.encode()).hexdigest()[:16]
    return str(int(hash_hex, 16))  # Convert to numeric token ID
