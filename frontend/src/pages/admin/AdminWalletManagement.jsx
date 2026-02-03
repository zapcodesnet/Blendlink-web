import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import {
  Coins, Search, RefreshCw, User, AlertTriangle, CheckCircle,
  Plus, Minus, Wallet, History, X, Gift, FileText
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const getToken = () => localStorage.getItem("blendlink_token");

// Robust API request helper with detailed logging
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const url = `${API_BASE}/api${endpoint}`;
  
  console.log(`[WalletAPI] Request: ${url}`);
  
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      cache: 'no-store',
    });
    console.log(`[WalletAPI] Status: ${response.status}`);
  } catch (networkError) {
    console.error("[WalletAPI] Network error:", networkError);
    throw new Error(`Network error: ${networkError.message}`);
  }

  // Handle empty responses
  if (response.status === 204) {
    return {};
  }
  
  let rawText = "";
  try {
    rawText = await response.text();
  } catch (readError) {
    console.error("[WalletAPI] Read error:", readError);
    if (response.ok) return {};
    throw new Error(`Server error (${response.status})`);
  }

  let data = {};
  if (rawText && rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[WalletAPI] Parse error:", parseError);
      if (!response.ok) {
        throw new Error(rawText.substring(0, 200) || `Error ${response.status}`);
      }
      return {};
    }
  }

  if (!response.ok) {
    const errorMsg = data?.detail?.message || data?.detail || data?.message || `Error ${response.status}`;
    throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
  }

  return data;
};

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, amount, user, loading, isDeduction }) => {
  if (!isOpen) return null;

  const absAmount = Math.abs(amount);
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isDeduction ? 'bg-red-500/20' : 'bg-amber-500/20'
          }`}>
            <AlertTriangle className={`w-6 h-6 ${isDeduction ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Confirm {isDeduction ? 'Deduction' : 'Large Credit'}
            </h3>
            <p className="text-sm text-slate-400">This action cannot be easily undone</p>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Recipient:</span>
            <span className="text-white font-medium">{user?.name || user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Action:</span>
            <span className={`font-bold text-xl ${isDeduction ? 'text-red-400' : 'text-green-400'}`}>
              {isDeduction ? '-' : '+'}{absAmount.toLocaleString()} BL
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Current Balance:</span>
            <span className="text-white">{(user?.bl_coins || 0).toLocaleString()} BL</span>
          </div>
          <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
            <span className="text-slate-400">New Balance:</span>
            <span className={`font-bold ${isDeduction ? 'text-red-400' : 'text-green-400'}`}>
              {((user?.bl_coins || 0) + (isDeduction ? -absAmount : absAmount)).toLocaleString()} BL
            </span>
          </div>
        </div>

        {isDeduction && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warning: You are about to REMOVE coins from this user's balance.
            </p>
          </div>
        )}

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
            className={`flex-1 ${isDeduction ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Confirm {isDeduction ? 'Deduction' : 'Credit'}
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
    data-testid={`user-result-${user.user_id}`}
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
        {user.avatar || user.profile_picture ? (
          <img src={user.avatar || user.profile_picture} alt="" className="w-full h-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{user.name || user.username || "Unknown"}</p>
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
          <Minus className="w-4 h-4 text-red-400" />
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
  const [searchError, setSearchError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [actionType, setActionType] = useState("credit"); // "credit" or "deduct"
  const [submitting, setSubmitting] = useState(false);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const LARGE_CREDIT_THRESHOLD = 10000;

  // Transaction history
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Search users with robust error handling
  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    
    try {
      console.log("[Search] Starting search for:", searchQuery);
      const data = await adminAPI.searchUsers({ query: searchQuery, limit: 15 });
      console.log("[Search] Results:", data);
      
      const users = data.users || data || [];
      setSearchResults(Array.isArray(users) ? users : []);
      
      if (Array.isArray(users) && users.length === 0) {
        setSearchError("No users found matching your search");
      }
    } catch (error) {
      console.error("[Search] Error:", error);
      setSearchError(error.message || "Search failed");
      setSearchResults([]);
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
      } else {
        setSearchResults([]);
        setSearchError(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Load recent transactions
  const loadRecentTransactions = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await apiRequest("/admin/finance/recent-adjustments?limit=25");
      setRecentTransactions(data.transactions || []);
    } catch (error) {
      console.log("Could not load recent transactions:", error.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadRecentTransactions();
  }, [loadRecentTransactions]);

  // Handle user selection
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);

    // Fetch fresh user data
    try {
      const userData = await adminAPI.getUser(user.user_id);
      if (userData.user) {
        setSelectedUser(userData.user);
      }
    } catch (error) {
      console.log("Could not refresh user data:", error.message);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error("Please select a user first");
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for this adjustment");
      return;
    }

    const isDeduction = actionType === "deduct";
    const finalAmount = isDeduction ? -Math.abs(numAmount) : Math.abs(numAmount);

    // Check if deduction would result in negative balance
    if (isDeduction && (selectedUser.bl_coins || 0) < Math.abs(numAmount)) {
      toast.error("Cannot deduct more than user's current balance");
      return;
    }

    // Show confirmation for deductions or large credits
    if ((isDeduction || numAmount >= LARGE_CREDIT_THRESHOLD) && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminAPI.adjustBalance(
        selectedUser.user_id,
        "bl_coins",
        finalAmount,
        reason
      );

      const actionWord = isDeduction ? "deducted" : "credited";
      toast.success(
        `Successfully ${actionWord} ${Math.abs(numAmount).toLocaleString()} BL Coins ${isDeduction ? 'from' : 'to'} ${selectedUser.name || selectedUser.email}`
      );

      // Update selected user with new balance
      setSelectedUser({
        ...selectedUser,
        bl_coins: result.balance_after,
      });

      // Reset form
      setAmount("");
      setReason("");
      setShowConfirm(false);

      // Refresh history
      loadRecentTransactions();
    } catch (error) {
      toast.error("Failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 5000, 10000, 100000];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="w-8 h-8 text-amber-400" />
            BL Coins Management
          </h1>
          <p className="text-slate-400 mt-1">
            Add or remove BL Coins from any user&apos;s wallet
          </p>
        </div>
        <Button
          onClick={loadRecentTransactions}
          variant="outline"
          className="border-slate-600"
          disabled={loadingHistory}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingHistory ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adjustment Form Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            Adjust User Balance
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
                  placeholder="Type at least 2 characters to search..."
                  className="pl-10 bg-slate-700 border-slate-600"
                  data-testid="user-search-input"
                />
                {searching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto space-y-2 bg-slate-900/50 rounded-lg p-2">
                  {searchResults.map((user) => (
                    <UserSearchItem
                      key={user.user_id || user._id}
                      user={user}
                      onSelect={handleSelectUser}
                      selected={selectedUser?.user_id === user.user_id}
                    />
                  ))}
                </div>
              )}

              {/* Search Error/Empty State */}
              {searchError && !searching && searchQuery.length >= 2 && (
                <div className="mt-2 p-3 bg-slate-700/50 rounded-lg text-center">
                  <p className="text-slate-400 text-sm">{searchError}</p>
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
                    {selectedUser.avatar || selectedUser.profile_picture ? (
                      <img
                        src={selectedUser.avatar || selectedUser.profile_picture}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{selectedUser.name || selectedUser.username || "Unknown"}</p>
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

            {/* Action Type Toggle */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">Action Type</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setActionType("credit")}
                  className={`flex-1 ${
                    actionType === "credit"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  }`}
                  data-testid="action-credit-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add / Credit
                </Button>
                <Button
                  type="button"
                  onClick={() => setActionType("deduct")}
                  className={`flex-1 ${
                    actionType === "deduct"
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  }`}
                  data-testid="action-deduct-btn"
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Remove / Deduct
                </Button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Amount (BL Coins)
              </label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount..."
                min={1}
                className="bg-slate-700 border-slate-600 text-lg"
                data-testid="amount-input"
              />
              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(amt.toString())}
                    className="border-slate-600 text-xs"
                  >
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Reason / Note (required for audit log)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Event reward, Compensation, Promotional bonus, Refund..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white min-h-[80px] resize-none"
                data-testid="reason-input"
              />
            </div>

            {/* Preview */}
            {selectedUser && amount && parseFloat(amount) > 0 && (
              <div className={`border rounded-lg p-3 ${
                actionType === "deduct" 
                  ? "bg-red-500/10 border-red-500/30" 
                  : "bg-green-500/10 border-green-500/30"
              }`}>
                <div className={`flex items-center gap-2 mb-2 ${
                  actionType === "deduct" ? "text-red-400" : "text-green-400"
                }`}>
                  {actionType === "deduct" ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span className="text-sm font-medium">Preview</span>
                </div>
                <div className="text-sm text-slate-300">
                  <span className="text-white font-medium">{selectedUser.name || selectedUser.email}</span>
                  {actionType === "deduct" ? " will lose " : " will receive "}
                  <span className={`font-bold ${actionType === "deduct" ? "text-red-400" : "text-green-400"}`}>
                    {actionType === "deduct" ? "-" : "+"}{parseFloat(amount).toLocaleString()} BL Coins
                  </span>
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  New balance:{" "}
                  <span className={`font-medium ${actionType === "deduct" ? "text-red-400" : "text-green-400"}`}>
                    {(
                      (selectedUser.bl_coins || 0) + 
                      (actionType === "deduct" ? -parseFloat(amount) : parseFloat(amount))
                    ).toLocaleString()} BL
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!selectedUser || !amount || !reason || submitting}
              className={`w-full font-semibold ${
                actionType === "deduct"
                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              } text-white`}
              data-testid="submit-btn"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : actionType === "deduct" ? (
                <>
                  <Minus className="w-4 h-4 mr-2" />
                  Deduct BL Coins
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add BL Coins
                </>
              )}
            </Button>

            {/* Deduction Warning */}
            {actionType === "deduct" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Deductions require confirmation and are logged for audit purposes.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions History */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Recent Admin Adjustments
          </h2>

          {loadingHistory ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No recent adjustments</p>
              <p className="text-sm text-slate-500">Adjustments made here will appear in this list</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentTransactions.map((txn, i) => (
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
        onConfirm={handleSubmit}
        amount={parseFloat(amount) || 0}
        user={selectedUser}
        loading={submitting}
        isDeduction={actionType === "deduct"}
      />
    </div>
  );
}
