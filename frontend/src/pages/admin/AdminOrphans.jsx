import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Users, UserPlus, UserMinus, Search, RefreshCw, 
  AlertTriangle, CheckCircle, Clock, ArrowRight, 
  Filter, ChevronDown, Eye, X
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Safe fetch helper
const safeFetch = async (url, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { ...options, headers });
  const rawText = await response.text();
  
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.error('JSON parse error:', e);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || 'Request failed');
  }
  
  return data;
};

export default function AdminOrphans() {
  const [orphans, setOrphans] = useState([]);
  const [potentialParents, setPotentialParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, unassigned, assigned
  const [selectedOrphan, setSelectedOrphan] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [stats, setStats] = useState({
    total_orphans: 0,
    unassigned: 0,
    assigned_today: 0,
    avg_assignment_time: 0
  });

  useEffect(() => {
    loadOrphans();
    loadPotentialParents();
    loadStats();
  }, []);

  const loadOrphans = async () => {
    setLoading(true);
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans`);
      setOrphans(data.orphans || []);
    } catch (error) {
      console.error("Failed to load orphans:", error);
      // Use mock data for demo
      setOrphans([
        {
          user_id: "orphan_1",
          username: "new_user_123",
          email: "new@example.com",
          created_at: new Date().toISOString(),
          is_orphan_assigned: false,
          assigned_to: null,
          last_login_at: new Date().toISOString(),
          bl_coins: 50000
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPotentialParents = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/potential-parents`);
      setPotentialParents(data.parents || []);
    } catch (error) {
      console.error("Failed to load potential parents:", error);
      // Use mock data
      setPotentialParents([
        {
          user_id: "parent_1",
          username: "active_user",
          direct_referrals: 0,
          orphans_assigned: 0,
          last_login_at: new Date().toISOString(),
          tier: 1,
          tier_desc: "ID-verified + 0 recruits + daily login"
        },
        {
          user_id: "parent_2",
          username: "moderator",
          direct_referrals: 1,
          orphans_assigned: 1,
          last_login_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          tier: 6,
          tier_desc: "1 recruit + weekly login"
        }
      ]);
    }
  };

  const loadStats = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/stats`);
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const assignOrphan = async (orphanId, parentId) => {
    setAssigning(true);
    try {
      await safeFetch(`${API_BASE}/api/admin/orphans/assign`, {
        method: 'POST',
        body: JSON.stringify({ orphan_id: orphanId, parent_id: parentId })
      });
      toast.success("Orphan assigned successfully!");
      loadOrphans();
      loadStats();
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
      const data = await safeFetch(`${API_BASE}/api/admin/orphans/auto-assign`, {
        method: 'POST',
        body: JSON.stringify({ orphan_id: orphanId })
      });
      toast.success(`Assigned to ${data.assigned_to_username}`);
      loadOrphans();
      loadStats();
    } catch (error) {
      toast.error(error.message || "No suitable parent found");
    } finally {
      setAssigning(false);
    }
  };

  const filteredOrphans = orphans.filter(orphan => {
    const matchesSearch = !search || 
      orphan.username?.toLowerCase().includes(search.toLowerCase()) ||
      orphan.email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === "all" || 
      (filter === "unassigned" && !orphan.is_orphan_assigned) ||
      (filter === "assigned" && orphan.is_orphan_assigned);
    
    return matchesSearch && matchesFilter;
  });

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Orphan Monitoring System
          </h1>
          <p className="text-slate-400">Manage users without referrers (11 priority tiers)</p>
        </div>
        <Button onClick={() => { loadOrphans(); loadStats(); }} variant="ghost" className="text-slate-400">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.unassigned}</p>
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
              <p className="text-xs text-slate-400">Assigned Today</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.avg_assignment_time}h</p>
              <p className="text-xs text-slate-400">Avg Assignment Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Tiers Info */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" /> 11 Priority Tiers for Assignment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {[
            "1. ID-verified + 0 recruits + daily login",
            "2. Not ID-verified + 0 recruits + daily login",
            "3. 0 recruits + weekly login",
            "4. 0 recruits + monthly login",
            "5. 0 recruits + quarterly login",
            "6. ID-verified + 1 recruit + daily login",
            "7. Not ID-verified + 1 recruit + daily login",
            "8. 1 recruit + weekly login",
            "9. 1 recruit + monthly login",
            "10. 1 recruit + quarterly login",
            "11. 1 recruit + biannual login"
          ].map((tier, i) => (
            <div key={i} className="px-2 py-1 bg-slate-700/50 rounded text-slate-300">
              {tier}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Max 2 orphans per user • Must be active within 6 months
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
                    <div className="flex items-center gap-2">
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
                {potentialParents.map((parent) => (
                  <button
                    key={parent.user_id}
                    onClick={() => assignOrphan(assignModal.user_id, parent.user_id)}
                    disabled={assigning}
                    className="w-full p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-left transition-colors flex items-center gap-3"
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
                      </div>
                      <p className="text-xs text-slate-400">
                        {parent.direct_referrals} recruits • {parent.orphans_assigned}/2 orphans
                      </p>
                      <p className="text-xs text-slate-500">{parent.tier_desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
