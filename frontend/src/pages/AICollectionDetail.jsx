import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  ArrowLeft, Heart, Share2, Edit2, Plus, Trash2, Eye,
  Image, Video, Music, Sparkles, Globe, Lock, Grid,
  Download, Play, Pause, Check, X, Loader2
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AICollectionDetail() {
  const { collectionId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableGenerations, setAvailableGenerations] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [adding, setAdding] = useState(false);

  const getToken = () => localStorage.getItem('blendlink_token') || localStorage.getItem('token');

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  const loadCollection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/${collectionId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCollection(data);
      } else {
        throw new Error('Not found');
      }
    } catch (e) {
      toast.error('Collection not found');
      navigate('/ai-collections');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableGenerations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/history?limit=50`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Filter out already added
        const existing = collection?.generation_ids || [];
        const available = (data.generations || []).filter(g => !existing.includes(g.generation_id));
        setAvailableGenerations(available);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openAddModal = () => {
    loadAvailableGenerations();
    setShowAddModal(true);
  };

  const addToCollection = async () => {
    if (selectedToAdd.length === 0) return;
    
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/${collectionId}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ generation_ids: selectedToAdd })
      });
      
      if (res.ok) {
        toast.success('Items added!');
        setShowAddModal(false);
        setSelectedToAdd([]);
        loadCollection();
      }
    } catch (e) {
      toast.error('Failed to add items');
    } finally {
      setAdding(false);
    }
  };

  const removeFromCollection = async (generationId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/${collectionId}/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ generation_ids: [generationId] })
      });
      
      if (res.ok) {
        toast.success('Removed from collection');
        setCollection(prev => ({
          ...prev,
          generations: prev.generations.filter(g => g.generation_id !== generationId)
        }));
      }
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const toggleFavorite = async (generationId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/collections/generation/${generationId}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCollection(prev => ({
          ...prev,
          generations: prev.generations.map(g => 
            g.generation_id === generationId ? { ...g, is_favorited: data.is_favorited } : g
          )
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const shareCollection = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: collection.name, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4 text-purple-400" />;
      case 'video': return <Video className="w-4 h-4 text-blue-400" />;
      case 'music': return <Music className="w-4 h-4 text-green-400" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getThumbnail = (item) => {
    if (item.thumbnail_url) return `${API_BASE}${item.thumbnail_url}`;
    if (item.cover_art_url) return `${API_BASE}${item.cover_art_url}`;
    return null;
  };

  const isOwner = collection?.user_id === user?.user_id;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!collection) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/ai-collections')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{collection.name}</h1>
                  {collection.is_public ? (
                    <Globe className="w-4 h-4 text-green-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                {collection.description && (
                  <p className="text-sm text-slate-400">{collection.description}</p>
                )}
                {collection.user && !isOwner && (
                  <p className="text-xs text-slate-500 mt-1">by {collection.user.name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4 text-sm text-slate-400 mr-4">
                <span className="flex items-center gap-1">
                  <Grid className="w-4 h-4" /> {collection.item_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {collection.views_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4" /> {collection.favorites_count || 0}
                </span>
              </div>
              
              {collection.is_public && (
                <Button variant="outline" size="sm" onClick={shareCollection}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}
              
              {isOwner && (
                <Button onClick={openAddModal} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Items
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {collection.generations?.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Collection is empty</h3>
            <p className="text-slate-400 mb-6">Add some AI creations to this collection</p>
            {isOwner && (
              <Button onClick={openAddModal} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Items
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {collection.generations.map((item) => (
              <div
                key={item.generation_id}
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-purple-500/50 transition-all group"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative">
                  {getThumbnail(item) ? (
                    <img src={getThumbnail(item)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                      item.type === 'image' ? 'from-purple-500/30 to-pink-500/30' :
                      item.type === 'video' ? 'from-blue-500/30 to-cyan-500/30' :
                      'from-green-500/30 to-teal-500/30'
                    }`}>
                      {getTypeIcon(item.type)}
                    </div>
                  )}
                  
                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <div className={`p-1.5 rounded-lg ${
                      item.type === 'image' ? 'bg-purple-500/80' :
                      item.type === 'video' ? 'bg-blue-500/80' :
                      'bg-green-500/80'
                    }`}>
                      {getTypeIcon(item.type)}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => toggleFavorite(item.generation_id)}
                    >
                      <Heart className={`w-5 h-5 ${item.is_favorited ? 'fill-pink-500 text-pink-500' : ''}`} />
                    </Button>
                    
                    {isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-red-500/50"
                        onClick={() => removeFromCollection(item.generation_id)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-3">
                  <p className="text-sm truncate">
                    {item.prompt || `${item.genre || 'AI'} ${item.mood || item.type}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Items Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add to Collection</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {availableGenerations.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No more items to add</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {availableGenerations.map((item) => (
                    <button
                      key={item.generation_id}
                      onClick={() => {
                        if (selectedToAdd.includes(item.generation_id)) {
                          setSelectedToAdd(prev => prev.filter(id => id !== item.generation_id));
                        } else {
                          setSelectedToAdd(prev => [...prev, item.generation_id]);
                        }
                      }}
                      className={`aspect-square rounded-lg overflow-hidden relative border-2 transition-all ${
                        selectedToAdd.includes(item.generation_id) 
                          ? 'border-purple-500 ring-2 ring-purple-500/50' 
                          : 'border-transparent hover:border-slate-600'
                      }`}
                    >
                      {getThumbnail(item) ? (
                        <img src={getThumbnail(item)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                          item.type === 'image' ? 'from-purple-500/30 to-pink-500/30' :
                          item.type === 'video' ? 'from-blue-500/30 to-cyan-500/30' :
                          'from-green-500/30 to-teal-500/30'
                        }`}>
                          {getTypeIcon(item.type)}
                        </div>
                      )}
                      
                      {selectedToAdd.includes(item.generation_id) && (
                        <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                          <Check className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-700 flex items-center justify-between">
              <span className="text-sm text-slate-400">{selectedToAdd.length} selected</span>
              <Button 
                onClick={addToCollection} 
                disabled={selectedToAdd.length === 0 || adding}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${selectedToAdd.length} Items`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
