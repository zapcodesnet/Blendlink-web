import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { Palette, Check, Search, RefreshCw, Sun, Moon } from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminThemes() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activating, setActivating] = useState(null);

  useEffect(() => {
    loadThemes();
    loadActiveTheme();
  }, []);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/themes/`);
      const data = await response.json();
      setThemes(data.themes || []);
    } catch (error) {
      toast.error("Failed to load themes");
    } finally {
      setLoading(false);
    }
  };

  const loadActiveTheme = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/themes/active`);
      const data = await response.json();
      setActiveTheme(data);
    } catch (error) {
      console.error("Failed to load active theme");
    }
  };

  const activateTheme = async (themeId) => {
    setActivating(themeId);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/themes/activate/${themeId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setActiveTheme(data.theme);
      toast.success(`Theme "${data.theme.name}" activated!`);
    } catch (error) {
      toast.error("Failed to activate theme");
    } finally {
      setActivating(null);
    }
  };

  const filteredThemes = themes.filter(theme => 
    !search || theme.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Theme Management</h1>
          <p className="text-slate-400">{themes.length} themes • Synced web + mobile</p>
        </div>
        <Button onClick={loadThemes} variant="ghost" size="icon" className="text-slate-400">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {activeTheme && (
        <div className="rounded-xl p-4 border-2 border-blue-500/50 bg-slate-800">
          <p className="font-bold text-white flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Active: {activeTheme.name}
          </p>
          <p className="text-sm text-slate-400">Applied to website and mobile app</p>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredThemes.map((theme) => {
            const isActive = activeTheme?.name === theme.name;
            return (
              <div
                key={theme.theme_id || theme.name}
                className={`rounded-xl border overflow-hidden ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-700'
                }`}
              >
                <div 
                  className="h-24 p-3 flex flex-wrap gap-1"
                  style={{ backgroundColor: theme.colors?.background || '#fff' }}
                >
                  {['primary', 'secondary', 'accent', 'success'].map(key => (
                    <div
                      key={key}
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: theme.colors?.[key] }}
                    />
                  ))}
                </div>
                <div className="bg-slate-800 p-3">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    {theme.category === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {theme.name}
                    {isActive && <Check className="w-4 h-4 text-green-400" />}
                  </h3>
                  <p className="text-xs text-slate-400 capitalize mb-2">{theme.category}</p>
                  <Button
                    size="sm"
                    className={`w-full ${isActive ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    onClick={() => !isActive && activateTheme(theme.theme_id)}
                    disabled={isActive || activating === theme.theme_id}
                  >
                    {activating === theme.theme_id ? 'Activating...' : isActive ? 'Active' : 'Activate'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
