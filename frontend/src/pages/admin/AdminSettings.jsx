import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Settings, Save, RefreshCw, Shield, Users, ShoppingBag,
  Gamepad2, Coins, Mail, Bell, Globe, Lock, CreditCard,
  MessageSquare, Image, Video, FileText, Share2, UserPlus,
  Percent, DollarSign, Clock, AlertTriangle, Eye, Ban,
  Smartphone, Monitor, Palette, Languages, Database,
  Zap, Gift, Target, TrendingUp, ChevronDown, ChevronUp
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Settings categories like Facebook/eBay admin
const SETTINGS_SCHEMA = {
  registration: {
    title: "Registration & Authentication",
    icon: UserPlus,
    color: "blue",
    description: "Control how users sign up and access the platform",
    fields: [
      { key: "registration_enabled", label: "Allow New Registrations", type: "toggle", desc: "Enable/disable new user signups" },
      { key: "email_verification_required", label: "Email Verification Required", type: "toggle", desc: "Users must verify email before full access" },
      { key: "phone_verification_required", label: "Phone Verification Required", type: "toggle", desc: "Require phone number verification" },
      { key: "google_auth_enabled", label: "Google Sign-In", type: "toggle", desc: "Allow Google OAuth login" },
      { key: "min_password_length", label: "Minimum Password Length", type: "number", desc: "Minimum characters required", min: 6, max: 32 },
      { key: "session_timeout_hours", label: "Session Timeout (Hours)", type: "number", desc: "Auto logout after inactivity", min: 1, max: 720 },
      { key: "max_login_attempts", label: "Max Login Attempts", type: "number", desc: "Lock account after failed attempts", min: 3, max: 10 },
      { key: "lockout_duration_minutes", label: "Lockout Duration (Minutes)", type: "number", desc: "Duration of account lockout", min: 5, max: 1440 },
    ]
  },
  features: {
    title: "Platform Features",
    icon: Zap,
    color: "green",
    description: "Enable or disable major platform features",
    fields: [
      { key: "social_feed_enabled", label: "Social Feed", type: "toggle", desc: "Main news feed with posts" },
      { key: "messaging_enabled", label: "Private Messaging", type: "toggle", desc: "Direct messages between users" },
      { key: "marketplace_enabled", label: "Marketplace", type: "toggle", desc: "Buy/sell listings" },
      { key: "casino_enabled", label: "Casino Games", type: "toggle", desc: "Slots, blackjack, roulette, etc." },
      { key: "daily_spin_enabled", label: "Daily Spin Bonus", type: "toggle", desc: "Free daily spin wheel" },
      { key: "stories_enabled", label: "Stories", type: "toggle", desc: "24-hour disappearing content" },
      { key: "groups_enabled", label: "Groups", type: "toggle", desc: "User-created communities" },
      { key: "pages_enabled", label: "Pages", type: "toggle", desc: "Business/creator pages" },
      { key: "events_enabled", label: "Events", type: "toggle", desc: "Event creation and RSVP" },
      { key: "ai_generation_enabled", label: "AI Media Generation", type: "toggle", desc: "AI image/video creation" },
      { key: "albums_enabled", label: "Albums", type: "toggle", desc: "Photo/video albums" },
      { key: "referral_system_enabled", label: "Referral System", type: "toggle", desc: "2-level referral program" },
    ]
  },
  content: {
    title: "Content Policies",
    icon: FileText,
    color: "purple",
    description: "Rules and limits for user-generated content",
    fields: [
      { key: "max_post_length", label: "Max Post Length (chars)", type: "number", desc: "Maximum characters per post", min: 100, max: 10000 },
      { key: "max_images_per_post", label: "Max Images Per Post", type: "number", desc: "Maximum images in a single post", min: 1, max: 20 },
      { key: "max_video_size_mb", label: "Max Video Size (MB)", type: "number", desc: "Maximum video file size", min: 10, max: 500 },
      { key: "max_image_size_mb", label: "Max Image Size (MB)", type: "number", desc: "Maximum image file size", min: 1, max: 50 },
      { key: "allowed_video_formats", label: "Allowed Video Formats", type: "text", desc: "Comma-separated: mp4,webm,mov" },
      { key: "allowed_image_formats", label: "Allowed Image Formats", type: "text", desc: "Comma-separated: jpg,png,gif,webp" },
      { key: "auto_moderate_content", label: "Auto-Moderate Content", type: "toggle", desc: "AI-powered content filtering" },
      { key: "require_post_approval", label: "Require Post Approval", type: "toggle", desc: "All posts need admin approval" },
      { key: "profanity_filter_enabled", label: "Profanity Filter", type: "toggle", desc: "Block inappropriate language" },
      { key: "spam_detection_enabled", label: "Spam Detection", type: "toggle", desc: "Auto-detect and block spam" },
    ]
  },
  rewards: {
    title: "Rewards & BL Coins",
    icon: Coins,
    color: "amber",
    description: "Configure BL Coin rewards and bonuses",
    fields: [
      { key: "welcome_bonus", label: "Welcome Bonus (BL)", type: "number", desc: "BL Coins for new users", min: 0, max: 10000 },
      { key: "referral_bonus", label: "Referral Bonus (BL)", type: "number", desc: "Bonus for successful referrals", min: 0, max: 10000 },
      { key: "daily_login_bonus", label: "Daily Login Bonus (BL)", type: "number", desc: "Bonus for daily login", min: 0, max: 1000 },
      { key: "post_video_reward", label: "Video Post Reward (BL)", type: "number", desc: "Reward for posting video", min: 0, max: 500 },
      { key: "post_photo_reward", label: "Photo Post Reward (BL)", type: "number", desc: "Reward for posting photo", min: 0, max: 500 },
      { key: "post_story_reward", label: "Story Post Reward (BL)", type: "number", desc: "Reward for posting story", min: 0, max: 500 },
      { key: "golden_thumbs_reward", label: "Golden Thumbs Reward (BL)", type: "number", desc: "Reward for golden reaction", min: 0, max: 100 },
      { key: "first_comment_reward", label: "First Comment Reward (BL)", type: "number", desc: "Reward for first comment", min: 0, max: 100 },
      { key: "create_group_reward", label: "Create Group Reward (BL)", type: "number", desc: "Reward for creating group", min: 0, max: 500 },
      { key: "create_page_reward", label: "Create Page Reward (BL)", type: "number", desc: "Reward for creating page", min: 0, max: 500 },
    ]
  },
  referral: {
    title: "Referral & Commissions",
    icon: Share2,
    color: "pink",
    description: "Configure the referral system and commissions",
    fields: [
      { key: "level1_commission_rate", label: "Level 1 Commission (%)", type: "number", desc: "Direct referral commission", min: 0, max: 50, step: 0.5 },
      { key: "level2_commission_rate", label: "Level 2 Commission (%)", type: "number", desc: "Indirect referral commission", min: 0, max: 25, step: 0.5 },
      { key: "min_withdrawal_amount", label: "Min Withdrawal (BL)", type: "number", desc: "Minimum BL to withdraw", min: 100, max: 100000 },
      { key: "withdrawal_fee_percent", label: "Withdrawal Fee (%)", type: "number", desc: "Fee for withdrawals", min: 0, max: 20, step: 0.5 },
      { key: "referral_transfer_enabled", label: "Referral Transfer", type: "toggle", desc: "Allow upline reassignment" },
      { key: "max_referral_depth", label: "Max Referral Depth", type: "number", desc: "Maximum levels in tree", min: 1, max: 10 },
      { key: "commission_payout_delay_days", label: "Payout Delay (Days)", type: "number", desc: "Days before commission available", min: 0, max: 30 },
    ]
  },
  marketplace: {
    title: "Marketplace Settings",
    icon: ShoppingBag,
    color: "cyan",
    description: "Configure marketplace fees and limits",
    fields: [
      { key: "marketplace_fee_percent", label: "Platform Fee (%)", type: "number", desc: "Fee on marketplace sales", min: 0, max: 30, step: 0.5 },
      { key: "max_listing_price", label: "Max Listing Price ($)", type: "number", desc: "Maximum price for listings", min: 100, max: 1000000 },
      { key: "min_listing_price", label: "Min Listing Price ($)", type: "number", desc: "Minimum price for listings", min: 0, max: 100 },
      { key: "max_listings_per_user", label: "Max Listings Per User", type: "number", desc: "Maximum active listings", min: 1, max: 1000 },
      { key: "listing_expiry_days", label: "Listing Expiry (Days)", type: "number", desc: "Days before listing expires", min: 7, max: 365 },
      { key: "featured_listing_cost", label: "Featured Listing Cost (BL)", type: "number", desc: "Cost to feature a listing", min: 0, max: 10000 },
      { key: "stripe_enabled", label: "Stripe Payments", type: "toggle", desc: "Enable Stripe payment processing" },
      { key: "crypto_payments_enabled", label: "Crypto Payments", type: "toggle", desc: "Accept cryptocurrency" },
      { key: "escrow_enabled", label: "Escrow Protection", type: "toggle", desc: "Hold funds until delivery confirmed" },
    ]
  },
  casino: {
    title: "Casino Settings",
    icon: Gamepad2,
    color: "red",
    description: "Configure casino games and limits",
    fields: [
      { key: "casino_min_bet", label: "Minimum Bet (BL)", type: "number", desc: "Minimum BL per bet", min: 1, max: 1000 },
      { key: "casino_max_bet", label: "Maximum Bet (BL)", type: "number", desc: "Maximum BL per bet", min: 100, max: 100000 },
      { key: "slots_enabled", label: "Slots Game", type: "toggle", desc: "Enable slot machine" },
      { key: "blackjack_enabled", label: "Blackjack Game", type: "toggle", desc: "Enable blackjack" },
      { key: "roulette_enabled", label: "Roulette Game", type: "toggle", desc: "Enable roulette" },
      { key: "poker_enabled", label: "Video Poker", type: "toggle", desc: "Enable video poker" },
      { key: "wheel_enabled", label: "Wheel of Fortune", type: "toggle", desc: "Enable wheel game" },
      { key: "house_edge_percent", label: "House Edge (%)", type: "number", desc: "Casino advantage", min: 1, max: 15, step: 0.5 },
      { key: "daily_spin_rewards", label: "Daily Spin Rewards (BL)", type: "text", desc: "Comma-separated: 1000,5000,15000,35000,80000,200000" },
    ]
  },
  notifications: {
    title: "Notifications",
    icon: Bell,
    color: "indigo",
    description: "Email and push notification settings",
    fields: [
      { key: "email_notifications_enabled", label: "Email Notifications", type: "toggle", desc: "Send email notifications" },
      { key: "push_notifications_enabled", label: "Push Notifications", type: "toggle", desc: "Send push notifications" },
      { key: "notify_on_new_follower", label: "New Follower Notification", type: "toggle", desc: "Notify when someone follows" },
      { key: "notify_on_comment", label: "Comment Notification", type: "toggle", desc: "Notify on new comments" },
      { key: "notify_on_reaction", label: "Reaction Notification", type: "toggle", desc: "Notify on reactions" },
      { key: "notify_on_message", label: "Message Notification", type: "toggle", desc: "Notify on new messages" },
      { key: "notify_on_sale", label: "Sale Notification", type: "toggle", desc: "Notify on marketplace sales" },
      { key: "marketing_emails_enabled", label: "Marketing Emails", type: "toggle", desc: "Send promotional emails" },
      { key: "digest_frequency", label: "Digest Frequency", type: "select", desc: "Email digest schedule", options: ["never", "daily", "weekly", "monthly"] },
    ]
  },
  moderation: {
    title: "Moderation & Safety",
    icon: Shield,
    color: "orange",
    description: "Content moderation and user safety settings",
    fields: [
      { key: "report_threshold_for_review", label: "Report Threshold", type: "number", desc: "Reports needed for auto-review", min: 1, max: 20 },
      { key: "auto_ban_threshold", label: "Auto-Ban Threshold", type: "number", desc: "Violations before auto-ban", min: 3, max: 20 },
      { key: "adult_content_allowed", label: "Adult Content Allowed", type: "toggle", desc: "Allow 18+ content" },
      { key: "age_verification_required", label: "Age Verification", type: "toggle", desc: "Require age verification for 18+ content" },
      { key: "block_vpn_access", label: "Block VPN Access", type: "toggle", desc: "Restrict VPN/proxy users" },
      { key: "geo_restrictions", label: "Geo Restrictions", type: "text", desc: "Blocked countries (comma-separated ISO codes)" },
      { key: "shadowban_enabled", label: "Shadow Banning", type: "toggle", desc: "Silent content restriction" },
      { key: "appeal_window_days", label: "Appeal Window (Days)", type: "number", desc: "Days to appeal moderation", min: 1, max: 90 },
    ]
  },
  platform: {
    title: "Platform & Branding",
    icon: Globe,
    color: "teal",
    description: "Platform-wide settings and branding",
    fields: [
      { key: "platform_name", label: "Platform Name", type: "text", desc: "Name displayed across the app" },
      { key: "platform_tagline", label: "Tagline", type: "text", desc: "Short platform description" },
      { key: "support_email", label: "Support Email", type: "text", desc: "Customer support email" },
      { key: "terms_url", label: "Terms of Service URL", type: "text", desc: "Link to ToS page" },
      { key: "privacy_url", label: "Privacy Policy URL", type: "text", desc: "Link to privacy policy" },
      { key: "default_language", label: "Default Language", type: "select", desc: "Platform default language", options: ["en", "es", "fr", "de", "pt", "zh", "ja", "ko"] },
      { key: "timezone", label: "Platform Timezone", type: "select", desc: "Default timezone", options: ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore"] },
      { key: "currency", label: "Default Currency", type: "select", desc: "Primary currency", options: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] },
    ]
  },
  maintenance: {
    title: "Maintenance & System",
    icon: Lock,
    color: "slate",
    description: "System maintenance and emergency controls",
    fields: [
      { key: "maintenance_mode", label: "Maintenance Mode", type: "toggle", desc: "Only admins can access" },
      { key: "maintenance_message", label: "Maintenance Message", type: "textarea", desc: "Message shown during maintenance" },
      { key: "scheduled_maintenance", label: "Scheduled Maintenance", type: "datetime", desc: "Next scheduled maintenance window" },
      { key: "read_only_mode", label: "Read-Only Mode", type: "toggle", desc: "Disable all write operations" },
      { key: "rate_limit_requests", label: "Rate Limit (req/min)", type: "number", desc: "Max API requests per minute", min: 10, max: 1000 },
      { key: "backup_frequency", label: "Backup Frequency", type: "select", desc: "Database backup schedule", options: ["hourly", "daily", "weekly"] },
      { key: "log_retention_days", label: "Log Retention (Days)", type: "number", desc: "Days to keep logs", min: 7, max: 365 },
      { key: "debug_mode", label: "Debug Mode", type: "toggle", desc: "Enable verbose logging (dev only)" },
    ]
  },
};

