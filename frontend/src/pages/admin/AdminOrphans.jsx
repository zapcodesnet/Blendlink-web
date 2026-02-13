import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Users, UserPlus, UserMinus, Search, RefreshCw, 
  AlertTriangle, CheckCircle, Clock, ArrowRight, 
  Filter, ChevronDown, Eye, X, Play, History,
  Shield, Calendar, TrendingUp, Database
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Safe fetch helper - properly handles response body without double-read issues
const safeFetch = async (url, options = {}) => {
  const token = localStorage.getItem('blendlink_token') || localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    // Clone the response before reading to avoid "body stream already read" error
    const clonedResponse = response.clone();
    
    let data = {};
    try {
      // Try to parse as JSON first
      data = await response.json();
    } catch (jsonError) {
      // If JSON parse fails, try text from cloned response
      try {
        const text = await clonedResponse.text();
        if (text) {
          data = { message: text };
        }
      } catch (textError) {
        console.error('Failed to read response:', textError);
      }
    }
    
    if (!response.ok) {
      throw new Error(data.detail || data.message || `Request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    // Re-throw with better error message
    if (error.name === 'TypeError' && error.message.includes('body stream')) {
      throw new Error('Network error - please try again');
    }
    throw error;
  }
};

// Priority tier descriptions
const TIER_DESCRIPTIONS = {
  1: "ID-verified + 0 recruits + daily login",
  2: "Not ID-verified + 0 recruits + daily login",
  3: "0 recruits + weekly login",
  4: "0 recruits + monthly login",
  5: "0 recruits + quarterly login",
  6: "ID-verified + 1 recruit + daily login",
  7: "Not ID-verified + 1 recruit + daily login",
  8: "1 recruit + weekly login",
  9: "1 recruit + monthly login",
  10: "1 recruit + quarterly login",
  11: "1 recruit + biannual login"
};

export default function AdminOrphans() {
  const [orphans, setOrphans] = useState([]);
  const [potentialParents, setPotentialParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState(null);
  const [selectedOrphan, setSelectedOrphan] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'parents', 'audit'
  
  const [stats, setStats] = useState({
    total_orphans: 0,
    unassigned: 0,
    assigned: 0,
    assigned_today: 0,
    assigned_this_week: 0,
    eligible_parents: 0,
    parents_at_capacity: 0,
    max_orphans_per_user: 2,
    assignment_breakdown: { auto: 0, manual: 0 }
  });

  const loadOrphans = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filter !== 'all' ? `?status=${filter}` : '';
      const data = await safeFetch(`${API_BASE}/api/admin/orphans${statusParam}`);
      setOrphans(data.orphans || []);
    } catch (error) {
      console.error("Failed to load orphans:", error);
      toast.error("Failed to load orphans");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadPotentialParents = useCallback(async () => {
    try {
      const tierParam = tierFilter ? `?tier=${tierFilter}&limit=100` : '?limit=100';
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/potential-parents${tierParam}`);
      setPotentialParents(data.parents || []);
    } catch (error) {
      console.error("Failed to load potential parents:", error);
    }
  }, [tierFilter]);

  const loadStats = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/stats`);
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadAuditLog = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/assignment-log?limit=50`);
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to load audit log:", error);
    }
  };

  useEffect(() => {
    loadOrphans();
    loadStats();
  }, [loadOrphans]);

  useEffect(() => {
    if (activeTab === 'parents') {
      loadPotentialParents();
    } else if (activeTab === 'audit') {
      loadAuditLog();
    }
  }, [activeTab, loadPotentialParents]);

  const assignOrphan = async (orphanId, parentId) => {
    setAssigning(true);
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/assign?orphan_id=${orphanId}&parent_id=${parentId}`, {
        method: 'POST'
      });
      toast.success(`Orphan assigned to ${data.assigned_to_username || 'user'}`);
      loadOrphans();
      loadStats();
      loadPotentialParents();
      setAssignModal(null);
    } catch (error) {
      toast.error(error.message || "Failed to assign orphan");
    } finally {
      setAssigning(false);
    }
  };

  const autoAssignOrphan = async (orphanId) => {
    setAssigning(true);
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/auto-assign?orphan_id=${orphanId}`, {
        method: 'POST'
      });
      toast.success(`Assigned to ${data.assigned_to_username} (Tier ${data.tier})`);
      loadOrphans();
      loadStats();
      loadPotentialParents();
    } catch (error) {
      toast.error(error.message || "No suitable parent found");
    } finally {
      setAssigning(false);
    }
  };

  const runBatchAssignment = async () => {
    setBatchRunning(true);
    setBatchResults(null);
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/batch-assign?limit=100`, {
        method: 'POST'
      });
      setBatchResults(data);
      toast.success(`Batch complete: ${data.successful}/${data.total_processed} assigned`);
      loadOrphans();
      loadStats();
      loadPotentialParents();
      loadAuditLog();
    } catch (error) {
      toast.error(error.message || "Batch assignment failed");
    } finally {
      setBatchRunning(false);
    }
  };

  const filteredOrphans = orphans.filter(orphan => {
    const matchesSearch = !search || 
      orphan.username?.toLowerCase().includes(search.toLowerCase()) ||
      orphan.email?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getLoginFrequencyBadge = (freq) => {
    const colors = {
      daily: 'bg-green-500/20 text-green-400',
      weekly: 'bg-blue-500/20 text-blue-400',
      monthly: 'bg-yellow-500/20 text-yellow-400',
      quarterly: 'bg-orange-500/20 text-orange-400',
      biannual: 'bg-red-500/20 text-red-400',
      inactive: 'bg-slate-500/20 text-slate-400'
    };
    return colors[freq] || colors.inactive;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Orphan Management System
          </h1>
          <p className="text-slate-400">11-tier priority assignment with round-robin distribution</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runBatchAssignment} 
            disabled={batchRunning || stats.unassigned === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {batchRunning ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Re-run Auto-Assign</>
            )}
          </Button>
          <Button onClick={() => { loadOrphans(); loadStats(); }} variant="ghost" className="text-slate-400">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Batch Results */}
      {batchResults && (
        <div className="bg-slate-800 rounded-xl p-4 border border-green-500/30">
          <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" /> Batch Assignment Results
          </h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Processed</p>
              <p className="text-xl font-bold text-white">{batchResults.total_processed}</p>
            </div>
            <div>
              <p className="text-slate-400">Successful</p>
              <p className="text-xl font-bold text-green-400">{batchResults.successful}</p>
            </div>
            <div>
              <p className="text-slate-400">Failed</p>
              <p className="text-xl font-bold text-red-400">{batchResults.failed}</p>
            </div>
            <div>
              <p className="text-slate-400">No Eligible</p>
              <p className="text-xl font-bold text-amber-400">{batchResults.no_eligible_recipients}</p>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="mt-2 text-slate-400"
            onClick={() => setBatchResults(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_orphans}</p>
              <p className="text-xs text-slate-400">Total Orphans</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{stats.unassigned}</p>
              <p className="text-xs text-slate-400">Unassigned</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.assigned_today}</p>
              <p className="text-xs text-slate-400">Today</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.assigned_this_week}</p>
              <p className="text-xs text-slate-400">This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.eligible_parents}</p>
              <p className="text-xs text-slate-400">Eligible Parents</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <UserMinus className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.parents_at_capacity}</p>
              <p className="text-xs text-slate-400">At Capacity (2)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Breakdown */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Assignment Breakdown
        </h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-slate-400">Auto:</span>
            <span className="text-white font-medium">{stats.assignment_breakdown?.auto || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-400">Manual:</span>
            <span className="text-white font-medium">{stats.assignment_breakdown?.manual || 0}</span>
          </div>
          <div className="ml-auto text-sm text-slate-500">
            Max {stats.max_orphans_per_user} orphans per user
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'queue', label: 'Orphan Queue', icon: Users },
          { id: 'parents', label: 'Eligible Parents', icon: UserPlus },
          { id: 'audit', label: 'Audit Log', icon: History }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'bg-purple-600' : 'text-slate-400'}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'queue' && (
        <>
          {/* Priority Tiers Info */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" /> 11 Priority Tiers (Round-Robin Distribution)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {Object.entries(TIER_DESCRIPTIONS).map(([tier, desc]) => (
                <div key={tier} className="px-2 py-1 bg-slate-700/50 rounded text-slate-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">
                    {tier}
                  </span>
                  {desc}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Max 2 orphans per user (permanent cap) • Users inactive &gt;6 months excluded
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username or email..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'unassigned', 'assigned'].map(f => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'ghost'}
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-purple-600' : 'text-slate-400'}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Orphans List */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : filteredOrphans.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p>No orphans found</p>
                <p className="text-sm">All users have been assigned uplines</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {filteredOrphans.map((orphan) => (
                  <div key={orphan.user_id} className="p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg">
                        {orphan.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-white">{orphan.username}</h3>
                          {orphan.is_orphan_assigned ? (
                            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                              Assigned
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                              Unassigned
                            </span>
                          )}
                          {orphan.login_frequency && (
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getLoginFrequencyBadge(orphan.login_frequency)}`}>
                              {orphan.login_frequency}
                            </span>
                          )}
                          {orphan.orphan_assigned_tier && (
                            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                              Tier {orphan.orphan_assigned_tier}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 truncate">{orphan.email}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span>Joined: {formatTimeAgo(orphan.created_at)}</span>
                          <span>Last login: {formatTimeAgo(orphan.last_login_at)}</span>
                          <span>{(orphan.bl_coins || 0).toLocaleString()} BL</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {orphan.is_orphan_assigned ? (
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Assigned to:</p>
                            <p className="text-white font-medium">{orphan.assigned_to_username || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{formatTimeAgo(orphan.orphan_assigned_at)}</p>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => autoAssignOrphan(orphan.user_id)}
                              disabled={assigning}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              {assigning ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Auto Assign'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAssignModal(orphan)}
                              className="border-slate-600"
                            >
                              Manual
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'parents' && (
        <>
          {/* Tier Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={tierFilter === null ? 'default' : 'ghost'}
              onClick={() => setTierFilter(null)}
              className={tierFilter === null ? 'bg-purple-600' : 'text-slate-400'}
              size="sm"
            >
              All Tiers
            </Button>
            {[1,2,3,4,5,6,7,8,9,10,11].map(t => (
              <Button
                key={t}
                variant={tierFilter === t ? 'default' : 'ghost'}
                onClick={() => setTierFilter(t)}
                className={tierFilter === t ? 'bg-purple-600' : 'text-slate-400'}
                size="sm"
              >
                Tier {t}
              </Button>
            ))}
          </div>

          {/* Parents List */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Eligible Parents ({potentialParents.length})</h3>
              <p className="text-sm text-slate-400">Sorted by priority tier, then join date (oldest first)</p>
            </div>
            <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
              {potentialParents.map((parent) => (
                <div key={parent.user_id} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                      {parent.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{parent.username}</span>
                        <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded-full">
                          Tier {parent.tier}
                        </span>
                        {parent.id_verified && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Verified
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getLoginFrequencyBadge(parent.login_frequency)}`}>
                          {parent.login_frequency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{parent.tier_description}</p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-slate-400">
                        <span className="text-white">{parent.direct_recruits}</span> recruits
                      </div>
                      <div className={parent.remaining_capacity === 0 ? 'text-red-400' : 'text-green-400'}>
                        <span className="font-medium">{parent.orphans_assigned}</span>/2 orphans
                      </div>
                      <div className="text-xs text-slate-500">
                        Joined: {formatTimeAgo(parent.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'audit' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Assignment Audit Log</h3>
              <p className="text-sm text-slate-400">All orphan assignments with timestamps</p>
            </div>
            <Button onClick={loadAuditLog} variant="ghost" size="sm" className="text-slate-400">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
          <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No assignment logs yet</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.assignment_id} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      log.assignment_type === 'auto' ? 'bg-purple-500/20' : 
                      log.assignment_type === 'manual' ? 'bg-blue-500/20' : 'bg-green-500/20'
                    }`}>
                      {log.assignment_type === 'auto' ? (
                        <Play className="w-5 h-5 text-purple-400" />
                      ) : log.assignment_type === 'manual' ? (
                        <UserPlus className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Database className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{log.orphan_username}</span>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                        <span className="text-white font-medium">{log.assigned_to_username}</span>
                        {log.tier && (
                          <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded-full">
                            Tier {log.tier}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {log.reason}
                        {log.assigned_by && ` • By admin`}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        log.assignment_type === 'auto' ? 'bg-purple-500/20 text-purple-400' :
                        log.assignment_type === 'manual' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {log.assignment_type}
                      </span>
                      <p className="mt-1">{formatTimeAgo(log.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Manual Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Manual Assignment</h2>
                <p className="text-sm text-slate-400">
                  Assign <span className="text-white">{assignModal.username}</span> to an upline
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAssignModal(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-slate-400 mb-3">Select a parent (sorted by priority tier):</p>
              <div className="space-y-2">
                {potentialParents.filter(p => p.remaining_capacity > 0).map((parent) => (
                  <button
                    key={parent.user_id}
                    onClick={() => assignOrphan(assignModal.user_id, parent.user_id)}
                    disabled={assigning}
                    className="w-full p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-left transition-colors flex items-center gap-3 disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                      {parent.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{parent.username}</span>
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/30 text-purple-300 rounded">
                          Tier {parent.tier}
                        </span>
                        {parent.id_verified && (
                          <Shield className="w-3 h-3 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {parent.direct_recruits} recruits • {parent.orphans_assigned}/2 orphans
                      </p>
                      <p className="text-xs text-slate-500">{parent.tier_description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
                {potentialParents.filter(p => p.remaining_capacity > 0).length === 0 && (
                  <div className="text-center text-slate-400 py-8">
                    <UserMinus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No eligible parents available</p>
                    <p className="text-sm">All users are at capacity or inactive</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
