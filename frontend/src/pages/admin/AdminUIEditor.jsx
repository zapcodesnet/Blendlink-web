import React, { useState, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  Code, Save, RefreshCw, Play, Eye, EyeOff, 
  Smartphone, Monitor, FileCode, Settings, 
  Palette, Type, Layout, Image, Box, X,
  ChevronDown, Copy, Download, Upload
} from "lucide-react";

const API_BASE = getApiUrl();

// Safe fetch helper
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

// Editable component types
const COMPONENT_TYPES = [
  { id: 'text', name: 'Text', icon: Type },
  { id: 'button', name: 'Button', icon: Box },
  { id: 'image', name: 'Image', icon: Image },
  { id: 'layout', name: 'Layout', icon: Layout },
  { id: 'color', name: 'Colors', icon: Palette },
];

// Sample editable areas
const EDITABLE_AREAS = [
  { id: 'landing_hero', name: 'Landing Hero Section', page: 'Landing' },
  { id: 'landing_features', name: 'Landing Features', page: 'Landing' },
  { id: 'navbar', name: 'Navigation Bar', page: 'Global' },
  { id: 'footer', name: 'Footer', page: 'Global' },
  { id: 'wallet_header', name: 'Wallet Header', page: 'Wallet' },
  { id: 'profile_header', name: 'Profile Header', page: 'Profile' },
  { id: 'marketplace_banner', name: 'Marketplace Banner', page: 'Marketplace' },
];

