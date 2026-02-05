"""
Blendlink AI-Powered Seller Dashboard
Features:
- AI Auto-Generate Listing Details from Photos (with weight/dimensions)
- AI Price Suggestions via Web Search
- AI Photo Background Removal & Enhancement
- AI Shipping Estimation & Provider Selection
- Seller Analytics & Performance Tracking
- Post-Sale Dashboard & Shipping Tools
- Returns & Refunds Management
"""

import os
import uuid
import base64
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from pydantic import BaseModel, Field, validator
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from jose import jwt, JWTError

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize routers
seller_router = APIRouter(prefix="/seller", tags=["Seller Dashboard"])
ai_tools_router = APIRouter(prefix="/ai-tools", tags=["AI Tools"])
shipping_router = APIRouter(prefix="/shipping", tags=["Shipping"])

# Database connection with fallback for preview environments
def get_mongo_connection():
    mongo_url = os.environ.get('MONGO_URL')
    mongo_url_local = os.environ.get('MONGO_URL_LOCAL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'blendlink')
    
    try:
        from pymongo import MongoClient as SyncMongoClient
        test_client = SyncMongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
        test_client.close()
        return AsyncIOMotorClient(mongo_url), db_name
    except Exception:
        return AsyncIOMotorClient(mongo_url_local), db_name

client, DB_NAME = get_mongo_connection()
db = client[DB_NAME]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = 'HS256'

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# ============== MODELS ==============

class AIListingRequest(BaseModel):
    images: List[str]  # Base64 encoded images
    condition: str = "new"  # "new", "like_new", "used", "fair", "poor"
    target_countries: List[str] = ["US"]
    category_hint: Optional[str] = None

class AIListingResponse(BaseModel):
    title: str
    description: str
    category: str
    suggested_tags: List[str]
    specifications: Dict[str, Any]
    detected_condition: str
    condition_details: str
    flaws_detected: List[str]
    features_detected: List[str]
    # New fields for weight and dimensions
    weight: Dict[str, Any]  # {"value": 2.5, "unit": "lbs"}
    dimensions: Dict[str, Any]  # {"length": 10, "width": 5, "height": 3, "unit": "in"}

class AIPriceRequest(BaseModel):
    title: str
    description: str
    condition: str
    target_countries: List[str]
    category: Optional[str] = None

class AIPriceResponse(BaseModel):
    retail_price: Optional[float]
    lowest_price: float
    average_price: float
    highest_price: float
    price_sources: List[Dict[str, Any]]
    recommended_price: float
    pricing_advice: str

class AIBackgroundRemovalRequest(BaseModel):
    image_base64: str
    background_type: str = "white"  # white, gray, gradient

class AIShippingRequest(BaseModel):
    images: Optional[List[str]] = None
    manual_dimensions: Optional[Dict[str, float]] = None  # length, width, height in inches
    manual_weight: Optional[float] = None  # in lbs
    origin_zip: str
    origin_location: Optional[Dict[str, float]] = None  # {"lat": x, "lng": y}
    destination_zip: Optional[str] = None
    destination_country: str = "US"

class AIShippingResponse(BaseModel):
    estimated_dimensions: Dict[str, float]
    estimated_weight: float
    shipping_options: List[Dict[str, Any]]
    recommended_provider: str
    packaging_advice: str
    packaging_materials_cost: float
    total_estimated_cost: float

class ShippingProviderLocation(BaseModel):
    provider: str
    name: str
    address: str
    distance_miles: float
    estimated_fee: float
    services: List[str]

class CreateListingRequest(BaseModel):
    title: str
    description: str
    price: float
    category: str
    condition: str
    images: List[str]
    tags: List[str] = []
    location: str = ""
    weight: Optional[Dict[str, Any]] = None
    dimensions: Optional[Dict[str, Any]] = None
    shipping_method: Optional[Dict[str, Any]] = None
    
    @validator('price')
    def price_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Price must be positive')
        return round(v, 2)
    
    @validator('weight')
    def weight_must_be_valid(cls, v):
        if v and v.get('value', 0) <= 0:
            raise ValueError('Weight must be positive')
        return v
    
    @validator('dimensions')
    def dimensions_must_be_valid(cls, v):
        if v:
            for key in ['length', 'width', 'height']:
                if v.get(key, 0) <= 0:
                    raise ValueError(f'{key} must be positive')
        return v

class SellerStats(BaseModel):
    total_listings: int
    active_listings: int
    sold_items: int
    total_revenue: float
    average_rating: float
    total_views: int
    conversion_rate: float
    bl_coins_earned: int

class ListingPerformance(BaseModel):
    listing_id: str
    title: str
    views: int
    favorites: int
    inquiries: int
    days_listed: int
    price: float
    status: str
    performance_score: float
    ai_recommendations: List[str]

class SoldItemDashboard(BaseModel):
    order_id: str
    listing_id: str
    title: str
    price: float
    buyer_name: str
    buyer_address: Dict[str, str]
    sold_at: str
    status: str  # pending_shipment, shipped, delivered
    shipping_method: Optional[Dict[str, Any]] = None
    tracking_number: Optional[str] = None

# ============== HELPER FUNCTIONS ==============

from fastapi import Request

async def get_current_user(request: Request):
    """Get current user from JWT token"""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def analyze_images_with_ai(images: List[str], condition: str, system_prompt: str) -> Dict[str, Any]:
    """Analyze product images using GPT-4o vision - includes weight and dimensions estimation"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"listing_analysis_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        # Create image contents from base64 images
        image_contents = []
        for i, img_base64 in enumerate(images[:5]):  # Max 5 images for vision
            # Clean base64 string if it has data URL prefix
            if ',' in img_base64:
                img_base64 = img_base64.split(',')[1]
            image_contents.append(ImageContent(image_base64=img_base64))
        
        # Build the analysis prompt
        condition_context = ""
        if condition == "new":
            condition_context = """
The item is marked as NEW. Focus on:
- Premium features and quality
- Highlight all positive aspects
- Note any accessories or packaging visible
- Emphasize value proposition for buyers
"""
        else:  # used
            condition_context = """
The item is marked as USED. You MUST honestly describe:
- ALL visible flaws (scratches, cracks, dents, holes, discoloration)
- Wear and tear signs
- Missing parts or accessories
- Damage of any kind
- Estimate overall condition percentage
Be thorough and honest - buyers appreciate transparency.
"""
        
        user_message = UserMessage(
            text=f"""Analyze these product images for a marketplace listing.

{condition_context}

Please provide a JSON response with these fields:
{{
    "title": "Compelling product title (max 80 chars)",
    "description": "Detailed, persuasive selling description highlighting features, benefits, and use cases. Make buyers want to purchase this item.",
    "category": "Best matching category",
    "suggested_tags": ["tag1", "tag2", ...],
    "specifications": {{
        "brand": "if identifiable",
        "model": "if visible",
        "material": "if identifiable",
        "color": "main color(s)",
        "sku_serial": "if visible"
    }},
    "weight": {{
        "value": estimated weight as a number (e.g., 2.5),
        "unit": "lbs",
        "estimate_confidence": "high/medium/low"
    }},
    "dimensions": {{
        "length": estimated length as a number (e.g., 10),
        "width": estimated width as a number (e.g., 5),
        "height": estimated height as a number (e.g., 3),
        "unit": "in",
        "estimate_confidence": "high/medium/low"
    }},
    "detected_condition": "new/like_new/good/fair/poor",
    "condition_details": "Detailed condition description",
    "flaws_detected": ["list of any flaws visible"],
    "features_detected": ["list of notable features"]
}}

IMPORTANT: For weight and dimensions, provide your best estimate based on:
- Visual cues in the images (hands, common objects for scale)
- Knowledge of similar products
- Standard sizing for the product category

Respond ONLY with valid JSON, no other text.""",
            file_contents=image_contents
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        import json
        # Clean response if needed
        response_text = response.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        try:
            result = json.loads(response_text.strip())
            # Ensure weight and dimensions exist with defaults
            if 'weight' not in result or not result['weight']:
                result['weight'] = {"value": 1.0, "unit": "lbs", "estimate_confidence": "low"}
            if 'dimensions' not in result or not result['dimensions']:
                result['dimensions'] = {"length": 6, "width": 4, "height": 2, "unit": "in", "estimate_confidence": "low"}
            return result
        except json.JSONDecodeError as je:
            # AI didn't return valid JSON, return a default structure
            logger.warning(f"AI returned non-JSON response: {response_text[:200]}")
            return {
                "title": "Product Listing",
                "description": response_text[:500] if response_text else "Unable to analyze image",
                "category": "General",
                "suggested_tags": [],
                "specifications": {},
                "weight": {"value": 1.0, "unit": "lbs", "estimate_confidence": "low"},
                "dimensions": {"length": 6, "width": 4, "height": 2, "unit": "in", "estimate_confidence": "low"},
                "detected_condition": condition,
                "condition_details": "Analysis pending",
                "flaws_detected": [],
                "features_detected": []
            }
        
    except Exception as e:
        logger.error(f"AI image analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

async def search_market_prices(title: str, condition: str, countries: List[str]) -> Dict[str, Any]:
    """Search for market prices using web search"""
    try:
        # Use web search to find prices
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"price_research_{uuid.uuid4().hex[:8]}",
            system_message="""You are a market research assistant. Search for product prices and provide accurate pricing data.
Always respond with valid JSON only."""
        ).with_model("openai", "gpt-4o")
        
        countries_str = ", ".join(countries)
        condition_text = "brand new" if condition == "new" else "used/pre-owned"
        
        user_message = UserMessage(
            text=f"""Research current market prices for: "{title}"

Condition: {condition_text}
Target markets: {countries_str}

Search eBay, Amazon, and Google Shopping mentally for similar items and provide realistic price estimates.

Return JSON format:
{{
    "retail_price": null or number (MSRP for new items),
    "lowest_price": number (lowest found price),
    "average_price": number (typical selling price),
    "highest_price": number (premium/highest price),
    "price_sources": [
        {{"source": "eBay", "price_range": "$X - $Y", "sample_listings": 3}},
        {{"source": "Amazon", "price_range": "$X - $Y", "sample_listings": 2}},
        {{"source": "Other", "price_range": "$X - $Y", "note": "..."}}
    ],
    "recommended_price": number (best price to list at for quick sale),
    "pricing_advice": "Brief advice on pricing strategy"
}}

Be realistic with prices based on current market conditions. Respond ONLY with valid JSON."""
        )
        
        response = await chat.send_message(user_message)
        
        import json
        response_text = response.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        return json.loads(response_text.strip())
        
    except Exception as e:
        print(f"Price research error: {e}")
        # Return mock data if search fails
        return {
            "retail_price": None,
            "lowest_price": 0,
            "average_price": 0,
            "highest_price": 0,
            "price_sources": [],
            "recommended_price": 0,
            "pricing_advice": "Unable to fetch prices. Please research manually."
        }

async def estimate_shipping(dimensions: Dict[str, float], weight: float, origin: str, destination: str, country: str, origin_location: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Estimate shipping costs with comprehensive breakdown including packaging materials"""
    
    # Calculate dimensional weight (DIM factor is 139 for domestic, 166 for international)
    dim_factor = 139 if country == "US" else 166
    dim_weight = (dimensions.get('length', 12) * dimensions.get('width', 12) * dimensions.get('height', 12)) / dim_factor
    billable_weight = max(weight, dim_weight)
    
    # Packaging materials cost estimation
    box_size = "small" if billable_weight < 2 else "medium" if billable_weight < 10 else "large"
    packaging_costs = {
        "small": {"box": 0.75, "tape": 0.25, "label": 0.10, "padding": 0.50, "total": 1.60},
        "medium": {"box": 1.50, "tape": 0.35, "label": 0.10, "padding": 1.00, "total": 2.95},
        "large": {"box": 2.50, "tape": 0.50, "label": 0.15, "padding": 1.50, "total": 4.65}
    }
    packaging = packaging_costs[box_size]
    
    # Estimated travel cost to drop-off (assuming average of 3 miles round trip)
    travel_cost = 1.50  # Base estimate for gas/time
    
    # Shipping providers with realistic rate calculation
    base_rates = {
        "USPS Ground Advantage": {"base": 4.50, "per_lb": 0.50, "days": "3-5", "provider": "USPS"},
        "USPS Priority Mail": {"base": 8.00, "per_lb": 0.75, "days": "1-3", "provider": "USPS"},
        "USPS Priority Mail Express": {"base": 26.00, "per_lb": 1.20, "days": "1-2", "provider": "USPS"},
        "UPS Ground": {"base": 9.00, "per_lb": 0.85, "days": "3-5", "provider": "UPS"},
        "UPS 2nd Day Air": {"base": 18.00, "per_lb": 1.50, "days": "2", "provider": "UPS"},
        "UPS Next Day Air": {"base": 35.00, "per_lb": 2.50, "days": "1", "provider": "UPS"},
        "FedEx Ground": {"base": 8.50, "per_lb": 0.80, "days": "3-5", "provider": "FedEx"},
        "FedEx Express Saver": {"base": 15.00, "per_lb": 1.25, "days": "3", "provider": "FedEx"},
        "FedEx 2Day": {"base": 20.00, "per_lb": 1.75, "days": "2", "provider": "FedEx"},
        "FedEx Priority Overnight": {"base": 40.00, "per_lb": 3.00, "days": "1", "provider": "FedEx"},
    }
    
    # International surcharge
    international = country != "US"
    int_multiplier = 2.5 if international else 1.0
    
    shipping_options = []
    for service_name, rates in base_rates.items():
        # Skip some domestic options for international
        if international and "Ground" in service_name:
            continue
            
        base_cost = (rates["base"] + (billable_weight * rates["per_lb"])) * int_multiplier
        total_cost = base_cost + packaging["total"] + travel_cost
        
        shipping_options.append({
            "provider": rates["provider"],
            "service": service_name,
            "base_shipping_cost": round(base_cost, 2),
            "packaging_cost": round(packaging["total"], 2),
            "travel_cost": round(travel_cost, 2),
            "total_estimated_cost": round(total_cost, 2),
            "delivery_days": rates["days"] + (" international" if international else ""),
            "tracking_included": True,
            "insurance_available": True,
            "pickup_available": "USPS" not in service_name,
            "cost_breakdown": {
                "shipping_fee": round(base_cost, 2),
                "box": packaging["box"],
                "tape": packaging["tape"],
                "label": packaging["label"],
                "padding": packaging["padding"],
                "travel": travel_cost
            }
        })
    
    # Sort by total cost
    shipping_options.sort(key=lambda x: x["total_estimated_cost"])
    
    # Generate nearby provider locations (mock data with realistic distances)
    provider_locations = []
    if origin_location:
        # Mock nearby locations based on common providers
        provider_locations = [
            {"provider": "USPS", "name": "USPS Post Office", "address": "123 Main St", "distance_miles": 0.5, "services": ["Ground Advantage", "Priority Mail", "Express"]},
            {"provider": "UPS", "name": "UPS Store", "address": "456 Oak Ave", "distance_miles": 1.2, "services": ["Ground", "2nd Day Air", "Next Day Air"]},
            {"provider": "FedEx", "name": "FedEx Office", "address": "789 Elm St", "distance_miles": 1.8, "services": ["Ground", "Express Saver", "2Day", "Priority Overnight"]},
            {"provider": "USPS", "name": "USPS Collection Box", "address": "Corner of Main & 2nd", "distance_miles": 0.2, "services": ["Ground Advantage", "Priority Mail"]},
        ]
        # Sort by distance
        provider_locations.sort(key=lambda x: x["distance_miles"])
    
    return {
        "billable_weight": round(billable_weight, 2),
        "dimensional_weight": round(dim_weight, 2),
        "actual_weight": round(weight, 2),
        "box_size_recommended": box_size,
        "packaging_materials_cost": round(packaging["total"], 2),
        "travel_cost_estimate": round(travel_cost, 2),
        "shipping_options": shipping_options,
        "provider_locations": provider_locations,
        "recommended_provider": shipping_options[0]["service"] if shipping_options else None,
        "packaging_advice": f"Use a {box_size} box. Include padding material to protect the item. Print shipping label clearly."
    }

# ============== AI TOOLS ENDPOINTS ==============

@ai_tools_router.post("/analyze-listing")
async def ai_analyze_listing(request: AIListingRequest, current_user: dict = Depends(get_current_user)):
    """AI analyzes product images and generates listing details"""
    
    if not request.images:
        raise HTTPException(status_code=400, detail="At least one image is required")
    
    if len(request.images) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 images allowed")
    
    system_prompt = """You are an expert e-commerce listing creator. Analyze product images and create compelling, accurate listings that drive sales. Be thorough in identifying product features, condition, and any flaws. Create descriptions that highlight benefits and make buyers want to purchase."""
    
    result = await analyze_images_with_ai(
        images=request.images,
        condition=request.condition,
        system_prompt=system_prompt
    )
    
    # Log the AI usage
    await db.ai_usage_logs.insert_one({
        "user_id": current_user["user_id"],
        "tool": "analyze_listing",
        "images_count": len(request.images),
        "condition": request.condition,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@ai_tools_router.post("/price-suggestions")
async def ai_price_suggestions(request: AIPriceRequest, current_user: dict = Depends(get_current_user)):
    """AI researches market and suggests pricing"""
    
    result = await search_market_prices(
        title=request.title,
        condition=request.condition,
        countries=request.target_countries
    )
    
    # Log the AI usage
    await db.ai_usage_logs.insert_one({
        "user_id": current_user["user_id"],
        "tool": "price_suggestions",
        "product_title": request.title,
        "countries": request.target_countries,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@ai_tools_router.post("/remove-background")
async def ai_remove_background(request: AIBackgroundRemovalRequest, current_user: dict = Depends(get_current_user)):
    """AI removes background from product photo"""
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Clean base64 string
        img_base64 = request.image_base64
        if ',' in img_base64:
            img_base64 = img_base64.split(',')[1]
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bg_removal_{uuid.uuid4().hex[:8]}",
            system_message="You are an image editing assistant."
        ).with_model("openai", "gpt-4o")
        
        background_desc = {
            "white": "pure white (#FFFFFF)",
            "gray": "light gray (#F5F5F5)",
            "gradient": "subtle white to light gray gradient"
        }.get(request.background_type, "pure white")
        
        # Note: GPT-4o can analyze but not edit images directly
        # For actual background removal, we'd need DALL-E or a dedicated service
        # For now, we'll return analysis and guidance
        
        user_message = UserMessage(
            text=f"""Analyze this product image and describe:
1. The main product/subject
2. The current background
3. How a {background_desc} background would improve it

Return JSON:
{{
    "product_detected": "description of main subject",
    "current_background": "description of current background",
    "improvement_notes": "how the new background would help",
    "processing_status": "For actual background removal, please use our web editor tool",
    "tip": "Product photography tip for this item"
}}""",
            file_contents=[ImageContent(image_base64=img_base64)]
        )
        
        response = await chat.send_message(user_message)
        
        import json
        response_text = response.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        result = json.loads(response_text.strip())
        result["original_image"] = request.image_base64
        result["background_type_requested"] = request.background_type
        
        return result
        
    except Exception as e:
        print(f"Background removal error: {e}")
        raise HTTPException(status_code=500, detail=f"Background removal failed: {str(e)}")

@ai_tools_router.post("/shipping-estimate")
async def ai_shipping_estimate(request: AIShippingRequest, current_user: dict = Depends(get_current_user)):
    """AI estimates shipping dimensions and provides carrier options"""
    
    dimensions = request.manual_dimensions or {"length": 12, "width": 9, "height": 6}
    weight = request.manual_weight or 2.0
    
    # If images provided, try to estimate dimensions
    if request.images and not request.manual_dimensions:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"shipping_est_{uuid.uuid4().hex[:8]}",
                system_message="You are a shipping logistics expert. Estimate package dimensions accurately."
            ).with_model("openai", "gpt-4o")
            
            img_base64 = request.images[0]
            if ',' in img_base64:
                img_base64 = img_base64.split(',')[1]
            
            user_message = UserMessage(
                text="""Analyze this product image and estimate realistic shipping dimensions.

Return JSON only:
{
    "length": number (inches),
    "width": number (inches),
    "height": number (inches),
    "estimated_weight": number (lbs),
    "packaging_recommendation": "box/padded envelope/tube/etc",
    "fragile": true/false,
    "notes": "any special shipping considerations"
}""",
                file_contents=[ImageContent(image_base64=img_base64)]
            )
            
            response = await chat.send_message(user_message)
            
            import json
            response_text = response.strip()
            if '```' in response_text:
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
            
            ai_estimate = json.loads(response_text.strip())
            dimensions = {
                "length": ai_estimate.get("length", 12),
                "width": ai_estimate.get("width", 9),
                "height": ai_estimate.get("height", 6)
            }
            weight = ai_estimate.get("estimated_weight", 2.0)
            packaging_advice = ai_estimate.get("packaging_recommendation", "Standard box")
            
        except Exception as e:
            print(f"AI dimension estimation failed: {e}")
            packaging_advice = "Standard shipping box recommended"
    else:
        packaging_advice = "Based on provided dimensions"
    
    # Get shipping options
    shipping_options = await estimate_shipping(
        dimensions=dimensions,
        weight=weight,
        origin=request.origin_zip,
        destination=request.destination_zip,
        country=request.destination_country
    )
    
    return {
        "estimated_dimensions": dimensions,
        "estimated_weight": weight,
        "shipping_options": shipping_options,
        "recommended_provider": shipping_options[0]["provider"] if shipping_options else "USPS",
        "packaging_advice": packaging_advice
    }

@ai_tools_router.post("/improve-listing")
async def ai_improve_listing(listing_id: str, current_user: dict = Depends(get_current_user)):
    """AI analyzes listing performance and suggests improvements"""
    
    listing = await db.listings.find_one({"listing_id": listing_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Get listing performance data
    views = await db.listing_views.count_documents({"listing_id": listing_id})
    favorites = await db.listing_favorites.count_documents({"listing_id": listing_id})
    inquiries = await db.listing_inquiries.count_documents({"listing_id": listing_id})
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"improve_listing_{uuid.uuid4().hex[:8]}",
            system_message="You are an e-commerce optimization expert. Analyze listings and provide actionable improvements."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"""Analyze this marketplace listing and suggest improvements:

Title: {listing.get('title', 'N/A')}
Description: {listing.get('description', 'N/A')}
Price: ${listing.get('price', 0)}
Category: {listing.get('category', 'N/A')}
Condition: {listing.get('condition', 'N/A')}
Images: {len(listing.get('images', []))} photos

Performance Metrics:
- Views: {views}
- Favorites: {favorites}  
- Inquiries: {inquiries}
- Days Listed: {(datetime.now(timezone.utc) - datetime.fromisoformat(listing.get('created_at', datetime.now(timezone.utc).isoformat()))).days}

Return JSON:
{{
    "performance_score": 1-100,
    "issues": ["list of problems identified"],
    "title_suggestions": ["improved title options"],
    "description_improvements": "how to improve the description",
    "pricing_feedback": "is the price competitive?",
    "photo_recommendations": "how to improve photos",
    "seo_keywords": ["keywords to add"],
    "urgent_actions": ["most important things to do NOW"],
    "estimated_improvement": "X% more views/sales expected"
}}"""
        )
        
        response = await chat.send_message(user_message)
        
        import json
        response_text = response.strip()
        if '```' in response_text:
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        return json.loads(response_text.strip())
        
    except Exception as e:
        print(f"AI improvement analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# ============== SELLER DASHBOARD ENDPOINTS ==============

@seller_router.get("/stats")
async def get_seller_stats(current_user: dict = Depends(get_current_user)):
    """Get seller's overall statistics"""
    
    user_id = current_user["user_id"]
    
    # Count listings
    total_listings = await db.listings.count_documents({"user_id": user_id})
    active_listings = await db.listings.count_documents({"user_id": user_id, "status": "active"})
    sold_items = await db.listings.count_documents({"user_id": user_id, "status": "sold"})
    
    # Calculate revenue from sold items
    sold_listings = await db.listings.find({"user_id": user_id, "status": "sold"}, {"_id": 0, "price": 1}).to_list(1000)
    total_revenue = sum(item.get("price", 0) for item in sold_listings)
    
    # Get views
    total_views = await db.listing_views.count_documents({"seller_id": user_id})
    
    # Calculate conversion rate
    conversion_rate = (sold_items / total_listings * 100) if total_listings > 0 else 0
    
    # Get average rating
    reviews = await db.seller_reviews.find({"seller_id": user_id}, {"_id": 0, "rating": 1}).to_list(100)
    average_rating = sum(r.get("rating", 5) for r in reviews) / len(reviews) if reviews else 5.0
    
    return {
        "total_listings": total_listings,
        "active_listings": active_listings,
        "sold_items": sold_items,
        "total_revenue": round(total_revenue, 2),
        "average_rating": round(average_rating, 1),
        "total_views": total_views,
        "conversion_rate": round(conversion_rate, 1),
        "bl_coins_earned": current_user.get("bl_coins", 0)
    }

@seller_router.get("/listings")
async def get_seller_listings(
    status: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get seller's listings with filters"""
    
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    sort_order = -1 if order == "desc" else 1
    
    listings = await db.listings.find(query, {"_id": 0}).sort(sort_by, sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with performance data
    for listing in listings:
        listing_id = listing["listing_id"]
        listing["views"] = await db.listing_views.count_documents({"listing_id": listing_id})
        listing["favorites"] = await db.listing_favorites.count_documents({"listing_id": listing_id})
        listing["inquiries"] = await db.listing_inquiries.count_documents({"listing_id": listing_id})
    
    total = await db.listings.count_documents(query)
    
    return {
        "listings": listings,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@seller_router.get("/performance")
async def get_listing_performance(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get performance analytics for all listings"""
    
    user_id = current_user["user_id"]
    
    listings = await db.listings.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    performance_data = []
    underperforming = []
    
    for listing in listings:
        listing_id = listing["listing_id"]
        
        # Handle created_at - could be string, datetime, or None
        created_at_raw = listing.get("created_at")
        if created_at_raw is None:
            created_at = datetime.now(timezone.utc)
        elif isinstance(created_at_raw, str):
            try:
                created_at = datetime.fromisoformat(created_at_raw.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                created_at = datetime.now(timezone.utc)
        elif isinstance(created_at_raw, datetime):
            created_at = created_at_raw
        else:
            created_at = datetime.now(timezone.utc)
        
        # Ensure timezone aware
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        days_listed = max(1, (datetime.now(timezone.utc) - created_at).days)
        
        views = await db.listing_views.count_documents({"listing_id": listing_id})
        favorites = await db.listing_favorites.count_documents({"listing_id": listing_id})
        inquiries = await db.listing_inquiries.count_documents({"listing_id": listing_id})
        
        # Calculate performance score (0-100)
        views_per_day = views / days_listed
        engagement_rate = ((favorites + inquiries) / max(views, 1)) * 100
        
        score = min(100, (views_per_day * 10) + (engagement_rate * 2))
        
        # Generate AI recommendations for underperforming listings
        recommendations = []
        if views_per_day < 5:
            recommendations.append("Consider improving title with more keywords")
        if engagement_rate < 2:
            recommendations.append("Add more detailed photos or lower price")
        if len(listing.get("images", [])) < 3:
            recommendations.append("Add more photos (at least 5 recommended)")
        if len(listing.get("description", "")) < 100:
            recommendations.append("Expand your description with more details")
        if days_listed > 14 and listing.get("status") == "active":
            recommendations.append("Consider refreshing listing or adjusting price")
        
        perf = {
            "listing_id": listing_id,
            "title": listing.get("title", "Untitled"),
            "views": views,
            "favorites": favorites,
            "inquiries": inquiries,
            "days_listed": days_listed,
            "price": listing.get("price", 0),
            "status": listing.get("status", "active"),
            "performance_score": round(score, 1),
            "ai_recommendations": recommendations,
            "image": listing.get("images", [None])[0] if listing.get("images") else None
        }
        
        performance_data.append(perf)
        
        if score < 30 and listing.get("status") == "active":
            underperforming.append(perf)
    
    # Sort by performance score
    performance_data.sort(key=lambda x: x["performance_score"], reverse=True)
    underperforming.sort(key=lambda x: x["performance_score"])
    
    return {
        "listings": performance_data,
        "underperforming": underperforming[:5],
        "total_listings": len(listings),
        "average_score": round(sum(p["performance_score"] for p in performance_data) / max(len(performance_data), 1), 1),
        "period_days": days
    }

@seller_router.get("/analytics")
async def get_seller_analytics(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed seller analytics"""
    
    user_id = current_user["user_id"]
    
    # Views over time (mock daily data)
    views_trend = []
    for i in range(days):
        date = datetime.now(timezone.utc) - timedelta(days=days-i-1)
        # In production, this would query actual view data
        views_trend.append({
            "date": date.strftime("%Y-%m-%d"),
            "views": 10 + (i % 7) * 5,  # Mock pattern
            "favorites": 2 + (i % 3),
            "inquiries": 1 + (i % 2)
        })
    
    # Category distribution
    categories = await db.listings.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    category_distribution = [{"category": c["_id"] or "Other", "count": c["count"]} for c in categories]
    
    # Price range distribution
    price_ranges = [
        {"range": "$0-$25", "count": await db.listings.count_documents({"user_id": user_id, "price": {"$lte": 25}})},
        {"range": "$25-$50", "count": await db.listings.count_documents({"user_id": user_id, "price": {"$gt": 25, "$lte": 50}})},
        {"range": "$50-$100", "count": await db.listings.count_documents({"user_id": user_id, "price": {"$gt": 50, "$lte": 100}})},
        {"range": "$100-$500", "count": await db.listings.count_documents({"user_id": user_id, "price": {"$gt": 100, "$lte": 500}})},
        {"range": "$500+", "count": await db.listings.count_documents({"user_id": user_id, "price": {"$gt": 500}})}
    ]
    
    return {
        "views_trend": views_trend,
        "category_distribution": category_distribution,
        "price_distribution": price_ranges,
        "period_days": days
    }

@seller_router.post("/returns/{order_id}/label")
async def generate_return_label(order_id: str, current_user: dict = Depends(get_current_user)):
    """Generate return shipping label for an order"""
    
    # In production, this would integrate with shipping APIs
    # For now, return mock label data
    
    return {
        "order_id": order_id,
        "return_label": {
            "tracking_number": f"RET{uuid.uuid4().hex[:10].upper()}",
            "carrier": "USPS",
            "service": "Priority Mail",
            "label_url": "https://example.com/label.pdf",  # Would be actual PDF URL
            "qr_code": "data:image/png;base64,...",  # Would be actual QR code
            "valid_until": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "instructions": "Pack item securely and drop off at any USPS location"
        },
        "return_address": {
            "name": current_user.get("name", "Seller"),
            "address_line1": "123 Return Center",
            "city": "Anytown",
            "state": "CA",
            "zip": "90210",
            "country": "US"
        }
    }

@seller_router.post("/returns/{order_id}/refund")
async def process_refund(order_id: str, amount: Optional[float] = None, current_user: dict = Depends(get_current_user)):
    """Process refund for a returned order"""
    
    # In production, this would integrate with payment processor
    # For now, return mock refund data
    
    return {
        "order_id": order_id,
        "refund_id": f"ref_{uuid.uuid4().hex[:12]}",
        "amount": amount or 0,
        "status": "processed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "message": "Refund has been processed. Buyer will receive funds within 3-5 business days."
    }

# ============== SOLD ITEMS & SHIPPING DASHBOARD ==============

@seller_router.get("/sold-items")
async def get_sold_items(
    status: Optional[str] = None,  # pending_shipment, shipped, delivered
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get seller's sold items for shipping dashboard"""
    
    user_id = current_user["user_id"]
    
    query = {"seller_id": user_id}
    if status:
        query["shipping_status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with listing and buyer data
    enriched_orders = []
    for order in orders:
        listing = await db.listings.find_one({"listing_id": order.get("listing_id")}, {"_id": 0, "title": 1, "images": 1, "weight": 1, "dimensions": 1, "shipping_method": 1})
        buyer = await db.users.find_one({"user_id": order.get("buyer_id")}, {"_id": 0, "name": 1, "email": 1})
        
        enriched_orders.append({
            "order_id": order.get("order_id"),
            "listing_id": order.get("listing_id"),
            "title": listing.get("title", "Item") if listing else "Item",
            "image": listing.get("images", [None])[0] if listing and listing.get("images") else None,
            "price": order.get("amount", 0),
            "buyer_name": buyer.get("name", "Buyer") if buyer else "Buyer",
            "buyer_email": buyer.get("email", "") if buyer else "",
            "buyer_address": order.get("shipping_address", {}),
            "sold_at": order.get("created_at"),
            "shipping_status": order.get("shipping_status", "pending_shipment"),
            "shipping_method": order.get("shipping_method") or (listing.get("shipping_method") if listing else None),
            "tracking_number": order.get("tracking_number"),
            "weight": listing.get("weight") if listing else None,
            "dimensions": listing.get("dimensions") if listing else None
        })
    
    total = await db.orders.count_documents(query)
    pending_count = await db.orders.count_documents({"seller_id": user_id, "shipping_status": "pending_shipment"})
    
    return {
        "orders": enriched_orders,
        "total": total,
        "pending_shipment_count": pending_count,
        "skip": skip,
        "limit": limit
    }

@seller_router.post("/sold-items/{order_id}/ship")
async def mark_item_shipped(
    order_id: str,
    tracking_number: str,
    carrier: str = "USPS",
    current_user: dict = Depends(get_current_user)
):
    """Mark a sold item as shipped with tracking info"""
    
    user_id = current_user["user_id"]
    
    order = await db.orders.find_one({"order_id": order_id, "seller_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "shipping_status": "shipped",
                "tracking_number": tracking_number,
                "carrier": carrier,
                "shipped_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Send notification to buyer (would use Twilio/SendGrid in production)
    buyer = await db.users.find_one({"user_id": order.get("buyer_id")}, {"_id": 0, "name": 1, "email": 1})
    listing = await db.listings.find_one({"listing_id": order.get("listing_id")}, {"_id": 0, "title": 1})
    
    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": order.get("buyer_id"),
        "type": "order_shipped",
        "title": "Your order has shipped!",
        "message": f"Your order '{listing.get('title', 'Item')}' has been shipped via {carrier}. Tracking: {tracking_number}",
        "data": {
            "order_id": order_id,
            "tracking_number": tracking_number,
            "carrier": carrier
        },
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "order_id": order_id,
        "tracking_number": tracking_number,
        "carrier": carrier,
        "shipped_at": datetime.now(timezone.utc).isoformat(),
        "message": f"Item marked as shipped. Buyer has been notified."
    }

@shipping_router.post("/estimate")
async def estimate_shipping_cost(request: AIShippingRequest, current_user: dict = Depends(get_current_user)):
    """Get comprehensive shipping estimate with provider options"""
    
    dimensions = request.manual_dimensions or {"length": 12, "width": 9, "height": 6}
    weight = request.manual_weight or 2.0
    
    result = await estimate_shipping(
        dimensions=dimensions,
        weight=weight,
        origin=request.origin_zip,
        destination=request.destination_zip or "90210",
        country=request.destination_country,
        origin_location=request.origin_location
    )
    
    return result

@shipping_router.post("/generate-label")
async def generate_shipping_label(
    order_id: str,
    carrier: str,
    service: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate shipping label for an order (mock implementation)"""
    
    user_id = current_user["user_id"]
    
    order = await db.orders.find_one({"order_id": order_id, "seller_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    listing = await db.listings.find_one({"listing_id": order.get("listing_id")}, {"_id": 0})
    
    # Generate tracking number
    tracking_prefixes = {"USPS": "9400", "UPS": "1Z", "FedEx": "7489"}
    prefix = tracking_prefixes.get(carrier, "SHIP")
    tracking_number = f"{prefix}{uuid.uuid4().hex[:16].upper()}"
    
    # In production, this would call the actual carrier API
    label_data = {
        "tracking_number": tracking_number,
        "carrier": carrier,
        "service": service,
        "from": {
            "name": current_user.get("name", "Seller"),
            "address": "Seller Address",
            "city": "City",
            "state": "ST",
            "zip": "00000"
        },
        "to": order.get("shipping_address", {}),
        "weight": listing.get("weight", {"value": 1, "unit": "lbs"}) if listing else {"value": 1, "unit": "lbs"},
        "dimensions": listing.get("dimensions", {"length": 6, "width": 4, "height": 2, "unit": "in"}) if listing else {"length": 6, "width": 4, "height": 2, "unit": "in"},
        "label_url": f"https://api.blendlink.net/shipping/labels/{tracking_number}.pdf",  # Mock URL
        "label_format": "PDF",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "print_instructions": "1. Click 'Print Label' button\n2. Use standard 4x6 label paper\n3. Affix label to package\n4. Drop off at nearest carrier location"
    }
    
    # Update order with tracking info
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "shipping_label": label_data,
                "tracking_number": tracking_number,
                "carrier": carrier
            }
        }
    )
    
    return {
        "success": True,
        "label": label_data,
        "message": "Shipping label generated. Click Print to print the label."
    }

@shipping_router.get("/providers/nearby")
async def get_nearby_shipping_providers(
    lat: float,
    lng: float,
    radius_miles: float = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get nearby shipping provider locations"""
    
    # Mock data - in production would use Google Places API or provider APIs
    providers = [
        {
            "provider": "USPS",
            "name": "USPS Post Office - Main Branch",
            "address": "123 Main Street, City, ST 00000",
            "lat": lat + 0.005,
            "lng": lng + 0.003,
            "distance_miles": 0.5,
            "hours": "Mon-Fri: 9AM-5PM, Sat: 9AM-12PM",
            "services": ["Ground Advantage", "Priority Mail", "Priority Mail Express", "International"],
            "phone": "(555) 123-4567"
        },
        {
            "provider": "UPS",
            "name": "The UPS Store",
            "address": "456 Oak Avenue, City, ST 00000",
            "lat": lat + 0.01,
            "lng": lng - 0.005,
            "distance_miles": 1.2,
            "hours": "Mon-Fri: 8AM-7PM, Sat: 9AM-5PM, Sun: 10AM-4PM",
            "services": ["Ground", "2nd Day Air", "Next Day Air", "International"],
            "phone": "(555) 234-5678"
        },
        {
            "provider": "FedEx",
            "name": "FedEx Office Print & Ship Center",
            "address": "789 Elm Street, City, ST 00000",
            "lat": lat - 0.008,
            "lng": lng + 0.012,
            "distance_miles": 1.8,
            "hours": "Mon-Fri: 7AM-9PM, Sat-Sun: 9AM-6PM",
            "services": ["Ground", "Express Saver", "2Day", "Priority Overnight", "International"],
            "phone": "(555) 345-6789"
        },
        {
            "provider": "USPS",
            "name": "USPS Collection Box",
            "address": "Corner of Main St & 2nd Ave",
            "lat": lat + 0.002,
            "lng": lng + 0.001,
            "distance_miles": 0.2,
            "hours": "Pickup: 10AM & 4PM daily",
            "services": ["Ground Advantage", "Priority Mail (with proper postage)"],
            "phone": None
        }
    ]
    
    # Filter by radius and sort by distance
    filtered = [p for p in providers if p["distance_miles"] <= radius_miles]
    filtered.sort(key=lambda x: x["distance_miles"])
    
    return {
        "providers": filtered,
        "search_location": {"lat": lat, "lng": lng},
        "radius_miles": radius_miles
    }

# ============== EXPORT ROUTERS ==============

def get_seller_routers():
    return [seller_router, ai_tools_router, shipping_router]
