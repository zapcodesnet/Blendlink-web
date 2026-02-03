import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import {
  Coins, Search, RefreshCw, User, AlertTriangle, CheckCircle,
  Plus, ArrowRight, Wallet, History, X, DollarSign, Gift,
  FileText, Clock, ChevronLeft, ChevronRight
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

const getToken = () => localStorage.getItem("blendlink_token");

// Safe API request helper
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

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.error("JSON parse error:", e);
  }

  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }

  return data;
};

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, amount, user, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Confirm Large Credit</h3>
            <p className="text-sm text-slate-400">This action cannot be easily undone</p>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Recipient:</span>
            <span className="text-white font-medium">{user?.name || user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Amount:</span>
            <span className="text-amber-400 font-bold text-xl">
              +{Number(amount).toLocaleString()} BL
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Current Balance:</span>
            <span className="text-white">{(user?.bl_coins || 0).toLocaleString()} BL</span>
          </div>
          <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
            <span className="text-slate-400">New Balance:</span>
            <span className="text-green-400 font-bold">
              {((user?.bl_coins || 0) + Number(amount)).toLocaleString()} BL
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-slate-600"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Confirm Credit
          </Button>
        </div>
      </div>
    </div>
  );
};

// User Search Result Item
const UserSearchItem = ({ user, onSelect, selected }) => (
  <div
    onClick={() => onSelect(user)}
    className={`p-3 rounded-lg cursor-pointer transition-all ${
      selected
        ? "bg-blue-600/20 border border-blue-500/50"
        : "bg-slate-700/50 hover:bg-slate-700 border border-transparent"
    }`}
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{user.name || "Unknown"}</p>
        <p className="text-sm text-slate-400 truncate">{user.email}</p>
      </div>
      <div className="text-right">
        <p className="text-amber-400 font-medium">{(user.bl_coins || 0).toLocaleString()}</p>
        <p className="text-xs text-slate-500">BL Coins</p>
      </div>
    </div>
  </div>
);