export default function AdminUIEditor() {
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' or 'code'
  const [selectedArea, setSelectedArea] = useState(null);
  const [devicePreview, setDevicePreview] = useState('desktop'); // 'desktop', 'mobile'
  const [customizations, setCustomizations] = useState({});
  const [codeContent, setCodeContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const codeEditorRef = useRef(null);

  useEffect(() => {
    loadCustomizations();
  }, []);

  const loadCustomizations = async () => {
    setLoading(true);
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/ui-customizations`);
      setCustomizations(data.customizations || {});
    } catch (error) {
      console.error("Failed to load customizations:", error);
      // Use defaults
      setCustomizations({
        landing_hero: {
          title: "Welcome to Blendlink",
          subtitle: "The Social Marketplace Platform",
          buttonText: "Get Started",
          buttonColor: "#3b82f6",
          backgroundColor: "#0a0a0a"
        },
        navbar: {
          logoText: "Blendlink",
          backgroundColor: "transparent",
          textColor: "#ffffff"
        },
        colors: {
          primary: "#3b82f6",
          secondary: "#6366f1",
          accent: "#8b5cf6",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444"
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCustomizations = async () => {
    setSaving(true);
    try {
      await safeFetch(`${API_BASE}/api/admin/ui-customizations`, {
        method: 'POST',
        body: JSON.stringify({ customizations })
      });
      toast.success("UI customizations saved!");
    } catch (error) {
      // Save locally
      localStorage.setItem('blendlink_ui_customizations', JSON.stringify(customizations));
      toast.success("Customizations saved locally!");
    } finally {
      setSaving(false);
    }
  };

  const updateCustomization = (areaId, key, value) => {
    setCustomizations(prev => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        [key]: value
      }
    }));
  };

  const handleCodeChange = (e) => {
    setCodeContent(e.target.value);
  };

  const applyCodeChanges = () => {
    try {
      const parsed = JSON.parse(codeContent);
      setCustomizations(parsed);
      toast.success("Code changes applied!");
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(customizations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blendlink-ui-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Configuration exported!");
  };

  const importConfig = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result);
        setCustomizations(parsed);
        toast.success("Configuration imported!");
      } catch (error) {
        toast.error("Invalid configuration file");
      }
    };
    reader.readAsText(file);
  };

  const selectedAreaConfig = selectedArea ? customizations[selectedArea.id] || {} : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Code className="w-6 h-6 text-blue-400" />
            UI Editor
          </h1>
          <p className="text-slate-400">Customize UI elements for web and mobile</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadCustomizations} variant="ghost" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".json" onChange={importConfig} className="hidden" />
            <Button variant="outline" className="border-slate-600" asChild>
              <span><Upload className="w-4 h-4 mr-2" /> Import</span>
            </Button>
          </label>
          <Button onClick={exportConfig} variant="outline" className="border-slate-600">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={saveCustomizations} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save All
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('visual')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'visual'
              ? 'bg-slate-800 text-white border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layout className="w-4 h-4" /> Visual Editor
        </button>
        <button
          onClick={() => {
            setActiveTab('code');
            setCodeContent(JSON.stringify(customizations, null, 2));
          }}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'code'
              ? 'bg-slate-800 text-white border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCode className="w-4 h-4" /> Code Editor
        </button>
      </div>

      {activeTab === 'visual' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Area Selection */}
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-3">Editable Areas</h3>
              <div className="space-y-2">
                {EDITABLE_AREAS.map(area => (
                  <button
                    key={area.id}
                    onClick={() => setSelectedArea(area)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedArea?.id === area.id
                        ? 'bg-blue-600/20 border border-blue-500/50 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <p className="font-medium">{area.name}</p>
                    <p className="text-xs text-slate-400">{area.page}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Global Colors */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Global Colors
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(customizations.colors || {}).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => updateCustomization('colors', key, e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0 mx-auto block"
                    />
                    <p className="text-xs text-slate-400 capitalize mt-1">{key}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Panel - Property Editor */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            {selectedArea ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">{selectedArea.name}</h3>
                  <button onClick={() => setSelectedArea(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* Text Properties */}
                  {(selectedAreaConfig.title !== undefined || selectedArea.id.includes('hero')) && (
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Title Text</label>
                      <input
                        type="text"
                        value={selectedAreaConfig.title || ''}
                        onChange={(e) => updateCustomization(selectedArea.id, 'title', e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="Enter title"
                      />
                    </div>
                  )}
                  
                  {(selectedAreaConfig.subtitle !== undefined || selectedArea.id.includes('hero')) && (
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Subtitle</label>
                      <input
                        type="text"
                        value={selectedAreaConfig.subtitle || ''}
                        onChange={(e) => updateCustomization(selectedArea.id, 'subtitle', e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="Enter subtitle"
                      />
                    </div>
                  )}
                  
                  {(selectedAreaConfig.buttonText !== undefined || selectedArea.id.includes('hero')) && (
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Button Text</label>
                      <input
                        type="text"
                        value={selectedAreaConfig.buttonText || ''}
                        onChange={(e) => updateCustomization(selectedArea.id, 'buttonText', e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="Button text"
                      />
                    </div>
                  )}
                  
                  {/* Color Properties */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Background</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selectedAreaConfig.backgroundColor || '#0a0a0a'}
                          onChange={(e) => updateCustomization(selectedArea.id, 'backgroundColor', e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={selectedAreaConfig.backgroundColor || '#0a0a0a'}
                          onChange={(e) => updateCustomization(selectedArea.id, 'backgroundColor', e.target.value)}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-white text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Text Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selectedAreaConfig.textColor || '#ffffff'}
                          onChange={(e) => updateCustomization(selectedArea.id, 'textColor', e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={selectedAreaConfig.textColor || '#ffffff'}
                          onChange={(e) => updateCustomization(selectedArea.id, 'textColor', e.target.value)}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {(selectedAreaConfig.buttonColor !== undefined || selectedArea.id.includes('hero') || selectedArea.id.includes('banner')) && (
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Button Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selectedAreaConfig.buttonColor || '#3b82f6'}
                          onChange={(e) => updateCustomization(selectedArea.id, 'buttonColor', e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={selectedAreaConfig.buttonColor || '#3b82f6'}
                          onChange={(e) => updateCustomization(selectedArea.id, 'buttonColor', e.target.value)}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Settings className="w-12 h-12 mb-3 opacity-30" />
                <p>Select an area to edit</p>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setDevicePreview('desktop')}
                  className={`p-1.5 rounded ${devicePreview === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDevicePreview('mobile')}
                  className={`p-1.5 rounded ${devicePreview === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className={`p-4 ${devicePreview === 'mobile' ? 'max-w-xs mx-auto' : ''}`}>
              {/* Preview Component */}
              {selectedArea?.id === 'landing_hero' && (
                <div 
                  className="rounded-lg p-6 text-center"
                  style={{ backgroundColor: selectedAreaConfig.backgroundColor || '#0a0a0a' }}
                >
                  <h1 
                    className="text-2xl font-bold mb-2"
                    style={{ color: selectedAreaConfig.textColor || '#ffffff' }}
                  >
                    {selectedAreaConfig.title || 'Welcome to Blendlink'}
                  </h1>
                  <p 
                    className="text-sm mb-4 opacity-70"
                    style={{ color: selectedAreaConfig.textColor || '#ffffff' }}
                  >
                    {selectedAreaConfig.subtitle || 'The Social Marketplace Platform'}
                  </p>
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: selectedAreaConfig.buttonColor || '#3b82f6' }}
                  >
                    {selectedAreaConfig.buttonText || 'Get Started'}
                  </button>
                </div>
              )}
              
              {selectedArea?.id === 'navbar' && (
                <div 
                  className="rounded-lg p-3 flex items-center justify-between"
                  style={{ backgroundColor: selectedAreaConfig.backgroundColor || 'transparent' }}
                >
                  <span 
                    className="font-bold"
                    style={{ color: selectedAreaConfig.textColor || '#ffffff' }}
                  >
                    {selectedAreaConfig.logoText || 'Blendlink'}
                  </span>
                  <div className="flex gap-4 text-sm" style={{ color: selectedAreaConfig.textColor || '#ffffff' }}>
                    <span>Home</span>
                    <span>Feed</span>
                    <span>Market</span>
                  </div>
                </div>
              )}
              
              {!selectedArea && (
                <div className="text-center text-slate-400 py-12">
                  <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Select an area to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Code Editor Tab */
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4" /> JSON Configuration
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(codeContent);
                  toast.success("Copied to clipboard!");
                }}
                className="text-slate-400"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={applyCodeChanges}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-1" /> Apply
              </Button>
            </div>
          </div>
          
          <textarea
            ref={codeEditorRef}
            value={codeContent}
            onChange={handleCodeChange}
            className="w-full h-96 bg-slate-900 text-green-400 font-mono text-sm p-4 focus:outline-none resize-none"
            spellCheck={false}
            placeholder="// Enter JSON configuration here"
          />
          
          <div className="p-3 border-t border-slate-700 text-xs text-slate-500">
            Edit JSON directly • Changes sync to web and mobile apps • Use Apply to preview
          </div>
        </div>
      )}

      {/* Sync Status */}
      <div className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Changes will sync to both web and mobile applications
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-green-400">
            <Monitor className="w-4 h-4" /> Web
          </span>
          <span className="flex items-center gap-1 text-green-400">
            <Smartphone className="w-4 h-4" /> Mobile
          </span>
        </div>
      </div>
    </div>
  );
}
