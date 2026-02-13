/**
 * Daily Sales Report Component
 * Automatically generates end-of-day reports with sales, top products, and peak hours
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { safeFetch } from "../../services/memberPagesApi";
import {
  FileText, Calendar, DollarSign, TrendingUp, Clock, Package,
  Download, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  BarChart3, ShoppingCart, Users, Star, Printer, Mail, Share2, Settings
} from "lucide-react";
import EmailReportSettings from "./EmailReportSettings";
import { getApiUrl } from "../../utils/runtimeConfig";

const API_URL = getApiUrl();

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
};

// Format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Peak hour chart bar
const HourBar = ({ hour, sales, maxSales }) => {
  const height = maxSales > 0 ? (sales / maxSales) * 100 : 0;
  const isPeak = height > 70;
  
  return (
    <div className="flex flex-col items-center">
      <div className="w-full h-24 flex items-end justify-center">
        <div 
          className={`w-6 rounded-t-lg transition-all ${
            isPeak 
              ? 'bg-gradient-to-t from-amber-500 to-orange-400' 
              : 'bg-gradient-to-t from-cyan-500 to-blue-400'
          }`}
          style={{ height: `${Math.max(height, 4)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 mt-1">
        {hour === 0 ? '12a' : hour <= 11 ? `${hour}a` : hour === 12 ? '12p' : `${hour-12}p`}
      </span>
    </div>
  );
};

export default function DailySalesReport({ pageId, pageType }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Load report for selected date - PRODUCTION FIX: uses safeFetch
  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await safeFetch(
        `${API_URL}/api/page-analytics/${pageId}/daily-report?date=${selectedDate}`
      );
      setReport(data);
    } catch (err) {
      console.error("Failed to load report:", err);
      // Try generating
      await generateReport();
    }
    setLoading(false);
  };

  // Generate daily report - PRODUCTION FIX: uses safeFetch
  const generateReport = async () => {
    setGenerating(true);
    try {
      const data = await safeFetch(
        `${API_URL}/api/pos/${pageId}/transactions?date=${selectedDate}`
      );
      const transactions = data.transactions || [];

      // Process transactions into report
      const report = processTransactions(transactions, selectedDate);
      setReport(report);

    } catch (err) {
      console.error("Failed to generate report:", err);
      // Create empty report
      setReport({
        date: selectedDate,
        summary: {
          total_sales: 0,
          total_orders: 0,
          average_order: 0,
          total_items_sold: 0
        },
        top_products: [],
        hourly_sales: Array(24).fill(0),
        payment_methods: {},
        order_types: {}
      });
    }
    setGenerating(false);
  };

  // Process transactions into report data
  const processTransactions = (transactions, date) => {
    const dateStr = new Date(date).toDateString();
    const dayTransactions = transactions.filter(t => 
      new Date(t.created_at).toDateString() === dateStr
    );

    // Summary
    const total_sales = dayTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const total_orders = dayTransactions.length;
    const average_order = total_orders > 0 ? total_sales / total_orders : 0;
    const total_items_sold = dayTransactions.reduce((sum, t) => 
      sum + (t.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0), 0
    );

    // Top products
    const productSales = {};
    dayTransactions.forEach(t => {
      t.items?.forEach(item => {
        const key = item.name || item.item_id;
        if (!productSales[key]) {
          productSales[key] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productSales[key].quantity += item.quantity || 1;
        productSales[key].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    const top_products = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Hourly sales
    const hourly_sales = Array(24).fill(0);
    dayTransactions.forEach(t => {
      const hour = new Date(t.created_at).getHours();
      hourly_sales[hour] += t.total || 0;
    });

    // Peak hours (top 3)
    const peakHours = hourly_sales
      .map((sales, hour) => ({ hour, sales }))
      .filter(h => h.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);

    // Payment methods
    const payment_methods = {};
    dayTransactions.forEach(t => {
      const method = t.payment_method || 'unknown';
      payment_methods[method] = (payment_methods[method] || 0) + (t.total || 0);
    });

    // Order types
    const order_types = {};
    dayTransactions.forEach(t => {
      const type = t.order_type || 'pickup';
      order_types[type] = (order_types[type] || 0) + 1;
    });

    return {
      date,
      summary: { total_sales, total_orders, average_order, total_items_sold },
      top_products,
      hourly_sales,
      peak_hours: peakHours,
      payment_methods,
      order_types,
      transactions: dayTransactions
    };
  };

  useEffect(() => {
    loadReport();
  }, [pageId, selectedDate]);

  // Navigate dates
  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Export report
  const exportReport = () => {
    if (!report) return;

    const reportText = `
DAILY SALES REPORT
==================
Date: ${formatDate(selectedDate)}

SUMMARY
-------
Total Sales: ${formatCurrency(report.summary.total_sales)}
Total Orders: ${report.summary.total_orders}
Average Order: ${formatCurrency(report.summary.average_order)}
Items Sold: ${report.summary.total_items_sold}

TOP PRODUCTS
------------
${report.top_products.map((p, i) => 
  `${i + 1}. ${p.name} - ${p.quantity} sold - ${formatCurrency(p.revenue)}`
).join('\n')}

PEAK HOURS
----------
${report.peak_hours?.map(h => 
  `${h.hour === 0 ? '12 AM' : h.hour <= 11 ? `${h.hour} AM` : h.hour === 12 ? '12 PM' : `${h.hour-12} PM`}: ${formatCurrency(h.sales)}`
).join('\n') || 'No sales'}

PAYMENT METHODS
---------------
${Object.entries(report.payment_methods).map(([method, amount]) => 
  `${method.charAt(0).toUpperCase() + method.slice(1)}: ${formatCurrency(amount)}`
).join('\n') || 'No payments'}

ORDER TYPES
-----------
${Object.entries(report.order_types).map(([type, count]) => 
  `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${count} orders`
).join('\n') || 'No orders'}
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${selectedDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  // Print report
  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const maxHourlySales = Math.max(...(report?.hourly_sales || [0]));

  return (
    <div className="space-y-6 print:space-y-4" data-testid="daily-sales-report">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5 print:bg-white print:border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center print:hidden">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Daily Sales Report</h3>
              <p className="text-sm text-gray-500">End-of-day performance summary</p>
            </div>
          </div>
          
          {/* Date Navigator */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
            />
            <button
              onClick={() => navigateDate(1)}
              disabled={selectedDate >= new Date().toISOString().split('T')[0]}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Date Title */}
        <div className="text-center py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl mb-4">
          <p className="text-lg font-semibold text-gray-800">{formatDate(selectedDate)}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={loadReport} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-1 ${generating ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportReport} className="rounded-xl">
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={printReport} className="rounded-xl">
            <Printer className="w-4 h-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/25">
          <DollarSign className="w-8 h-8 opacity-80 mb-2" />
          <p className="text-3xl font-bold">{formatCurrency(report?.summary?.total_sales)}</p>
          <p className="text-sm opacity-90">Total Sales</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/25">
          <ShoppingCart className="w-8 h-8 opacity-80 mb-2" />
          <p className="text-3xl font-bold">{report?.summary?.total_orders || 0}</p>
          <p className="text-sm opacity-90">Total Orders</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/25">
          <TrendingUp className="w-8 h-8 opacity-80 mb-2" />
          <p className="text-3xl font-bold">{formatCurrency(report?.summary?.average_order)}</p>
          <p className="text-sm opacity-90">Average Order</p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/25">
          <Package className="w-8 h-8 opacity-80 mb-2" />
          <p className="text-3xl font-bold">{report?.summary?.total_items_sold || 0}</p>
          <p className="text-sm opacity-90">Items Sold</p>
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Hourly Sales Distribution
        </h4>
        
        {report?.summary?.total_orders > 0 ? (
          <>
            <div className="flex justify-between items-end gap-1 overflow-x-auto pb-2">
              {report?.hourly_sales?.map((sales, hour) => (
                <HourBar 
                  key={hour} 
                  hour={hour} 
                  sales={sales} 
                  maxSales={maxHourlySales} 
                />
              ))}
            </div>
            
            {/* Peak Hours Highlight */}
            {report?.peak_hours?.length > 0 && (
              <div className="mt-4 bg-amber-50 rounded-xl p-3">
                <p className="text-sm font-medium text-amber-800 mb-2">Peak Hours:</p>
                <div className="flex flex-wrap gap-2">
                  {report.peak_hours.map((ph, i) => (
                    <span key={i} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                      {ph.hour === 0 ? '12 AM' : ph.hour <= 11 ? `${ph.hour} AM` : ph.hour === 12 ? '12 PM' : `${ph.hour-12} PM`}
                      : {formatCurrency(ph.sales)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No sales recorded for this date</p>
          </div>
        )}
      </div>

      {/* Top Products & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Top Products
          </h4>
          
          {report?.top_products?.length > 0 ? (
            <div className="space-y-3">
              {report.top_products.map((product, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.quantity} sold</p>
                  </div>
                  <p className="font-semibold text-gray-800">{formatCurrency(product.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p>No products sold</p>
            </div>
          )}
        </div>

        {/* Payment Methods & Order Types */}
        <div className="space-y-6">
          {/* Payment Methods */}
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Payment Methods
            </h4>
            
            {Object.keys(report?.payment_methods || {}).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(report.payment_methods).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 capitalize">{method}</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No payment data</p>
            )}
          </div>

          {/* Order Types */}
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              Order Types
            </h4>
            
            {Object.keys(report?.order_types || {}).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.order_types).map(([type, count]) => (
                  <span key={type} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: {count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No order data</p>
            )}
          </div>
        </div>
      </div>

      {/* Email Report Settings */}
      <div className="print:hidden">
        <EmailReportSettings pageId={pageId} />
      </div>
    </div>
  );
}
