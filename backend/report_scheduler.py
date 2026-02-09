"""
BlendLink Daily Report Scheduler
Sends automated daily sales reports to merchants at their configured closing time
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'blendlink')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Global scheduler instance
scheduler: Optional[AsyncIOScheduler] = None


async def generate_daily_report(page_id: str, date: datetime) -> dict:
    """Generate daily report for a specific page and date"""
    
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    # Fetch orders for the date
    orders = await db.page_orders.find({
        "page_id": page_id,
        "created_at": {
            "$gte": start_of_day.isoformat(),
            "$lt": end_of_day.isoformat()
        }
    }).to_list(1000)
    
    # Summary metrics
    total_sales = sum(o.get("total", 0) for o in orders)
    total_orders = len(orders)
    average_order = total_sales / total_orders if total_orders > 0 else 0
    total_items_sold = sum(
        sum(item.get("quantity", 1) for item in o.get("items", []))
        for o in orders
    )
    
    # Top products
    product_sales = {}
    for order in orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            if name not in product_sales:
                product_sales[name] = {"name": name, "quantity": 0, "revenue": 0}
            product_sales[name]["quantity"] += item.get("quantity", 1)
            product_sales[name]["revenue"] += item.get("price", 0) * item.get("quantity", 1)
    
    top_products = sorted(product_sales.values(), key=lambda x: x["revenue"], reverse=True)[:5]
    
    # Hourly sales distribution
    hourly_sales = [0] * 24
    for order in orders:
        try:
            order_time = datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))
            hour = order_time.hour
            hourly_sales[hour] += order.get("total", 0)
        except:
            pass
    
    # Peak hours (top 3)
    peak_hours = [
        {"hour": h, "sales": s}
        for h, s in enumerate(hourly_sales)
        if s > 0
    ]
    peak_hours.sort(key=lambda x: x["sales"], reverse=True)
    peak_hours = peak_hours[:3]
    
    # Payment methods breakdown
    payment_methods = {}
    for order in orders:
        method = order.get("payment_method", "unknown")
        payment_methods[method] = payment_methods.get(method, 0) + order.get("total", 0)
    
    # Order types breakdown
    order_types = {}
    for order in orders:
        otype = order.get("order_type", "pickup")
        order_types[otype] = order_types.get(otype, 0) + 1
    
    return {
        "date": date.strftime("%Y-%m-%d"),
        "summary": {
            "total_sales": total_sales,
            "total_orders": total_orders,
            "average_order": average_order,
            "total_items_sold": total_items_sold
        },
        "top_products": top_products,
        "hourly_sales": hourly_sales,
        "peak_hours": peak_hours,
        "payment_methods": payment_methods,
        "order_types": order_types
    }


async def send_scheduled_reports():
    """Check for pages that need daily reports sent and send them"""
    from email_report_service import send_daily_report_email
    
    logger.info("Running scheduled daily report check...")
    
    # Get current hour in UTC
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    
    # Find all pages with email reports enabled for this hour
    # We'll check pages where report_settings.send_time matches current hour
    pages = await db.member_pages.find({
        "report_settings.email_enabled": True,
        "report_settings.send_hour": current_hour
    }, {"_id": 0}).to_list(1000)
    
    if not pages:
        logger.info(f"No pages scheduled for reports at hour {current_hour}")
        return
    
    logger.info(f"Found {len(pages)} pages to send reports to")
    
    # Get yesterday's date for the report
    yesterday = now - timedelta(days=1)
    date_str = yesterday.strftime("%B %d, %Y")
    
    for page in pages:
        try:
            page_id = page.get("page_id")
            owner_id = page.get("owner_id")
            page_name = page.get("name", "Your Store")
            
            # Get owner's email
            owner = await db.users.find_one({"user_id": owner_id}, {"_id": 0})
            if not owner or not owner.get("email"):
                logger.warning(f"No email found for owner of page {page_id}")
                continue
            
            recipient_email = page.get("report_settings", {}).get("email") or owner.get("email")
            
            # Generate report
            report = await generate_daily_report(page_id, yesterday)
            
            # Only send if there was activity
            if report["summary"]["total_orders"] == 0:
                # Check if merchant wants reports even with no sales
                if not page.get("report_settings", {}).get("send_empty_reports", False):
                    logger.info(f"Skipping empty report for {page_name}")
                    continue
            
            # Send email
            result = await send_daily_report_email(
                recipient_email,
                report,
                page_name,
                date_str
            )
            
            # Log the result
            await db.report_email_logs.insert_one({
                "page_id": page_id,
                "recipient": recipient_email,
                "date": yesterday.isoformat(),
                "status": result.get("status"),
                "email_id": result.get("email_id"),
                "sent_at": now.isoformat()
            })
            
            logger.info(f"Report email {'sent' if result.get('status') == 'success' else 'failed'} for {page_name}")
            
        except Exception as e:
            logger.error(f"Error sending report for page {page.get('page_id')}: {e}")


def start_scheduler():
    """Initialize and start the APScheduler"""
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already running")
        return scheduler
    
    scheduler = AsyncIOScheduler()
    
    # Run every hour to check for scheduled reports
    scheduler.add_job(
        send_scheduled_reports,
        CronTrigger(minute=0),  # Run at the start of every hour
        id="daily_report_check",
        name="Daily Report Email Check",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Daily report scheduler started - checking every hour")
    
    return scheduler


def stop_scheduler():
    """Stop the scheduler"""
    global scheduler
    
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("Daily report scheduler stopped")


async def trigger_report_now(page_id: str, recipient_email: str) -> dict:
    """Manually trigger a report for a specific page"""
    from email_report_service import send_daily_report_email
    
    # Get page info
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        return {"status": "error", "message": "Page not found"}
    
    # Generate today's report
    today = datetime.now(timezone.utc)
    date_str = today.strftime("%B %d, %Y")
    
    report = await generate_daily_report(page_id, today)
    
    # Send email
    result = await send_daily_report_email(
        recipient_email,
        report,
        page.get("name", "Your Store"),
        date_str
    )
    
    return result
