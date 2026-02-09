/**
 * Inventory Manager Component
 * Section 2: Inventory tracking with low-stock alerts
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { safeFetch } from "../../services/memberPagesApi";
import {
  Package, AlertTriangle, Search, Filter, Download, Upload,
  RefreshCw, Loader2, Plus, Minus, Edit2, Check, X
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function InventoryManager({ pageId, pageType }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState(0);

  // PRODUCTION FIX: uses safeFetch
  const loadInventory = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/page-inventory/${pageId}${showLowStockOnly ? '?low_stock_only=true' : ''}`;
      const data = await safeFetch(url);
      setInventory(data.inventory || []);
    } catch (err) {
      toast.error("Failed to load inventory");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInventory();
  }, [pageId, showLowStockOnly]);

  // PRODUCTION FIX: uses safeFetch
  const updateQuantity = async (itemId, newQuantity) => {
    try {
      await safeFetch(`${API_URL}/api/page-inventory/${pageId}/${itemId}?quantity=${newQuantity}`, {
        method: "PUT"
      });
      toast.success("Inventory updated");
      setEditingItem(null);
      loadInventory();
    } catch (err) {
      toast.error("Failed to update inventory");
    }
  };

  // PRODUCTION FIX: uses safeFetch
  const handleBulkImport = async (file) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(1); // Skip header
      const items = lines.filter(l => l.trim()).map(line => {
        const [item_id, quantity, low_stock_threshold] = line.split(',');
        return { item_id: item_id.trim(), quantity: parseInt(quantity), low_stock_threshold: parseInt(low_stock_threshold) || 5 };
      });

      await safeFetch(`${API_URL}/api/page-inventory/${pageId}/bulk-import`, {
        method: "POST",
        body: JSON.stringify({ items })
      });
      toast.success("Inventory imported");
      loadInventory();
    } catch (err) {
      toast.error("Failed to import inventory");
    }
  };

  const filteredInventory = inventory.filter(item => 
    !searchQuery || item.item_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockCount = inventory.filter(item => 
    item.quantity <= (item.low_stock_threshold || 5)
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Inventory Management
          </h2>
          <p className="text-sm text-muted-foreground">{inventory.length} items tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadInventory}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleBulkImport(e.target.files[0])}
            />
            <Button size="sm" variant="outline" asChild>
              <span><Upload className="w-4 h-4 mr-1" /> Import CSV</span>
            </Button>
          </label>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div className="flex-1">
            <p className="font-medium text-red-700">{lowStockCount} items low on stock</p>
            <p className="text-sm text-red-600">Review and restock these items</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowLowStockOnly(!showLowStockOnly)}>
            {showLowStockOnly ? "Show All" : "View Low Stock"}
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by item ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          variant={showLowStockOnly ? "default" : "outline"} 
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
        >
          <Filter className="w-4 h-4 mr-1" /> Low Stock
        </Button>
      </div>

      {/* Inventory Table */}
      {filteredInventory.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No inventory items found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Item</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-center p-4 font-medium">Quantity</th>
                  <th className="text-center p-4 font-medium">Threshold</th>
                  <th className="text-center p-4 font-medium">Status</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInventory.map((item) => {
                  const isLowStock = item.quantity <= (item.low_stock_threshold || 5);
                  const isEditing = editingItem === item.item_id;
                  
                  return (
                    <tr key={item.inventory_id || item.item_id} className={isLowStock ? "bg-red-50/50" : ""}>
                      <td className="p-4">
                        <p className="font-medium">{item.item_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.location_id ? `@ ${item.location_id}` : "Main"}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-muted rounded text-xs capitalize">
                          {item.item_type || "product"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setEditQuantity(Math.max(0, editQuantity - 1))}
                              className="w-8 h-8 rounded bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <Input
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
                            <button 
                              onClick={() => setEditQuantity(editQuantity + 1)}
                              className="w-8 h-8 rounded bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className={`text-lg font-bold ${isLowStock ? "text-red-600" : ""}`}>
                            {item.quantity}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center text-muted-foreground">
                        {item.low_stock_threshold || 5}
                      </td>
                      <td className="p-4 text-center">
                        {isLowStock ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" onClick={() => updateQuantity(item.item_id, editQuantity)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setEditingItem(item.item_id);
                              setEditQuantity(item.quantity);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
