import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  Image, Video, Music, Sparkles, Download, Play, Pause, 
  Trash2, Eye, Share2, Heart, ArrowLeft, Filter, Grid,
  List, RefreshCw, Clock, CheckCircle, XCircle, Loader2,
  ExternalLink, FolderOpen, Plus
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AIGallery() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generations, setGenerations] = useState([]);
  const [filter, setFilter] = useState('all'); // all, image, video, music
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef(null);
  const scheduledNotesRef = useRef([]);

  const getToken = () => localStorage.getItem('blendlink_token') || localStorage.getItem('token');

  useEffect(() => {
    loadGenerations();
  }, [filter]);

  const loadGenerations = async () => {
    setLoading(true);
    try {
      const typeParam = filter !== 'all' ? `?type=${filter}&limit=50` : '?limit=50';
      const res = await fetch(`${API_BASE}/api/ai/history${typeParam}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations || []);
      } else {
        throw new Error('Failed to load');
      }
    } catch (e) {
      toast.error('Failed to load AI gallery');
    } finally {
      setLoading(false);
    }
  };

  const deleteGeneration = async (generationId) => {
    if (!confirm('Delete this AI creation?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/ai/generation/${generationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        setGenerations(prev => prev.filter(g => g.generation_id !== generationId));
        toast.success('Deleted successfully');
        if (selectedItem?.generation_id === generationId) {
          setSelectedItem(null);
        }
      }
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const downloadItem = (url, filename) => {
    const link = document.createElement('a');
    link.href = url.startsWith('http') ? url : `${API_BASE}${url}`;
    link.download = filename;
    link.target = '_blank';
    link.click();
  };

  const shareItem = async (item) => {
    const shareUrl = `${window.location.origin}/ai-gallery/${item.generation_id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `AI ${item.type} by ${user?.name || 'User'}`,
          text: item.prompt || `${item.genre} ${item.mood} music`,
          url: shareUrl
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  // Music playback
  const playMusic = (params) => {
    if (isPlaying) {
      stopMusic();
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;
      
      const { tempo, melody, synth, effects } = params;
      const beatDuration = 60 / tempo;
      const now = ctx.currentTime;
      
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(ctx.destination);
      
      melody.forEach((note, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = synth.type;
        osc.frequency.value = 440 * Math.pow(2, (note - 9) / 12);
        
        gain.gain.setValueAtTime(0, now + i * beatDuration);
        gain.gain.linearRampToValueAtTime(0.3, now + i * beatDuration + synth.attack);
        gain.gain.linearRampToValueAtTime(0, now + i * beatDuration + beatDuration);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(now + i * beatDuration);
        osc.stop(now + (i + 1) * beatDuration);
        
        scheduledNotesRef.current.push(osc);
      });
      
      setIsPlaying(true);
      
      setTimeout(() => stopMusic(), params.duration * 1000);
    } catch (e) {
      toast.error('Failed to play');
    }
  };

  const stopMusic = () => {
    scheduledNotesRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    scheduledNotesRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5 text-purple-400" />;
      case 'video': return <Video className="w-5 h-5 text-blue-400" />;
      case 'music': return <Music className="w-5 h-5 text-green-400" />;
      default: return <Sparkles className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Done</span>;
      case 'processing':
      case 'generating_thumbnail':
      case 'generating_video':
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing</span>;
      case 'failed':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 text-xs rounded-full">{status}</span>;
    }
  };

  const renderThumbnail = (item) => {
    if (item.type === 'image' && item.result_count > 0) {
      // For images, we'd need to store the URL - showing placeholder for now
      return (
        <div className="w-full h-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
          <Image className="w-12 h-12 text-purple-400" />
        </div>
      );
    }
    
    if (item.type === 'video' && item.thumbnail_url) {
      return (
        <img 
          src={`${API_BASE}${item.thumbnail_url}`} 
          alt="Video thumbnail"
          className="w-full h-full object-cover"
        />
      );
    }
    
    if (item.type === 'music' && item.cover_art_url) {
      return (
        <img 
          src={`${API_BASE}${item.cover_art_url}`} 
          alt="Album cover"
          className="w-full h-full object-cover"
        />
      );
    }
    
    // Fallback gradient based on type
    const gradients = {
      image: 'from-purple-500/30 to-pink-500/30',
      video: 'from-blue-500/30 to-cyan-500/30',
      music: 'from-green-500/30 to-teal-500/30'
    };
    
    return (
      <div className={`w-full h-full bg-gradient-to-br ${gradients[item.type] || 'from-slate-500/30 to-slate-600/30'} flex items-center justify-center`}>
        {getTypeIcon(item.type)}
      </div>
    );
  };

  const stats = {
    total: generations.length,
    images: generations.filter(g => g.type === 'image').length,
    videos: generations.filter(g => g.type === 'video').length,
    music: generations.filter(g => g.type === 'music').length
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  AI Gallery
                </h1>
                <p className="text-sm text-slate-400">{stats.total} AI creations</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Link to Personal Album */}
              <Button 
                variant="outline" 
                className="border-slate-600 hidden sm:flex"
                onClick={() => navigate('/my-media')}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                My Media
              </Button>
              
              {/* Link to Collections */}
              <Button 
                variant="outline" 
                className="border-slate-600 hidden sm:flex"
                onClick={() => navigate('/ai-collections')}
              >
                <Heart className="w-4 h-4 mr-2" />
                Collections
              </Button>
              
              <Button 
                onClick={() => navigate('/ai-studio')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <button 
            onClick={() => setFilter('all')}
            className={`p-3 rounded-xl text-center transition-all ${filter === 'all' ? 'bg-purple-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-slate-400">All</p>
          </button>
          <button 
            onClick={() => setFilter('image')}
            className={`p-3 rounded-xl text-center transition-all ${filter === 'image' ? 'bg-purple-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <p className="text-2xl font-bold">{stats.images}</p>
            <p className="text-xs text-slate-400">Images</p>
          </button>
          <button 
            onClick={() => setFilter('video')}
            className={`p-3 rounded-xl text-center transition-all ${filter === 'video' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <p className="text-2xl font-bold">{stats.videos}</p>
            <p className="text-xs text-slate-400">Videos</p>
          </button>
          <button 
            onClick={() => setFilter('music')}
            className={`p-3 rounded-xl text-center transition-all ${filter === 'music' ? 'bg-green-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <p className="text-2xl font-bold">{stats.music}</p>
            <p className="text-xs text-slate-400">Music</p>
          </button>
        </div>

        {/* View Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          
          <Button variant="ghost" size="sm" onClick={loadGenerations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No AI creations yet</h3>
            <p className="text-slate-400 mb-6">Start creating amazing content with AI</p>
            <Button onClick={() => navigate('/ai-studio')} className="bg-purple-600 hover:bg-purple-700">
              <Sparkles className="w-4 h-4 mr-2" />
              Open AI Studio
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {generations.map((item) => (
              <div
                key={item.generation_id}
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                onClick={() => setSelectedItem(item)}
              >
                {/* Thumbnail */}
                <div className="aspect-square relative overflow-hidden">
                  {renderThumbnail(item)}
                  
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <div className={`p-1.5 rounded-lg ${
                      item.type === 'image' ? 'bg-purple-500/80' :
                      item.type === 'video' ? 'bg-blue-500/80' :
                      'bg-green-500/80'
                    }`}>
                      {getTypeIcon(item.type)}
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(item.status)}
                  </div>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                      <Eye className="w-5 h-5" />
                    </Button>
                    {item.status === 'completed' && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); shareItem(item); }}
                      >
                        <Share2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-medium truncate">
                    {item.prompt || `${item.genre || 'AI'} ${item.mood || item.type}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3">
            {generations.map((item) => (
              <div
                key={item.generation_id}
                className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer flex items-center gap-4"
                onClick={() => setSelectedItem(item)}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {renderThumbnail(item)}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeIcon(item.type)}
                    <span className="font-medium truncate">
                      {item.prompt || `${item.genre || 'AI'} ${item.mood || item.type}`}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                
                {/* Status & Actions */}
                <div className="flex items-center gap-3">
                  {getStatusBadge(item.status)}
                  
                  {item.status === 'completed' && (
                    <div className="flex items-center gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); shareItem(item); }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={(e) => { e.stopPropagation(); deleteGeneration(item.generation_id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => { setSelectedItem(null); stopMusic(); }}
        >
          <div 
            className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTypeIcon(selectedItem.type)}
                <span className="font-semibold capitalize">{selectedItem.type} Details</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(null); stopMusic(); }}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4">
              {/* Preview */}
              {selectedItem.type === 'image' && (
                <div className="aspect-square bg-slate-700 rounded-xl flex items-center justify-center mb-4">
                  <div className="text-center">
                    <Image className="w-16 h-16 text-purple-400 mx-auto mb-2" />
                    <p className="text-slate-400">Image preview</p>
                  </div>
                </div>
              )}
              
              {selectedItem.type === 'video' && (
                <div className="mb-4">
                  {selectedItem.thumbnail_url && (
                    <img 
                      src={`${API_BASE}${selectedItem.thumbnail_url}`}
                      alt="Thumbnail"
                      className="w-full rounded-xl mb-3"
                    />
                  )}
                  {selectedItem.video_url && (
                    <video
                      src={`${API_BASE}${selectedItem.video_url}`}
                      poster={selectedItem.thumbnail_url ? `${API_BASE}${selectedItem.thumbnail_url}` : undefined}
                      controls
                      className="w-full rounded-xl"
                    />
                  )}
                </div>
              )}
              
              {selectedItem.type === 'music' && (
                <div className="mb-4">
                  {selectedItem.cover_art_url && (
                    <img 
                      src={`${API_BASE}${selectedItem.cover_art_url}`}
                      alt="Cover art"
                      className="w-48 h-48 rounded-xl mx-auto mb-4 shadow-lg"
                    />
                  )}
                  <div className="flex justify-center">
                    <Button
                      onClick={() => playMusic(selectedItem.params || { tempo: 120, melody: [0, 2, 4, 5, 7], synth: { type: 'sine', attack: 0.01 }, duration: 30 })}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isPlaying ? <><Pause className="w-5 h-5 mr-2" /> Stop</> : <><Play className="w-5 h-5 mr-2" /> Play</>}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Details */}
              <div className="space-y-3">
                {selectedItem.prompt && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Prompt</p>
                    <p className="text-sm bg-slate-700 rounded-lg p-3">{selectedItem.prompt}</p>
                  </div>
                )}
                
                {selectedItem.genre && (
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Genre</p>
                      <p className="text-sm font-medium capitalize">{selectedItem.genre}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Mood</p>
                      <p className="text-sm font-medium capitalize">{selectedItem.mood}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    {getStatusBadge(selectedItem.status)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Created</p>
                    <p className="text-sm">{new Date(selectedItem.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => shareItem(selectedItem)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {selectedItem.video_url && (
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => downloadItem(selectedItem.video_url, `${selectedItem.generation_id}.mp4`)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
                {selectedItem.cover_art_url && (
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => downloadItem(selectedItem.cover_art_url, `${selectedItem.generation_id}_cover.png`)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Cover Art
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                  onClick={() => deleteGeneration(selectedItem.generation_id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
