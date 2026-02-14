import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  Shield, AlertTriangle, MapPin, Clock, User, Lock, 
  Eye, RefreshCw, ChevronDown, ChevronRight, Globe,
  Smartphone, Monitor, CheckCircle, XCircle, Ban
} from "lucide-react";

const API_BASE = getApiUrl();

export default function AdminSecurityDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [failedAttempts, setFailedAttempts] = useState([]);
  const [lockedAccounts, setLockedAccounts] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [expandedSection, setExpandedSection] = useState('logins');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadSecurityData();
  }, [timeRange]);

  const loadSecurityData = async () => {
    setLoading(true);
    const token = localStorage.getItem('blendlink_token');
    
    try {
      const headers = { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      const [statsRes, loginsRes, failedRes, lockedRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/security/stats?range=${timeRange}`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/admin/security/login-history?range=${timeRange}&limit=50`, { headers }).then(r => r.json()).catch(() => ({ logins: [] })),
        fetch(`${API_BASE}/api/admin/security/failed-attempts?range=${timeRange}&limit=50`, { headers }).then(r => r.json()).catch(() => ({ attempts: [] })),
        fetch(`${API_BASE}/api/admin/security/locked-accounts`, { headers }).then(r => r.json()).catch(() => ({ accounts: [] })),
        fetch(`${API_BASE}/api/admin/security/alerts?range=${timeRange}&limit=20`, { headers }).then(r => r.json()).catch(() => ({ alerts: [] })),
      ]);

      setStats(statsRes);
      setLoginHistory(loginsRes.logins || []);
      setFailedAttempts(failedRes.attempts || []);
      setLockedAccounts(lockedRes.accounts || []);
      setSecurityAlerts(alertsRes.alerts || []);
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  const unlockAccount = async (email) => {
    const token = localStorage.getItem('blendlink_token');
    try {
      const response = await fetch(`${API_BASE}/api/admin/security/unlock-account`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      if (response.ok) {
        toast.success(`Account ${email} unlocked`);
        loadSecurityData();
      } else {
        throw new Error('Failed to unlock');
      }
    } catch (error) {
      toast.error('Failed to unlock account');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getDeviceIcon = (userAgent) => {
    if (!userAgent) return <Globe className="w-4 h-4" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Success</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>;
      case 'locked':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1"><Ban className="w-3 h-3" /> Locked</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded-full">{status}</span>;
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-500" />
            Security Dashboard
          </h1>
          <p className="text-slate-400 text-sm">Monitor admin activity, login history, and security events</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button 
            variant="outline" 
            size="icon"
            onClick={loadSecurityData}
            className="border-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-blue-400" />
            <span className="text-slate-400 text-sm">Total Logins</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.total_logins || loginHistory.length || 0}</p>
          <p className="text-xs text-slate-400 mt-1">In selected period</p>
        </div>
        
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-slate-400 text-sm">Failed Attempts</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.failed_attempts || failedAttempts.length || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Blocked intrusions</p>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-400 text-sm">Locked Accounts</span>
          </div>
          <p className="text-2xl font-bold text-white">{lockedAccounts.length}</p>
          <p className="text-xs text-slate-400 mt-1">Currently locked</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-slate-400 text-sm">Active Sessions</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.active_sessions || 1}</p>
          <p className="text-xs text-slate-400 mt-1">Currently online</p>
        </div>
      </div>

      {/* Security Alerts */}
      {securityAlerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Security Alerts ({securityAlerts.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {securityAlerts.map((alert, i) => (
              <div key={i} className="bg-red-500/10 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{alert.title}</p>
                  <p className="text-red-300 text-xs">{alert.body}</p>
                  <p className="text-slate-500 text-xs mt-1">{formatDate(alert.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Accounts */}
      {lockedAccounts.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <h3 className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Locked Accounts ({lockedAccounts.length})
          </h3>
          <div className="space-y-2">
            {lockedAccounts.map((account, i) => (
              <div key={i} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{account.email}</p>
                  <p className="text-slate-400 text-xs">Locked until: {formatDate(account.locked_until)}</p>
                  <p className="text-yellow-400 text-xs">{account.reason}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => unlockAccount(account.email)}
                  className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                >
                  Unlock
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Login History */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button 
          className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
          onClick={() => setExpandedSection(expandedSection === 'logins' ? '' : 'logins')}
        >
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-400" />
            <span className="text-white font-semibold">Admin Login History</span>
            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{loginHistory.length}</span>
          </div>
          {expandedSection === 'logins' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </button>
        
        {expandedSection === 'logins' && (
          <div className="border-t border-slate-700">
            {loginHistory.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No login history found</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">Admin</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">Status</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">IP Address</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3 hidden sm:table-cell">Location</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3 hidden md:table-cell">Device</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((login, i) => (
                      <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="p-3">
                          <p className="text-white text-sm">{login.admin_email || login.email}</p>
                        </td>
                        <td className="p-3">{getStatusBadge(login.status || 'success')}</td>
                        <td className="p-3 text-slate-300 text-sm font-mono">{login.ip_address || 'N/A'}</td>
                        <td className="p-3 hidden sm:table-cell">
                          <div className="flex items-center gap-1 text-slate-400 text-sm">
                            <MapPin className="w-3 h-3" />
                            {login.location || login.country || 'Unknown'}
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <div className="flex items-center gap-1 text-slate-400">
                            {getDeviceIcon(login.user_agent)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Clock className="w-3 h-3" />
                            {formatDate(login.created_at || login.timestamp)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Failed Attempts */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <button 
          className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
          onClick={() => setExpandedSection(expandedSection === 'failed' ? '' : 'failed')}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-white font-semibold">Failed Login Attempts</span>
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">{failedAttempts.length}</span>
          </div>
          {expandedSection === 'failed' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </button>
        
        {expandedSection === 'failed' && (
          <div className="border-t border-slate-700">
            {failedAttempts.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No failed attempts found</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">Email</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">Reason</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">IP Address</th>
                      <th className="text-left text-xs text-slate-400 font-medium p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedAttempts.map((attempt, i) => (
                      <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="p-3 text-white text-sm">{attempt.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                            {attempt.reason || 'Invalid credentials'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 text-sm font-mono">{attempt.ip_address || 'N/A'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Clock className="w-3 h-3" />
                            {formatDate(attempt.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
