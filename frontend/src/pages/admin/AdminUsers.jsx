import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Routes, Route, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import { 
  Users, Search, Eye, ArrowLeft, RefreshCw, Filter,
  Ban, Clock, Trash2, Key, LogOut, Shield, DollarSign,
  Coins, UserPlus, ChevronLeft, ChevronRight, MoreVertical,
  CheckCircle, XCircle, AlertTriangle, User, Mail, Calendar,
  TrendingUp, CreditCard, GitBranch, X
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const getToken = () => localStorage.getItem('blendlink_token');

// Safe API request helper - reads body only once
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
  
  // Read body as text first to avoid "body stream already read" errors
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

export default function AdminUsers() {
  return (
    <Routes>
      <Route index element={<UsersList />} />
      <Route path=":userId" element={<UserDetail />} />
    </Routes>
  );
}

// Status badge component
const StatusBadge = ({ user }) => {
  if (user.is_banned) {
    return <Badge className="bg-red-500/20 text-red-500 border border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Banned</Badge>;
  }
  if (user.is_suspended) {
    return <Badge className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Suspended</Badge>;
  }
  if (user.is_deleted) {
    return <Badge className="bg-slate-500/20 text-slate-500 border border-slate-500/30"><Trash2 className="w-3 h-3 mr-1" />Deleted</Badge>;
  }
  return <Badge className="bg-green-500/20 text-green-500 border border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
};

function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const limit = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { skip: page * limit, limit };
      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;
      
      const data = await adminAPI.searchUsers(params);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error("Failed to load users: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { 
    loadUsers(); 
  }, [loadUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    loadUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            User Management
          </h1>
          <p className="text-slate-400">{total.toLocaleString()} total users • Real-time production data</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-slate-600"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, username, or user ID..."
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </form>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <span className="text-sm text-slate-400 mr-2">Status:</span>
            {["", "active", "suspended", "banned"].map((status) => (
              <Button
                key={status || "all"}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(status); setPage(0); }}
                className={statusFilter !== status ? "border-slate-600" : ""}
              >
                {status || "All"}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">BL Coins</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">USD</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Referrals</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Joined</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    <p className="text-slate-400">Loading users...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr 
                  key={user.user_id} 
                  className="hover:bg-slate-700/30 cursor-pointer"
                  onClick={() => navigate(`/admin/users/${user.user_id}`)}
                  data-testid={`user-row-${user.user_id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.name || "Unknown"}</p>
                        <p className="text-xs text-slate-500">@{user.username || user.user_id?.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-amber-400 font-medium">{(user.bl_coins || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-green-400 font-medium">${(user.usd_balance || 0).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.referral_count || 0}</td>
                  <td className="px-4 py-3"><StatusBadge user={user} /></td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/users/${user.user_id}`)}
                      className="text-slate-400 hover:text-white"
                      data-testid={`view-user-${user.user_id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
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
                disabled={(page + 1) * limit >= total}
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

function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionModal, setShowActionModal] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);
  const [balanceAdjust, setBalanceAdjust] = useState({ currency: "bl_coins", amount: 0, reason: "" });

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getUser(userId);
      setData(result);
    } catch (error) {
      toast.error("Failed to load user: " + error.message);
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!actionReason) {
      toast.error("Please provide a reason");
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.suspendUser(userId, actionReason, suspendDays);
      toast.success("User suspended successfully");
      setShowActionModal(null);
      loadUserData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/admin/users/${userId}/unsuspend`, { method: "POST" });
      toast.success("User unsuspended");
      loadUserData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    if (!actionReason) {
      toast.error("Please provide a reason");
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.banUser(userId, actionReason);
      toast.success("User banned successfully");
      setShowActionModal(null);
      loadUserData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/admin/users/${userId}/unban`, { method: "POST" });
      toast.success("User unbanned");
      loadUserData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newPassword = prompt("Enter new password for user:");
    if (!newPassword) return;
    
    setActionLoading(true);
    try {
      await apiRequest(`/admin/users/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword })
      });
      toast.success("Password reset successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceLogout = async () => {
    if (!confirm("Force logout user from all sessions?")) return;
    setActionLoading(true);
    try {
      await apiRequest(`/admin/users/${userId}/force-logout`, { method: "POST" });
      toast.success("User logged out from all sessions");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBalanceAdjust = async () => {
    if (!balanceAdjust.amount || !balanceAdjust.reason) {
      toast.error("Please fill all fields");
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.adjustBalance(userId, balanceAdjust.currency, parseFloat(balanceAdjust.amount), balanceAdjust.reason);
      toast.success("Balance adjusted successfully");
      setShowActionModal(null);
      setBalanceAdjust({ currency: "bl_coins", amount: 0, reason: "" });
      loadUserData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!actionReason) {
      toast.error("Please provide a reason for deletion");
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/admin/users/${userId}`, { 
        method: "DELETE",
        body: JSON.stringify({ reason: actionReason })
      });
      toast.success("User deleted successfully");
      setShowActionModal(null);
      navigate('/admin/users');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const user = data?.user;
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')} className="text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                {user?.name || "Unknown User"}
                {user?.is_admin && <Shield className="w-5 h-5 text-blue-400" />}
              </h1>
              <p className="text-slate-400">{user?.email}</p>
              <StatusBadge user={user || {}} />
            </div>
          </div>
        </div>
        <Button onClick={loadUserData} variant="ghost" size="icon" className="text-slate-400">
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Coins} label="BL Coins" value={(user?.bl_coins || 0).toLocaleString()} color="amber" />
        <StatCard icon={DollarSign} label="USD Balance" value={`$${(user?.usd_balance || 0).toFixed(2)}`} color="green" />
        <StatCard icon={UserPlus} label="Referrals (L1)" value={stats?.referral_count || 0} color="blue" />
        <StatCard icon={GitBranch} label="L2 Referrals" value={stats?.l2_referral_count || 0} color="purple" />
      </div>

      {/* User Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Info */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Profile Information
          </h3>
          <div className="space-y-3">
            <InfoRow label="User ID" value={user?.user_id} mono />
            <InfoRow label="Username" value={user?.username || "Not set"} />
            <InfoRow label="Referral Code" value={user?.referral_code || "N/A"} mono />
            <InfoRow label="Referred By" value={user?.referred_by || "None"} mono />
            <InfoRow label="Rank" value={user?.rank || "Regular"} />
            <InfoRow label="KYC Status" value={user?.kyc_status || "Not started"} />
            <InfoRow label="Joined" value={user?.created_at ? new Date(user.created_at).toLocaleString() : "N/A"} />
            <InfoRow label="Last Login" value={user?.last_login ? new Date(user.last_login).toLocaleString() : "Never"} />
          </div>
        </div>

        {/* Admin Actions */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Admin Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Suspend/Unsuspend */}
            {user?.is_suspended ? (
              <Button onClick={handleUnsuspend} className="bg-green-600 hover:bg-green-700" disabled={actionLoading}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Unsuspend
              </Button>
            ) : (
              <Button onClick={() => setShowActionModal("suspend")} variant="outline" className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10" disabled={user?.is_banned}>
                <Clock className="w-4 h-4 mr-2" />
                Suspend
              </Button>
            )}

            {/* Ban/Unban */}
            {user?.is_banned ? (
              <Button onClick={handleUnban} className="bg-green-600 hover:bg-green-700" disabled={actionLoading}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Unban
              </Button>
            ) : (
              <Button onClick={() => setShowActionModal("ban")} variant="destructive" disabled={actionLoading}>
                <Ban className="w-4 h-4 mr-2" />
                Ban User
              </Button>
            )}

            {/* Password Reset */}
            <Button onClick={handleResetPassword} variant="outline" className="border-slate-600" disabled={actionLoading}>
              <Key className="w-4 h-4 mr-2" />
              Reset Password
            </Button>

            {/* Force Logout */}
            <Button onClick={handleForceLogout} variant="outline" className="border-slate-600" disabled={actionLoading}>
              <LogOut className="w-4 h-4 mr-2" />
              Force Logout
            </Button>

            {/* Adjust Balance */}
            <Button onClick={() => setShowActionModal("balance")} className="col-span-2 bg-blue-600 hover:bg-blue-700">
              <CreditCard className="w-4 h-4 mr-2" />
              Adjust Balance
            </Button>

            {/* Delete User */}
            <Button 
              onClick={() => setShowActionModal("delete")} 
              variant="outline" 
              className="col-span-2 border-red-500/50 text-red-500 hover:bg-red-500/10 mt-4"
              disabled={actionLoading || user?.is_admin}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete User Permanently
            </Button>
          </div>

          {/* Suspension Info */}
          {user?.is_suspended && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-500">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Suspended: {user.suspension_reason}
              </p>
              {user.suspension_expires && (
                <p className="text-xs text-yellow-400 mt-1">
                  Expires: {new Date(user.suspension_expires).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Ban Info */}
          {user?.is_banned && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-500">
                <Ban className="w-4 h-4 inline mr-2" />
                Banned: {user.ban_reason}
              </p>
              <p className="text-xs text-red-400 mt-1">
                On: {new Date(user.banned_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            Recent Transactions
          </h3>
        </div>
        <div className="divide-y divide-slate-700">
          {data?.recent_transactions?.length === 0 ? (
            <p className="p-4 text-center text-slate-400">No transactions found</p>
          ) : (
            data?.recent_transactions?.slice(0, 10).map((txn, i) => (
              <div key={txn.transaction_id || i} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white capitalize">{txn.transaction_type?.replace(/_/g, " ")}</p>
                  <p className="text-sm text-slate-400">{txn.transaction_id}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${txn.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {txn.amount >= 0 ? "+" : ""}{txn.amount} {txn.currency?.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {txn.created_at ? new Date(txn.created_at).toLocaleString() : "N/A"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Modals */}
      {showActionModal === "suspend" && (
        <ActionModal
          title="Suspend User"
          icon={Clock}
          iconColor="text-yellow-400"
          onClose={() => setShowActionModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Reason for suspension</label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason..."
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Duration (days)</label>
              <Input
                type="number"
                value={suspendDays}
                onChange={(e) => setSuspendDays(parseInt(e.target.value))}
                min={1}
                max={365}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSuspend} className="flex-1 bg-yellow-600 hover:bg-yellow-700" disabled={actionLoading}>
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                Confirm Suspend
              </Button>
              <Button variant="outline" onClick={() => setShowActionModal(null)} className="border-slate-600">
                Cancel
              </Button>
            </div>
          </div>
        </ActionModal>
      )}

      {showActionModal === "ban" && (
        <ActionModal
          title="Ban User"
          icon={Ban}
          iconColor="text-red-400"
          onClose={() => setShowActionModal(null)}
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                This action will permanently ban the user. They will not be able to access their account.
              </p>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Reason for ban</label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason..."
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBan} variant="destructive" className="flex-1" disabled={actionLoading}>
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                Confirm Ban
              </Button>
              <Button variant="outline" onClick={() => setShowActionModal(null)} className="border-slate-600">
                Cancel
              </Button>
            </div>
          </div>
        </ActionModal>
      )}

      {showActionModal === "balance" && (
        <ActionModal
          title="Adjust Balance"
          icon={CreditCard}
          iconColor="text-blue-400"
          onClose={() => setShowActionModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Currency</label>
              <select
                value={balanceAdjust.currency}
                onChange={(e) => setBalanceAdjust({ ...balanceAdjust, currency: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="bl_coins">BL Coins</option>
                <option value="usd">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Amount (use negative for debit)</label>
              <Input
                type="number"
                value={balanceAdjust.amount}
                onChange={(e) => setBalanceAdjust({ ...balanceAdjust, amount: e.target.value })}
                placeholder="e.g. 100 or -50"
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Reason (for audit log)</label>
              <Input
                value={balanceAdjust.reason}
                onChange={(e) => setBalanceAdjust({ ...balanceAdjust, reason: e.target.value })}
                placeholder="Enter reason..."
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBalanceAdjust} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Confirm Adjustment
              </Button>
              <Button variant="outline" onClick={() => setShowActionModal(null)} className="border-slate-600">
                Cancel
              </Button>
            </div>
          </div>
        </ActionModal>
      )}

      {showActionModal === "delete" && (
        <ActionModal
          title="Delete User Permanently"
          icon={Trash2}
          iconColor="text-red-400"
          onClose={() => setShowActionModal(null)}
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                <strong>WARNING:</strong> This action is IRREVERSIBLE. The user's account will be permanently deleted and cannot be recovered.
              </p>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-300">
                User: <span className="text-white font-medium">{data?.user?.name}</span>
              </p>
              <p className="text-sm text-slate-300">
                Email: <span className="text-white font-medium">{data?.user?.email}</span>
              </p>
              <p className="text-sm text-slate-300">
                BL Coins: <span className="text-amber-400 font-medium">{(data?.user?.bl_coins || 0).toLocaleString()}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Reason for deletion (required)</label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason for deletion..."
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDeleteUser} variant="destructive" className="flex-1" disabled={actionLoading}>
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete Permanently
              </Button>
              <Button variant="outline" onClick={() => setShowActionModal(null)} className="border-slate-600">
                Cancel
              </Button>
            </div>
          </div>
        </ActionModal>
      )}
    </div>
  );
}

// Helper Components
function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 border`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${colorClasses[color].split(' ').pop()}`} />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`text-white ${mono ? 'font-mono text-sm' : ''}`}>{value}</span>
    </div>
  );
}

function ActionModal({ title, icon: Icon, iconColor, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {title}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </Button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
