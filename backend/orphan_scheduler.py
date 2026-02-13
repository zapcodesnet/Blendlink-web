"""
Orphan Auto-Assignment Scheduler
================================
Runs periodic jobs to:
1. Auto-assign unassigned orphans every 6 hours
2. Send email notifications for assignments
3. Clean up stale assignment data

Integrates with the existing APScheduler setup.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
orphan_scheduler: Optional[AsyncIOScheduler] = None

# ============== EMAIL NOTIFICATION TEMPLATES ==============

ORPHAN_ASSIGNMENT_EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 30px; border: 1px solid #334155; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .logo {{ font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #a855f7, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
        .title {{ color: #f8fafc; font-size: 24px; margin: 20px 0 10px; }}
        .subtitle {{ color: #94a3b8; font-size: 14px; }}
        .info-box {{ background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0; }}
        .info-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }}
        .info-row:last-child {{ border-bottom: none; }}
        .label {{ color: #94a3b8; }}
        .value {{ color: #f8fafc; font-weight: 600; }}
        .cta {{ display: inline-block; background: linear-gradient(135deg, #a855f7, #3b82f6); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }}
        .footer {{ text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }}
        .highlight {{ color: #a855f7; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">BlendLink</div>
            <h1 class="title">{title}</h1>
            <p class="subtitle">{subtitle}</p>
        </div>
        
        <div class="info-box">
            {content}
        </div>
        
        <div style="text-align: center;">
            <a href="{cta_url}" class="cta">{cta_text}</a>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from BlendLink.</p>
            <p>© 2026 BlendLink. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

# ============== EMAIL NOTIFICATION FUNCTIONS ==============

async def send_orphan_assignment_notification(
    orphan_email: str,
    orphan_username: str,
    parent_username: str,
    assignment_type: str,
    tier: Optional[int] = None
) -> bool:
    """Send email notification to orphan about their assignment"""
    try:
        from server import db
        
        # Get email settings
        settings = await db.system_settings.find_one({"key": "email_settings"})
        if not settings or not settings.get("value", {}).get("notifications_enabled"):
            logger.info("Email notifications disabled, skipping orphan assignment email")
            return False
        
        # Build email content
        tier_desc = f" (Priority Tier {tier})" if tier else ""
        content = f"""
        <div class="info-row">
            <span class="label">Your Account</span>
            <span class="value">{orphan_username}</span>
        </div>
        <div class="info-row">
            <span class="label">Assigned Upline</span>
            <span class="value highlight">{parent_username}</span>
        </div>
        <div class="info-row">
            <span class="label">Assignment Type</span>
            <span class="value">{assignment_type.title()}{tier_desc}</span>
        </div>
        <div class="info-row">
            <span class="label">Date</span>
            <span class="value">{datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}</span>
        </div>
        <p style="margin-top: 20px; color: #94a3b8; font-size: 14px;">
            You've been connected with an upline in the BlendLink network! 
            Your upline can help guide you and you'll both benefit from network activities.
            <br><br>
            <strong>Note:</strong> This assignment does not affect your signup bonus of 50,000 BL coins.
        </p>
        """
        
        html_content = ORPHAN_ASSIGNMENT_EMAIL_TEMPLATE.format(
            title="Upline Assigned!",
            subtitle="You've been connected with a network sponsor",
            content=content,
            cta_url="https://blendlink.net/dashboard",
            cta_text="View Your Dashboard"
        )
        
        # Send via existing email system
        try:
            from emergentintegrations.llm.email import send_email
            import os
            
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if api_key:
                await send_email(
                    api_key=api_key,
                    to_email=orphan_email,
                    subject="BlendLink: You've Been Assigned an Upline!",
                    html_content=html_content
                )
                logger.info(f"Sent orphan assignment email to {orphan_email}")
                return True
        except ImportError:
            logger.warning("Email integration not available")
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
        
        return False
        
    except Exception as e:
        logger.error(f"Error sending orphan notification: {e}")
        return False

async def send_parent_notification(
    parent_email: str,
    parent_username: str,
    orphan_username: str,
    orphan_count: int
) -> bool:
    """Send email notification to parent about receiving an orphan"""
    try:
        from server import db
        
        settings = await db.system_settings.find_one({"key": "email_settings"})
        if not settings or not settings.get("value", {}).get("notifications_enabled"):
            return False
        
        content = f"""
        <div class="info-row">
            <span class="label">New Team Member</span>
            <span class="value highlight">{orphan_username}</span>
        </div>
        <div class="info-row">
            <span class="label">Your Total Orphans</span>
            <span class="value">{orphan_count}/2</span>
        </div>
        <div class="info-row">
            <span class="label">Date Added</span>
            <span class="value">{datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}</span>
        </div>
        <p style="margin-top: 20px; color: #94a3b8; font-size: 14px;">
            A new user has been assigned to your network! Help them get started 
            and grow your team together.
            <br><br>
            <strong>Note:</strong> Orphan assignments do not provide referral bonuses, 
            but they do count toward your network for other benefits.
        </p>
        """
        
        html_content = ORPHAN_ASSIGNMENT_EMAIL_TEMPLATE.format(
            title="New Team Member Added!",
            subtitle="An orphan user has been assigned to your network",
            content=content,
            cta_url="https://blendlink.net/dashboard/referrals",
            cta_text="View Your Network"
        )
        
        try:
            from emergentintegrations.llm.email import send_email
            import os
            
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if api_key:
                await send_email(
                    api_key=api_key,
                    to_email=parent_email,
                    subject="BlendLink: New Team Member Added to Your Network!",
                    html_content=html_content
                )
                logger.info(f"Sent parent notification email to {parent_email}")
                return True
        except ImportError:
            pass
        except Exception as e:
            logger.error(f"Failed to send parent email: {e}")
        
        return False
        
    except Exception as e:
        logger.error(f"Error sending parent notification: {e}")
        return False

async def send_admin_batch_report(results: Dict[str, Any]) -> bool:
    """Send admin notification about batch assignment results"""
    try:
        from server import db
        
        # Get admin emails
        admins = await db.users.find(
            {"role": {"$in": ["admin", "super_admin"]}},
            {"email": 1}
        ).to_list(10)
        
        admin_emails = [a.get("email") for a in admins if a.get("email")]
        
        if not admin_emails:
            return False
        
        content = f"""
        <div class="info-row">
            <span class="label">Total Processed</span>
            <span class="value">{results.get('total_processed', 0)}</span>
        </div>
        <div class="info-row">
            <span class="label">Successful</span>
            <span class="value" style="color: #22c55e;">{results.get('successful', 0)}</span>
        </div>
        <div class="info-row">
            <span class="label">Failed</span>
            <span class="value" style="color: #ef4444;">{results.get('failed', 0)}</span>
        </div>
        <div class="info-row">
            <span class="label">No Eligible Parents</span>
            <span class="value" style="color: #f59e0b;">{results.get('no_eligible_recipients', 0)}</span>
        </div>
        <div class="info-row">
            <span class="label">Run Time</span>
            <span class="value">{datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}</span>
        </div>
        """
        
        html_content = ORPHAN_ASSIGNMENT_EMAIL_TEMPLATE.format(
            title="Batch Orphan Assignment Complete",
            subtitle="Scheduled auto-assignment job finished",
            content=content,
            cta_url="https://blendlink.net/admin/orphans",
            cta_text="View Orphan Dashboard"
        )
        
        try:
            from emergentintegrations.llm.email import send_email
            import os
            
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if api_key:
                for email in admin_emails[:3]:  # Max 3 admins
                    await send_email(
                        api_key=api_key,
                        to_email=email,
                        subject="BlendLink Admin: Batch Orphan Assignment Report",
                        html_content=html_content
                    )
                logger.info(f"Sent batch report to {len(admin_emails)} admins")
                return True
        except ImportError:
            pass
        except Exception as e:
            logger.error(f"Failed to send admin report: {e}")
        
        return False
        
    except Exception as e:
        logger.error(f"Error sending admin report: {e}")
        return False

# ============== SCHEDULED JOB FUNCTIONS ==============

async def scheduled_orphan_auto_assign():
    """
    Scheduled job to auto-assign all unassigned orphans.
    Runs every 6 hours.
    """
    logger.info("Starting scheduled orphan auto-assignment job...")
    
    try:
        from orphan_assignment_system import batch_auto_assign_orphans
        from server import db
        
        # Check how many unassigned orphans exist
        unassigned_count = await db.users.count_documents({
            "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
            "is_orphan_assigned": {"$ne": True}
        })
        
        if unassigned_count == 0:
            logger.info("No unassigned orphans found, skipping batch assignment")
            return
        
        logger.info(f"Found {unassigned_count} unassigned orphans, starting batch assignment...")
        
        # Run batch assignment (max 100 per run to avoid overload)
        results = await batch_auto_assign_orphans(limit=100)
        
        # Log results
        await db.orphan_scheduled_jobs.insert_one({
            "job_type": "auto_assign",
            "run_at": datetime.now(timezone.utc).isoformat(),
            "results": results,
            "orphans_before": unassigned_count
        })
        
        logger.info(f"Scheduled orphan assignment complete: {results['successful']}/{results['total_processed']} assigned")
        
        # Send admin report if there were assignments
        if results['total_processed'] > 0:
            await send_admin_batch_report(results)
        
    except Exception as e:
        logger.error(f"Scheduled orphan assignment failed: {e}")

async def cleanup_orphan_data():
    """
    Cleanup job for orphan data.
    Runs daily to:
    - Update orphan counts
    - Fix any data inconsistencies
    """
    logger.info("Starting orphan data cleanup job...")
    
    try:
        from server import db
        
        # Fix users with incorrect orphan counts
        async for user in db.users.find({"orphans_assigned_count": {"$exists": True}}):
            # Count actual orphans assigned to this user
            actual_count = await db.users.count_documents({
                "referred_by": user["user_id"],
                "is_orphan": True
            })
            
            if user.get("orphans_assigned_count", 0) != actual_count:
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"orphans_assigned_count": actual_count}}
                )
                logger.info(f"Fixed orphan count for {user['user_id']}: {user.get('orphans_assigned_count', 0)} -> {actual_count}")
        
        # Mark users who should be orphans but aren't marked
        async for user in db.users.find({
            "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
            "is_orphan": {"$ne": True}
        }):
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"is_orphan": True}}
            )
            logger.info(f"Marked {user['user_id']} as orphan")
        
        logger.info("Orphan data cleanup complete")
        
    except Exception as e:
        logger.error(f"Orphan cleanup failed: {e}")

# ============== SCHEDULER MANAGEMENT ==============

def start_orphan_scheduler():
    """Initialize and start the orphan assignment scheduler"""
    global orphan_scheduler
    
    if orphan_scheduler is not None:
        logger.info("Orphan scheduler already running")
        return orphan_scheduler
    
    orphan_scheduler = AsyncIOScheduler()
    
    # Auto-assign orphans every 6 hours
    orphan_scheduler.add_job(
        scheduled_orphan_auto_assign,
        IntervalTrigger(hours=6),
        id="orphan_auto_assign",
        name="Auto-assign orphans",
        replace_existing=True
    )
    
    # Cleanup job daily at 3 AM UTC
    orphan_scheduler.add_job(
        cleanup_orphan_data,
        CronTrigger(hour=3, minute=0),
        id="orphan_cleanup",
        name="Cleanup orphan data",
        replace_existing=True
    )
    
    orphan_scheduler.start()
    logger.info("Orphan assignment scheduler started (auto-assign every 6h, cleanup daily at 3 AM UTC)")
    
    return orphan_scheduler

def stop_orphan_scheduler():
    """Stop the orphan scheduler"""
    global orphan_scheduler
    
    if orphan_scheduler:
        orphan_scheduler.shutdown(wait=False)
        orphan_scheduler = None
        logger.info("Orphan scheduler stopped")

async def trigger_orphan_job_now(job_type: str = "auto_assign") -> Dict[str, Any]:
    """Manually trigger an orphan job"""
    if job_type == "auto_assign":
        await scheduled_orphan_auto_assign()
        return {"status": "completed", "job": "auto_assign"}
    elif job_type == "cleanup":
        await cleanup_orphan_data()
        return {"status": "completed", "job": "cleanup"}
    else:
        return {"status": "error", "message": f"Unknown job type: {job_type}"}

def get_scheduler_status() -> Dict[str, Any]:
    """Get current scheduler status"""
    global orphan_scheduler
    
    if not orphan_scheduler:
        return {"running": False, "jobs": []}
    
    jobs = []
    for job in orphan_scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None
        })
    
    return {
        "running": orphan_scheduler.running,
        "jobs": jobs
    }
