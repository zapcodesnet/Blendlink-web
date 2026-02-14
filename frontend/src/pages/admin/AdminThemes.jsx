import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { Palette, Check, Search, RefreshCw, Sun, Moon, Plus, Edit, Trash2, Save, X } from "lucide-react";

const API_BASE = getApiUrl();

// Safe fetch helper to avoid "body stream already read" errors
const safeFetch = async (url, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { ...options, headers });
  const rawText = await response.text();
  
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.error('JSON parse error:', e);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || 'Request failed');
  }
  
  return data;
};

// Default theme colors
const DEFAULT_THEMES = [
  {
    name: "Default Dark",
    mode: "dark",
    colors: {
      primary: "#3b82f6",
      secondary: "#6366f1",
      accent: "#8b5cf6",
      background: "#0a0a0a",
      foreground: "#fafafa",
      card: "#171717",
      border: "#262626",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444"
    }
  },
  {
    name: "Ocean Blue",
    mode: "dark",
    colors: {
      primary: "#0ea5e9",
      secondary: "#06b6d4",
      accent: "#14b8a6",
      background: "#0c1929",
      foreground: "#e0f2fe",
      card: "#0f2942",
      border: "#164e63",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#f43f5e"
    }
  },
  {
    name: "Purple Haze",
    mode: "dark",
    colors: {
      primary: "#a855f7",
      secondary: "#c084fc",
      accent: "#e879f9",
      background: "#1a0a2e",
      foreground: "#f3e8ff",
      card: "#2e1065",
      border: "#4c1d95",
      success: "#4ade80",
      warning: "#fbbf24",
      error: "#fb7185"
    }
  },
  {
    name: "Forest Green",
    mode: "dark",
    colors: {
      primary: "#22c55e",
      secondary: "#10b981",
      accent: "#34d399",
      background: "#0a1f0a",
      foreground: "#ecfdf5",
      card: "#14532d",
      border: "#166534",
      success: "#4ade80",
      warning: "#fbbf24",
      error: "#f87171"
    }
  },
  {
    name: "Sunset Orange",
    mode: "dark",
    colors: {
      primary: "#f97316",
      secondary: "#fb923c",
      accent: "#fbbf24",
      background: "#1c0f05",
      foreground: "#fff7ed",
      card: "#431407",
      border: "#7c2d12",
      success: "#84cc16",
      warning: "#eab308",
      error: "#dc2626"
    }
  },
  {
    name: "Clean Light",
    mode: "light",
    colors: {
      primary: "#2563eb",
      secondary: "#4f46e5",
      accent: "#7c3aed",
      background: "#ffffff",
      foreground: "#0a0a0a",
      card: "#f4f4f5",
      border: "#e4e4e7",
      success: "#16a34a",
      warning: "#ca8a04",
      error: "#dc2626"
    }
  }
];

