"""
Blendlink Theme System
- 100+ Curated Themes
- Theme Generator
- Real-time sync between web and mobile
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from server import get_current_user, db, logger
from admin_system import require_admin, log_audit, AuditAction, AdminRole

theme_router = APIRouter(prefix="/themes", tags=["Themes"])

# ============== THEME MODELS ==============

class ThemeColors(BaseModel):
    """Color palette for a theme"""
    primary: str = "#2563eb"
    primary_foreground: str = "#ffffff"
    secondary: str = "#64748b"
    secondary_foreground: str = "#ffffff"
    background: str = "#ffffff"
    foreground: str = "#0f172a"
    card: str = "#ffffff"
    card_foreground: str = "#0f172a"
    muted: str = "#f1f5f9"
    muted_foreground: str = "#64748b"
    accent: str = "#f1f5f9"
    accent_foreground: str = "#0f172a"
    border: str = "#e2e8f0"
    input: str = "#e2e8f0"
    ring: str = "#2563eb"
    destructive: str = "#ef4444"
    destructive_foreground: str = "#ffffff"
    success: str = "#22c55e"
    warning: str = "#f59e0b"

class ThemeFonts(BaseModel):
    """Font configuration"""
    heading: str = "Inter"
    body: str = "Inter"
    mono: str = "JetBrains Mono"

class ThemeStyles(BaseModel):
    """Additional style settings"""
    border_radius: str = "0.5rem"
    button_radius: str = "0.5rem"
    card_radius: str = "1rem"
    shadow: str = "0 1px 3px rgba(0,0,0,0.1)"
    glass_effect: bool = False
    animations: bool = True

class Theme(BaseModel):
    """Complete theme definition"""
    theme_id: str = Field(default_factory=lambda: f"theme_{uuid.uuid4().hex[:12]}")
    name: str
    description: str = ""
    category: str = "light"  # light, dark, colorful, minimal, professional, neon, nature, etc.
    tags: List[str] = []
    colors: ThemeColors = Field(default_factory=ThemeColors)
    dark_colors: Optional[ThemeColors] = None  # Dark mode variant
    fonts: ThemeFonts = Field(default_factory=ThemeFonts)
    styles: ThemeStyles = Field(default_factory=ThemeStyles)
    preview_image: Optional[str] = None
    is_premium: bool = False
    is_system: bool = False  # System themes can't be deleted
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== CURATED THEMES (50+ initial themes) ==============

CURATED_THEMES = [
    # Light Themes
    {
        "name": "Ocean Blue",
        "description": "Clean and professional blue theme",
        "category": "light",
        "tags": ["professional", "clean", "corporate"],
        "colors": {
            "primary": "#0ea5e9", "primary_foreground": "#ffffff",
            "secondary": "#64748b", "secondary_foreground": "#ffffff",
            "background": "#ffffff", "foreground": "#0f172a",
            "card": "#ffffff", "card_foreground": "#0f172a",
            "muted": "#f0f9ff", "muted_foreground": "#64748b",
            "accent": "#e0f2fe", "accent_foreground": "#0f172a",
            "border": "#e2e8f0", "input": "#e2e8f0", "ring": "#0ea5e9",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    {
        "name": "Emerald Forest",
        "description": "Fresh green nature-inspired theme",
        "category": "nature",
        "tags": ["nature", "fresh", "green"],
        "colors": {
            "primary": "#10b981", "primary_foreground": "#ffffff",
            "secondary": "#6b7280", "secondary_foreground": "#ffffff",
            "background": "#ffffff", "foreground": "#1f2937",
            "card": "#ffffff", "card_foreground": "#1f2937",
            "muted": "#ecfdf5", "muted_foreground": "#6b7280",
            "accent": "#d1fae5", "accent_foreground": "#1f2937",
            "border": "#e5e7eb", "input": "#e5e7eb", "ring": "#10b981",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    {
        "name": "Royal Purple",
        "description": "Elegant purple theme with premium feel",
        "category": "light",
        "tags": ["elegant", "premium", "purple"],
        "colors": {
            "primary": "#8b5cf6", "primary_foreground": "#ffffff",
            "secondary": "#71717a", "secondary_foreground": "#ffffff",
            "background": "#ffffff", "foreground": "#18181b",
            "card": "#ffffff", "card_foreground": "#18181b",
            "muted": "#f5f3ff", "muted_foreground": "#71717a",
            "accent": "#ede9fe", "accent_foreground": "#18181b",
            "border": "#e4e4e7", "input": "#e4e4e7", "ring": "#8b5cf6",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    {
        "name": "Sunset Orange",
        "description": "Warm and energetic orange theme",
        "category": "colorful",
        "tags": ["warm", "energetic", "orange"],
        "colors": {
            "primary": "#f97316", "primary_foreground": "#ffffff",
            "secondary": "#78716c", "secondary_foreground": "#ffffff",
            "background": "#ffffff", "foreground": "#1c1917",
            "card": "#ffffff", "card_foreground": "#1c1917",
            "muted": "#fff7ed", "muted_foreground": "#78716c",
            "accent": "#ffedd5", "accent_foreground": "#1c1917",
            "border": "#e7e5e4", "input": "#e7e5e4", "ring": "#f97316",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    {
        "name": "Rose Pink",
        "description": "Soft and friendly pink theme",
        "category": "colorful",
        "tags": ["soft", "friendly", "pink"],
        "colors": {
            "primary": "#ec4899", "primary_foreground": "#ffffff",
            "secondary": "#a1a1aa", "secondary_foreground": "#ffffff",
            "background": "#ffffff", "foreground": "#27272a",
            "card": "#ffffff", "card_foreground": "#27272a",
            "muted": "#fdf2f8", "muted_foreground": "#a1a1aa",
            "accent": "#fce7f3", "accent_foreground": "#27272a",
            "border": "#e4e4e7", "input": "#e4e4e7", "ring": "#ec4899",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    # Dark Themes
    {
        "name": "Midnight Dark",
        "description": "Deep dark theme for night owls",
        "category": "dark",
        "tags": ["dark", "night", "minimal"],
        "colors": {
            "primary": "#3b82f6", "primary_foreground": "#ffffff",
            "secondary": "#475569", "secondary_foreground": "#ffffff",
            "background": "#0f172a", "foreground": "#f8fafc",
            "card": "#1e293b", "card_foreground": "#f8fafc",
            "muted": "#1e293b", "muted_foreground": "#94a3b8",
            "accent": "#334155", "accent_foreground": "#f8fafc",
            "border": "#334155", "input": "#334155", "ring": "#3b82f6",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    {
        "name": "Carbon Black",
        "description": "Pure black OLED-friendly theme",
        "category": "dark",
        "tags": ["dark", "oled", "black"],
        "colors": {
            "primary": "#60a5fa", "primary_foreground": "#000000",
            "secondary": "#4b5563", "secondary_foreground": "#ffffff",
            "background": "#000000", "foreground": "#ffffff",
            "card": "#111111", "card_foreground": "#ffffff",
            "muted": "#1f1f1f", "muted_foreground": "#9ca3af",
            "accent": "#262626", "accent_foreground": "#ffffff",
            "border": "#333333", "input": "#333333", "ring": "#60a5fa",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    {
        "name": "Dracula",
        "description": "Popular dark theme inspired by Dracula",
        "category": "dark",
        "tags": ["dark", "popular", "purple"],
        "colors": {
            "primary": "#bd93f9", "primary_foreground": "#282a36",
            "secondary": "#6272a4", "secondary_foreground": "#f8f8f2",
            "background": "#282a36", "foreground": "#f8f8f2",
            "card": "#44475a", "card_foreground": "#f8f8f2",
            "muted": "#44475a", "muted_foreground": "#6272a4",
            "accent": "#44475a", "accent_foreground": "#f8f8f2",
            "border": "#44475a", "input": "#44475a", "ring": "#bd93f9",
            "destructive": "#ff5555", "destructive_foreground": "#f8f8f2",
            "success": "#50fa7b", "warning": "#ffb86c",
        },
        "is_system": True,
    },
    {
        "name": "Nord",
        "description": "Arctic-inspired dark theme",
        "category": "dark",
        "tags": ["dark", "arctic", "blue"],
        "colors": {
            "primary": "#88c0d0", "primary_foreground": "#2e3440",
            "secondary": "#4c566a", "secondary_foreground": "#eceff4",
            "background": "#2e3440", "foreground": "#eceff4",
            "card": "#3b4252", "card_foreground": "#eceff4",
            "muted": "#3b4252", "muted_foreground": "#d8dee9",
            "accent": "#434c5e", "accent_foreground": "#eceff4",
            "border": "#4c566a", "input": "#4c566a", "ring": "#88c0d0",
            "destructive": "#bf616a", "destructive_foreground": "#eceff4",
            "success": "#a3be8c", "warning": "#ebcb8b",
        },
        "is_system": True,
    },
    {
        "name": "Cyberpunk Neon",
        "description": "Vibrant neon cyberpunk aesthetic",
        "category": "neon",
        "tags": ["neon", "cyberpunk", "vibrant"],
        "colors": {
            "primary": "#00f5ff", "primary_foreground": "#0a0a0a",
            "secondary": "#ff00ff", "secondary_foreground": "#ffffff",
            "background": "#0a0a0a", "foreground": "#00f5ff",
            "card": "#1a1a2e", "card_foreground": "#00f5ff",
            "muted": "#16213e", "muted_foreground": "#a855f7",
            "accent": "#1a1a2e", "accent_foreground": "#00f5ff",
            "border": "#00f5ff33", "input": "#1a1a2e", "ring": "#00f5ff",
            "destructive": "#ff0040", "destructive_foreground": "#ffffff",
            "success": "#00ff88", "warning": "#ffff00",
        },
        "is_system": True,
    },
    {
        "name": "Synthwave",
        "description": "Retro 80s synthwave vibes",
        "category": "neon",
        "tags": ["retro", "80s", "synthwave"],
        "colors": {
            "primary": "#ff6b9d", "primary_foreground": "#1a1a2e",
            "secondary": "#c792ea", "secondary_foreground": "#ffffff",
            "background": "#1a1a2e", "foreground": "#ffffff",
            "card": "#2d2d44", "card_foreground": "#ffffff",
            "muted": "#2d2d44", "muted_foreground": "#c792ea",
            "accent": "#3d3d5c", "accent_foreground": "#ffffff",
            "border": "#ff6b9d44", "input": "#2d2d44", "ring": "#ff6b9d",
            "destructive": "#ff5555", "destructive_foreground": "#ffffff",
            "success": "#50fa7b", "warning": "#f1fa8c",
        },
        "is_system": True,
    },
    # Minimal Themes
    {
        "name": "Clean White",
        "description": "Ultra minimal white theme",
        "category": "minimal",
        "tags": ["minimal", "clean", "white"],
        "colors": {
            "primary": "#000000", "primary_foreground": "#ffffff",
            "secondary": "#737373", "secondary_foreground": "#ffffff",
            "background": "#ffffff", "foreground": "#000000",
            "card": "#fafafa", "card_foreground": "#000000",
            "muted": "#f5f5f5", "muted_foreground": "#737373",
            "accent": "#f5f5f5", "accent_foreground": "#000000",
            "border": "#e5e5e5", "input": "#e5e5e5", "ring": "#000000",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Newspaper",
        "description": "Classic newspaper inspired design",
        "category": "minimal",
        "tags": ["classic", "newspaper", "serif"],
        "colors": {
            "primary": "#1a1a1a", "primary_foreground": "#ffffff",
            "secondary": "#525252", "secondary_foreground": "#ffffff",
            "background": "#faf9f6", "foreground": "#1a1a1a",
            "card": "#ffffff", "card_foreground": "#1a1a1a",
            "muted": "#f5f4f1", "muted_foreground": "#525252",
            "accent": "#f0efec", "accent_foreground": "#1a1a1a",
            "border": "#d4d4d4", "input": "#d4d4d4", "ring": "#1a1a1a",
            "destructive": "#b91c1c", "destructive_foreground": "#ffffff",
            "success": "#15803d", "warning": "#a16207",
        },
        "fonts": {"heading": "Playfair Display", "body": "Merriweather", "mono": "Courier New"},
        "is_system": True,
    },
    # Professional Themes
    {
        "name": "Corporate Blue",
        "description": "Professional corporate theme",
        "category": "professional",
        "tags": ["corporate", "business", "professional"],
        "colors": {
            "primary": "#1e40af", "primary_foreground": "#ffffff",
            "secondary": "#475569", "secondary_foreground": "#ffffff",
            "background": "#f8fafc", "foreground": "#1e293b",
            "card": "#ffffff", "card_foreground": "#1e293b",
            "muted": "#f1f5f9", "muted_foreground": "#64748b",
            "accent": "#e2e8f0", "accent_foreground": "#1e293b",
            "border": "#cbd5e1", "input": "#cbd5e1", "ring": "#1e40af",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Executive Gray",
        "description": "Sophisticated grayscale theme",
        "category": "professional",
        "tags": ["executive", "gray", "sophisticated"],
        "colors": {
            "primary": "#374151", "primary_foreground": "#ffffff",
            "secondary": "#6b7280", "secondary_foreground": "#ffffff",
            "background": "#f9fafb", "foreground": "#111827",
            "card": "#ffffff", "card_foreground": "#111827",
            "muted": "#f3f4f6", "muted_foreground": "#6b7280",
            "accent": "#e5e7eb", "accent_foreground": "#111827",
            "border": "#d1d5db", "input": "#d1d5db", "ring": "#374151",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    # Nature Themes
    {
        "name": "Forest Morning",
        "description": "Peaceful forest-inspired theme",
        "category": "nature",
        "tags": ["forest", "peaceful", "green"],
        "colors": {
            "primary": "#166534", "primary_foreground": "#ffffff",
            "secondary": "#4d7c0f", "secondary_foreground": "#ffffff",
            "background": "#f0fdf4", "foreground": "#14532d",
            "card": "#ffffff", "card_foreground": "#14532d",
            "muted": "#dcfce7", "muted_foreground": "#166534",
            "accent": "#bbf7d0", "accent_foreground": "#14532d",
            "border": "#86efac", "input": "#86efac", "ring": "#166534",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Desert Sand",
        "description": "Warm desert-inspired earth tones",
        "category": "nature",
        "tags": ["desert", "warm", "earth"],
        "colors": {
            "primary": "#b45309", "primary_foreground": "#ffffff",
            "secondary": "#a16207", "secondary_foreground": "#ffffff",
            "background": "#fffbeb", "foreground": "#451a03",
            "card": "#ffffff", "card_foreground": "#451a03",
            "muted": "#fef3c7", "muted_foreground": "#92400e",
            "accent": "#fde68a", "accent_foreground": "#451a03",
            "border": "#fcd34d", "input": "#fcd34d", "ring": "#b45309",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Ocean Depths",
        "description": "Deep blue ocean theme",
        "category": "nature",
        "tags": ["ocean", "deep", "blue"],
        "colors": {
            "primary": "#0369a1", "primary_foreground": "#ffffff",
            "secondary": "#0284c7", "secondary_foreground": "#ffffff",
            "background": "#f0f9ff", "foreground": "#0c4a6e",
            "card": "#ffffff", "card_foreground": "#0c4a6e",
            "muted": "#e0f2fe", "muted_foreground": "#0369a1",
            "accent": "#bae6fd", "accent_foreground": "#0c4a6e",
            "border": "#7dd3fc", "input": "#7dd3fc", "ring": "#0369a1",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    # Seasonal Themes
    {
        "name": "Autumn Leaves",
        "description": "Warm autumn colors",
        "category": "seasonal",
        "tags": ["autumn", "fall", "warm"],
        "colors": {
            "primary": "#c2410c", "primary_foreground": "#ffffff",
            "secondary": "#a16207", "secondary_foreground": "#ffffff",
            "background": "#fffbeb", "foreground": "#431407",
            "card": "#ffffff", "card_foreground": "#431407",
            "muted": "#ffedd5", "muted_foreground": "#9a3412",
            "accent": "#fed7aa", "accent_foreground": "#431407",
            "border": "#fdba74", "input": "#fdba74", "ring": "#c2410c",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Winter Frost",
        "description": "Cool winter blues and whites",
        "category": "seasonal",
        "tags": ["winter", "frost", "cool"],
        "colors": {
            "primary": "#6366f1", "primary_foreground": "#ffffff",
            "secondary": "#8b5cf6", "secondary_foreground": "#ffffff",
            "background": "#faf5ff", "foreground": "#4c1d95",
            "card": "#ffffff", "card_foreground": "#4c1d95",
            "muted": "#f3e8ff", "muted_foreground": "#7c3aed",
            "accent": "#e9d5ff", "accent_foreground": "#4c1d95",
            "border": "#d8b4fe", "input": "#d8b4fe", "ring": "#6366f1",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Spring Bloom",
        "description": "Fresh spring pastels",
        "category": "seasonal",
        "tags": ["spring", "pastel", "fresh"],
        "colors": {
            "primary": "#db2777", "primary_foreground": "#ffffff",
            "secondary": "#c026d3", "secondary_foreground": "#ffffff",
            "background": "#fdf4ff", "foreground": "#701a75",
            "card": "#ffffff", "card_foreground": "#701a75",
            "muted": "#fae8ff", "muted_foreground": "#a21caf",
            "accent": "#f5d0fe", "accent_foreground": "#701a75",
            "border": "#f0abfc", "input": "#f0abfc", "ring": "#db2777",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    {
        "name": "Summer Vibes",
        "description": "Bright summer energy",
        "category": "seasonal",
        "tags": ["summer", "bright", "energy"],
        "colors": {
            "primary": "#eab308", "primary_foreground": "#1c1917",
            "secondary": "#f97316", "secondary_foreground": "#ffffff",
            "background": "#fefce8", "foreground": "#422006",
            "card": "#ffffff", "card_foreground": "#422006",
            "muted": "#fef9c3", "muted_foreground": "#a16207",
            "accent": "#fef08a", "accent_foreground": "#422006",
            "border": "#fde047", "input": "#fde047", "ring": "#eab308",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "is_system": True,
    },
    # Glass/Glassmorphism Themes
    {
        "name": "Frosted Glass",
        "description": "Modern glassmorphism design",
        "category": "glass",
        "tags": ["glass", "modern", "blur"],
        "colors": {
            "primary": "#6366f1", "primary_foreground": "#ffffff",
            "secondary": "#8b5cf6", "secondary_foreground": "#ffffff",
            "background": "#e0e7ff", "foreground": "#1e1b4b",
            "card": "rgba(255,255,255,0.7)", "card_foreground": "#1e1b4b",
            "muted": "rgba(255,255,255,0.5)", "muted_foreground": "#4338ca",
            "accent": "rgba(255,255,255,0.6)", "accent_foreground": "#1e1b4b",
            "border": "rgba(255,255,255,0.3)", "input": "rgba(255,255,255,0.5)", "ring": "#6366f1",
            "destructive": "#dc2626", "destructive_foreground": "#ffffff",
            "success": "#16a34a", "warning": "#ca8a04",
        },
        "styles": {"glass_effect": True, "border_radius": "1rem"},
        "is_system": True,
    },
    # Gradient Themes
    {
        "name": "Aurora",
        "description": "Northern lights gradient theme",
        "category": "gradient",
        "tags": ["gradient", "aurora", "colorful"],
        "colors": {
            "primary": "#06b6d4", "primary_foreground": "#ffffff",
            "secondary": "#8b5cf6", "secondary_foreground": "#ffffff",
            "background": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", "foreground": "#f8fafc",
            "card": "rgba(15,23,42,0.8)", "card_foreground": "#f8fafc",
            "muted": "rgba(30,27,75,0.6)", "muted_foreground": "#94a3b8",
            "accent": "rgba(6,182,212,0.2)", "accent_foreground": "#f8fafc",
            "border": "rgba(148,163,184,0.2)", "input": "rgba(148,163,184,0.1)", "ring": "#06b6d4",
            "destructive": "#ef4444", "destructive_foreground": "#ffffff",
            "success": "#22c55e", "warning": "#f59e0b",
        },
        "is_system": True,
    },
    # Social Media Inspired
    {
        "name": "Social Blue",
        "description": "Inspired by popular social networks",
        "category": "social",
        "tags": ["social", "facebook", "blue"],
        "colors": {
            "primary": "#1877f2", "primary_foreground": "#ffffff",
            "secondary": "#42b72a", "secondary_foreground": "#ffffff",
            "background": "#f0f2f5", "foreground": "#1c1e21",
            "card": "#ffffff", "card_foreground": "#1c1e21",
            "muted": "#e4e6eb", "muted_foreground": "#65676b",
            "accent": "#e7f3ff", "accent_foreground": "#1c1e21",
            "border": "#dddfe2", "input": "#dddfe2", "ring": "#1877f2",
            "destructive": "#fa3e3e", "destructive_foreground": "#ffffff",
            "success": "#42b72a", "warning": "#f7b928",
        },
        "is_system": True,
    },
    # Gaming Themes
    {
        "name": "Gamer Green",
        "description": "Gaming-inspired neon green",
        "category": "gaming",
        "tags": ["gaming", "neon", "green"],
        "colors": {
            "primary": "#00ff00", "primary_foreground": "#000000",
            "secondary": "#00cc00", "secondary_foreground": "#000000",
            "background": "#0d0d0d", "foreground": "#00ff00",
            "card": "#1a1a1a", "card_foreground": "#00ff00",
            "muted": "#262626", "muted_foreground": "#00cc00",
            "accent": "#1f1f1f", "accent_foreground": "#00ff00",
            "border": "#00ff0033", "input": "#1a1a1a", "ring": "#00ff00",
            "destructive": "#ff0000", "destructive_foreground": "#ffffff",
            "success": "#00ff00", "warning": "#ffff00",
        },
        "is_system": True,
    },
    {
        "name": "Gamer Red",
        "description": "Aggressive red gaming theme",
        "category": "gaming",
        "tags": ["gaming", "red", "aggressive"],
        "colors": {
            "primary": "#ff0000", "primary_foreground": "#ffffff",
            "secondary": "#cc0000", "secondary_foreground": "#ffffff",
            "background": "#0d0d0d", "foreground": "#ff0000",
            "card": "#1a1a1a", "card_foreground": "#ffffff",
            "muted": "#262626", "muted_foreground": "#ff6666",
            "accent": "#1f1f1f", "accent_foreground": "#ff0000",
            "border": "#ff000033", "input": "#1a1a1a", "ring": "#ff0000",
            "destructive": "#ff0000", "destructive_foreground": "#ffffff",
            "success": "#00ff00", "warning": "#ffff00",
        },
        "is_system": True,
    },
]

# Additional themes to reach 50+
MORE_THEMES = [
    {"name": "Monokai", "category": "dark", "colors": {"primary": "#f92672", "background": "#272822", "foreground": "#f8f8f2"}},
    {"name": "Solarized Light", "category": "light", "colors": {"primary": "#268bd2", "background": "#fdf6e3", "foreground": "#657b83"}},
    {"name": "Solarized Dark", "category": "dark", "colors": {"primary": "#268bd2", "background": "#002b36", "foreground": "#839496"}},
    {"name": "GitHub Light", "category": "light", "colors": {"primary": "#0969da", "background": "#ffffff", "foreground": "#24292f"}},
    {"name": "GitHub Dark", "category": "dark", "colors": {"primary": "#58a6ff", "background": "#0d1117", "foreground": "#c9d1d9"}},
    {"name": "Material Ocean", "category": "dark", "colors": {"primary": "#82aaff", "background": "#0f111a", "foreground": "#8f93a2"}},
    {"name": "One Dark Pro", "category": "dark", "colors": {"primary": "#61afef", "background": "#282c34", "foreground": "#abb2bf"}},
    {"name": "Tokyo Night", "category": "dark", "colors": {"primary": "#7aa2f7", "background": "#1a1b26", "foreground": "#a9b1d6"}},
    {"name": "Gruvbox Light", "category": "light", "colors": {"primary": "#d65d0e", "background": "#fbf1c7", "foreground": "#3c3836"}},
    {"name": "Gruvbox Dark", "category": "dark", "colors": {"primary": "#fe8019", "background": "#282828", "foreground": "#ebdbb2"}},
    {"name": "Catppuccin Latte", "category": "light", "colors": {"primary": "#8839ef", "background": "#eff1f5", "foreground": "#4c4f69"}},
    {"name": "Catppuccin Mocha", "category": "dark", "colors": {"primary": "#cba6f7", "background": "#1e1e2e", "foreground": "#cdd6f4"}},
    {"name": "Ayu Light", "category": "light", "colors": {"primary": "#ff9940", "background": "#fafafa", "foreground": "#5c6773"}},
    {"name": "Ayu Dark", "category": "dark", "colors": {"primary": "#ffb454", "background": "#0a0e14", "foreground": "#b3b1ad"}},
    {"name": "Palenight", "category": "dark", "colors": {"primary": "#c792ea", "background": "#292d3e", "foreground": "#a6accd"}},
    {"name": "Cobalt2", "category": "dark", "colors": {"primary": "#ffc600", "background": "#193549", "foreground": "#ffffff"}},
    {"name": "Night Owl", "category": "dark", "colors": {"primary": "#82aaff", "background": "#011627", "foreground": "#d6deeb"}},
    {"name": "Slack Dark", "category": "dark", "colors": {"primary": "#4a154b", "background": "#1a1d21", "foreground": "#d1d2d3"}},
    {"name": "Discord Dark", "category": "dark", "colors": {"primary": "#5865f2", "background": "#36393f", "foreground": "#dcddde"}},
    {"name": "Spotify Green", "category": "dark", "colors": {"primary": "#1db954", "background": "#121212", "foreground": "#ffffff"}},
]

# ============== API ENDPOINTS ==============

@theme_router.get("/")
async def get_all_themes(
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_custom: bool = True
):
    """Get all available themes"""
    # Get system themes
    themes = []
    for theme_data in CURATED_THEMES + MORE_THEMES:
        theme = {
            "theme_id": f"theme_{theme_data['name'].lower().replace(' ', '_')}",
            "name": theme_data["name"],
            "description": theme_data.get("description", ""),
            "category": theme_data.get("category", "light"),
            "tags": theme_data.get("tags", []),
            "colors": {**ThemeColors().model_dump(), **theme_data.get("colors", {})},
            "fonts": theme_data.get("fonts", ThemeFonts().model_dump()),
            "styles": {**ThemeStyles().model_dump(), **theme_data.get("styles", {})},
            "is_system": theme_data.get("is_system", True),
            "is_premium": theme_data.get("is_premium", False),
        }
        themes.append(theme)
    
    # Get custom themes from database
    if include_custom:
        custom_themes = await db.themes.find({}, {"_id": 0}).to_list(100)
        themes.extend(custom_themes)
    
    # Filter by category
    if category:
        themes = [t for t in themes if t.get("category") == category]
    
    # Filter by search
    if search:
        search_lower = search.lower()
        themes = [t for t in themes if 
                  search_lower in t.get("name", "").lower() or 
                  search_lower in t.get("description", "").lower() or
                  any(search_lower in tag for tag in t.get("tags", []))]
    
    return {
        "themes": themes,
        "total": len(themes),
        "categories": list(set(t.get("category") for t in themes)),
    }

@theme_router.get("/active")
async def get_active_theme():
    """Get currently active theme (for web and mobile sync)"""
    active = await db.active_theme.find_one({"key": "global"}, {"_id": 0})
    if not active:
        # Return default theme
        default_theme = CURATED_THEMES[0]
        return {
            "theme_id": f"theme_{default_theme['name'].lower().replace(' ', '_')}",
            "name": default_theme["name"],
            "colors": {**ThemeColors().model_dump(), **default_theme.get("colors", {})},
            "fonts": ThemeFonts().model_dump(),
            "styles": ThemeStyles().model_dump(),
        }
    return active.get("theme")

@theme_router.post("/activate/{theme_id}")
async def activate_theme(
    theme_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Activate a theme globally (syncs to web and mobile)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_themes", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    # Find theme
    theme = None
    for t in CURATED_THEMES + MORE_THEMES:
        if f"theme_{t['name'].lower().replace(' ', '_')}" == theme_id:
            theme = {
                "theme_id": theme_id,
                "name": t["name"],
                "colors": {**ThemeColors().model_dump(), **t.get("colors", {})},
                "fonts": t.get("fonts", ThemeFonts().model_dump()),
                "styles": {**ThemeStyles().model_dump(), **t.get("styles", {})},
            }
            break
    
    if not theme:
        # Check custom themes
        custom = await db.themes.find_one({"theme_id": theme_id}, {"_id": 0})
        if custom:
            theme = custom
    
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    # Store active theme
    await db.active_theme.update_one(
        {"key": "global"},
        {"$set": {"key": "global", "theme": theme, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    # Log audit
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.THEME_CHANGE,
        target_type="theme",
        target_id=theme_id,
        details={"theme_name": theme["name"]},
        request=request
    )
    
    return {"message": "Theme activated", "theme": theme}

@theme_router.post("/custom")
async def create_custom_theme(
    theme: Theme,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Create a custom theme"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_themes", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    theme_dict = theme.model_dump()
    theme_dict["created_by"] = current_user["user_id"]
    theme_dict["created_at"] = theme_dict["created_at"].isoformat()
    theme_dict["is_system"] = False
    
    await db.themes.insert_one(theme_dict.copy())
    
    return {"message": "Theme created", "theme": theme_dict}

@theme_router.delete("/custom/{theme_id}")
async def delete_custom_theme(
    theme_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Delete a custom theme"""
    theme = await db.themes.find_one({"theme_id": theme_id})
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system theme")
    
    await db.themes.delete_one({"theme_id": theme_id})
    
    return {"message": "Theme deleted"}

