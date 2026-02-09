/**
 * Customer Options & Locations Component
 * Section 6: Order types, delivery settings, Google Maps integration
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  MapPin, Plus, Trash2, Edit2, Save, Loader2, Check, X,
  Car, UtensilsCrossed, ShoppingBag, Truck, Package, Clock,
  Phone, Mail, Globe
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Order type configurations
const ORDER_TYPE_CONFIG = {
  dine_in: { label: "Dine In", icon: UtensilsCrossed, description: "Customers eat at your location" },
  drive_thru: { label: "Drive Thru", icon: Car, description: "Customers order from their vehicle" },
  pickup: { label: "Pickup", icon: ShoppingBag, description: "Customers pick up their order" },
  delivery: { label: "Delivery", icon: Truck, description: "You deliver to customer's location" },
  shipping: { label: "Shipping", icon: Package, description: "Ship orders to customers" },
};

export default function CustomerOptionsManager({ pageId, pageType }) {
  const [options, setOptions] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showAddLocation, setShowAddLocation] = useState(false);

  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "USA",
    postal_code: "",
    phone: "",
    email: "",
    latitude: null,
    longitude: null,
    is_primary: false,
    operating_hours: {}
  });

  // Load options and locations
  useEffect(() => {
    loadData();
  }, [pageId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/customer-options/${pageId}/options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOptions({
          order_types: data.order_types || [],
          delivery_settings: data.delivery_settings || {},
          pickup_settings: data.pickup_settings || {},
          shipping_settings: data.shipping_settings || {}
        });
        setLocations(data.locations || []);
      }
    } catch (err) {
      toast.error("Failed to load options");
    }
    setLoading(false);
  };

  // Toggle order type
  const toggleOrderType = (type) => {
    setOptions(prev => ({
      ...prev,
      order_types: prev.order_types.includes(type)
        ? prev.order_types.filter(t => t !== type)
        : [...prev.order_types, type]
    }));
  };

  // Save options
  const saveOptions = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/customer-options/${pageId}/options`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          page_id: pageId,
          ...options
        })
      });
      if (res.ok) {
        toast.success("Options saved!");
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      toast.error("Failed to save options");
    }
    setSaving(false);
  };

  // Add location
  const addLocation = async () => {
    if (!newLocation.name || !newLocation.address || !newLocation.city) {
      toast.error("Please fill in required fields");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/customer-options/${pageId}/locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newLocation, location_id: "" })
      });
      
      if (res.ok) {
        toast.success("Location added!");
        setShowAddLocation(false);
        setNewLocation({
          name: "", address: "", city: "", state: "", country: "USA",
          postal_code: "", phone: "", email: "", latitude: null, longitude: null,
          is_primary: false, operating_hours: {}
        });
        loadData();
      } else {
        throw new Error("Failed to add");
      }
    } catch (err) {
      toast.error("Failed to add location");
    }
    setSaving(false);
  };

  // Delete location
  const deleteLocation = async (locationId) => {
    if (!confirm("Delete this location?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/customer-options/${pageId}/locations/${locationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Location deleted");
        loadData();
      }
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  // Geocode address
  const geocodeAddress = async (address) => {
    // Using a simple geocoding approach - in production, use Google Maps Geocoding API
    try {
      const query = encodeURIComponent(`${address.address}, ${address.city}, ${address.state} ${address.postal_code}`);
      // This is a placeholder - real implementation would use Google Maps API
      toast.info("Geocoding requires Google Maps API key for accuracy");
      return null;
    } catch (err) {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin"></div>
        <p className="mt-4 text-gray-500">Loading options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ touchAction: 'pan-y' }}>
      {/* Order Types Section */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-cyan-600" />
          Order Types
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Select which ordering options to offer your customers
        </p>

        <div className="space-y-3">
          {Object.entries(ORDER_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            const isEnabled = options?.order_types?.includes(type);
            
            return (
              <button
                key={type}
                onClick={() => toggleOrderType(type)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                  isEnabled 
                    ? "border-cyan-400 bg-cyan-50/50" 
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isEnabled ? "bg-cyan-100" : "bg-gray-100"
                }`}>
                  <Icon className={`w-6 h-6 ${isEnabled ? "text-cyan-600" : "text-gray-400"}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${isEnabled ? "text-gray-900" : "text-gray-600"}`}>{config.label}</p>
                  <p className="text-sm text-gray-500">{config.description}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isEnabled ? "border-cyan-500 bg-cyan-500" : "border-gray-300"
                }`}>
                  {isEnabled && <Check className="w-4 h-4 text-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Locations Section */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-600" />
            Locations ({locations.length})
          </h3>
          <Button
            size="sm"
            onClick={() => setShowAddLocation(true)}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Location
          </Button>
        </div>

        {/* Locations List */}
        {locations.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No locations added yet</p>
            <p className="text-sm text-gray-400">Add your business locations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.location_id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-800">{loc.name || "Location"}</h4>
                      {loc.is_primary && (
                        <span className="px-2 py-0.5 bg-cyan-100 text-cyan-600 text-xs rounded-full">Primary</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{loc.address}</p>
                    {loc.city && (
                      <p className="text-sm text-gray-500">{loc.city}, {loc.state} {loc.postal_code}</p>
                    )}
                    {loc.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {loc.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Globe className="w-4 h-4 text-gray-500" />
                    </a>
                    <button
                      onClick={() => deleteLocation(loc.location_id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Settings */}
      {options?.order_types?.includes("delivery") && (
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-600" />
            Delivery Settings
          </h3>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Delivery Fee ($)</label>
              <Input
                type="number"
                step="0.01"
                value={options.delivery_settings?.fee || ""}
                onChange={(e) => setOptions({
                  ...options,
                  delivery_settings: {
                    ...options.delivery_settings,
                    fee: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Delivery Radius (miles)</label>
              <Input
                type="number"
                value={options.delivery_settings?.radius_miles || ""}
                onChange={(e) => setOptions({
                  ...options,
                  delivery_settings: {
                    ...options.delivery_settings,
                    radius_miles: parseFloat(e.target.value) || 10
                  }
                })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Min Order ($)</label>
              <Input
                type="number"
                step="0.01"
                value={options.delivery_settings?.min_order || ""}
                onChange={(e) => setOptions({
                  ...options,
                  delivery_settings: {
                    ...options.delivery_settings,
                    min_order: parseFloat(e.target.value) || 0
                  }
                })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Locations Section */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Locations ({locations.length})
          </h3>
          <Button size="sm" onClick={() => setShowAddLocation(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Location
          </Button>
        </div>

        {locations.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No locations added yet</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddLocation(true)}>
              Add Your First Location
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((location) => (
              <div 
                key={location.location_id} 
                className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{location.name}</p>
                    {location.is_primary && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Primary</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {location.address}, {location.city}, {location.state} {location.postal_code}
                  </p>
                  {location.phone && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {location.phone}
                    </p>
                  )}
                  {location.latitude && location.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" /> View on Google Maps
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingLocation(location)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-red-500 hover:text-red-600"
                    onClick={() => deleteLocation(location.location_id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button onClick={saveOptions} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Customer Options
      </Button>

      {/* Add Location Modal */}
      {showAddLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add New Location</h3>
              <button onClick={() => setShowAddLocation(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Location Name *</label>
                <Input
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="Main Store, Downtown Branch, etc."
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Address *</label>
                <Input
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">City *</label>
                  <Input
                    value={newLocation.city}
                    onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">State</label>
                  <Input
                    value={newLocation.state}
                    onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Postal Code</label>
                  <Input
                    value={newLocation.postal_code}
                    onChange={(e) => setNewLocation({ ...newLocation, postal_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Country</label>
                  <Input
                    value={newLocation.country}
                    onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <Input
                    value={newLocation.phone}
                    onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input
                    value={newLocation.email}
                    onChange={(e) => setNewLocation({ ...newLocation, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Latitude</label>
                  <Input
                    type="number"
                    step="any"
                    value={newLocation.latitude || ""}
                    onChange={(e) => setNewLocation({ ...newLocation, latitude: parseFloat(e.target.value) || null })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Longitude</label>
                  <Input
                    type="number"
                    step="any"
                    value={newLocation.longitude || ""}
                    onChange={(e) => setNewLocation({ ...newLocation, longitude: parseFloat(e.target.value) || null })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newLocation.is_primary}
                  onChange={(e) => setNewLocation({ ...newLocation, is_primary: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Set as primary location</span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddLocation(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={addLocation} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Location
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
