import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  Crown, Users, DollarSign, TrendingUp, Search, RefreshCw,
  ChevronUp, ChevronDown, AlertTriangle, CheckCircle, Clock,
  Award, Target, X, ArrowUpRight, ArrowDownRight
} from "lucide-react";

const API_BASE = getApiUrl();

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

// Diamond requirements
const DIAMOND_REQUIREMENTS = {
  direct_recruits: 100,
  downline_commissions: 1000,
  personal_sales: 1000,
  bl_coins_earned: 6000000
};

const MAINTENANCE_REQUIREMENTS = {
  new_recruits: 1,
  personal_sales: 10,
  team_commissions: 10,
  bl_earned: 100000
};

export default function AdminDiamondLeaders() {
  const [diamonds, setDiamonds] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [pendingDemotions, setPendingDemotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active"); // active, candidates, pending-demotions
  const [selectedUser, setSelectedUser] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [demoting, setDemoting] = useState(false);
  const [stats, setStats] = useState({
    total_diamonds: 0,
    promoted_this_month: 0,
    demoted_this_month: 0,
    pending_bonuses: 0
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDiamonds(),
      loadCandidates(),
      loadPendingDemotions(),
      loadStats()
    ]);
    setLoading(false);
  };

  const loadDiamonds = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/diamond-leaders`);
      setDiamonds(data.diamonds || []);
    } catch (error) {
      console.error("Failed to load diamonds:", error);
      // Mock data
      setDiamonds([
        {
          user_id: "diamond_1",
          username: "top_leader",
          email: "leader@example.com",
          diamond_achieved_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          maintenance_due: new Date(Date.now() + 86400000 * 15).toISOString(),
          direct_referrals: 150,
          total_commissions_30d: 2500,
          personal_sales_30d: 1800,
          bl_earned_30d: 250000,
          maintenance_status: "on_track"
        }
      ]);
    }
  };

  const loadCandidates = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/diamond-leaders/candidates`);
      setCandidates(data.candidates || []);
    } catch (error) {
      console.error("Failed to load candidates:", error);
      setCandidates([
        {
          user_id: "candidate_1",
          username: "rising_star",
          email: "star@example.com",
          progress: {
            direct_recruits: { current: 85, required: 100 },
            downline_commissions: { current: 1200, required: 1000 },
            personal_sales: { current: 950, required: 1000 },
            bl_coins_earned: { current: 5500000, required: 6000000 }
          },
          qualified: false
        }
      ]);
    }
  };

  const loadPendingDemotions = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/diamond-leaders/pending-demotions`);
      setPendingDemotions(data.pending || []);
    } catch (error) {
      console.error("Failed to load pending demotions:", error);
      setPendingDemotions([]);
    }
  };

  const loadStats = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/admin/diamond-leaders/stats`);
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const promoteUser = async (userId) => {
    setPromoting(true);
    try {
      await safeFetch(`${API_BASE}/api/admin/diamond-leaders/promote`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
      });
      toast.success("User promoted to Diamond Leader! 10M BL + $100 USD bonus awarded.");
      loadAllData();
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.message || "Failed to promote user");
    } finally {
      setPromoting(false);
    }
  };

  const approveDemotion = async (userId) => {
    setDemoting(true);
    try {
      await safeFetch(`${API_BASE}/api/admin/diamond-leaders/demote`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
      });
      toast.success("User demoted from Diamond Leader");
      loadAllData();
    } catch (error) {
      toast.error(error.message || "Failed to demote user");
    } finally {
      setDemoting(false);
    }
  };

  const extendMaintenance = async (userId, days = 30) => {
    try {
      await safeFetch(`${API_BASE}/api/admin/diamond-leaders/extend-maintenance`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, days })
      });
      toast.success(`Maintenance period extended by ${days} days`);
      loadAllData();
    } catch (error) {
      toast.error(error.message || "Failed to extend maintenance");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  const getProgressColor = (current, required) => {
    const percent = (current / required) * 100;
    if (percent >= 100) return "text-green-400 bg-green-500/20";
    if (percent >= 75) return "text-amber-400 bg-amber-500/20";
    return "text-red-400 bg-red-500/20";
  };

  const filteredItems = () => {
    const items = tab === "active" ? diamonds : tab === "candidates" ? candidates : pendingDemotions;
    if (!search) return items;
    return items.filter(item => 
      item.username?.toLowerCase().includes(search.toLowerCase()) ||
      item.email?.toLowerCase().includes(search.toLowerCase())
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-400" />
            Diamond Leader Management
          </h1>
          <p className="text-slate-400">Monitor performance, promote & demote leaders</p>
        </div>
        <Button onClick={loadAllData} variant="ghost" className="text-slate-400">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/20 rounded-xl p-4 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/30 flex items-center justify-center">
              <Crown className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_diamonds}</p>
              <p className="text-xs text-yellow-300/70">Total Diamonds</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.promoted_this_month}</p>
              <p className="text-xs text-slate-400">Promoted (30d)</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.demoted_this_month}</p>
              <p className="text-xs text-slate-400">Demoted (30d)</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">${stats.pending_bonuses}</p>
              <p className="text-xs text-slate-400">Pending Bonuses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requirements Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-yellow-400" /> Qualification Requirements (30 days)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">Direct Recruits</p>
              <p className="text-white font-medium">{DIAMOND_REQUIREMENTS.direct_recruits}</p>
            </div>
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">Downline Commissions</p>
              <p className="text-white font-medium">${DIAMOND_REQUIREMENTS.downline_commissions}</p>
            </div>
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">Personal Sales</p>
              <p className="text-white font-medium">${DIAMOND_REQUIREMENTS.personal_sales}</p>
            </div>
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">BL Coins Earned</p>
              <p className="text-white font-medium">{DIAMOND_REQUIREMENTS.bl_coins_earned.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-yellow-400 mt-2">Bonus: 10,000,000 BL + $100 USD</p>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" /> Maintenance Requirements (per 30 days)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">New Recruits</p>
              <p className="text-white font-medium">{MAINTENANCE_REQUIREMENTS.new_recruits}+</p>
            </div>
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">Personal Sales</p>
              <p className="text-white font-medium">${MAINTENANCE_REQUIREMENTS.personal_sales}+</p>
            </div>
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">Team Commissions</p>
              <p className="text-white font-medium">${MAINTENANCE_REQUIREMENTS.team_commissions}+</p>
            </div>
            <div className="bg-slate-700/50 rounded px-3 py-2">
              <p className="text-slate-400">BL Earned</p>
              <p className="text-white font-medium">{MAINTENANCE_REQUIREMENTS.bl_earned.toLocaleString()}+</p>
            </div>
          </div>
          <p className="text-xs text-red-400 mt-2">Failure = Demotion to Regular status</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { key: 'active', label: 'Active Diamonds', count: diamonds.length },
          { key: 'candidates', label: 'Candidates', count: candidates.length },
          { key: 'pending-demotions', label: 'Pending Demotions', count: pendingDemotions.length }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'bg-slate-800 text-white border-b-2 border-yellow-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                t.key === 'pending-demotions' && t.count > 0
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-slate-600 text-slate-300'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white"
        />
      </div>

      {/* Content */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          </div>
        ) : filteredItems().length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Crown className="w-12 h-12 mb-3 opacity-30" />
            <p>No {tab === 'active' ? 'diamond leaders' : tab === 'candidates' ? 'candidates' : 'pending demotions'} found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredItems().map((user) => (
              <div key={user.user_id} className="p-4 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                    tab === 'active' ? 'bg-yellow-500/20' : 'bg-slate-700'
                  }`}>
                    {tab === 'active' ? (
                      <Crown className="w-6 h-6 text-yellow-400" />
                    ) : (
                      user.username?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{user.username}</h3>
                      {tab === 'active' && user.maintenance_status === 'at_risk' && (
                        <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                          At Risk
                        </span>
                      )}
                      {tab === 'candidates' && user.qualified && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                          Qualified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{user.email}</p>
                    
                    {/* Progress bars for candidates */}
                    {tab === 'candidates' && user.progress && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {Object.entries(user.progress).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-500 truncate">{key.replace(/_/g, ' ')}</span>
                              <span className={getProgressColor(val.current, val.required).split(' ')[0]}>
                                {Math.round((val.current / val.required) * 100)}%
                              </span>
                            </div>
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-500 to-amber-500"
                                style={{ width: `${Math.min((val.current / val.required) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Stats for active diamonds */}
                    {tab === 'active' && (
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>Since: {formatDate(user.diamond_achieved_at)}</span>
                        <span>Due: {formatDate(user.maintenance_due)}</span>
                        <span>${user.total_commissions_30d || 0} comm.</span>
                        <span>${user.personal_sales_30d || 0} sales</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {tab === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extendMaintenance(user.user_id)}
                          className="border-slate-600"
                        >
                          Extend 30d
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser({ ...user, action: 'demote' })}
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                          Demote
                        </Button>
                      </>
                    )}
                    
                    {tab === 'candidates' && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedUser({ ...user, action: 'promote' })}
                        disabled={!user.qualified}
                        className={user.qualified ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-slate-600'}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Promote
                      </Button>
                    )}
                    
                    {tab === 'pending-demotions' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extendMaintenance(user.user_id)}
                          className="border-slate-600"
                        >
                          Give Extension
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveDemotion(user.user_id)}
                          disabled={demoting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Approve Demotion
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

      {/* Confirmation Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {selectedUser.action === 'promote' ? 'Confirm Promotion' : 'Confirm Demotion'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4">
              {selectedUser.action === 'promote' ? (
                <>
                  <p className="text-slate-300 mb-4">
                    Promote <span className="text-white font-medium">{selectedUser.username}</span> to Diamond Leader?
                  </p>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <p className="text-yellow-400 text-sm font-medium">Bonus will be awarded:</p>
                    <ul className="text-yellow-300/70 text-sm mt-1">
                      <li>• 10,000,000 BL Coins (instant)</li>
                      <li>• $100 USD (manual credit required)</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-slate-300 mb-4">
                    Demote <span className="text-white font-medium">{selectedUser.username}</span> from Diamond Leader?
                  </p>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">
                      User will lose Diamond Leader benefits and commission rates will revert to regular rates.
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedUser.action === 'promote' 
                  ? promoteUser(selectedUser.user_id) 
                  : approveDemotion(selectedUser.user_id)
                }
                disabled={promoting || demoting}
                className={selectedUser.action === 'promote' 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-red-600 hover:bg-red-700'
                }
              >
                {(promoting || demoting) ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  selectedUser.action === 'promote' ? 'Promote to Diamond' : 'Confirm Demotion'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
