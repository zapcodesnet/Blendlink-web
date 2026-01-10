import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  Plus, Upload, Image as ImageIcon, Video, Music, 
  Trash2, Edit, Eye, Lock, Users, Globe, ChevronLeft,
  MoreVertical, Play, Folder, Grid, List, Loader2
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Request failed');
  }
  
  return response.json();
};

// Privacy Icon Component
const PrivacyIcon = ({ privacy }) => {
  const icons = {
    public: <Globe className="w-4 h-4 text-green-500" />,
    friends: <Users className="w-4 h-4 text-blue-500" />,
    private: <Lock className="w-4 h-4 text-gray-500" />
  };
  return icons[privacy] || icons.public;
};

// Media Type Icon Component
const MediaTypeIcon = ({ type }) => {
  const icons = {
    photo: <ImageIcon className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
    music: <Music className="w-4 h-4" />,
    mixed: <Folder className="w-4 h-4" />
  };
  return icons[type] || icons.mixed;
};

// Album Card Component
const AlbumCard = ({ album, onOpen, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <div 
      className="group relative bg-card rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all cursor-pointer"
      onClick={() => onOpen(album)}
      data-testid={`album-card-${album.album_id}`}
    >
      {/* Cover Image */}
      <div className="aspect-square relative overflow-hidden bg-muted">
        {album.cover_image ? (
          <img 
            src={album.cover_image.startsWith('data:') || album.cover_image.startsWith('http') 
              ? album.cover_image 
              : `${API_BASE_URL}${album.cover_image}`}
            alt={album.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MediaTypeIcon type={album.media_type} />
            <span className="ml-2 text-muted-foreground">{album.media_count || 0} items</span>
          </div>
        )}
        
        {/* Privacy Badge */}
        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5">
          <PrivacyIcon privacy={album.privacy} />
        </div>
        
        {/* Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        
        {/* Dropdown Menu */}
        {showMenu && (
          <div 
            className="absolute top-10 left-2 bg-popover rounded-lg shadow-lg p-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => { onEdit(album); setShowMenu(false); }}
              className="flex items-center w-full px-3 py-2 text-sm hover:bg-muted rounded"
            >
              <Edit className="w-4 h-4 mr-2" /> Edit
            </button>
            <button 
              onClick={() => { onDelete(album); setShowMenu(false); }}
              className="flex items-center w-full px-3 py-2 text-sm text-red-500 hover:bg-muted rounded"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </button>
          </div>
        )}
      </div>
      
      {/* Album Info */}
      <div className="p-4">
        <h3 className="font-semibold truncate">{album.name}</h3>
        <p className="text-sm text-muted-foreground truncate">{album.description || "No description"}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{album.media_count || 0} items</span>
          <span>{new Date(album.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

// Media Item Component (with video thumbnail/preview)
const MediaItem = ({ item, onView, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getMediaSrc = (url) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };
  
  return (
    <div 
      className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onView(item)}
    >
      {item.media_type === 'video' ? (
        <>
          {/* Video Thumbnail or Preview */}
          {item.thumbnail_url ? (
            <img 
              src={getMediaSrc(item.thumbnail_url)}
              alt={item.title || 'Video'}
              className="w-full h-full object-cover"
            />
          ) : (
            <video 
              src={getMediaSrc(item.media_url)}
              className="w-full h-full object-cover"
              muted
              loop
              autoPlay={isHovered}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-3">
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
          </div>
        </>
      ) : item.media_type === 'audio' ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
          <Music className="w-12 h-12 text-white" />
        </div>
      ) : (
        <img 
          src={getMediaSrc(item.media_url)}
          alt={item.title || 'Image'}
          className="w-full h-full object-cover"
        />
      )}
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); onView(item); }}
          className="bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30"
        >
          <Eye className="w-5 h-5 text-white" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          className="bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-red-500/50"
        >
          <Trash2 className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* Title */}
      {item.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <p className="text-white text-sm truncate">{item.title}</p>
        </div>
      )}
    </div>
  );
};