// Transaction History Item
const TransactionItem = ({ txn }) => (
  <div className="p-3 bg-slate-700/30 rounded-lg flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          txn.amount > 0 ? "bg-green-500/20" : "bg-red-500/20"
        }`}
      >
        {txn.amount > 0 ? (
          <Plus className="w-4 h-4 text-green-400" />
        ) : (
          <ArrowRight className="w-4 h-4 text-red-400" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-white">
          {txn.details?.reason || txn.transaction_type?.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-slate-500">
          {txn.details?.adjusted_by ? `by ${txn.details.adjusted_by}` : ""}
          {txn.created_at ? ` • ${new Date(txn.created_at).toLocaleString()}` : ""}
        </p>
      </div>
    </div>
    <div className="text-right">
      <p className={`font-bold ${txn.amount > 0 ? "text-green-400" : "text-red-400"}`}>
        {txn.amount > 0 ? "+" : ""}
        {Number(txn.amount).toLocaleString()} BL
      </p>
      <p className="text-xs text-slate-500">
        Balance: {Number(txn.balance_after || 0).toLocaleString()}
      </p>
    </div>
  </div>
);

export default function AdminWalletManagement() {
  // User search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Credit form state
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const LARGE_AMOUNT_THRESHOLD = 10000;

  // Transaction history
  const [recentCredits, setRecentCredits] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Search users
  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await adminAPI.searchUsers({ query: searchQuery, limit: 10 });
      setSearchResults(data.users || []);
    } catch (error) {
      toast.error("Search failed: " + error.message);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Load recent admin credits
  const loadRecentCredits = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // Fetch recent admin adjustment transactions
      const data = await apiRequest("/admin/finance/recent-adjustments?limit=20&type=admin_adjustment");
      setRecentCredits(data.transactions || []);
    } catch (error) {
      console.log("Could not load recent credits:", error.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadRecentCredits();
  }, [loadRecentCredits]);

  // Handle user selection
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setSearchQuery("");
    setSearchResults([]);

    // Fetch fresh user data
    try {
      const userData = await adminAPI.getUser(user.user_id);
      setSelectedUser(userData.user);
    } catch (error) {
      console.log("Could not refresh user data");
    }
  };

  // Handle credit submission
  const handleSubmitCredit = async () => {
    if (!selectedUser) {
      toast.error("Please select a user first");
      return;
    }

    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (!creditReason.trim()) {
      toast.error("Please provide a reason for this credit");
      return;
    }

    // Show confirmation for large amounts
    if (amount >= LARGE_AMOUNT_THRESHOLD && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminAPI.adjustBalance(
        selectedUser.user_id,
        "bl_coins",
        amount,
        creditReason
      );

      toast.success(
        `Successfully credited ${amount.toLocaleString()} BL Coins to ${selectedUser.name || selectedUser.email}`
      );

      // Update selected user with new balance
      setSelectedUser({
        ...selectedUser,
        bl_coins: result.balance_after,
      });

      // Reset form
      setCreditAmount("");
      setCreditReason("");
      setShowConfirm(false);

      // Refresh history
      loadRecentCredits();
    } catch (error) {
      toast.error("Failed to credit: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [100, 1000, 10000, 100000, 1000000, 1000000000];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="w-8 h-8 text-amber-400" />
            Manual BL Coins Credit
          </h1>
          <p className="text-slate-400 mt-1">
            Add BL Coins to any user's wallet with full audit trail
          </p>
        </div>
        <Button
          onClick={loadRecentCredits}
          variant="outline"
          className="border-slate-600"
          disabled={loadingHistory}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingHistory ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credit Form Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-green-400" />
            Credit BL Coins
          </h2>

          {/* User Search */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Search User (by email, name, username, or ID)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search users..."
                  className="pl-10 bg-slate-700 border-slate-600"
                  data-testid="user-search-input"
                />
                {searching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto space-y-2 bg-slate-900/50 rounded-lg p-2">
                  {searchResults.map((user) => (
                    <UserSearchItem
                      key={user.user_id}
                      user={user}
                      onSelect={handleSelectUser}
                      selected={selectedUser?.user_id === user.user_id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Selected User Display */}
            {selectedUser && (
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">Selected User</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="text-slate-400 hover:text-white h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
                    {selectedUser.avatar ? (
                      <img
                        src={selectedUser.avatar}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{selectedUser.name || "Unknown"}</p>
                    <p className="text-sm text-slate-400">{selectedUser.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold text-xl">
                      {(selectedUser.bl_coins || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">Current Balance</p>
                  </div>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Amount to Credit (BL Coins)
              </label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount..."
                min={1}
                className="bg-slate-700 border-slate-600 text-lg"
                data-testid="credit-amount-input"
              />
              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setCreditAmount(amt.toString())}
                    className="border-slate-600 text-xs"
                  >
                    +{amt >= 1000000000 ? `${amt / 1000000000}B` : amt >= 1000000 ? `${amt / 1000000}M` : amt >= 1000 ? `${amt / 1000}K` : amt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Reason / Note (for audit log)
              </label>
              <textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g., Event reward, Compensation, Promotional bonus..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white min-h-[80px] resize-none"
                data-testid="credit-reason-input"
              />
            </div>

            {/* Preview */}
            {selectedUser && creditAmount && parseFloat(creditAmount) > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Preview</span>
                </div>
                <div className="text-sm text-slate-300">
                  <span className="text-white font-medium">{selectedUser.name || selectedUser.email}</span>
                  {" will receive "}
                  <span className="text-amber-400 font-bold">
                    +{parseFloat(creditAmount).toLocaleString()} BL Coins
                  </span>
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  New balance:{" "}
                  <span className="text-green-400 font-medium">
                    {((selectedUser.bl_coins || 0) + parseFloat(creditAmount)).toLocaleString()} BL
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmitCredit}
              disabled={!selectedUser || !creditAmount || !creditReason || submitting}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
              data-testid="submit-credit-btn"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add BL Coins
                </>
              )}
            </Button>

            {/* Warning for large amounts */}
            {creditAmount && parseFloat(creditAmount) >= LARGE_AMOUNT_THRESHOLD && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Large amount detected. You'll need to confirm this action.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Credits History */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Recent Admin Credits
          </h2>

          {loadingHistory ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : recentCredits.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No recent admin credits</p>
              <p className="text-sm text-slate-500">Credits made here will appear in this list</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentCredits.map((txn, i) => (
                <TransactionItem key={txn.transaction_id || i} txn={txn} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmitCredit}
        amount={creditAmount}
        user={selectedUser}
        loading={submitting}
      />
    </div>
  );
}
