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
import { 
  ArrowLeft, User, Bell, Moon, Shield, HelpCircle, 
  LogOut, ChevronRight, Camera, Globe, Eye, EyeOff,
  Lock, UserX, Users, Loader2
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function Settings() {
  const { t } = useTranslation();
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));
  const [notifications, setNotifications] = useState(true);
  const [isRealNamePrivate, setIsRealNamePrivate] = useState(user?.is_real_name_private || false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

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
              <AvatarImage src={user?.avatar || user?.picture} />
              <AvatarFallback className="text-2xl">{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
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
    </div>
  );
}
