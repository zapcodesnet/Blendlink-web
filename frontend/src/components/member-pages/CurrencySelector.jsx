/**
 * Currency Selector Component
 * Allows page owners to select their page's currency for POS and checkout
 */
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { safeFetch } from "../../services/memberPagesApi";
import {
  Globe, Check, ChevronDown, Search, Loader2
} from "lucide-react";
import { getApiUrl } from "../../utils/runtimeConfig";

const API_URL = getApiUrl();

export default function CurrencySelector({ pageId, currentCurrency = "USD", currentSymbol = "$", onUpdate }) {
  const [currencies, setCurrencies] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/member-pages/currencies/supported`);
      setCurrencies(data.currencies || {});
    } catch (err) {
      console.error("Failed to load currencies:", err);
    }
    setLoading(false);
  };

  const selectCurrency = async (code) => {
    if (code === currentCurrency) {
      setIsOpen(false);
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const data = await safeFetch(`${API_URL}/api/member-pages/${pageId}/currency`, {
        method: "PUT",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ currency: code })
      });
      
      toast.success(data.message || `Currency updated to ${currencies[code]?.name}`);
      setIsOpen(false);
      
      if (onUpdate) {
        onUpdate(code, currencies[code]?.symbol);
      }
    } catch (err) {
      toast.error(err.message || "Failed to update currency");
    }
    setUpdating(false);
  };

  const filteredCurrencies = Object.entries(currencies).filter(([code, info]) => 
    code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    info.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-11 bg-gray-100 rounded-xl animate-pulse"></div>
    );
  }

  return (
    <div className="relative" data-testid="currency-selector">
      {/* Current Selection Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 justify-between rounded-xl border-gray-200 hover:bg-gray-50"
        disabled={updating}
        data-testid="currency-selector-button"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="font-medium">{currentSymbol}</span>
          <span className="text-gray-600">{currentCurrency}</span>
          <span className="text-gray-400 text-sm">
            ({currencies[currentCurrency]?.name || currentCurrency})
          </span>
        </div>
        {updating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search currencies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                  data-testid="currency-search-input"
                />
              </div>
            </div>

            {/* Currency List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredCurrencies.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No currencies found
                </div>
              ) : (
                filteredCurrencies.map(([code, info]) => (
                  <button
                    key={code}
                    onClick={() => selectCurrency(code)}
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      code === currentCurrency ? 'bg-cyan-50' : ''
                    }`}
                    data-testid={`currency-option-${code}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium w-8">{info.symbol}</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{code}</p>
                        <p className="text-sm text-gray-500">{info.name}</p>
                      </div>
                    </div>
                    {code === currentCurrency && (
                      <Check className="w-5 h-5 text-cyan-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