// Default values for all settings
const DEFAULT_SETTINGS = {
  // Registration
  registration_enabled: true,
  email_verification_required: false,
  phone_verification_required: false,
  google_auth_enabled: true,
  min_password_length: 8,
  session_timeout_hours: 24,
  max_login_attempts: 5,
  lockout_duration_minutes: 30,
  // Features
  social_feed_enabled: true,
  messaging_enabled: true,
  marketplace_enabled: true,
  casino_enabled: true,
  daily_spin_enabled: true,
  stories_enabled: true,
  groups_enabled: true,
  pages_enabled: true,
  events_enabled: true,
  ai_generation_enabled: true,
  albums_enabled: true,
  referral_system_enabled: true,
  // Content
  max_post_length: 5000,
  max_images_per_post: 10,
  max_video_size_mb: 100,
  max_image_size_mb: 10,
  allowed_video_formats: "mp4,webm,mov",
  allowed_image_formats: "jpg,jpeg,png,gif,webp",
  auto_moderate_content: false,
  require_post_approval: false,
  profanity_filter_enabled: true,
  spam_detection_enabled: true,
  // Rewards
  welcome_bonus: 100,
  referral_bonus: 100,
  daily_login_bonus: 10,
  post_video_reward: 50,
  post_photo_reward: 20,
  post_story_reward: 50,
  golden_thumbs_reward: 10,
  first_comment_reward: 10,
  create_group_reward: 40,
  create_page_reward: 40,
  // Referral
  level1_commission_rate: 10,
  level2_commission_rate: 5,
  min_withdrawal_amount: 1000,
  withdrawal_fee_percent: 2,
  referral_transfer_enabled: true,
  max_referral_depth: 2,
  commission_payout_delay_days: 7,
  // Marketplace
  marketplace_fee_percent: 5,
  max_listing_price: 100000,
  min_listing_price: 1,
  max_listings_per_user: 100,
  listing_expiry_days: 30,
  featured_listing_cost: 500,
  stripe_enabled: true,
  crypto_payments_enabled: false,
  escrow_enabled: true,
  // Casino
  casino_min_bet: 10,
  casino_max_bet: 10000,
  slots_enabled: true,
  blackjack_enabled: true,
  roulette_enabled: true,
  poker_enabled: true,
  wheel_enabled: true,
  house_edge_percent: 5,
  daily_spin_rewards: "1000,5000,15000,35000,80000,200000",
  // Notifications
  email_notifications_enabled: true,
  push_notifications_enabled: true,
  notify_on_new_follower: true,
  notify_on_comment: true,
  notify_on_reaction: true,
  notify_on_message: true,
  notify_on_sale: true,
  marketing_emails_enabled: false,
  digest_frequency: "weekly",
  // Moderation
  report_threshold_for_review: 3,
  auto_ban_threshold: 5,
  adult_content_allowed: false,
  age_verification_required: false,
  block_vpn_access: false,
  geo_restrictions: "",
  shadowban_enabled: true,
  appeal_window_days: 14,
  // Platform
  platform_name: "Blendlink",
  platform_tagline: "Connect. Create. Earn.",
  support_email: "support@blendlink.com",
  terms_url: "/terms",
  privacy_url: "/privacy",
  default_language: "en",
  timezone: "UTC",
  currency: "USD",
  // Maintenance
  maintenance_mode: false,
  maintenance_message: "We are performing scheduled maintenance. Please check back soon.",
  scheduled_maintenance: "",
  read_only_mode: false,
  rate_limit_requests: 100,
  backup_frequency: "daily",
  log_retention_days: 30,
  debug_mode: false,
};

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState(["registration", "features"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/admin-system/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      // Merge with defaults
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to load settings");
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/admin-system/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      toast.success("Settings saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    if (confirm("Reset all settings to defaults? This cannot be undone.")) {
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(true);
      toast.info("Settings reset to defaults. Click Save to apply.");
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    pink: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Filter settings based on search
  const filteredSections = searchQuery 
    ? Object.entries(SETTINGS_SCHEMA).filter(([key, section]) => {
        return section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.fields.some(f => f.label.toLowerCase().includes(searchQuery.toLowerCase()));
      })
    : Object.entries(SETTINGS_SCHEMA);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-400" />
            Platform Settings
          </h1>
          <p className="text-slate-400">Complete admin control panel like Facebook & eBay</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={resetToDefaults} 
            variant="outline" 
            className="border-slate-600 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Reset Defaults
          </Button>
          <Button 
            onClick={saveSettings} 
            disabled={saving || !hasChanges} 
            className={hasChanges ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-600"}
          >
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 text-sm">You have unsaved changes. Do not forget to save!</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {filteredSections.map(([sectionKey, section]) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.includes(sectionKey);
          
          return (
            <div 
              key={sectionKey} 
              className={`bg-slate-800 rounded-xl border ${colorClasses[section.color]} overflow-hidden`}
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${colorClasses[section.color]} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">{section.title}</h3>
                    <p className="text-sm text-slate-400">{section.description}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="px-6 pb-6 space-y-4 border-t border-slate-700/50">
                  {section.fields.map((field) => (
                    <SettingField
                      key={field.key}
                      field={field}
                      value={settings[field.key]}
                      onChange={(value) => updateSetting(field.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            onClick={() => {
              updateSetting('maintenance_mode', true);
              toast.warning("Maintenance mode enabled. Save to apply.");
            }}
          >
            <Lock className="w-4 h-4 mr-2" /> Enable Maintenance
          </Button>
          <Button
            variant="outline"
            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => {
              updateSetting('registration_enabled', false);
              toast.warning("Registration disabled. Save to apply.");
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Disable Registration
          </Button>
          <Button
            variant="outline"
            className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            onClick={() => {
              updateSetting('casino_enabled', false);
              toast.warning("Casino disabled. Save to apply.");
            }}
          >
            <Gamepad2 className="w-4 h-4 mr-2" /> Disable Casino
          </Button>
          <Button
            variant="outline"
            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                maintenance_mode: false,
                registration_enabled: true,
                casino_enabled: true,
                marketplace_enabled: true,
              }));
              setHasChanges(true);
              toast.success("All features enabled. Save to apply.");
            }}
          >
            <Zap className="w-4 h-4 mr-2" /> Enable All
          </Button>
        </div>
      </div>
    </div>
  );
}

// Individual Setting Field Component
function SettingField({ field, value, onChange }) {
  const { key, label, type, desc, min, max, step, options } = field;

  switch (type) {
    case 'toggle':
      return (
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
          <div>
            <p className="font-medium text-white">{label}</p>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
          <ToggleSwitch checked={value === true} onChange={onChange} />
        </div>
      );

    case 'number':
      return (
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
          <div>
            <p className="font-medium text-white">{label}</p>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
          <input
            type="number"
            value={value || 0}
            min={min}
            max={max}
            step={step || 1}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-32 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );

    case 'text':
      return (
        <div className="py-3 border-b border-slate-700/50 last:border-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-medium text-white">{label}</p>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          </div>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="py-3 border-b border-slate-700/50 last:border-0">
          <div className="mb-2">
            <p className="font-medium text-white">{label}</p>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      );

    case 'select':
      return (
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
          <div>
            <p className="font-medium text-white">{label}</p>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
          <select
            value={value || options?.[0]}
            onChange={(e) => onChange(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'datetime':
      return (
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
          <div>
            <p className="font-medium text-white">{label}</p>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
          <input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );

    default:
      return null;
  }
}

// Toggle Switch Component
function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-600'}`}
      data-testid="toggle-switch"
    >
      <div 
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`} 
      />
    </button>
  );
}
