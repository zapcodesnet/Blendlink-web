import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import {
  Wallet, Search, RefreshCw, Check, X, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, Shield, User, DollarSign, Filter,
  CheckCircle, XCircle, Eye, CreditCard, Building
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

const getToken = () => localStorage.getItem("blendlink_token");

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
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
};

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    pending: { color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30", icon: Clock },
    approved: { color: "bg-blue-500/20 text-blue-500 border-blue-500/30", icon: Check },
    completed: { color: "bg-green-500/20 text-green-500 border-green-500/30", icon: CheckCircle },
    rejected: { color: "bg-red-500/20 text-red-500 border-red-500/30", icon: XCircle },
  };
  const { color, icon: Icon } = config[status] || config.pending;
  
  return (
    <Badge className={`${color} border`}>
      <Icon className="w-3 h-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

// Withdrawal detail modal
const WithdrawalDetailModal = ({ withdrawal, onClose, onAction }) => {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);
  const [notes, setNotes] = useState("");
  const [payoutRef, setPayoutRef] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  if (!withdrawal) return null;

  const handleAction = async (actionType) => {
    setLoading(true);
    try {
      let endpoint = `/admin/withdrawals/${withdrawal.withdrawal_id}/${actionType}`;
      let body = {};
      
      if (actionType === "approve") {
        body = { payout_reference: payoutRef, notes };
      } else if (actionType === "complete") {
        body = { payout_reference: payoutRef, payout_method_used: "manual", notes };
      } else if (actionType === "reject") {
        body = { reason: rejectReason || "Rejected by admin", refund_balance: true };
      }
      
      await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
      toast.success(`Withdrawal ${actionType}d successfully`);
      onAction();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Withdrawal Details
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Amount</p>
              <p className="text-2xl font-bold text-green-500">${withdrawal.amount_usd?.toFixed(2)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Fee</p>
              <p className="text-2xl font-bold">${withdrawal.fee_usd?.toFixed(2)}</p>
            </div>
          </div>
          
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={withdrawal.status} />
          </div>
          
          {/* User Info */}
          <div className="bg-muted/20 rounded-lg p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              User Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span>{withdrawal.user?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{withdrawal.user?.email || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">KYC Status</span>
                <Badge variant={withdrawal.user?.kyc_status === "verified" ? "default" : "outline"}>
                  {withdrawal.user?.kyc_status || "Not Started"}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Payout Method */}
          <div className="bg-muted/20 rounded-lg p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payout Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">{withdrawal.payout_method?.replace("_", " ")}</span>
              </div>
              {withdrawal.bank_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank</span>
                  <span>{withdrawal.bank_name}</span>
                </div>
              )}
              {withdrawal.account_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span>****{withdrawal.account_number.slice(-4)}</span>
                </div>
              )}
              {withdrawal.card_last_four && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card</span>
                  <span>****{withdrawal.card_last_four}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Dates */}
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requested</span>
              <span>{new Date(withdrawal.created_at).toLocaleString()}</span>
            </div>
            {withdrawal.approved_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved</span>
                <span>{new Date(withdrawal.approved_at).toLocaleString()}</span>
              </div>
            )}
            {withdrawal.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{new Date(withdrawal.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
          
          {/* Action Forms */}
          {withdrawal.status === "pending" && !action && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setAction("approve")}>
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setAction("complete")}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Now
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setAction("reject")}>
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
          
          {withdrawal.status === "approved" && !action && (
            <div className="flex gap-2">
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setAction("complete")}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Completed
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setAction("reject")}>
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
          
          {action === "approve" && (
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium">Approve Withdrawal</h4>
              <Input
                placeholder="Payout reference (optional)"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={() => handleAction("approve")} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Confirm Approve
                </Button>
                <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
              </div>
            </div>
          )}
          
          {action === "complete" && (
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium">Complete Withdrawal</h4>
              <Input
                placeholder="Payout reference (required)"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                required
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAction("complete")} disabled={loading || !payoutRef}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Confirm Complete
                </Button>
                <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
              </div>
            </div>
          )}
          
          {action === "reject" && (
            <div className="space-y-3 p-4 border border-red-500/30 rounded-lg">
              <h4 className="font-medium text-red-500">Reject Withdrawal</h4>
              <Input
                placeholder="Rejection reason (required)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Balance will be refunded to user
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => handleAction("reject")} disabled={loading || !rejectReason}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  Confirm Reject
                </Button>
                <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// KYC Panel
const KYCPanel = ({ onRefresh }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingKYC = async () => {
    try {
      const data = await apiRequest("/admin/withdrawals/kyc/pending");
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch KYC:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingKYC();
  }, []);

  const handleKYCAction = async (userId, action) => {
    try {
      await apiRequest(`/admin/withdrawals/kyc/${userId}/${action}`, { method: "POST" });
      toast.success(`KYC ${action}d successfully`);
      fetchPendingKYC();
      onRefresh();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="text-center py-4"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-blue-500" />
        Pending KYC Verifications ({users.length})
      </h3>
      
      {users.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No pending KYC verifications</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.user_id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div>
                <p className="font-medium">{user.name || user.username}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleKYCAction(user.user_id, "approve")}>
                  <Check className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleKYCAction(user.user_id, "reject")}>
                  <X className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main component
export default function AdminWithdrawals() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [stats, setStats] = useState(null);
  const [counts, setCounts] = useState({});
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, statsData] = await Promise.all([
        apiRequest(`/admin/withdrawals/list?status=${statusFilter}&skip=${page * limit}&limit=${limit}`),
        apiRequest("/admin/withdrawals/stats/summary"),
      ]);
      
      setWithdrawals(listData.withdrawals || []);
      setCounts(listData.counts || {});
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
      toast.error("Failed to load withdrawals. Make sure you're logged in as admin.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      w.user?.email?.toLowerCase().includes(query) ||
      w.user?.name?.toLowerCase().includes(query) ||
      w.withdrawal_id.toLowerCase().includes(query)
    );
  });

  const viewDetails = async (withdrawalId) => {
    try {
      const data = await apiRequest(`/admin/withdrawals/${withdrawalId}`);
      setSelectedWithdrawal(data);
    } catch (error) {
      toast.error("Failed to load withdrawal details");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              Withdrawal Management
            </h1>
            <p className="text-muted-foreground">Review and process user withdrawal requests</p>
          </div>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">Total Paid Out</p>
              <p className="text-2xl font-bold text-green-500">${stats.total_paid_out?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">Fees Collected</p>
              <p className="text-2xl font-bold">${stats.total_fees_collected?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
              <p className="text-2xl font-bold text-yellow-500">{counts.pending || 0}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">Pending KYC</p>
              <p className="text-2xl font-bold text-blue-500">{stats.pending_kyc_count || 0}</p>
            </div>
          </div>
        )}

        {/* KYC Panel */}
        <KYCPanel onRefresh={fetchData} />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            {["pending", "approved", "completed", "rejected"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(status); setPage(0); }}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {counts[status] > 0 && (
                  <span className="ml-1 bg-background/20 px-1.5 rounded-full text-xs">
                    {counts[status]}
                  </span>
                )}
              </Button>
            ))}
          </div>
          
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Withdrawals Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No withdrawals found
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((w) => (
                    <tr key={w.withdrawal_id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{w.user?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">{w.user?.email}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-green-500">${w.amount_usd?.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Fee: ${w.fee_usd?.toFixed(2)}</p>
                      </td>
                      <td className="p-3 capitalize">{w.payout_method?.replace("_", " ")}</td>
                      <td className="p-3"><StatusBadge status={w.status} /></td>
                      <td className="p-3 text-sm">{new Date(w.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => viewDetails(w.withdrawal_id)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, withdrawals.length + page * limit)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={withdrawals.length < limit} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Detail Modal */}
        <WithdrawalDetailModal
          withdrawal={selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
          onAction={fetchData}
        />
      </div>
    </AdminLayout>
  );
}
