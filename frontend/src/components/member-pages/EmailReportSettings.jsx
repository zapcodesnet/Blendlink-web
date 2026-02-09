/**
 * Email Report Settings Component
 * Configure automated daily sales report email delivery
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { safeFetch } from "../../services/memberPagesApi";
import {
  Mail, Clock, Bell, BellOff, Send, Check, Loader2,
  Settings, Calendar, AlertCircle, Info
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Time options for send hour
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM (Midnight)" : 
         i < 12 ? `${i}:00 AM` : 
         i === 12 ? "12:00 PM (Noon)" : 
         `${i - 12}:00 PM`
}));

export default function EmailReportSettings({ pageId }) {
  const [settings, setSettings] = useState({
    email_enabled: false,
    email: "",
    send_hour: 23,
    send_empty_reports: false,
    timezone: "UTC"
  });
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Load settings - PRODUCTION FIX: uses safeFetch
  const loadSettings = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/page-analytics/${pageId}/email-settings`);
      setSettings(data.settings || {
        email_enabled: false,
        email: "",
        send_hour: 23,
        send_empty_reports: false,
        timezone: "UTC"
      });
      setOwnerEmail(data.owner_email || "");
    } catch (err) {
      console.error("Failed to load email settings:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, [pageId]);

  // Save settings - PRODUCTION FIX: uses safeFetch
  const saveSettings = async () => {
    setSaving(true);
    try {
      await safeFetch(`${API_URL}/api/page-analytics/${pageId}/email-settings`, {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      toast.success("Email report settings saved!");
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  // Send test email - PRODUCTION FIX: uses safeFetch
  const sendTestReport = async () => {
    setSendingTest(true);
    try {
      await safeFetch(`${API_URL}/api/page-analytics/${pageId}/send-test-report`, {
        method: "POST"
      });
      toast.success(`Test report sent to ${settings.email || ownerEmail}!`);
    } catch (err) {
      toast.error(err.message);
    }
    setSendingTest(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-6 space-y-6" data-testid="email-report-settings">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Automated Email Reports</h3>
          <p className="text-sm text-gray-500">Receive daily sales summaries in your inbox</p>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl">
        <div className="flex items-center gap-3">
          {settings.email_enabled ? (
            <Bell className="w-5 h-5 text-violet-600" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-medium text-gray-800">Daily Report Emails</p>
            <p className="text-sm text-gray-500">
              {settings.email_enabled 
                ? "You'll receive a report every day at your scheduled time" 
                : "Enable to receive automated daily reports"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSettings(s => ({ ...s, email_enabled: !s.email_enabled }))}
          className={`relative w-14 h-8 rounded-full transition-colors ${
            settings.email_enabled ? 'bg-violet-500' : 'bg-gray-300'
          }`}
        >
          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
            settings.email_enabled ? 'left-7' : 'left-1'
          }`} />
        </button>
      </div>

      {/* Settings Form (shown when enabled) */}
      {settings.email_enabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Email Address */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address
            </label>
            <Input
              type="email"
              placeholder={ownerEmail || "your@email.com"}
              value={settings.email}
              onChange={(e) => setSettings(s => ({ ...s, email: e.target.value }))}
              className="rounded-xl"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use your account email ({ownerEmail})
            </p>
          </div>

          {/* Send Time */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Daily Report Time
            </label>
            <select
              value={settings.send_hour}
              onChange={(e) => setSettings(s => ({ ...s, send_hour: parseInt(e.target.value) }))}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white focus:border-violet-400 focus:ring-violet-400"
            >
              {HOUR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Report for the previous day will be sent at this time (UTC)
            </p>
          </div>

          {/* Empty Reports Option */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-800 text-sm">Send reports with no sales</p>
              <p className="text-xs text-gray-500">Receive reports even on days with no transactions</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, send_empty_reports: !s.send_empty_reports }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.send_empty_reports ? 'bg-violet-500' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                settings.send_empty_reports ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">What's included in daily reports?</p>
              <ul className="mt-1 space-y-1 text-blue-600">
                <li>• Total sales and order count</li>
                <li>• Top performing products</li>
                <li>• Peak hours analysis</li>
                <li>• Payment methods breakdown</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
        
        {settings.email_enabled && (
          <Button
            variant="outline"
            onClick={sendTestReport}
            disabled={sendingTest}
            className="rounded-xl"
          >
            {sendingTest ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Test
          </Button>
        )}
      </div>
    </div>
  );
}
