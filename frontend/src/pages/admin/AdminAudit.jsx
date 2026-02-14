import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  FileText, Search, Filter, RefreshCw, Download,
  User, Eye, Ban, Trash2, Palette, Layout, Shield,
  Bot, Calendar, ChevronLeft, ChevronRight, Clock,
  Key, LogOut, DollarSign, GitBranch, Settings,
  AlertTriangle, CheckCircle, XCircle, Activity
} from "lucide-react";

const API_BASE = getApiUrl();

// Map audit actions to icons and colors
const ACTION_CONFIG = {
  // Authentication
  login_success: { icon: User, color: 'text-green-400', bg: 'bg-green-500/10' },
  login_failed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  logout: { icon: LogOut, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  '2fa_enabled': { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  '2fa_disabled': { icon: Shield, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  '2fa_verified': { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  password_reset: { icon: Key, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  
  // User Management
  user_view: { icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  user_edit: { icon: User, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  user_suspend: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  user_unsuspend: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  user_ban: { icon: Ban, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  user_unban: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  user_delete: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' },
  user_password_reset: { icon: Key, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  user_force_logout: { icon: LogOut, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  
  // Financial
  balance_adjust: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
  withdrawal_approve: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  withdrawal_reject: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  commission_adjust: { icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  
  // Genealogy
  genealogy_view: { icon: GitBranch, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  genealogy_reassign: { icon: GitBranch, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  orphan_assign: { icon: User, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  
  // Content Moderation
  content_view_private: { icon: Eye, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  content_delete: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' },
  content_restore: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  report_resolve: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  
  // Platform
  theme_change: { icon: Palette, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  page_create: { icon: Layout, color: 'text-green-400', bg: 'bg-green-500/10' },
  page_update: { icon: Layout, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  page_delete: { icon: Layout, color: 'text-red-400', bg: 'bg-red-500/10' },
  settings_update: { icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  
  // Admin Management
  admin_create: { icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
  admin_update: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  admin_delete: { icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
  permission_change: { icon: Key, color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const getActionConfig = (action) => {
  return ACTION_CONFIG[action] || { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-500/10' };
};

const formatActionName = (action) => {
  return action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown Action';
};

export default function AdminAudit() {
  const [data, setData] = useState({ audit_logs: [], recent_signups: [], recent_transactions: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('audit');
  const [limit, setLimit] = useState(50);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getActivityFeed(limit);
      setData(result);
    } catch (error) {
      toast.error("Failed to load activity feed: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportLogs = () => {
    const logs = data.audit_logs || [];
    const csv = [
      ['Date', 'Admin', 'Action', 'Target Type', 'Target ID', 'Details', 'IP Address'].join(','),
      ...logs.map(log => [
        log.timestamp,
        log.admin_email,
        log.action,
        log.target_type,
        log.target_id || '',
        JSON.stringify(log.details || {}),
        log.ip_address || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Exported to CSV");
  };

  const tabs = [
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'signups', label: 'Recent Signups', icon: User },
    { id: 'transactions', label: 'Transactions', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            Activity Feed & Audit Logs
          </h1>
          <p className="text-slate-400">Real-time platform activity • GDPR Compliant • Complete audit trail</p>
        </div>
        <div className="flex gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
          <Button onClick={exportLogs} variant="outline" className="border-slate-600">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'audit' && data.audit_logs?.length > 0 && (
                <Badge className="bg-slate-700 text-white">{data.audit_logs.length}</Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : data.audit_logs?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
              <p className="text-sm text-slate-500 mt-1">Admin actions will be recorded here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Admin</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Target</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Details</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {data.audit_logs.map((log, i) => {
                    const config = getActionConfig(log.action);
                    const ActionIcon = config.icon;
                    return (
                      <tr key={log.log_id || i} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Calendar className="w-3 h-3" />
                            <span>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm text-white">{log.admin_name || 'Admin'}</p>
                              <p className="text-xs text-slate-500">{log.admin_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${config.bg}`}>
                            <ActionIcon className={`w-4 h-4 ${config.color}`} />
                            <span className={`text-sm ${config.color}`}>{formatActionName(log.action)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-slate-700 text-slate-300">
                            {log.target_type}:{log.target_id?.slice(0, 12) || 'N/A'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400 max-w-xs">
                          <div className="truncate" title={JSON.stringify(log.details || {})}>
                            {log.details ? Object.entries(log.details).map(([k, v]) => (
                              <span key={k} className="mr-2">
                                <span className="text-slate-500">{k}:</span> {String(v).slice(0, 20)}
                              </span>
                            )).slice(0, 2) : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                          {log.ip_address || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent Signups Tab */}
      {activeTab === 'signups' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : data.recent_signups?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent signups</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {data.recent_signups.map((user, i) => (
                <div key={user.user_id || i} className="p-4 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.name || 'New User'}</p>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500/20 text-green-400">New User</Badge>
                    <p className="text-xs text-slate-500 mt-1">
                      {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : data.recent_transactions?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent transactions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {data.recent_transactions.map((txn, i) => (
                    <tr key={txn.transaction_id || i} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm font-mono text-slate-400">
                        {txn.transaction_id?.slice(0, 16) || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {txn.user_id?.slice(0, 12) || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-blue-500/20 text-blue-400">
                          {txn.transaction_type?.replace(/_/g, ' ') || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${(txn.amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(txn.amount || 0) >= 0 ? '+' : ''}{txn.amount} {txn.currency?.toUpperCase() || 'BL'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {txn.created_at ? new Date(txn.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.audit_logs?.length || 0}</p>
              <p className="text-sm text-slate-400">Audit Records</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <User className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.recent_signups?.length || 0}</p>
              <p className="text-sm text-slate-400">Recent Signups</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.recent_transactions?.length || 0}</p>
              <p className="text-sm text-slate-400">Recent Transactions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
