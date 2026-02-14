import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { getApiUrl } from "../utils/runtimeConfig";
import { 
  FolderPlus, Folder, Heart, Eye, Trash2, Edit2, Plus,
  ArrowLeft, Grid, Image, Video, Music, Sparkles, Share2,
  Globe, Lock, MoreVertical, Check, X, Loader2
} from "lucide-react";

const API_BASE = getApiUrl();

export default function AICollections() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState([]);
  const [publicCollections, setPublicCollections] = useState([]);
  const [favoriteCollections, setFavoriteCollections] = useState([]);
  const [activeTab, setActiveTab] = useState('mine'); // mine, public, favorites
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '', theme: 'default', is_public: false });
  const [creating, setCreating] = useState(false);

  const getToken = () => localStorage.getItem('blendlink_token') || localStorage.getItem('token');

  useEffect(() => {
    loadCollections();
  }, [activeTab]);

  const loadCollections = async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${getToken()}` };
    
    try {
      if (activeTab === 'mine') {
        const res = await fetch(`${API_BASE}/api/ai/collections/`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCollections(data.collections || []);
        }
      } else if (activeTab === 'public') {
        const res = await fetch(`${API_BASE}/api/ai/collections/public`, { headers });
        if (res.ok) {
          const data = await res.json();
          setPublicCollections(data.collections || []);
        }
      } else if (activeTab === 'favorites') {
        const res = await fetch(`${API_BASE}/api/ai/collections/favorites/mine`, { headers });
        if (res.ok) {
          const data = await res.json();
          setFavoriteCollections(data.collections || []);
        }
      }
    } catch (e) {
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async () => {
    if (!newCollection.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(newCollection)
      });
      
      if (res.ok) {
        toast.success('Collection created!');
        setShowCreateModal(false);
        setNewCollection({ name: '', description: '', theme: 'default', is_public: false });
        loadCollections();
      } else {
        throw new Error('Failed to create');
      }
    } catch (e) {
      toast.error('Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = async (collectionId) => {
    if (!confirm('Delete this collection?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/${collectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        toast.success('Collection deleted');
        setCollections(prev => prev.filter(c => c.collection_id !== collectionId));
      }
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const toggleFavorite = async (collectionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/${collectionId}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.favorited ? 'Added to favorites!' : 'Removed from favorites');
        loadCollections();
      }
    } catch (e) {
      toast.error('Failed to update favorite');
    }
  };

  const getThemeColors = (theme) => {
    const themes = {
      default: 'from-purple-500/30 to-blue-500/30',
      dark: 'from-slate-700 to-slate-900',
      vibrant: 'from-pink-500/30 to-orange-500/30',
      minimal: 'from-slate-500/20 to-slate-600/20'
    };
    return themes[theme] || themes.default;
  };

  const displayCollections = activeTab === 'mine' ? collections : 
                            activeTab === 'public' ? publicCollections : 
                            favoriteCollections;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/ai-gallery')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Folder className="w-6 h-6 text-purple-400" />
                  AI Collections
                </h1>
                <p className="text-sm text-slate-400">Organize your AI creations</p>
              </div>
            </div>
            
            <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
              <FolderPlus className="w-4 h-4 mr-2" />
              New Collection
            </Button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={activeTab === 'mine' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('mine')}
            >
              <Folder className="w-4 h-4 mr-2" />
              My Collections
            </Button>
            <Button
              variant={activeTab === 'public' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('public')}
            >
              <Globe className="w-4 h-4 mr-2" />
              Discover
            </Button>
            <Button
              variant={activeTab === 'favorites' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('favorites')}
            >
              <Heart className="w-4 h-4 mr-2" />
              Favorites
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : displayCollections.length === 0 ? (
          <div className="text-center py-20">
            <Folder className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {activeTab === 'mine' ? 'No collections yet' : 
               activeTab === 'public' ? 'No public collections' : 
               'No favorite collections'}
            </h3>
            <p className="text-slate-400 mb-6">
              {activeTab === 'mine' ? 'Create your first collection to organize AI creations' : 
               'Discover and favorite collections from other creators'}
            </p>
            {activeTab === 'mine' && (
              <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
                <FolderPlus className="w-4 h-4 mr-2" />
                Create Collection
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayCollections.map((col) => (
              <div
                key={col.collection_id}
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                onClick={() => navigate(`/ai-collections/${col.collection_id}`)}
              >
                {/* Cover */}
                <div className={`aspect-video relative bg-gradient-to-br ${getThemeColors(col.theme)}`}>
                  {col.cover_url ? (
                    <img src={`${API_BASE}${col.cover_url}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-white/50" />
                    </div>
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-2">
                    {col.is_public ? (
                      <span className="px-2 py-1 bg-green-500/80 text-white text-xs rounded-full flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Public
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-500/80 text-white text-xs rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Private
                      </span>
                    )}
                  </div>
                  
                  {/* Stats */}
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full flex items-center gap-1">
                      <Grid className="w-3 h-3" /> {col.item_count || 0}
                    </span>
                    {col.favorites_count > 0 && (
                      <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {col.favorites_count}
                      </span>
                    )}
                  </div>
                  
                  {/* Hover Actions */}
                  {activeTab === 'mine' && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="bg-red-500/80 hover:bg-red-600 text-white h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); deleteCollection(col.collection_id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  {activeTab !== 'mine' && col.is_public && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="bg-pink-500/80 hover:bg-pink-600 text-white h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(col.collection_id); }}
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold truncate">{col.name}</h3>
                  {col.description && (
                    <p className="text-sm text-slate-400 truncate mt-1">{col.description}</p>
                  )}
                  {col.user && col.user_id !== user?.user_id && (
                    <p className="text-xs text-slate-500 mt-2">by {col.user.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FolderPlus className="w-6 h-6 text-purple-400" />
              New Collection
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={newCollection.name}
                  onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My awesome collection"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <Input
                  value={newCollection.description}
                  onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="A collection of..."
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {['default', 'dark', 'vibrant', 'minimal'].map(theme => (
                    <button
                      key={theme}
                      onClick={() => setNewCollection(prev => ({ ...prev, theme }))}
                      className={`p-3 rounded-lg bg-gradient-to-br ${getThemeColors(theme)} border-2 ${
                        newCollection.theme === theme ? 'border-purple-500' : 'border-transparent'
                      }`}
                    >
                      {newCollection.theme === theme && <Check className="w-4 h-4 mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNewCollection(prev => ({ ...prev, is_public: !prev.is_public }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    newCollection.is_public ? 'bg-green-500' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    newCollection.is_public ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-sm">Make public</span>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-purple-600 hover:bg-purple-700" 
                onClick={createCollection}
                disabled={creating}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
