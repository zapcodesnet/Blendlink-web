import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Settings, Save, RefreshCw, Shield, Users, ShoppingBag,
  Gamepad2, Coins, Mail, Bell, Globe, Lock
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/admin-system/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSettings(data || {});
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/admin-system/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-400" />
            Platform Settings
          </h1>
          <p className="text-slate-400">Global configuration for Blendlink</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button onClick={loadSettings} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Registration & Auth */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Registration & Authentication
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Allow Registration</p>
                <p className="text-sm text-slate-400">New users can create accounts</p>
              </div>
              <ToggleSwitch
                checked={settings.registration_enabled !== false}
                onChange={(val) => updateSetting('registration_enabled', val)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Email Verification Required</p>
                <p className="text-sm text-slate-400">Users must verify email before full access</p>
              </div>
              <ToggleSwitch
                checked={settings.email_verification_required === true}
                onChange={(val) => updateSetting('email_verification_required', val)}
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-400" />
            Feature Toggles
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Messaging</p>
                <p className="text-sm text-slate-400">Private messaging between users</p>
              </div>
              <ToggleSwitch
                checked={settings.messaging_enabled !== false}
                onChange={(val) => updateSetting('messaging_enabled', val)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Marketplace</p>
                <p className="text-sm text-slate-400">Buy/sell listings</p>
              </div>
              <ToggleSwitch
                checked={settings.marketplace_enabled !== false}
                onChange={(val) => updateSetting('marketplace_enabled', val)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Casino</p>
                <p className="text-sm text-slate-400">Casino games and daily spin</p>
              </div>
              <ToggleSwitch
                checked={settings.casino_enabled !== false}
                onChange={(val) => updateSetting('casino_enabled', val)}
              />
            </div>
          </div>
        </div>

        {/* Rewards */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Rewards Configuration
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Welcome Bonus (BL Coins)</label>
              <input
                type="number"
                value={settings.welcome_bonus || 100}
                onChange={(e) => updateSetting('welcome_bonus', parseInt(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Referral Bonus (BL Coins)</label>
              <input
                type="number"
                value={settings.referral_bonus || 100}
                onChange={(e) => updateSetting('referral_bonus', parseInt(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-400" />
            Maintenance Mode
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Enable Maintenance Mode</p>
              <p className="text-sm text-slate-400">Only admins can access the platform</p>
            </div>
            <ToggleSwitch
              checked={settings.maintenance_mode === true}
              onChange={(val) => updateSetting('maintenance_mode', val)}
            />
          </div>
          {settings.maintenance_mode && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">⚠️ Maintenance mode is ON. Regular users cannot access the platform.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  );
}