export default function AdminThemes() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activating, setActivating] = useState(null);
  const [editingTheme, setEditingTheme] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTheme, setNewTheme] = useState({
    name: "",
    mode: "dark",
    colors: { ...DEFAULT_THEMES[0].colors }
  });

  useEffect(() => {
    loadThemes();
    loadActiveTheme();
  }, []);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const data = await safeFetch(`${API_BASE}/api/themes/`);
      // Merge with defaults if empty
      const allThemes = data.themes?.length > 0 ? data.themes : DEFAULT_THEMES;
      setThemes(allThemes);
    } catch (error) {
      console.error("Failed to load themes:", error);
      // Use default themes on error
      setThemes(DEFAULT_THEMES);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveTheme = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/themes/active`);
      setActiveTheme(data);
    } catch (error) {
      console.error("Failed to load active theme");
      // Set first default as active
      setActiveTheme(DEFAULT_THEMES[0]);
    }
  };

  const activateTheme = async (theme) => {
    setActivating(theme.name);
    try {
      const data = await safeFetch(`${API_BASE}/api/themes/activate`, {
        method: 'POST',
        body: JSON.stringify(theme)
      });
      setActiveTheme(theme);
      toast.success(`Theme "${theme.name}" activated!`);
      
      // Apply theme to document
      applyThemeToDOM(theme);
    } catch (error) {
      // Still apply locally even if backend fails
      setActiveTheme(theme);
      applyThemeToDOM(theme);
      toast.success(`Theme "${theme.name}" applied locally!`);
    } finally {
      setActivating(null);
    }
  };

  const applyThemeToDOM = (theme) => {
    const root = document.documentElement;
    Object.entries(theme.colors || {}).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    
    if (theme.mode === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  };

  const saveTheme = async (theme) => {
    try {
      await safeFetch(`${API_BASE}/api/themes/save`, {
        method: 'POST',
        body: JSON.stringify(theme)
      });
      toast.success("Theme saved!");
      loadThemes();
    } catch (error) {
      // Save locally
      setThemes(prev => {
        const exists = prev.find(t => t.name === theme.name);
        if (exists) {
          return prev.map(t => t.name === theme.name ? theme : t);
        }
        return [...prev, theme];
      });
      toast.success("Theme saved locally!");
    }
    setEditingTheme(null);
    setShowCreateModal(false);
  };

  const deleteTheme = async (themeName) => {
    if (!confirm(`Delete theme "${themeName}"?`)) return;
    
    try {
      await safeFetch(`${API_BASE}/api/themes/${encodeURIComponent(themeName)}`, {
        method: 'DELETE'
      });
      toast.success("Theme deleted!");
    } catch (error) {
      // Delete locally
      toast.info("Theme removed locally");
    }
    setThemes(prev => prev.filter(t => t.name !== themeName));
  };

  const filteredThemes = themes.filter(theme => 
    !search || theme.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Palette className="w-6 h-6 text-purple-400" />
            Theme Management
          </h1>
          <p className="text-slate-400">{themes.length} themes • Synced web + mobile</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" /> Create Theme
          </Button>
          <Button onClick={loadThemes} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {activeTheme && (
        <div className="rounded-xl p-4 border-2 border-purple-500/50 bg-slate-800">
          <p className="font-bold text-white flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Active: {activeTheme.name}
          </p>
          <p className="text-sm text-slate-400">Applied to website and mobile app</p>
          <div className="flex gap-2 mt-2">
            {Object.entries(activeTheme.colors || {}).slice(0, 5).map(([key, color]) => (
              <div 
                key={key}
                className="w-6 h-6 rounded-full border border-white/20"
                style={{ backgroundColor: color }}
                title={key}
              />
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search themes..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredThemes.map((theme) => {
            const isActive = activeTheme?.name === theme.name;
            return (
              <div
                key={theme.name}
                className={`rounded-xl border overflow-hidden transition-all hover:scale-[1.02] ${
                  isActive ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-slate-700'
                }`}
              >
                {/* Color Preview */}
                <div 
                  className="h-24 p-3 relative"
                  style={{ backgroundColor: theme.colors?.background || '#0a0a0a' }}
                >
                  <div className="flex flex-wrap gap-1">
                    {['primary', 'secondary', 'accent', 'success', 'warning', 'error'].map(key => (
                      <div 
                        key={key}
                        className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: theme.colors?.[key] || '#666' }}
                        title={key}
                      />
                    ))}
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                      Active
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2">
                    {theme.mode === 'light' ? (
                      <Sun className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                </div>
                
                {/* Theme Info */}
                <div className="p-3 bg-slate-800">
                  <h3 className="font-semibold text-white truncate">{theme.name}</h3>
                  <p className="text-xs text-slate-400 capitalize">{theme.mode} mode</p>
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => activateTheme(theme)}
                      disabled={isActive || activating === theme.name}
                      className={isActive ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}
                    >
                      {activating === theme.name ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : isActive ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        'Activate'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingTheme(theme)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    {!DEFAULT_THEMES.find(t => t.name === theme.name) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTheme(theme.name)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Theme Modal */}
      {(showCreateModal || editingTheme) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingTheme ? 'Edit Theme' : 'Create Theme'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowCreateModal(false); setEditingTheme(null); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Theme Name</label>
                <input
                  type="text"
                  value={editingTheme?.name || newTheme.name}
                  onChange={(e) => editingTheme 
                    ? setEditingTheme({...editingTheme, name: e.target.value})
                    : setNewTheme({...newTheme, name: e.target.value})
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="My Custom Theme"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-1">Mode</label>
                <div className="flex gap-2">
                  {['dark', 'light'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => editingTheme 
                        ? setEditingTheme({...editingTheme, mode})
                        : setNewTheme({...newTheme, mode})
                      }
                      className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 capitalize transition-colors ${
                        (editingTheme?.mode || newTheme.mode) === mode
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {mode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 block mb-2">Colors</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries((editingTheme?.colors || newTheme.colors)).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => {
                          const newColors = {...(editingTheme?.colors || newTheme.colors), [key]: e.target.value};
                          editingTheme 
                            ? setEditingTheme({...editingTheme, colors: newColors})
                            : setNewTheme({...newTheme, colors: newColors});
                        }}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <span className="text-sm text-slate-300 capitalize">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Preview */}
              <div 
                className="rounded-lg p-4 border"
                style={{ 
                  backgroundColor: (editingTheme?.colors || newTheme.colors).background,
                  borderColor: (editingTheme?.colors || newTheme.colors).border,
                  color: (editingTheme?.colors || newTheme.colors).foreground
                }}
              >
                <p className="text-sm font-medium mb-2">Preview</p>
                <div className="flex gap-2">
                  <button 
                    className="px-3 py-1 rounded text-sm text-white"
                    style={{ backgroundColor: (editingTheme?.colors || newTheme.colors).primary }}
                  >
                    Primary
                  </button>
                  <button 
                    className="px-3 py-1 rounded text-sm text-white"
                    style={{ backgroundColor: (editingTheme?.colors || newTheme.colors).secondary }}
                  >
                    Secondary
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => { setShowCreateModal(false); setEditingTheme(null); }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveTheme(editingTheme || newTheme)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4 mr-2" /> Save Theme
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
