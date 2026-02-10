/**
 * Platform Fees Manager Component
 * Shows 8% platform fees owed and history for page owners
 */
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { safeFetch } from "../../services/memberPagesApi";
import {
  DollarSign, TrendingUp, Clock, CreditCard, Banknote, Info,
  AlertTriangle, ChevronDown, ChevronUp, Calendar
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PlatformFeesManager({ pageId, currencySymbol = "$" }) {
  const [feesData, setFeesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadFeesData();
  }, [pageId]);

  const loadFeesData = async () => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const data = await safeFetch(`${API_URL}/api/member-pages/${pageId}/fees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeesData(data);
    } catch (err) {
      console.error("Failed to load fees data:", err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-white/50 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-12 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!feesData) {
    return null;
  }

  const symbol = feesData.currency_symbol || currencySymbol;
  const hasOwedFees = feesData.fees_owed > 0;

  return (
    <div className="space-y-4" data-testid="platform-fees-manager">
      {/* Fees Summary Card */}
      <div className={`rounded-2xl p-5 border ${
        hasOwedFees 
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' 
          : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              hasOwedFees 
                ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                : 'bg-gradient-to-br from-green-500 to-emerald-500'
            }`}>
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Platform Fees</h3>
              <p className="text-sm text-gray-500">{feesData.fee_rate_percentage} on all sales</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/80 text-sm font-medium">
            <Info className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{feesData.fee_rate_percentage}</span>
          </div>
        </div>

        {/* Fees Owed */}
        <div className={`rounded-xl p-4 ${hasOwedFees ? 'bg-white/80' : 'bg-white/60'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Fees Owed (Cash Sales)</p>
              <p className={`text-3xl font-bold ${hasOwedFees ? 'text-amber-600' : 'text-green-600'}`}>
                {symbol}{feesData.fees_owed.toFixed(2)}
              </p>
            </div>
            {hasOwedFees && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Due at billing cycle
              </div>
            )}
          </div>
        </div>

        {/* Fees Info */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Cash sale fees
            </span>
            <span className="text-gray-700">Billed monthly</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Card sale fees
            </span>
            <span className="text-gray-700">Auto-deducted from payout</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total paid
            </span>
            <span className="text-green-600 font-medium">{symbol}{feesData.fees_paid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Fee History Toggle */}
      {feesData.fee_history && feesData.fee_history.length > 0 && (
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            data-testid="toggle-fee-history"
          >
            <span className="font-medium text-gray-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Fee History ({feesData.fee_history.length})
            </span>
            {showHistory ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showHistory && (
            <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
              {feesData.fee_history.map((log, i) => (
                <div 
                  key={log.log_id || i}
                  className="p-4 border-b border-gray-50 last:border-0 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      log.payment_method === 'cash' 
                        ? 'bg-amber-100' 
                        : 'bg-blue-100'
                    }`}>
                      {log.payment_method === 'cash' ? (
                        <Banknote className={`w-4 h-4 text-amber-600`} />
                      ) : (
                        <CreditCard className={`w-4 h-4 text-blue-600`} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {log.payment_method === 'cash' ? 'Cash Sale' : 'Card Sale'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Sale: {symbol}{log.transaction_total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      log.status === 'pending' ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {symbol}{log.fee_amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{log.status.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" /> How Platform Fees Work
        </h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li><strong>8% fee</strong> applies to all sales processed through this page</li>
          <li><strong>Card payments:</strong> Fee is automatically deducted from your payout</li>
          <li><strong>Cash payments:</strong> Fee accumulates and is billed monthly</li>
          <li>Fees help maintain the platform and payment processing</li>
        </ul>
      </div>
    </div>
  );
}
