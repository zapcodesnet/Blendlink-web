import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  ArrowLeft, Users, DollarSign, TrendingUp, Shield,
  Clock, CheckCircle2, XCircle, RefreshCw, Settings,
  Crown, BarChart3, AlertTriangle
} from "lucide-react";
import { adminAPI } from "../services/referralApi";

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    if (!user?.is_admin) {
      toast.error("Admin access required");
      navigate('/');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardData, withdrawalsData, analyticsData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getPendingWithdrawals(),
        adminAPI.getAnalytics()
      ]);
      setDashboard(dashboardData);
      setPendingWithdrawals(withdrawalsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Failed to load admin data:", error);
      toast.error("Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    setProcessing({ ...processing, [withdrawalId]: 'approving' });
    try {
      await adminAPI.approveWithdrawal(withdrawalId);
      toast.success("Withdrawal approved!");
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to approve");
    } finally {
      setProcessing({ ...processing, [withdrawalId]: null });
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    setProcessing({ ...processing, [withdrawalId]: 'rejecting' });
    try {
      await adminAPI.rejectWithdrawal(withdrawalId, reason);
      toast.success("Withdrawal rejected");
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to reject");
    } finally {
      setProcessing({ ...processing, [withdrawalId]: null });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={loadData}>
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Users</span>
            </div>
            <p className="text-2xl font-bold">{dashboard?.total_users || 0}</p>
          </div>
          
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Commissions Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              ${dashboard?.total_commissions_paid?.toFixed(2) || '0.00'}
            </p>
          </div>
          
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Platform Revenue</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              ${dashboard?.platform_earnings?.toFixed(2) || '0.00'}
            </p>
          </div>
          
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Diamond Leaders</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {dashboard?.diamond_leaders || 0}
            </p>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Pending Withdrawals
              {dashboard?.pending_withdrawals > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                  {dashboard.pending_withdrawals}
                </span>
              )}
            </h3>
          </div>
          
          <div className="divide-y divide-border">
            {pendingWithdrawals.length > 0 ? (
              pendingWithdrawals.map((withdrawal) => (
                <div key={withdrawal.withdrawal_id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{withdrawal.user?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {withdrawal.user?.email}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="capitalize">{withdrawal.payment_method.replace('_', ' ')}</span>
                        {' • '}
                        {new Date(withdrawal.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">${withdrawal.amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        Fee: ${withdrawal.fee.toFixed(2)} • Net: ${withdrawal.net_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="bg-green-500 hover:bg-green-600"
                      onClick={() => handleApproveWithdrawal(withdrawal.withdrawal_id)}
                      disabled={processing[withdrawal.withdrawal_id]}
                    >
                      {processing[withdrawal.withdrawal_id] === 'approving' ? (
                        "Processing..."
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-500 hover:bg-red-500/10"
                      onClick={() => handleRejectWithdrawal(withdrawal.withdrawal_id)}
                      disabled={processing[withdrawal.withdrawal_id]}
                    >
                      {processing[withdrawal.withdrawal_id] === 'rejecting' ? (
                        "Processing..."
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No pending withdrawals</p>
              </div>
            )}
          </div>
        </div>

        {/* Analytics */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              30-Day Analytics
            </h3>
          </div>
          <div className="p-4 grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-3xl font-bold text-blue-500">{analytics?.users?.new_30d || 0}</p>
              <p className="text-sm text-muted-foreground">New Users</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-3xl font-bold text-green-500">
                ${analytics?.sales?.volume_30d?.toFixed(0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Sales Volume</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-3xl font-bold text-purple-500">
                ${analytics?.commissions?.total_30d?.toFixed(0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Commissions</p>
            </div>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recent Users
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
              View All
            </Button>
          </div>
          <div className="divide-y divide-border">
            {dashboard?.recent_users?.slice(0, 5).map((user) => (
              <div key={user.user_id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                  {user.is_admin && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/admin/users')}
          >
            <Users className="w-6 h-6" />
            <span>Manage Users</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/admin/settings')}
          >
            <Settings className="w-6 h-6" />
            <span>Platform Settings</span>
          </Button>
        </div>
      </main>
    </div>
  );
}
