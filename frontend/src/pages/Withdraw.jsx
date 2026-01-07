import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { 
  ArrowLeft, Wallet, DollarSign, CreditCard, Building2,
  ShieldCheck, AlertCircle, CheckCircle2, Clock, ExternalLink
} from "lucide-react";
import { withdrawalsAPI } from "../services/referralApi";

export default function WithdrawPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [startingVerification, setStartingVerification] = useState(false);
  
  const [form, setForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    bank_name: '',
    account_number: '',
    routing_number: '',
    paypal_email: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eligibilityData, verificationData] = await Promise.all([
        withdrawalsAPI.checkEligibility(),
        withdrawalsAPI.getIDVerificationStatus()
      ]);
      setEligibility(eligibilityData);
      setVerificationStatus(verificationData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async () => {
    setStartingVerification(true);
    try {
      const result = await withdrawalsAPI.startIDVerification();
      if (result.url) {
        window.open(result.url, '_blank');
        toast.success("Verification started! Complete the process in the new window.");
      }
    } catch (error) {
      toast.error(error.message || "Failed to start verification");
    } finally {
      setStartingVerification(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(form.amount);
    if (!amount || amount < 10) {
      toast.error("Minimum withdrawal is $10");
      return;
    }
    
    if (amount > eligibility?.available_balance) {
      toast.error("Insufficient balance");
      return;
    }

    const paymentDetails = form.payment_method === 'bank_transfer' 
      ? {
          bank_name: form.bank_name,
          account_number: form.account_number,
          routing_number: form.routing_number,
        }
      : form.payment_method === 'paypal'
      ? { paypal_email: form.paypal_email }
      : {};

    setWithdrawing(true);
    try {
      const result = await withdrawalsAPI.request(amount, form.payment_method, paymentDetails);
      toast.success(`Withdrawal requested! Net amount: $${result.net_amount.toFixed(2)}`);
      navigate('/withdraw/history');
    } catch (error) {
      toast.error(error.message || "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const fee = form.amount ? parseFloat(form.amount) * 0.01 : 0;
  const netAmount = form.amount ? parseFloat(form.amount) - fee : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">Withdraw Earnings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-2xl p-6 border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold text-green-600">
                ${eligibility?.available_balance?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
          {eligibility?.pending_earnings > 0 && (
            <p className="text-sm text-muted-foreground">
              + ${eligibility.pending_earnings.toFixed(2)} pending
            </p>
          )}
        </div>

        {/* ID Verification Status */}
        {!verificationStatus?.verified ? (
          <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  ID Verification Required
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  To withdraw your earnings, you need to verify your identity with a 
                  government-issued ID. This is a one-time process.
                </p>
                <Button 
                  onClick={startVerification}
                  disabled={startingVerification}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {startingVerification ? (
                    "Starting..."
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Verify My Identity
                    </>
                  )}
                </Button>
                {verificationStatus?.status === 'pending' && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Verification in progress...
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-500/10 rounded-2xl p-4 border border-green-500/20 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                Identity Verified
              </p>
              <p className="text-sm text-muted-foreground">
                You can withdraw your earnings
              </p>
            </div>
          </div>
        )}

        {/* Withdrawal Form */}
        {verificationStatus?.verified && (
          <form onSubmit={handleWithdraw} className="space-y-6">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold">Withdrawal Details</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Amount */}
                <div className="space-y-2">
                  <Label>Amount to Withdraw</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="number"
                      min="10"
                      step="0.01"
                      max={eligibility?.available_balance || 0}
                      className="pl-10 text-lg"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum: $10 • Maximum: ${eligibility?.available_balance?.toFixed(2)}
                  </p>
                </div>

                {/* Fee Breakdown */}
                {form.amount && parseFloat(form.amount) >= 10 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Amount</span>
                      <span>${parseFloat(form.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Processing Fee (1%)</span>
                      <span>-${fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t border-border">
                      <span>You'll Receive</span>
                      <span className="text-green-600">${netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, payment_method: 'bank_transfer' })}
                      className={`p-4 rounded-xl border flex items-center gap-3 ${
                        form.payment_method === 'bank_transfer'
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Bank Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, payment_method: 'paypal' })}
                      className={`p-4 rounded-xl border flex items-center gap-3 ${
                        form.payment_method === 'paypal'
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="text-sm font-medium">PayPal</span>
                    </button>
                  </div>
                </div>

                {/* Bank Details */}
                {form.payment_method === 'bank_transfer' && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input
                        placeholder="Chase, Bank of America, etc."
                        value={form.bank_name}
                        onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <Input
                          placeholder="123456789"
                          value={form.account_number}
                          onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Routing Number</Label>
                        <Input
                          placeholder="021000021"
                          value={form.routing_number}
                          onChange={(e) => setForm({ ...form, routing_number: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* PayPal Details */}
                {form.payment_method === 'paypal' && (
                  <div className="space-y-2 pt-2">
                    <Label>PayPal Email</Label>
                    <Input
                      type="email"
                      placeholder="your@paypal.com"
                      value={form.paypal_email}
                      onChange={(e) => setForm({ ...form, paypal_email: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            <Button 
              type="submit"
              className="w-full"
              size="lg"
              disabled={
                withdrawing || 
                !form.amount || 
                parseFloat(form.amount) < 10 ||
                parseFloat(form.amount) > (eligibility?.available_balance || 0)
              }
            >
              {withdrawing ? (
                "Processing..."
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Withdraw ${netAmount.toFixed(2)}
                </>
              )}
            </Button>
          </form>
        )}

        {/* Withdrawal History Link */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/withdraw/history')}
        >
          View Withdrawal History
        </Button>
      </main>
    </div>
  );
}
