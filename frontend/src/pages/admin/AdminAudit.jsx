import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  FileText, Search, Filter, RefreshCw, Download,
  User, Eye, Ban, Trash2, Palette, Layout, Shield,
  Bot, Calendar, ChevronLeft, ChevronRight
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login', icon: User, color: 'text-green-400' },
  { value: 'view_private_content', label: 'View Private Content', icon: Eye, color: 'text-blue-400' },
  { value: 'user_suspend', label: 'User Suspend', icon: Ban, color: 'text-yellow-400' },
  { value: 'user_ban', label: 'User Ban', icon: Ban, color: 'text-orange-400' },
  { value: 'user_delete', label: 'User Delete', icon: Trash2, color: 'text-red-400' },
  { value: 'theme_change', label: 'Theme Change', icon: Palette, color: 'text-purple-400' },
  { value: 'page_modify', label: 'Page Modify', icon: Layout, color: 'text-cyan-400' },
  { value: 'genealogy_modify', label: 'Genealogy Modify', icon: User, color: 'text-pink-400' },
  { value: 'permission_change', label: 'Permission Change', icon: Shield, color: 'text-amber-400' },
  { value: 'ai_assist_request', label: 'AI Request', icon: Bot, color: 'text-indigo-400' },
];

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, targetFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const params = new URLSearchParams({ skip: page * 50, limit: 50 });
      if (actionFilter) params.append('action', actionFilter);
      if (targetFilter) params.append('target_type', targetFilter);
      
      const response = await fetch(`${API_BASE}/api/audit/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionInfo = (action) => {
    return ACTION_TYPES.find(a => a.value === action) || { label: action, icon: FileText, color: 'text-slate-400' };
  };

  const exportLogs = () => {
    const csv = [
      ['Date', 'Admin', 'Action', 'Target', 'Details', 'IP'].join(','),
      ...logs.map(log => [
        new Date(log.created_at).toISOString(),
        log.admin_email,
        log.action,
        `${log.target_type}:${log.target_id}`,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            Audit Logs
          </h1>
          <p className="text-slate-400">{total} total records • GDPR Compliant</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportLogs} variant="outline" className="border-slate-600">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={loadLogs} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
        >
          {ACTION_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={targetFilter}
          onChange={(e) => { setTargetFilter(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
        >
          <option value="">All Targets</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
          <option value="theme">Themes</option>
          <option value="page">Pages</option>
          <option value="albums">Albums</option>
          <option value="messages">Messages</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No audit logs found</p>
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
                {logs.map((log) => {
                  const actionInfo = getActionInfo(log.action);
                  const ActionIcon = actionInfo.icon;
                  return (
                    <tr key={log.log_id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{log.admin_email}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-2 ${actionInfo.color}`}>
                          <ActionIcon className="w-4 h-4" />
                          <span className="text-sm">{actionInfo.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                          {log.target_type}:{log.target_id?.slice(0, 12)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                        {JSON.stringify(log.details || {})}
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

        {/* Pagination */}
        {total > 50 && (
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {page * 50 + 1} - {Math.min((page + 1) * 50, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="border-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * 50 >= total}
                onClick={() => setPage(p => p + 1)}
                className="border-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
