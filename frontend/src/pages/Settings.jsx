import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import LanguageSelector from "../components/LanguageSelector";
import { 
  ArrowLeft, User, Bell, Moon, Shield, HelpCircle, 
  LogOut, ChevronRight, Camera, Globe
} from "lucide-react";

export default function Settings() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));
  const [notifications, setNotifications] = useState(true);

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

  const handleLogout = () => {
    api.auth.logout();
    toast.success("Logged out successfully");
  };

  const settingsGroups = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Edit Profile", onClick: () => {} },
        { icon: Bell, label: "Notifications", toggle: true, value: notifications, onChange: setNotifications },
        { icon: Shield, label: "Privacy & Security", onClick: () => {} },
      ]
    },
    {
      title: "Preferences",
      items: [
        { icon: Moon, label: "Dark Mode", toggle: true, value: darkMode, onChange: toggleDarkMode },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Center", onClick: () => {} },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Settings</h1>
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
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <p className="text-muted-foreground">@{user?.username}</p>
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
          </div>
        </div>

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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.toggle ? (
                    <Switch 
                      checked={item.value} 
                      onCheckedChange={item.onChange}
                      data-testid={`toggle-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    />
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
          Log Out
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
