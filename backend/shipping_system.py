"""
Blendlink Shipping System - Shippo Integration
- Shipping cost estimation
- Label generation
- Multi-carrier support (USPS, UPS, FedEx)
"""

import os
import logging
import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
import uuid

logger = logging.getLogger(__name__)

# Shippo API configuration
SHIPPO_API_KEY = os.environ.get("SHIPPO_API_KEY", "")
SHIPPO_BASE_URL = "https://api.goshippo.com"

# Router
shipping_router = APIRouter(prefix="/shipping", tags=["Shipping"])

# ============== MODELS ==============

class Address(BaseModel):
    name: str
    street1: str
    street2: Optional[str] = ""
    city: str
    state: str
    zip: str
    country: str = "US"
    phone: Optional[str] = ""
    email: Optional[str] = ""

class Parcel(BaseModel):
    length: float = 6.0  # inches
    width: float = 4.0
    height: float = 2.0
    weight: float = 1.0  # lbs
    distance_unit: str = "in"
    mass_unit: str = "lb"

class ShippingEstimateRequest(BaseModel):
    origin_zip: str
    destination_zip: str
    weight: Optional[float] = None  # lbs
    length: Optional[float] = None  # inches
    width: Optional[float] = None
    height: Optional[float] = None
    is_digital: bool = False

class ShippingLabelRequest(BaseModel):
    from_address: Address
    to_address: Address
    parcel: Parcel
    carrier: str = "usps"
    service_level: str = "usps_priority"
    order_id: str

# ============== SHIPPO API HELPERS ==============

