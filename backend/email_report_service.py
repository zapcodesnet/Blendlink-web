"""
BlendLink Daily Sales Report Email Service
Automatically sends daily sales reports to merchants at their configured closing time
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Resend Configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
PLATFORM_NAME = "BlendLink"
PLATFORM_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://blendlink.net")

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def format_currency(amount: float) -> str:
    """Format currency with proper formatting"""
    return f"${amount:,.2f}"


def get_hour_label(hour: int) -> str:
    """Convert 24-hour to 12-hour format"""
    if hour == 0:
        return "12 AM"
    elif hour < 12:
        return f"{hour} AM"
    elif hour == 12:
        return "12 PM"
    else:
        return f"{hour - 12} PM"


def generate_report_email_html(report: dict, page_name: str, date_str: str) -> str:
    """Generate beautiful HTML email for daily sales report"""
    
    summary = report.get("summary", {})
    top_products = report.get("top_products", [])
    peak_hours = report.get("peak_hours", [])
    payment_methods = report.get("payment_methods", {})
    order_types = report.get("order_types", {})
    hourly_sales = report.get("hourly_sales", [0] * 24)
    
    # Calculate max hourly for chart
    max_hourly = max(hourly_sales) if hourly_sales else 1
    
    # Generate hourly chart bars
    hourly_bars_html = ""
    for hour in range(24):
        sales = hourly_sales[hour] if hour < len(hourly_sales) else 0
        height_percent = (sales / max_hourly * 100) if max_hourly > 0 else 0
        is_peak = height_percent > 70
        color = "#f59e0b" if is_peak else "#06b6d4"
        hourly_bars_html += f'''
        <td style="vertical-align: bottom; padding: 0 2px;">
            <div style="background: {color}; width: 12px; height: {max(height_percent, 3)}px; border-radius: 2px 2px 0 0;"></div>
            <div style="font-size: 9px; color: #9ca3af; text-align: center; margin-top: 4px;">
                {hour if hour % 4 == 0 else ''}
            </div>
        </td>
        '''
    
    # Generate top products list
    top_products_html = ""
    if top_products:
        for i, product in enumerate(top_products[:5]):
            medal_colors = ["#fbbf24", "#9ca3af", "#d97706", "#6b7280", "#6b7280"]
            medal_color = medal_colors[i] if i < len(medal_colors) else "#6b7280"
            top_products_html += f'''
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
                    <div style="display: inline-block; width: 24px; height: 24px; background: {medal_color}; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; margin-right: 12px;">{i + 1}</div>
                    <span style="font-weight: 500; color: #1f2937;">{product.get("name", "Unknown")}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: center; color: #6b7280;">{product.get("quantity", 0)} sold</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600; color: #1f2937;">{format_currency(product.get("revenue", 0))}</td>
            </tr>
            '''
    else:
        top_products_html = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #9ca3af;">No products sold today</td></tr>'
    
    # Generate peak hours
    peak_hours_html = ""
    if peak_hours:
        for ph in peak_hours[:3]:
            peak_hours_html += f'''
            <span style="display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 20px; margin: 4px; font-size: 14px;">
                {get_hour_label(ph.get("hour", 0))}: {format_currency(ph.get("sales", 0))}
            </span>
            '''
    else:
        peak_hours_html = '<span style="color: #9ca3af;">No peak hours recorded</span>'
    
    # Generate payment methods
    payment_methods_html = ""
    for method, amount in payment_methods.items():
        payment_methods_html += f'''
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; text-transform: capitalize;">{method}</span>
            <span style="font-weight: 600; color: #1f2937;">{format_currency(amount)}</span>
        </div>
        '''
    if not payment_methods_html:
        payment_methods_html = '<div style="color: #9ca3af; text-align: center; padding: 12px;">No payments recorded</div>'
    
    # Generate order types
    order_types_html = ""
    for otype, count in order_types.items():
        order_types_html += f'''
        <span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 20px; margin: 4px; font-size: 14px;">
            {otype.replace("_", " ").title()}: {count}
        </span>
        '''
    if not order_types_html:
        order_types_html = '<span style="color: #9ca3af;">No orders recorded</span>'
    
    html = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Sales Report - {page_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                            <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">Daily Sales Report</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">{page_name}</p>
                            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">{date_str}</p>
                        </td>
                    </tr>
                    
                    <!-- Summary Cards -->
                    <tr>
                        <td style="background: white; padding: 24px;">
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="width: 50%; padding: 12px;">
                                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 20px; text-align: center;">
                                            <p style="color: rgba(255,255,255,0.9); margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Sales</p>
                                            <p style="color: white; margin: 0; font-size: 28px; font-weight: 700;">{format_currency(summary.get("total_sales", 0))}</p>
                                        </div>
                                    </td>
                                    <td style="width: 50%; padding: 12px;">
                                        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; padding: 20px; text-align: center;">
                                            <p style="color: rgba(255,255,255,0.9); margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Orders</p>
                                            <p style="color: white; margin: 0; font-size: 28px; font-weight: 700;">{summary.get("total_orders", 0)}</p>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="width: 50%; padding: 12px;">
                                        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 12px; padding: 20px; text-align: center;">
                                            <p style="color: rgba(255,255,255,0.9); margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Average Order</p>
                                            <p style="color: white; margin: 0; font-size: 28px; font-weight: 700;">{format_currency(summary.get("average_order", 0))}</p>
                                        </div>
                                    </td>
                                    <td style="width: 50%; padding: 12px;">
                                        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 20px; text-align: center;">
                                            <p style="color: rgba(255,255,255,0.9); margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Items Sold</p>
                                            <p style="color: white; margin: 0; font-size: 28px; font-weight: 700;">{summary.get("total_items_sold", 0)}</p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Hourly Sales Chart -->
                    <tr>
                        <td style="background: white; padding: 24px; border-top: 1px solid #f3f4f6;">
                            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                                Hourly Sales Distribution
                            </h2>
                            <table role="presentation" style="width: 100%; height: 100px; border-collapse: collapse;">
                                <tr>
                                    {hourly_bars_html}
                                </tr>
                            </table>
                            <div style="margin-top: 16px;">
                                <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">Peak Hours:</p>
                                {peak_hours_html}
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Top Products -->
                    <tr>
                        <td style="background: white; padding: 24px; border-top: 1px solid #f3f4f6;">
                            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                                Top Products
                            </h2>
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f9fafb;">
                                        <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Product</th>
                                        <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Quantity</th>
                                        <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {top_products_html}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Payment Methods -->
                    <tr>
                        <td style="background: white; padding: 24px; border-top: 1px solid #f3f4f6;">
                            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                                Payment Methods
                            </h2>
                            {payment_methods_html}
                        </td>
                    </tr>
                    
                    <!-- Order Types -->
                    <tr>
                        <td style="background: white; padding: 24px; border-top: 1px solid #f3f4f6;">
                            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                                Order Types
                            </h2>
                            <div>
                                {order_types_html}
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #1f2937; padding: 24px; border-radius: 0 0 16px 16px; text-align: center;">
                            <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">
                                This report was automatically generated by {PLATFORM_NAME}
                            </p>
                            <p style="color: #6b7280; margin: 0; font-size: 12px;">
                                <a href="{PLATFORM_URL}/member-pages" style="color: #10b981; text-decoration: none;">View Full Dashboard</a>
                                &nbsp;|&nbsp;
                                <a href="{PLATFORM_URL}/settings/notifications" style="color: #10b981; text-decoration: none;">Email Preferences</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    '''
    
    return html


async def send_daily_report_email(
    recipient_email: str,
    report: dict,
    page_name: str,
    date_str: str
) -> dict:
    """Send daily sales report email to merchant"""
    
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping email")
        return {"status": "skipped", "reason": "API key not configured"}
    
    try:
        html_content = generate_report_email_html(report, page_name, date_str)
        
        params = {
            "from": SENDER_EMAIL,
            "to": [recipient_email],
            "subject": f"Daily Sales Report - {page_name} ({date_str})",
            "html": html_content
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Daily report email sent to {recipient_email} for {page_name}")
        
        return {
            "status": "success",
            "message": f"Email sent to {recipient_email}",
            "email_id": email_result.get("id")
        }
        
    except Exception as e:
        logger.error(f"Failed to send daily report email: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }


async def send_test_report_email(recipient_email: str) -> dict:
    """Send a test report email with sample data"""
    
    sample_report = {
        "summary": {
            "total_sales": 1234.56,
            "total_orders": 42,
            "average_order": 29.39,
            "total_items_sold": 127
        },
        "top_products": [
            {"name": "Premium Coffee", "quantity": 35, "revenue": 175.00},
            {"name": "Avocado Toast", "quantity": 28, "revenue": 252.00},
            {"name": "Fresh Juice", "quantity": 22, "revenue": 110.00},
            {"name": "Breakfast Platter", "quantity": 18, "revenue": 270.00},
            {"name": "Croissant", "quantity": 15, "revenue": 52.50}
        ],
        "peak_hours": [
            {"hour": 9, "sales": 345.00},
            {"hour": 12, "sales": 289.00},
            {"hour": 18, "sales": 198.00}
        ],
        "hourly_sales": [
            0, 0, 0, 0, 0, 0, 15, 45, 89, 345, 178, 156, 289, 134, 98, 76, 89, 134, 198, 156, 78, 45, 12, 0
        ],
        "payment_methods": {
            "card": 892.45,
            "cash": 312.11,
            "digital_wallet": 30.00
        },
        "order_types": {
            "dine_in": 18,
            "pickup": 15,
            "delivery": 9
        }
    }
    
    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    
    return await send_daily_report_email(
        recipient_email,
        sample_report,
        "Sample Store",
        date_str
    )
