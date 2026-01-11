import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Palette, Check, Search, Grid, List, Sparkles,
  Sun, Moon, Wand2, RefreshCw
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const adminApiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Request failed');
  return data;
};

export default function AdminThemes() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorColor, setGeneratorColor] = useState("#3b82f6");
  const [generatorMode, setGeneratorMode] = useState("light");
  const [generatedTheme, setGeneratedTheme] = useState(null);
  const [activating, setActivating] = useState(null);

  useEffect(() => {
    loadThemes();
    loadActiveTheme();
  }, []);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (search) params.search = search;
      const data = await adminApiRequest(`/themes/?${new URLSearchParams(params)}`);
      setThemes(data.themes);
      setCategories(data.categories);
    } catch (error) {
      toast.error("Failed to load themes");
    } finally {
      setLoading(false);
    }
  };

  const loadActiveTheme = async () => {
    try {
      const data = await adminApiRequest('/themes/active');
      setActiveTheme(data);
    } catch (error) {
      console.error("Failed to load active theme");
    }
  };

  const activateTheme = async (themeId) => {
    setActivating(themeId);
    try {
      const data = await adminApiRequest(`/themes/activate/${themeId}`, { method: 'POST' });
      setActiveTheme(data.theme);
      toast.success(`Theme "${data.theme.name}" activated!`);
      
      // Apply theme to current page for preview
      applyThemeToPage(data.theme);
    } catch (error) {
      toast.error("Failed to activate theme");
    } finally {
      setActivating(null);
    }
  };

  const applyThemeToPage = (theme) => {
    const root = document.documentElement;
    const colors = theme.colors;
    
    // This would update CSS variables - for demo we'll show a notification
    Object.entries(colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/_/g, '-')}`;
      root.style.setProperty(cssVar, value);
    });
  };

  const generateTheme = async () => {
    try {
      const data = await adminApiRequest('/themes/generate', {
        method: 'POST',
        body: JSON.stringify({
          base_color: generatorColor,
          mode: generatorMode,
          style: 'modern'
        })
      });
      setGeneratedTheme(data.generated_theme);
      toast.success("Theme generated!");
    } catch (error) {
      toast.error("Failed to generate theme");
    }
  };

  const filteredThemes = themes.filter(theme => {
    if (search) {
      const s = search.toLowerCase();
      if (!theme.name.toLowerCase().includes(s) && 
          !theme.description?.toLowerCase().includes(s) &&
          !theme.tags?.some(t => t.toLowerCase().includes(s))) {
        return false;
      }
    }
    if (category && theme.category !== category) return false;
    return true;
  });

  const categoryIcons = {
    light: Sun,
    dark: Moon,
    neon: Sparkles,
    nature: '🌿',
    gaming: '🎮',
    professional: '💼',
    minimal: '✨',
    colorful: '🌈',
    seasonal: '🍂',
    glass: '💎',
    gradient: '🎨',
    social: '👥',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Theme Management</h1>
          <p className="text-slate-400">
            {themes.length} themes available • Synced to web + mobile
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-slate-600"
            onClick={() => setShowGenerator(!showGenerator)}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Generator
          </Button>
          <Button onClick={loadThemes} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Active Theme Banner */}
      {activeTheme && (
        <div 
          className="rounded-xl p-4 border-2 border-blue-500/50"
          style={{ backgroundColor: activeTheme.colors?.background, color: activeTheme.colors?.foreground }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {Object.values(activeTheme.colors || {}).slice(0, 5).map((color, i) => (
                  <div 
                    key={i} 
                    className="w-6 h-6 rounded-full border border-white/20" 
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div>
                <p className="font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Active: {activeTheme.name}
                </p>
                <p className="text-sm opacity-70">Applied to website and mobile app</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Generator */}
      {showGenerator && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            Theme Generator
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Base Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={generatorColor}
                    onChange={(e) => setGeneratorColor(e.target.value)}
                    className="w-16 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={generatorColor}
                    onChange={(e) => setGeneratorColor(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mode</label>
                <div className="flex gap-2">
                  <Button
                    variant={generatorMode === 'light' ? 'default' : 'outline'}
                    onClick={() => setGeneratorMode('light')}
                    className={generatorMode === 'light' ? 'bg-blue-600' : 'border-slate-600'}
                  >
                    <Sun className="w-4 h-4 mr-2" /> Light
                  </Button>
                  <Button
                    variant={generatorMode === 'dark' ? 'default' : 'outline'}
                    onClick={() => setGeneratorMode('dark')}
                    className={generatorMode === 'dark' ? 'bg-blue-600' : 'border-slate-600'}
                  >
                    <Moon className="w-4 h-4 mr-2" /> Dark
                  </Button>
                </div>
              </div>
              <Button onClick={generateTheme} className="w-full bg-purple-600 hover:bg-purple-700">
                <Sparkles className="w-4 h-4 mr-2" /> Generate Theme
              </Button>
            </div>
            
            {/* Generated Preview */}
            {generatedTheme && (
              <div 
                className="rounded-xl p-4 border border-slate-600"
                style={{ 
                  backgroundColor: generatedTheme.colors?.background,
                  color: generatedTheme.colors?.foreground
                }}
              >
                <p className="font-bold mb-3">Preview</p>
                <div className="space-y-3">
                  <button
                    style={{ 
                      backgroundColor: generatedTheme.colors?.primary,
                      color: generatedTheme.colors?.primary_foreground,
                      borderRadius: generatedTheme.styles?.button_radius
                    }}
                    className="px-4 py-2 font-medium"
                  >
                    Primary Button
                  </button>
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: generatedTheme.colors?.card }}
                  >
                    <p style={{ color: generatedTheme.colors?.card_foreground }}>Card component</p>
                    <p style={{ color: generatedTheme.colors?.muted_foreground }} className="text-sm">
                      Muted text color
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {['primary', 'secondary', 'accent', 'destructive', 'success'].map(key => (
                      <div
                        key={key}
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: generatedTheme.colors?.[key] }}
                        title={key}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search themes..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <div className="flex border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            <Grid className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            <List className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !category ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              category === cat ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {typeof categoryIcons[cat] === 'string' ? categoryIcons[cat] : ''} {cat}
          </button>
        ))}
      </div>

      {/* Themes Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
          : 'space-y-3'
        }>
          {filteredThemes.map((theme) => {
            const isActive = activeTheme?.theme_id === theme.theme_id || activeTheme?.name === theme.name;
            
            return viewMode === 'grid' ? (
              <div
                key={theme.theme_id || theme.name}
                className={`rounded-xl border overflow-hidden transition-all hover:scale-[1.02] ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-700'
                }`}
              >
                {/* Theme Preview */}
                <div 
                  className="h-32 p-4 flex flex-col justify-between"
                  style={{ 
                    backgroundColor: theme.colors?.background || '#ffffff',
                    color: theme.colors?.foreground || '#000000'
                  }}
                >
                  <div className="flex gap-1">
                    {['primary', 'secondary', 'accent', 'destructive', 'success'].map(key => (
                      <div
                        key={key}
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: theme.colors?.[key] }}
                      />
                    ))}
                  </div>
                  <div 
                    className="rounded-lg p-2 text-xs"
                    style={{ 
                      backgroundColor: theme.colors?.card || '#f5f5f5',
                      color: theme.colors?.card_foreground || '#000000'
                    }}
                  >
                    Card preview
                  </div>
                </div>
                
                {/* Theme Info */}
                <div className="bg-slate-800 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {theme.name}
                        {isActive && <Check className="w-4 h-4 text-green-400" />}
                      </h3>
                      <p className="text-xs text-slate-400 capitalize">{theme.category}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {theme.description || 'No description'}
                  </p>
                  <Button
                    size="sm"
                    className={`w-full ${isActive ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    onClick={() => !isActive && activateTheme(theme.theme_id)}
                    disabled={isActive || activating === theme.theme_id}
                  >
                    {activating === theme.theme_id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isActive ? (
                      <>
                        <Check className="w-4 h-4 mr-1" /> Active
                      </>
                    ) : (
                      'Activate'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={theme.theme_id || theme.name}
                className={`bg-slate-800 rounded-xl border p-4 flex items-center gap-4 ${
                  isActive ? 'border-blue-500' : 'border-slate-700'
                }`}
              >
                <div className="flex gap-1">
                  {['primary', 'secondary', 'accent'].map(key => (
                    <div
                      key={key}
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: theme.colors?.[key] }}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    {theme.name}
                    {isActive && <Check className="w-4 h-4 text-green-400" />}
                  </h3>
                  <p className="text-sm text-slate-400">{theme.description || theme.category}</p>
                </div>
                <Button
                  size="sm"
                  className={isActive ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}
                  onClick={() => !isActive && activateTheme(theme.theme_id)}
                  disabled={isActive || activating === theme.theme_id}
                >
                  {activating === theme.theme_id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isActive ? 'Active' : 'Activate'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {filteredThemes.length === 0 && !loading && (
        <div className="text-center py-12">
          <Palette className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No themes found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
