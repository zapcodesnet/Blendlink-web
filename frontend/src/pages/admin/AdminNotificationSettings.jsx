import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  Bell, BellOff, Shield, DollarSign, Users, Diamond,
  AlertTriangle, Clock, Moon, RefreshCw, Check, X,
  Settings, ChevronDown, ChevronRight, Smartphone,
  Mail, Send, UserPlus, Volume2, VolumeX, Globe
} from "lucide-react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

// Note: Using local apiRequest instead of importing from AdminLayout to avoid circular dependency

const API_BASE = getApiUrl();

const getToken = () => localStorage.getItem('blendlink_token');

// Safe API request helper
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const response = await fetch(`${API_BASE}/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.error('JSON parse error:', e);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }
  
  return data;
};

const NOTIFICATION_CATEGORIES = [
  {
    key: 'kyc_notifications',
    label: 'KYC Requests',
    icon: Shield,
    color: 'blue',
    description: 'New KYC verification requests, approvals, and rejections',
  },
  {
    key: 'withdrawal_notifications',
    label: 'Withdrawals',
    icon: DollarSign,
    color: 'green',
    description: 'New withdrawal requests, approvals, and rejections',
  },
  {
    key: 'diamond_notifications',
    label: 'Diamond Leaders',
    icon: Diamond,
    color: 'amber',
    description: 'User promotions and demotions to Diamond Leader status',
  },
  {
    key: 'security_notifications',
    label: 'Security Alerts',
    icon: AlertTriangle,
    color: 'red',
    description: 'Login attempts, brute force detection, suspicious activity',
  },
  {
    key: 'user_event_notifications',
    label: 'User Events',
    icon: Users,
    color: 'purple',
    description: 'New signups, user bans, and suspensions',
  },
  {
    key: 'system_notifications',
    label: 'System Alerts',
    icon: Settings,
    color: 'slate',
    description: 'High withdrawal volume, database warnings, system alerts',
  },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'All (Low+)', description: 'Receive all notifications' },
  { value: 'normal', label: 'Normal+', description: 'Skip low priority' },
  { value: 'high', label: 'High+', description: 'Only important alerts' },
  { value: 'critical', label: 'Critical Only', description: 'Only emergencies' },
];

export default function AdminNotificationSettings() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [delegates, setDelegates] = useState([]);
  const [availableDelegates, setAvailableDelegates] = useState([]);
  const [expandedSection, setExpandedSection] = useState('push');
  const [testSending, setTestSending] = useState(false);

  // Push notifications hook
  const { 
    isSupported: pushSupported, 
    permission: pushPermission, 
    isSubscribed: pushSubscribed,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification: sendTestPush
  } = usePushNotifications();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prefsData, notifsData, delegatesData] = await Promise.all([
        apiRequest('/admin/notifications/preferences'),
        apiRequest('/admin/notifications/?limit=10'),
        apiRequest('/admin/notifications/delegates'),
      ]);
      setPreferences(prefsData);
      setNotifications(notifsData.notifications || []);
      setUnreadCount(notifsData.unread_count || 0);
      setAvailableDelegates(delegatesData.delegates || []);
      setDelegates(prefsData.delegate_to || []);
    } catch (error) {
      toast.error("Failed to load notification settings: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updatePreference = async (key, value) => {
    setSaving(true);
    try {
      await apiRequest('/admin/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ [key]: value }),
      });
      setPreferences(prev => ({ ...prev, [key]: value }));
      toast.success("Preference updated");
    } catch (error) {
      toast.error("Failed to update: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateDelegates = async (newDelegates) => {
    setSaving(true);
    try {
      await apiRequest('/admin/notifications/delegates', {
        method: 'PUT',
        body: JSON.stringify(newDelegates),
      });
      setDelegates(newDelegates);
      toast.success("Delegates updated");
    } catch (error) {
      toast.error("Failed to update delegates: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async () => {
    setTestSending(true);
    try {
      await apiRequest('/admin/notifications/test', { method: 'POST' });
      toast.success("Test notification sent!");
      setTimeout(loadData, 2000);
    } catch (error) {
      toast.error("Failed to send test: " + error.message);
    } finally {
      setTestSending(false);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/admin/notifications/mark-all-read', { method: 'POST' });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All marked as read");
    } catch (error) {
      toast.error("Failed to mark read");
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    slate: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-400" />
            Push Notification Settings
          </h1>
          <p className="text-slate-400">Customize how and when you receive admin alerts</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={sendTestNotification}
            variant="outline"
            className="border-slate-600"
            disabled={testSending}
          >
            {testSending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Test Notification
          </Button>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Browser Push Notifications Section */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          onClick={() => toggleSection('push')}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${pushSubscribed ? 'bg-green-500/20' : 'bg-slate-600'}`}>
              <Globe className={`w-5 h-5 ${pushSubscribed ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Browser Push Notifications</h3>
              <p className="text-sm text-slate-400">
                {pushSubscribed ? 'Enabled - receiving notifications in this browser' : 'Get real-time alerts even when the tab is closed'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pushSubscribed && <Badge className="bg-green-500/20 text-green-400">Active</Badge>}
            {expandedSection === 'push' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </div>
        </button>
        
        {expandedSection === 'push' && (
          <div className="p-4 border-t border-slate-700 space-y-4">
            {!pushSupported ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Push notifications are not supported in this browser
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-slate-700/50 p-4 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Permission Status</p>
                    <p className="text-sm text-slate-400">
                      {pushPermission === 'granted' && '✅ Permission granted'}
                      {pushPermission === 'denied' && '❌ Permission denied - enable in browser settings'}
                      {pushPermission === 'default' && '⏳ Not yet requested'}
                    </p>
                  </div>
                  <Badge className={
                    pushPermission === 'granted' ? 'bg-green-500/20 text-green-400' :
                    pushPermission === 'denied' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }>
                    {pushPermission}
                  </Badge>
                </div>

                <div className="flex gap-3">
                  {!pushSubscribed ? (
                    <Button
                      onClick={subscribePush}
                      disabled={pushLoading || pushPermission === 'denied'}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {pushLoading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Bell className="w-4 h-4 mr-2" />
                      )}
                      Enable Browser Notifications
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={unsubscribePush}
                        disabled={pushLoading}
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                      >
                        <BellOff className="w-4 h-4 mr-2" />
                        Disable Notifications
                      </Button>
                      <Button
                        onClick={sendTestPush}
                        variant="outline"
                        className="border-slate-600"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Test
                      </Button>
                    </>
                  )}
                </div>

                {pushSubscribed && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-400 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      You'll receive notifications for KYC requests, withdrawals, security alerts, and more
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Recent Notifications Preview */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            Recent Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white">{unreadCount} unread</Badge>
            )}
          </h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No notifications yet</p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-3 rounded-lg border ${
                  notif.read_by?.includes(preferences?.admin_id) 
                    ? 'bg-slate-700/30 border-slate-700' 
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{notif.title}</p>
                    <p className="text-sm text-slate-400">{notif.body}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(notif.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Master Switch */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {preferences?.enabled ? (
              <div className="p-3 bg-green-500/20 rounded-full">
                <Bell className="w-6 h-6 text-green-400" />
              </div>
            ) : (
              <div className="p-3 bg-red-500/20 rounded-full">
                <BellOff className="w-6 h-6 text-red-400" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">Push Notifications</h3>
              <p className="text-slate-400">
                {preferences?.enabled ? 'You will receive admin alerts' : 'All notifications are disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updatePreference('enabled', !preferences?.enabled)}
            disabled={saving}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
              preferences?.enabled ? 'bg-green-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                preferences?.enabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Category Settings */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button
          onClick={() => toggleSection('categories')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            Notification Categories
          </h3>
          {expandedSection === 'categories' ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {expandedSection === 'categories' && (
          <div className="border-t border-slate-700 p-4 space-y-3">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const enabled = preferences?.[category.key] ?? true;
              return (
                <div
                  key={category.key}
                  className={`p-4 rounded-lg border flex items-center justify-between ${colorClasses[category.color]}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <div>
                      <p className="font-medium text-white">{category.label}</p>
                      <p className="text-xs text-slate-400">{category.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePreference(category.key, !enabled)}
                    disabled={saving || !preferences?.enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enabled && preferences?.enabled ? 'bg-green-500' : 'bg-slate-600'
                    } ${!preferences?.enabled ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Priority Threshold */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button
          onClick={() => toggleSection('priority')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Priority Threshold
          </h3>
          {expandedSection === 'priority' ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {expandedSection === 'priority' && (
          <div className="border-t border-slate-700 p-4">
            <p className="text-sm text-slate-400 mb-4">
              Only receive notifications at or above this priority level
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updatePreference('min_priority', option.value)}
                  disabled={saving}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    preferences?.min_priority === option.value
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <p className="font-medium text-white">{option.label}</p>
                  <p className="text-xs mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quiet Hours */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button
          onClick={() => toggleSection('quiet')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Moon className="w-5 h-5 text-purple-400" />
            Quiet Hours
          </h3>
          {expandedSection === 'quiet' ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {expandedSection === 'quiet' && (
          <div className="border-t border-slate-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Enable Quiet Hours</p>
                <p className="text-sm text-slate-400">Pause non-critical notifications during set hours</p>
              </div>
              <button
                onClick={() => updatePreference('quiet_hours_enabled', !preferences?.quiet_hours_enabled)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences?.quiet_hours_enabled ? 'bg-purple-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences?.quiet_hours_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {preferences?.quiet_hours_enabled && (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-2">Start Time</label>
                  <select
                    value={preferences?.quiet_hours_start || 22}
                    onChange={(e) => updatePreference('quiet_hours_start', parseInt(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {[...Array(24)].map((_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-2">End Time</label>
                  <select
                    value={preferences?.quiet_hours_end || 7}
                    onChange={(e) => updatePreference('quiet_hours_end', parseInt(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {[...Array(24)].map((_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            <p className="text-xs text-slate-500">
              Critical security alerts will always be delivered, even during quiet hours.
            </p>
          </div>
        )}
      </div>

      {/* Delegation */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button
          onClick={() => toggleSection('delegates')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            Notification Delegation
          </h3>
          {expandedSection === 'delegates' ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {expandedSection === 'delegates' && (
          <div className="border-t border-slate-700 p-4 space-y-4">
            <p className="text-sm text-slate-400">
              Forward your notifications to other admins when you are unavailable
            </p>
            
            {availableDelegates.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No other admins available</p>
            ) : (
              <div className="space-y-2">
                {availableDelegates.map((admin) => {
                  const isDelegate = delegates.includes(admin.admin_id);
                  return (
                    <div
                      key={admin.admin_id}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        isDelegate ? 'bg-cyan-500/10 border-cyan-500/30' : 'border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{admin.name}</p>
                          <p className="text-xs text-slate-400">{admin.email} • {admin.role}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newDelegates = isDelegate
                            ? delegates.filter(id => id !== admin.admin_id)
                            : [...delegates, admin.admin_id];
                          updateDelegates(newDelegates);
                        }}
                        disabled={saving}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          isDelegate
                            ? 'bg-cyan-500 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {isDelegate ? (
                          <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Delegated</span>
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Channel Settings */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-slate-400" />
          Notification Channels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border flex items-center justify-between ${
            preferences?.push_enabled ? 'bg-green-500/10 border-green-500/30' : 'border-slate-600'
          }`}>
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-green-400" />
              <div>
                <p className="font-medium text-white">Push</p>
                <p className="text-xs text-slate-400">Mobile & Web</p>
              </div>
            </div>
            <button
              onClick={() => updatePreference('push_enabled', !preferences?.push_enabled)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences?.push_enabled ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences?.push_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className={`p-4 rounded-lg border flex items-center justify-between ${
            preferences?.in_app_enabled ? 'bg-blue-500/10 border-blue-500/30' : 'border-slate-600'
          }`}>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-medium text-white">In-App</p>
                <p className="text-xs text-slate-400">Notification Center</p>
              </div>
            </div>
            <button
              onClick={() => updatePreference('in_app_enabled', !preferences?.in_app_enabled)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences?.in_app_enabled ? 'bg-blue-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences?.in_app_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="p-4 rounded-lg border border-slate-600 opacity-50">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="font-medium text-white">Email</p>
                <p className="text-xs text-slate-400">Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