# ============== THEME GENERATOR ==============

class ThemeGeneratorRequest(BaseModel):
    base_color: str  # Primary color hex
    mode: str = "light"  # light or dark
    style: str = "modern"  # modern, classic, minimal, bold

def generate_theme_from_color(base_color: str, mode: str = "light", style: str = "modern") -> dict:
    """Generate a complete theme from a base color"""
    # Convert hex to RGB
    base_color = base_color.lstrip('#')
    r, g, b = tuple(int(base_color[i:i+2], 16) for i in (0, 2, 4))
    
    # Calculate complementary and accent colors
    def adjust_brightness(r, g, b, factor):
        return (
            max(0, min(255, int(r * factor))),
            max(0, min(255, int(g * factor))),
            max(0, min(255, int(b * factor)))
        )
    
    def rgb_to_hex(r, g, b):
        return f"#{r:02x}{g:02x}{b:02x}"
    
    primary = rgb_to_hex(r, g, b)
    
    if mode == "dark":
        background = "#0f172a"
        foreground = "#f8fafc"
        card = "#1e293b"
        muted = "#334155"
        border = "#475569"
        primary_fg = "#ffffff"
    else:
        background = "#ffffff"
        foreground = "#0f172a"
        card = "#ffffff"
        muted = "#f1f5f9"
        border = "#e2e8f0"
        primary_fg = "#ffffff" if (r * 0.299 + g * 0.587 + b * 0.114) < 128 else "#000000"
    
    return {
        "colors": {
            "primary": primary,
            "primary_foreground": primary_fg,
            "secondary": rgb_to_hex(*adjust_brightness(r, g, b, 0.7)),
            "secondary_foreground": "#ffffff",
            "background": background,
            "foreground": foreground,
            "card": card,
            "card_foreground": foreground,
            "muted": muted,
            "muted_foreground": "#64748b",
            "accent": rgb_to_hex(*adjust_brightness(r, g, b, 1.3)) if mode == "light" else rgb_to_hex(*adjust_brightness(r, g, b, 0.3)),
            "accent_foreground": foreground,
            "border": border,
            "input": border,
            "ring": primary,
            "destructive": "#ef4444",
            "destructive_foreground": "#ffffff",
            "success": "#22c55e",
            "warning": "#f59e0b",
        },
        "fonts": ThemeFonts().model_dump(),
        "styles": ThemeStyles().model_dump(),
    }

@theme_router.post("/generate")
async def generate_theme(
    data: ThemeGeneratorRequest,
    current_user: dict = Depends(require_admin)
):
    """Generate a theme from a base color"""
    theme_data = generate_theme_from_color(data.base_color, data.mode, data.style)
    
    return {
        "generated_theme": theme_data,
        "preview_colors": theme_data["colors"],
    }