// Create Album Dialog
const CreateAlbumDialog = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState('mixed');
  const [privacy, setPrivacy] = useState('public');
  const [autoPost, setAutoPost] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter an album name');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await apiRequest('/albums/create', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          media_type: mediaType,
          privacy,
          auto_post_to_feed: autoPost
        })
      });
      
      toast.success('Album created!');
      onCreated(result.album);
      onClose();
      
      // Reset form
      setName('');
      setDescription('');
      setMediaType('mixed');
      setPrivacy('public');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Album</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Album Name *</label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Album"
              data-testid="album-name-input"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this album about?"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Media Type</label>
            <div className="flex gap-2 mt-1">
              {[
                { value: 'mixed', label: 'Mixed', icon: Folder },
                { value: 'photo', label: 'Photos', icon: ImageIcon },
                { value: 'video', label: 'Videos', icon: Video },
                { value: 'music', label: 'Music', icon: Music },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMediaType(opt.value)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
                    mediaType === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium">Privacy</label>
            <div className="flex gap-2 mt-1">
              {[
                { value: 'public', label: 'Public', icon: Globe },
                { value: 'friends', label: 'Friends', icon: Users },
                { value: 'private', label: 'Private', icon: Lock },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
                    privacy === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          {privacy === 'public' && (
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                checked={autoPost}
                onChange={(e) => setAutoPost(e.target.checked)}
                className="rounded"
              />
              <label className="text-sm">Auto-post new media to social feed</label>
            </div>
          )}
          
          <Button 
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full"
            data-testid="create-album-submit"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Album
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Main Albums Page
export default function Albums() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  
  useEffect(() => {
    loadAlbums();
  }, []);
  
  const loadAlbums = async () => {
    setIsLoading(true);
    try {
      const result = await apiRequest('/albums/my');
      setAlbums(result.albums || []);
    } catch (error) {
      toast.error('Failed to load albums');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenAlbum = (album) => {
    setSelectedAlbum(album);
  };
  
  const handleEditAlbum = (album) => {
    // TODO: Implement edit dialog
    toast.info('Edit feature coming soon');
  };
  
  const handleDeleteAlbum = async (album) => {
    if (!confirm(`Delete album "${album.name}"? This cannot be undone.`)) return;
    
    try {
      await apiRequest(`/albums/${album.album_id}`, { method: 'DELETE' });
      toast.success('Album deleted');
      setAlbums(albums.filter(a => a.album_id !== album.album_id));
      if (selectedAlbum?.album_id === album.album_id) {
        setSelectedAlbum(null);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  const handleUploadMedia = async (e) => {
    if (!selectedAlbum) return;
    
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setIsUploading(true);
    const token = localStorage.getItem('blendlink_token');
    
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.split('.')[0]);
        
        const response = await fetch(`${API_BASE_URL}/api/albums/${selectedAlbum.album_id}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        const result = await response.json();
        toast.success(`Uploaded ${file.name}`);
        
        // Update album media count locally
        setSelectedAlbum(prev => ({
          ...prev,
          media_count: (prev.media_count || 0) + 1,
          media_items: [...(prev.media_items || []), {
            media_id: result.media_id,
            media_url: result.media_url,
            thumbnail_url: result.thumbnail_url,
            media_type: file.type.split('/')[0],
            title: file.name.split('.')[0]
          }]
        }));
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleDeleteMedia = async (item) => {
    if (!selectedAlbum || !confirm('Delete this media?')) return;
    
    try {
      await apiRequest(`/albums/${selectedAlbum.album_id}/media/${item.media_id}`, { method: 'DELETE' });
      toast.success('Media deleted');
      
      setSelectedAlbum(prev => ({
        ...prev,
        media_count: (prev.media_count || 1) - 1,
        media_items: prev.media_items.filter(m => m.media_id !== item.media_id)
      }));
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  const handleViewMedia = (item) => {
    // Open in fullscreen viewer
    const src = item.media_url.startsWith('data:') || item.media_url.startsWith('http')
      ? item.media_url
      : `${API_BASE_URL}${item.media_url}`;
    window.open(src, '_blank');
  };
  
  // Album Detail View
  if (selectedAlbum) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedAlbum(null)}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold">{selectedAlbum.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {selectedAlbum.media_count || 0} items · <PrivacyIcon privacy={selectedAlbum.privacy} />
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  multiple
                  onChange={handleUploadMedia}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="upload-media-btn"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Media Grid */}
        <main className="max-w-6xl mx-auto px-4 py-6">
          {!selectedAlbum.media_items?.length ? (
            <div className="text-center py-20">
              <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Album is empty</h3>
              <p className="text-muted-foreground mb-4">Upload photos, videos, or music to get started</p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload Media
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {selectedAlbum.media_items.map((item) => (
                <MediaItem 
                  key={item.media_id}
                  item={item}
                  onView={handleViewMedia}
                  onDelete={handleDeleteMedia}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }
  
  // Albums List View
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">My Albums</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </Button>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="create-album-btn">
                <Plus className="w-4 h-4 mr-2" /> New Album
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Albums Grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-20">
            <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No albums yet</h3>
            <p className="text-muted-foreground mb-4">Create your first album to organize your media</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Album
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
            : "space-y-3"
          }>
            {albums.map((album) => (
              <AlbumCard 
                key={album.album_id}
                album={album}
                onOpen={handleOpenAlbum}
                onEdit={handleEditAlbum}
                onDelete={handleDeleteAlbum}
              />
            ))}
          </div>
        )}
      </main>
      
      {/* Create Album Dialog */}
      <CreateAlbumDialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(newAlbum) => setAlbums([newAlbum, ...albums])}
      />
    </div>
  );
}
