import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import LanguageSelector from "../components/LanguageSelector";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, User, Bell, Moon, Shield, HelpCircle, 
  LogOut, ChevronRight, Camera, Globe, Eye, EyeOff,
  Lock, UserX, Users, Loader2, X, Check, Image
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Profile Picture Selector Modal
const ProfilePictureModal = ({ isOpen, onClose, onSelect, currentUserId }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      fetchMintedPhotos();
    }
  }, [isOpen]);
  
  const fetchMintedPhotos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/photo-game/battle-photos');
      setPhotos(res.data.photos || []);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
      toast.error('Failed to load your minted photos');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!selectedPhoto) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE_URL}/api/users/me/profile-picture`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image_url: selectedPhoto.image_url,
          mint_id: selectedPhoto.mint_id
        })
      });
      
      if (response.ok) {
        toast.success('Profile picture updated!');
        onSelect(selectedPhoto);
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to update profile picture');
      }
    } catch (err) {
      toast.error('Failed to update profile picture');
    } finally {
      setSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[80vh] bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
        data-testid="profile-picture-modal"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Image className="w-5 h-5 text-purple-400" />
            Choose Profile Picture
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Photo Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12">
              <Image className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No minted photos found</p>
              <p className="text-gray-500 text-sm">Mint some photos first to use as profile picture</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <button
                  key={photo.mint_id}
                  onClick={() => setSelectedPhoto(photo)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    selectedPhoto?.mint_id === photo.mint_id
                      ? 'border-purple-500 ring-2 ring-purple-500/50'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                  data-testid={`photo-option-${photo.mint_id}`}
                >
                  <img 
                    src={photo.image_url} 
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedPhoto?.mint_id === photo.mint_id && (
                    <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                  )}
                  {/* Medal display */}
                  {photo.medals?.ten_win_streak > 0 && (
                    <div className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5 text-xs">
                      🏅x{photo.medals.ten_win_streak}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                    <p className="text-white text-xs truncate">{photo.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-gray-600"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-500"
            onClick={handleSave}
            disabled={!selectedPhoto || saving}
            data-testid="save-profile-picture-btn"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function Settings() {
  const { t } = useTranslation();
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));
  const [notifications, setNotifications] = useState(true);
  const [isRealNamePrivate, setIsRealNamePrivate] = useState(user?.is_real_name_private || false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [showPictureModal, setShowPictureModal] = useState(false);

  // Load user's privacy setting on mount
  useEffect(() => {
    if (user?.is_real_name_private !== undefined) {
      setIsRealNamePrivate(user.is_real_name_private);
    }
  }, [user]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const toggleRealNamePrivacy = async (enabled) => {
    setSavingPrivacy(true);
    const token = localStorage.getItem('blendlink_token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/privacy-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_real_name_private: enabled
        })
      });

      if (response.ok) {
        setIsRealNamePrivate(enabled);
        // Update user context
        if (setUser && user) {
          setUser({ ...user, is_real_name_private: enabled });
        }
        toast.success(
          enabled 
            ? "Your real name is now private. Only approved friends can see it." 
            : "Your real name is now visible to everyone."
        );
      } else {
        const data = await response.json();
        toast.error(data.detail || "Failed to update privacy setting");
        // Revert the toggle
        setIsRealNamePrivate(!enabled);
      }
    } catch (err) {
      toast.error("Failed to update privacy setting. Please try again.");
      // Revert the toggle
      setIsRealNamePrivate(!enabled);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleLogout = () => {
    api.auth.logout();
    toast.success(t("auth.logout") + " successfully");
  };

  const settingsGroups = [
    {
      title: t("settings.account"),
      items: [
        { icon: User, label: t("profile.edit"), onClick: () => navigate('/profile/edit') },
        { icon: Bell, label: t("settings.notifications"), toggle: true, value: notifications, onChange: setNotifications },
      ]
    },
    {
      title: t("settings.privacy"),
      items: [
        { 
          icon: isRealNamePrivate ? EyeOff : Eye, 
          label: "Make my real name private",
          description: isRealNamePrivate 
            ? "Only approved friends can see your real name" 
            : "Your real name is visible to everyone",
          toggle: true, 
          value: isRealNamePrivate, 
          onChange: toggleRealNamePrivacy,
          loading: savingPrivacy,
          testId: "toggle-real-name-privacy"
        },
        { 
          icon: Shield, 
          label: "Security Settings", 
          onClick: () => {} 
        },
      ]
    },
    {
      title: t("settings.preferences"),
      items: [
        { icon: Moon, label: t("settings.dark_mode"), toggle: true, value: darkMode, onChange: toggleDarkMode },
        { icon: Globe, label: t("settings.language"), custom: true, component: <LanguageSelector className="ml-auto" /> },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: t("settings.help"), onClick: () => {} },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">{t("settings")}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Section */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.profile_picture || user?.avatar || user?.picture} />
              <AvatarFallback className="text-2xl">{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => setShowPictureModal(true)}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
              data-testid="change-profile-picture-btn"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {isRealNamePrivate ? user?.username : user?.name}
            </h2>
            <p className="text-muted-foreground">@{user?.username}</p>
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
            {isRealNamePrivate && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Real name hidden
              </p>
            )}
          </div>
        </div>

        {/* Privacy Banner */}
        {isRealNamePrivate && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <EyeOff className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Real Name Privacy Enabled</p>
                <p className="text-sm text-muted-foreground">
                  Your real name &quot;{user?.name}&quot; is only visible to your approved friends. 
                  Everyone else sees your username @{user?.username}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Status */}
        <div className="bg-green-500/10 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-500">✓</span>
          </div>
          <div>
            <p className="font-medium text-green-700 dark:text-green-400">Synced with Mobile App</p>
            <p className="text-sm text-muted-foreground">Your data syncs across all devices</p>
          </div>
        </div>

        {/* Settings Groups */}
        {settingsGroups.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
              {group.title}
            </h3>
            <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/50">
              {group.items.map((item) => (
                <div 
                  key={item.label}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium block">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground block truncate">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.toggle ? (
                    <div className="flex items-center gap-2">
                      {item.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <Switch 
                        checked={item.value} 
                        onCheckedChange={item.onChange}
                        disabled={item.loading}
                        data-testid={item.testId || `toggle-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                      />
                    </div>
                  ) : item.custom ? (
                    item.component
                  ) : (
                    <Button variant="ghost" size="icon" onClick={item.onClick}>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <Button 
          variant="destructive" 
          className="w-full rounded-full"
          onClick={handleLogout}
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t("auth.logout")}
        </Button>

        {/* Version */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Blendlink PWA v1.0.0
        </p>
        <p className="text-center text-xs text-muted-foreground mt-1">
          Connected to mobile-games-hub API
        </p>
      </main>
      
      {/* Profile Picture Modal */}
      <AnimatePresence>
        {showPictureModal && (
          <ProfilePictureModal
            isOpen={showPictureModal}
            onClose={() => setShowPictureModal(false)}
            onSelect={(photo) => {
              // Update user context with new profile picture
              if (setUser && user) {
                setUser({ 
                  ...user, 
                  profile_picture: photo.image_url,
                  profile_picture_mint_id: photo.mint_id 
                });
              }
            }}
            currentUserId={user?.user_id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
