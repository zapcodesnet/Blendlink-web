import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  Activity, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, Coins,
  Flag, Eye, User, Calendar, Download, TrendingUp, TrendingDown,
  Shield, Ban, X
} from "lucide-react";

const API_BASE = getApiUrl();

const TRANSACTION_TYPES = [
  { value: "", label: "All Types" },
  { value: "subscription", label: "Subscription" },
  { value: "top_up", label: "Top Up" },
  { value: "commission", label: "Commission" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "game", label: "Game" },
  { value: "purchase", label: "Purchase" },
  { value: "sale", label: "Sale" }
];

const STATUS_TYPES = [
  { value: "", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "held", label: "Held" }
];

const SEVERITY_COLORS = {
  low: "bg-blue-500/20 text-blue-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400"
};

export default function AdminTransactionMonitor() {
  const [transactions, setTransactions] = useState([]);
  const [flaggedTransactions, setFlaggedTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // all, flagged
  const [filters, setFilters] = useState({
    transaction_type: "",
    status: "",
    min_amount: "",
    max_amount: "",
    user_id: "",
    flagged_only: false
  });
  const [pagination, setPagination] = useState({ skip: 0, limit: 50, total: 0 });
  const [flagModal, setFlagModal] = useState({ show: false, transaction: null });
  const [flagForm, setFlagForm] = useState({ reason: "", severity: "medium" });
  const [saving, setSaving] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const params = new URLSearchParams({
        skip: pagination.skip.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.transaction_type) params.append("transaction_type", filters.transaction_type);
      if (filters.status) params.append("status", filters.status);
      if (filters.min_amount) params.append("min_amount", filters.min_amount);
      if (filters.max_amount) params.append("max_amount", filters.max_amount);
      if (filters.user_id) params.append("user_id", filters.user_id);
      if (filters.flagged_only) params.append("flagged_only", "true");

      const response = await fetch(
        `${API_BASE}/api/admin/membership/transactions?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      setTransactions(data.transactions || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      toast.error("Failed to load transactions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.skip, pagination.limit, filters]);

  const fetchFlaggedTransactions = useCallback(async () => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(
        `${API_BASE}/api/admin/membership/transactions/flagged?status=pending_review`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Failed to fetch flagged transactions");

      const data = await response.json();
      setFlaggedTransactions(data.flagged_transactions || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchFlaggedTransactions();
  }, [fetchTransactions, fetchFlaggedTransactions]);

  const handleFlag = async () => {
    if (!flagForm.reason) {
      toast.error("Please provide a reason for flagging");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/transactions/flag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transaction_id: flagModal.transaction.transaction_id || flagModal.transaction.commission_id,
          reason: flagForm.reason,
          severity: flagForm.severity
        })
      });

      if (!response.ok) throw new Error("Failed to flag transaction");

      toast.success("Transaction flagged successfully");
      setFlagModal({ show: false, transaction: null });
      setFlagForm({ reason: "", severity: "medium" });
      fetchTransactions();
      fetchFlaggedTransactions();
    } catch (error) {
      toast.error("Failed to flag transaction");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (transactionId, resolution) => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(
        `${API_BASE}/api/admin/membership/transactions/flag/${transactionId}/resolve?resolution=${resolution}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error("Failed to resolve transaction");

      toast.success(`Transaction marked as ${resolution}`);
      fetchFlaggedTransactions();
      fetchTransactions();
    } catch (error) {
      toast.error("Failed to resolve transaction");
      console.error(error);
    }
  };

  const formatAmount = (txn) => {
    if (txn.amount_usd !== undefined) {
      return `$${txn.amount_usd.toFixed(2)}`;
    }
    if (txn.amount !== undefined) {
      if (txn.source === "bl_transactions") {
        return `${txn.amount.toLocaleString()} BL`;
      }
      return `$${txn.amount.toFixed(2)}`;
    }
    return "—";
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: { color: "bg-green-500/20 text-green-400", icon: CheckCircle },
      pending: { color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
      failed: { color: "bg-red-500/20 text-red-400", icon: XCircle },
      held: { color: "bg-orange-500/20 text-orange-400", icon: Ban }
    };
    const config = badges[status] || badges.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Transaction Monitor</h2>
          <p className="text-slate-400 mt-1">
            Monitor, filter, and flag suspicious transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {flaggedTransactions.length > 0 && (
            <Badge className="bg-red-500/20 text-red-400 px-3 py-1">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {flaggedTransactions.length} Pending Review
            </Badge>
          )}
          <Button onClick={() => { fetchTransactions(); fetchFlaggedTransactions(); }} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Activity className="w-4 h-4 inline-block mr-2" />
          All Transactions
        </button>
        <button
          onClick={() => setActiveTab("flagged")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "flagged"
              ? "border-red-500 text-red-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Flag className="w-4 h-4 inline-block mr-2" />
          Flagged ({flaggedTransactions.length})
        </button>
      </div>

      {activeTab === "all" ? (
        <>
          {/* Filters */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <select
                value={filters.transaction_type}
                onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })}
                className="h-10 bg-slate-700 border border-slate-600 rounded-md px-3 text-white text-sm"
              >
                {TRANSACTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="h-10 bg-slate-700 border border-slate-600 rounded-md px-3 text-white text-sm"
              >
                {STATUS_TYPES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <Input
                placeholder="Min Amount"
                type="number"
                value={filters.min_amount}
                onChange={(e) => setFilters({ ...filters, min_amount: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
              <Input
                placeholder="Max Amount"
                type="number"
                value={filters.max_amount}
                onChange={(e) => setFilters({ ...filters, max_amount: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
              <Input
                placeholder="User ID"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 text-slate-400 text-sm">
                <input
                  type="checkbox"
                  checked={filters.flagged_only}
                  onChange={(e) => setFilters({ ...filters, flagged_only: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Show flagged only
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({
                    transaction_type: "",
                    status: "",
                    min_amount: "",
                    max_amount: "",
                    user_id: "",
                    flagged_only: false
                  });
                  setPagination(prev => ({ ...prev, skip: 0 }));
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-semibold text-white mb-2">No Transactions Found</h3>
                <p className="text-slate-400">Adjust your filters or check back later</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {transactions.map((txn, idx) => (
                        <tr key={idx} className={`hover:bg-slate-700/30 ${txn.is_flagged ? "bg-red-500/5" : ""}`}>
                          <td className="px-4 py-3">
                            <p className="text-white font-mono text-sm">
                              {(txn.transaction_id || txn.commission_id || "—").slice(0, 12)}...
                            </p>
                            <p className="text-xs text-slate-500">{txn.source}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-slate-300">
                              {txn.transaction_type || txn.type || txn.level || "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white text-sm">{(txn.user_id || txn.beneficiary_id || "—").slice(0, 10)}...</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{formatAmount(txn)}</p>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(txn.status || "completed")}
                            {txn.is_flagged && (
                              <Badge className={`ml-2 ${SEVERITY_COLORS[txn.flag_severity || "medium"]}`}>
                                <Flag className="w-3 h-3 mr-1" />
                                Flagged
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-sm">
                            {txn.created_at ? new Date(txn.created_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {!txn.is_flagged && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setFlagModal({ show: true, transaction: txn })}
                                  className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10"
                                >
                                  <Flag className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Showing {pagination.skip + 1} - {Math.min(pagination.skip + pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, skip: Math.max(0, prev.skip - prev.limit) }))}
                      disabled={pagination.skip === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }))}
                      disabled={pagination.skip + pagination.limit >= pagination.total}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Flagged Transactions Tab */
        <div className="space-y-4">
          {flaggedTransactions.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
              <p className="text-slate-400">No flagged transactions pending review</p>
            </div>
          ) : (
            flaggedTransactions.map((flag, idx) => (
              <div key={idx} className="bg-slate-800 rounded-xl border border-red-500/30 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={SEVERITY_COLORS[flag.severity]}>
                        {flag.severity.toUpperCase()}
                      </Badge>
                      <span className="text-white font-mono">{flag.transaction_id}</span>
                    </div>
                    <p className="text-slate-300 mb-2">{flag.reason}</p>
                    <p className="text-sm text-slate-500">
                      Flagged by {flag.flagged_by} on {new Date(flag.flagged_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolve(flag.transaction_id, "false_positive")}
                      className="text-blue-400 border-blue-400/50"
                    >
                      False Positive
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolve(flag.transaction_id, "resolved")}
                      className="text-green-400 border-green-400/50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleResolve(flag.transaction_id, "action_taken")}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Action Taken
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Flag Modal */}
      {flagModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-yellow-400" />
                Flag Transaction
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Severity</label>
                <select
                  value={flagForm.severity}
                  onChange={(e) => setFlagForm({ ...flagForm, severity: e.target.value })}
                  className="w-full h-10 bg-slate-700 border border-slate-600 rounded-md px-3 text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Reason</label>
                <textarea
                  value={flagForm.reason}
                  onChange={(e) => setFlagForm({ ...flagForm, reason: e.target.value })}
                  className="w-full h-24 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white resize-none"
                  placeholder="Describe why this transaction is suspicious..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setFlagModal({ show: false, transaction: null });
                  setFlagForm({ reason: "", severity: "medium" });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFlag}
                disabled={saving || !flagForm.reason}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
                Flag Transaction
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
