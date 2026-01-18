"""
Blendlink NFT API Routes
- Mint NFTs for listings (photos, videos, music)
- Check mint status
- View collection info
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from immutable_minting import (
    minting_service,
    NFTMetadata,
    MintRequest,
    generate_token_id,
    IMMUTABLE_CONFIG,
)

logger = logging.getLogger(__name__)

nft_router = APIRouter(prefix="/nft", tags=["NFT"])


# Request/Response Models
class MintNFTRequest(BaseModel):
    """Request to mint an NFT for a listing"""
    listing_id: str
    owner_address: str  # Wallet address to receive NFT
    name: str
    description: Optional[str] = ""
    image_url: str  # IPFS or HTTPS URL
    animation_url: Optional[str] = None  # For video/audio
    attributes: Optional[List[Dict[str, Any]]] = []


class MintNFTResponse(BaseModel):
    success: bool
    token_id: Optional[str] = None
    mint_request_id: Optional[str] = None
    explorer_url: Optional[str] = None
    error: Optional[str] = None


class BatchMintRequest(BaseModel):
    """Request for batch minting"""
    items: List[MintNFTRequest]


# Routes
@nft_router.get("/config")
async def get_nft_config():
    """Get NFT contract configuration"""
    return {
        "contract_address": IMMUTABLE_CONFIG["contract_address"],
        "chain_name": IMMUTABLE_CONFIG["chain_name"],
        "chain_name": "Immutable zkEVM Mainnet",
        "explorer_url": minting_service.get_contract_url(),
        "minting_enabled": bool(IMMUTABLE_CONFIG["api_key"]),
    }


@nft_router.get("/collection")
async def get_collection_info():
    """Get collection information"""
    result = await minting_service.get_collection_info()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to get collection info"))
    return result["data"]


@nft_router.post("/mint", response_model=MintNFTResponse)
async def mint_nft(request: MintNFTRequest):
    """
    Mint a single NFT for a listing (gasless via Immutable Minting API)
    
    - Supports photos, videos, music with IPFS metadata
    - Owner receives NFT directly to their wallet
    - Returns token ID and explorer link
    """
    try:
        # Generate unique token ID
        token_id = generate_token_id(request.owner_address, request.listing_id)
        
        # Create metadata
        metadata = NFTMetadata(
            name=request.name,
            description=request.description or f"Blendlink NFT - {request.name}",
            image=request.image_url,
            animation_url=request.animation_url,
            external_url=f"https://blendlink.net/listing/{request.listing_id}",
            attributes=request.attributes or [
                {"trait_type": "Platform", "value": "Blendlink"},
                {"trait_type": "Listing ID", "value": request.listing_id},
            ]
        )
        
        # Mint via Immutable API
        result = await minting_service.mint_nft(
            owner_address=request.owner_address,
            token_id=token_id,
            metadata=metadata
        )
        
        if result.success:
            return MintNFTResponse(
                success=True,
                token_id=token_id,
                mint_request_id=result.mint_request_id,
                explorer_url=minting_service.get_explorer_url(token_id),
            )
        else:
            return MintNFTResponse(success=False, error=result.error)
            
    except Exception as e:
        logger.error(f"Mint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@nft_router.post("/mint/batch")
async def mint_batch(request: BatchMintRequest):
    """
    Batch mint multiple NFTs (up to 100 per request)
    """
    if len(request.items) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 NFTs per batch")
    
    try:
        mint_requests = []
        for item in request.items:
            token_id = generate_token_id(item.owner_address, item.listing_id)
            metadata = NFTMetadata(
                name=item.name,
                description=item.description or f"Blendlink NFT - {item.name}",
                image=item.image_url,
                animation_url=item.animation_url,
                external_url=f"https://blendlink.net/listing/{item.listing_id}",
                attributes=item.attributes or [
                    {"trait_type": "Platform", "value": "Blendlink"},
                    {"trait_type": "Listing ID", "value": item.listing_id},
                ]
            )
            mint_requests.append(MintRequest(
                owner_address=item.owner_address,
                token_id=token_id,
                metadata=metadata
            ))
        
        result = await minting_service.mint_batch(mint_requests)
        return result
        
    except Exception as e:
        logger.error(f"Batch mint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@nft_router.get("/mint/status/{mint_request_id}")
async def get_mint_status(mint_request_id: str):
    """
    Check the status of a mint request
    
    - Returns pending/completed status
    - Includes transaction hash when complete
    """
    result = await minting_service.get_mint_status(mint_request_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to get status"))
    return result["data"]


@nft_router.get("/token/{token_id}")
async def get_token_info(token_id: str):
    """Get token explorer URL"""
    return {
        "token_id": token_id,
        "contract_address": IMMUTABLE_CONFIG["contract_address"],
        "explorer_url": minting_service.get_explorer_url(token_id),
    }