async def shippo_request(endpoint: str, method: str = "GET", data: dict = None) -> dict:
    """Make a request to Shippo API"""
    if not SHIPPO_API_KEY:
        raise HTTPException(status_code=500, detail="Shipping service not configured")
    
    headers = {
        "Authorization": f"ShippoToken {SHIPPO_API_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{SHIPPO_BASE_URL}{endpoint}"
        
        if method == "GET":
            response = await client.get(url, headers=headers)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        if response.status_code >= 400:
            logger.error(f"Shippo API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Shipping API error: {response.text}"
            )
        
        return response.json()

async def create_shippo_address(address: Address) -> dict:
    """Create an address object in Shippo"""
    return await shippo_request("/addresses", "POST", {
        "name": address.name,
        "street1": address.street1,
        "street2": address.street2 or "",
        "city": address.city,
        "state": address.state,
        "zip": address.zip,
        "country": address.country,
        "phone": address.phone or "",
        "email": address.email or "",
        "validate": True
    })

async def create_shippo_parcel(parcel: Parcel) -> dict:
    """Create a parcel object in Shippo"""
    return await shippo_request("/parcels", "POST", {
        "length": str(parcel.length),
        "width": str(parcel.width),
        "height": str(parcel.height),
        "distance_unit": parcel.distance_unit,
        "weight": str(parcel.weight),
        "mass_unit": parcel.mass_unit
    })

# ============== API ENDPOINTS ==============

@shipping_router.post("/estimate")
async def get_shipping_estimate(data: ShippingEstimateRequest):
    """
    Get shipping cost estimates for an item.
    Returns rates from multiple carriers (USPS, UPS, FedEx).
    """
    # Digital goods don't need shipping
    if data.is_digital:
        return {
            "is_digital": True,
            "message": "Digital goods - no shipping required",
            "rates": []
        }
    
    # Check if weight/dimensions provided
    if not data.weight or data.weight <= 0:
        return {
            "requires_seller_info": True,
            "message": "Contact seller for shipping cost",
            "rates": []
        }
    
    try:
        # Create a shipment to get rates
        shipment_data = {
            "address_from": {
                "zip": data.origin_zip,
                "country": "US"
            },
            "address_to": {
                "zip": data.destination_zip,
                "country": "US"
            },
            "parcels": [{
                "length": str(data.length or 6),
                "width": str(data.width or 4),
                "height": str(data.height or 2),
                "distance_unit": "in",
                "weight": str(data.weight),
                "mass_unit": "lb"
            }],
            "async": False
        }
        
        result = await shippo_request("/shipments", "POST", shipment_data)
        
        # Extract rates
        rates = []
        for rate in result.get("rates", []):
            rates.append({
                "carrier": rate.get("provider", "Unknown"),
                "service": rate.get("servicelevel", {}).get("name", "Standard"),
                "service_token": rate.get("servicelevel", {}).get("token", ""),
                "amount": float(rate.get("amount", 0)),
                "currency": rate.get("currency", "USD"),
                "estimated_days": rate.get("estimated_days", 5),
                "rate_id": rate.get("object_id")
            })
        
        # Sort by price
        rates.sort(key=lambda x: x["amount"])
        
        return {
            "origin_zip": data.origin_zip,
            "destination_zip": data.destination_zip,
            "weight": data.weight,
            "rates": rates,
            "cheapest": rates[0] if rates else None,
            "fastest": min(rates, key=lambda x: x.get("estimated_days", 99)) if rates else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Shipping estimate error: {e}")
        # Return fallback estimates if API fails
        return {
            "origin_zip": data.origin_zip,
            "destination_zip": data.destination_zip,
            "weight": data.weight,
            "rates": [
                {"carrier": "USPS", "service": "Priority Mail", "amount": 8.95, "currency": "USD", "estimated_days": 3},
                {"carrier": "USPS", "service": "Ground Advantage", "amount": 5.95, "currency": "USD", "estimated_days": 5},
                {"carrier": "UPS", "service": "Ground", "amount": 12.50, "currency": "USD", "estimated_days": 5},
            ],
            "is_estimate": True,
            "message": "Estimated rates - actual cost may vary"
        }

@shipping_router.post("/create-label")
async def create_shipping_label(data: ShippingLabelRequest, request: Request):
    """
    Create a shipping label for an order.
    Returns a PDF label URL that can be downloaded and printed.
    """
    from server import get_current_user, db
    
    # Verify user is authenticated
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Create addresses
        from_address = await create_shippo_address(data.from_address)
        to_address = await create_shippo_address(data.to_address)
        
        # Create parcel
        parcel = await create_shippo_parcel(data.parcel)
        
        # Create shipment
        shipment = await shippo_request("/shipments", "POST", {
            "address_from": from_address["object_id"],
            "address_to": to_address["object_id"],
            "parcels": [parcel["object_id"]],
            "async": False
        })
        
        # Find the rate for the requested carrier/service
        selected_rate = None
        for rate in shipment.get("rates", []):
            provider = rate.get("provider", "").lower()
            service = rate.get("servicelevel", {}).get("token", "").lower()
            if data.carrier.lower() in provider or data.service_level.lower() in service:
                selected_rate = rate
                break
        
        if not selected_rate and shipment.get("rates"):
            # Use cheapest rate as fallback
            selected_rate = min(shipment["rates"], key=lambda x: float(x.get("amount", 999)))
        
        if not selected_rate:
            raise HTTPException(status_code=400, detail="No shipping rates available")
        
        # Purchase the label (creates transaction)
        transaction = await shippo_request("/transactions", "POST", {
            "rate": selected_rate["object_id"],
            "label_file_type": "PDF",
            "async": False
        })
        
        # Store label info in database
        label_record = {
            "label_id": f"label_{uuid.uuid4().hex[:12]}",
            "order_id": data.order_id,
            "user_id": user["user_id"],
            "tracking_number": transaction.get("tracking_number"),
            "tracking_url": transaction.get("tracking_url_provider"),
            "label_url": transaction.get("label_url"),
            "carrier": selected_rate.get("provider"),
            "service": selected_rate.get("servicelevel", {}).get("name"),
            "rate": float(selected_rate.get("amount", 0)),
            "status": transaction.get("status"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.shipping_labels.insert_one(label_record)
        
        # Update order with tracking info
        await db.orders.update_one(
            {"order_id": data.order_id},
            {"$set": {
                "tracking_number": transaction.get("tracking_number"),
                "tracking_url": transaction.get("tracking_url_provider"),
                "label_url": transaction.get("label_url"),
                "shipping_status": "label_created"
            }}
        )
        
        return {
            "success": True,
            "label_url": transaction.get("label_url"),
            "tracking_number": transaction.get("tracking_number"),
            "tracking_url": transaction.get("tracking_url_provider"),
            "carrier": selected_rate.get("provider"),
            "service": selected_rate.get("servicelevel", {}).get("name"),
            "rate": float(selected_rate.get("amount", 0)),
            "status": transaction.get("status"),
            "message": "TEST" if "test" in SHIPPO_API_KEY.lower() else "Label created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Label creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create shipping label: {str(e)}")

@shipping_router.get("/label/{order_id}")
async def get_shipping_label(order_id: str, request: Request):
    """Get shipping label info for an order"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    label = await db.shipping_labels.find_one(
        {"order_id": order_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not label:
        raise HTTPException(status_code=404, detail="Shipping label not found")
    
    return label

@shipping_router.get("/carriers")
async def get_available_carriers():
    """Get list of available shipping carriers"""
    return {
        "carriers": [
            {"id": "usps", "name": "USPS", "services": ["usps_priority", "usps_ground_advantage", "usps_first"]},
            {"id": "ups", "name": "UPS", "services": ["ups_ground", "ups_3_day_select", "ups_2nd_day_air"]},
            {"id": "fedex", "name": "FedEx", "services": ["fedex_ground", "fedex_express_saver", "fedex_2day"]}
        ]
    }

@shipping_router.post("/validate-address")
async def validate_address(address: Address):
    """Validate a shipping address"""
    try:
        result = await create_shippo_address(address)
        
        validation = result.get("validation_results", {})
        is_valid = validation.get("is_valid", False)
        
        return {
            "is_valid": is_valid,
            "messages": validation.get("messages", []),
            "suggested_address": result if is_valid else None
        }
    except Exception as e:
        logger.error(f"Address validation error: {e}")
        return {
            "is_valid": False,
            "messages": [{"text": str(e)}],
            "suggested_address": None
        }
