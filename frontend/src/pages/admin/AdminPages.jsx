import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Layout, GripVertical, Eye, EyeOff, Trash2, Plus,
  Save, RefreshCw, Smartphone, Monitor, Settings
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Icon mapping for display
const iconMap = {
  Home: "🏠", Newspaper: "📰", ShoppingBag: "🛍️", Dice5: "🎲",
  User: "👤", Wallet: "💰", Users: "👥", Users2: "👥", Calendar: "📅",
  MessageCircle: "💬", Bell: "🔔", Image: "🖼️", TrendingUp: "📈",
  Store: "🏪", Shield: "🛡️", FileText: "📄"
};

export default function AdminPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/page-manager/pages?include_hidden=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPages(data.pages || []);
    } catch (error) {
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (pageId) => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/page-manager/pages/${pageId}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPages(prev => prev.map(p => 
        p.page_id === pageId ? { ...p, is_visible: data.is_visible } : p
      ));
      toast.success(data.message);
    } catch (error) {
      toast.error("Failed to toggle visibility");
    }
  };

  const updatePage = async (pageId, updates) => {
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/page-manager/pages/${pageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      loadPages();
      setEditModal(null);
      toast.success("Page updated");
    } catch (error) {
      toast.error("Failed to update page");
    }
  };

  const deletePage = async (pageId) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/page-manager/pages/${pageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPages(prev => prev.filter(p => p.page_id !== pageId));
      toast.success("Page deleted");
    } catch (error) {
      toast.error(error.message || "Failed to delete page");
    }
  };

  const createPage = async (pageData) => {
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/page-manager/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(pageData)
      });
      loadPages();
      setCreateModal(false);
      toast.success("Page created");
    } catch (error) {
      toast.error("Failed to create page");
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    
    const newPages = [...pages];
    const draggedPage = newPages[draggedItem];
    newPages.splice(draggedItem, 1);
    newPages.splice(index, 0, draggedPage);
    
    // Update order numbers
    newPages.forEach((page, i) => page.order = i);
    
    setPages(newPages);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem === null) return;
    setDraggedItem(null);
    
    // Save new order to backend
    setSaving(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/page-manager/pages/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          page_orders: pages.map((p, i) => ({ page_id: p.page_id, order: i }))
        })
      });
      toast.success("Order saved");
    } catch (error) {
      toast.error("Failed to save order");
      loadPages();
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("Reset all pages to defaults? This will delete custom pages.")) return;
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/page-manager/pages/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadPages();
      toast.success("Reset to defaults");
    } catch (error) {
      toast.error("Failed to reset");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layout className="w-6 h-6 text-blue-400" />
            Page Management
          </h1>
          <p className="text-slate-400">
            {pages.length} pages • Drag to reorder • Synced web + mobile
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Page
          </Button>
          <Button onClick={resetToDefaults} variant="outline" className="border-slate-600">
            <RefreshCw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm text-slate-400">
        <span className="flex items-center gap-1"><Monitor className="w-4 h-4" /> Show in Web Nav</span>
        <span className="flex items-center gap-1"><Smartphone className="w-4 h-4" /> Show in Mobile Nav</span>
        <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> Visible</span>
      </div>

      {/* Pages List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {pages.map((page, index) => (
              <div
                key={page.page_id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-4 p-4 transition-colors ${
                  draggedItem === index ? 'bg-blue-600/20' : 'hover:bg-slate-700/30'
                } ${!page.is_visible ? 'opacity-50' : ''}`}
              >
                <div className="cursor-grab text-slate-500 hover:text-slate-300">
                  <GripVertical className="w-5 h-5" />
                </div>
                
                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                  {iconMap[page.icon] || "📄"}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{page.name}</h3>
                    {page.is_system && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-slate-600 text-slate-300 rounded">SYSTEM</span>
                    )}
                    {page.required_role === 'admin' && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-purple-600/30 text-purple-400 rounded">ADMIN</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 truncate">{page.route} → {page.mobile_screen}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {page.show_in_nav && <Monitor className="w-4 h-4 text-blue-400" title="Shows in web nav" />}
                  {page.show_in_mobile_nav && <Smartphone className="w-4 h-4 text-green-400" title="Shows in mobile nav" />}
                  {page.requires_auth && <span className="text-xs text-amber-400">🔒</span>}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleVisibility(page.page_id)}
                    className={page.is_visible ? "text-green-400" : "text-slate-500"}
                  >
                    {page.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditModal(page)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  {!page.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePage(page.page_id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-8 right-8 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <Save className="w-4 h-4 animate-pulse" /> Saving order...
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <PageEditModal
          page={editModal}
          onSave={(updates) => updatePage(editModal.page_id, updates)}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* Create Modal */}
      {createModal && (
        <PageCreateModal
          onSave={createPage}
          onClose={() => setCreateModal(false)}
        />
      )}
    </div>
  );
}

function PageEditModal({ page, onSave, onClose }) {
  const [name, setName] = useState(page.name);
  const [icon, setIcon] = useState(page.icon);
  const [description, setDescription] = useState(page.description || "");
  const [showInNav, setShowInNav] = useState(page.show_in_nav);
  const [showInMobileNav, setShowInMobileNav] = useState(page.show_in_mobile_nav);
  const [requiresAuth, setRequiresAuth] = useState(page.requires_auth);

  const handleSave = () => {
    onSave({
      name,
      icon,
      description,
      show_in_nav: showInNav,
      show_in_mobile_nav: showInMobileNav,
      requires_auth: requiresAuth,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-white mb-4">Edit Page: {page.name}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Icon</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="Lucide icon name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} />
              Web Nav
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={showInMobileNav} onChange={(e) => setShowInMobileNav(e.target.checked)} />
              Mobile Nav
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={requiresAuth} onChange={(e) => setRequiresAuth(e.target.checked)} />
              Requires Login
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save</Button>
        </div>
      </div>
    </div>
  );
}

function PageCreateModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [route, setRoute] = useState("");
  const [mobileScreen, setMobileScreen] = useState("");
  const [icon, setIcon] = useState("FileText");

  const handleSave = () => {
    if (!name || !route || !mobileScreen) {
      toast.error("All fields are required");
      return;
    }
    onSave({ name, route, mobile_screen: mobileScreen, icon });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-white mb-4">Create New Page</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Page Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="My Custom Page"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Web Route</label>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="/my-page"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mobile Screen Name</label>
            <input
              type="text"
              value={mobileScreen}
              onChange={(e) => setMobileScreen(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="MyPageScreen"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Icon</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="FileText"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Create</Button>
        </div>
      </div>
    </div>
  );
}
