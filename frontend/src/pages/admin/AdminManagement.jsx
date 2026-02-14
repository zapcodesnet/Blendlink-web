import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  Shield, Plus, Trash2, Edit2, UserPlus, Check, X,
  Crown, User, Eye, Settings, RefreshCw, Key, 
  AlertTriangle, Search, Clock, Activity
} from "lucide-react";

const API_BASE = getApiUrl();

const getToken = () => localStorage.getItem('blendlink_token');

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
    console.error('JSON parse error:', e);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }
  
  return data;
};

const ROLES = [
  { 
    value: 'super_admin', 
    label: 'Super Admin', 
    icon: Crown, 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/30',
    desc: 'Full access to everything including admin management' 
  },
  { 
    value: 'co_admin', 
    label: 'Co-Admin', 
    icon: Shield, 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/30',
    desc: 'Can manage users, content, and platform settings' 
  },
  { 
    value: 'moderator', 
    label: 'Moderator', 
    icon: Eye, 
    color: 'text-green-400', 
    bg: 'bg-green-500/10 border-green-500/30',
    desc: 'Can view and moderate users and content' 
  },
  { 
    value: 'support', 
    label: 'Support', 
    icon: User, 
    color: 'text-slate-400', 
    bg: 'bg-slate-500/10 border-slate-500/30',
    desc: 'View-only access for customer support' 
  },
];

const PERMISSION_GROUPS = [
  {
    name: 'User Management',
    permissions: [
      { key: 'view_users', label: 'View Users' },
      { key: 'edit_users', label: 'Edit Users' },
      { key: 'suspend_users', label: 'Suspend Users' },
      { key: 'ban_users', label: 'Ban Users' },
      { key: 'delete_users', label: 'Delete Users' },
      { key: 'reset_user_passwords', label: 'Reset Passwords' },
      { key: 'force_logout_users', label: 'Force Logout' },
    ]
  },
  {
    name: 'Financial',
    permissions: [
      { key: 'view_balances', label: 'View Balances' },
      { key: 'adjust_bl_coins', label: 'Adjust BL Coins' },
      { key: 'adjust_usd_balance', label: 'Adjust USD' },
      { key: 'view_transactions', label: 'View Transactions' },
      { key: 'approve_withdrawals', label: 'Approve Withdrawals' },
      { key: 'reject_withdrawals', label: 'Reject Withdrawals' },
    ]
  },
  {
    name: 'Genealogy',
    permissions: [
      { key: 'view_genealogy', label: 'View Genealogy' },
      { key: 'edit_genealogy', label: 'Edit Genealogy' },
      { key: 'reassign_downlines', label: 'Reassign Downlines' },
      { key: 'manage_orphans', label: 'Manage Orphans' },
    ]
  },
  {
    name: 'Content',
    permissions: [
      { key: 'view_public_content', label: 'View Public Content' },
      { key: 'view_private_content', label: 'View Private Content' },
      { key: 'delete_content', label: 'Delete Content' },
      { key: 'restore_content', label: 'Restore Content' },
      { key: 'manage_reports', label: 'Manage Reports' },
    ]
  },
  {
    name: 'Platform',
    permissions: [
      { key: 'manage_themes', label: 'Manage Themes' },
      { key: 'manage_pages', label: 'Manage Pages' },
      { key: 'manage_settings', label: 'Manage Settings' },
    ]
  },
  {
    name: 'Admin',
    permissions: [
      { key: 'view_admins', label: 'View Admins' },
      { key: 'create_admins', label: 'Create Admins' },
      { key: 'edit_admins', label: 'Edit Admins' },
      { key: 'delete_admins', label: 'Delete Admins' },
      { key: 'manage_permissions', label: 'Manage Permissions' },
    ]
  },
  {
    name: 'System',
    permissions: [
      { key: 'view_audit_logs', label: 'View Audit Logs' },
      { key: 'view_analytics', label: 'View Analytics' },
      { key: 'view_system_health', label: 'View System Health' },
      { key: 'use_ai_assistant', label: 'Use AI Assistant' },
    ]
  },
];

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [newAdminData, setNewAdminData] = useState({ userId: "", role: "moderator", permissions: {} });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.listAdmins();
      setAdmins(data.admins || []);
    } catch (error) {
      toast.error("Failed to load admins: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await adminAPI.searchUsers({ query, limit: 10 });
      // Filter out users who are already admins
      const adminUserIds = new Set(admins.map(a => a.user_id));
      const nonAdminUsers = (data.users || []).filter(u => !adminUserIds.has(u.user_id));
      setSearchResults(nonAdminUsers);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const createAdmin = async () => {
    if (!newAdminData.userId) {
      toast.error("Please select a user");
      return;
    }
    try {
      await adminAPI.createAdmin(newAdminData.userId, newAdminData.role, newAdminData.permissions);
      toast.success("Admin created successfully");
      setShowAddModal(false);
      setNewAdminData({ userId: "", role: "moderator", permissions: {} });
      setSearchQuery("");
      setSearchResults([]);
      loadAdmins();
    } catch (error) {
      toast.error("Failed to create admin: " + error.message);
    }
  };

  const updateAdmin = async (adminId, updates) => {
    try {
      await apiRequest(`/admin/roles/admins/${adminId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      toast.success("Admin updated successfully");
      setEditAdmin(null);
      loadAdmins();
    } catch (error) {
      toast.error("Failed to update admin: " + error.message);
    }
  };

  const deleteAdmin = async (adminId) => {
    if (!confirm("Are you sure you want to remove admin privileges from this user?")) return;
    try {
      await apiRequest(`/admin/roles/admins/${adminId}`, { method: 'DELETE' });
      toast.success("Admin privileges removed");
      loadAdmins();
    } catch (error) {
      toast.error("Failed to remove admin: " + error.message);
    }
  };

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            Admin & Role Management
          </h1>
          <p className="text-slate-400">{admins.length} administrators • Role-Based Access Control</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="w-4 h-4 mr-2" /> Add Admin
          </Button>
          <Button onClick={loadAdmins} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const count = admins.filter(a => a.role === role.value).length;
          return (
            <div key={role.value} className={`rounded-xl border p-4 ${role.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${role.color}`} />
                  <span className={`font-semibold ${role.color}`}>{role.label}</span>
                </div>
                <Badge className="bg-slate-700 text-white">{count}</Badge>
              </div>
              <p className="text-xs text-slate-400">{role.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Admins List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No admins found</p>
            <p className="text-sm text-slate-500 mt-1">Add your first admin to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {admins.map((admin) => {
              const roleInfo = getRoleInfo(admin.role);
              const RoleIcon = roleInfo.icon;
              return (
                <div key={admin.admin_id} className="p-4 flex items-center gap-4 hover:bg-slate-700/30" data-testid={`admin-row-${admin.admin_id}`}>
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    {admin.avatar ? (
                      <img src={admin.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-white">{admin.name || 'Unknown'}</h3>
                      <Badge className={`${roleInfo.bg} ${roleInfo.color}`}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {roleInfo.label}
                      </Badge>
                      {admin.totp_enabled && (
                        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
                          <Key className="w-3 h-3 mr-1" />
                          2FA
                        </Badge>
                      )}
                      {!admin.is_active && (
                        <Badge className="bg-red-500/20 text-red-400">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 truncate">{admin.email}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last login: {admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Created: {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditAdmin(admin)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAdmin(admin.admin_id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Add New Admin
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* User Search */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Search User</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                    placeholder="Search by name or email..."
                    className="pl-10 bg-slate-700 border-slate-600"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-slate-700 rounded-lg border border-slate-600">
                    {searchResults.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => {
                          setNewAdminData({ ...newAdminData, userId: user.user_id });
                          setSearchQuery(user.name || user.email);
                          setSearchResults([]);
                        }}
                        className="w-full p-3 text-left hover:bg-slate-600 flex items-center gap-3"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-white text-sm">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {newAdminData.userId && (
                  <p className="text-xs text-green-400 mt-2">
                    <Check className="w-3 h-3 inline mr-1" />
                    User selected: {newAdminData.userId.slice(0, 12)}...
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Role</label>
                <div className="space-y-2">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        onClick={() => setNewAdminData({ ...newAdminData, role: role.value })}
                        className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                          newAdminData.role === role.value 
                            ? 'border-blue-500 bg-blue-600/20' 
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${role.color}`} />
                        <div className="text-left flex-1">
                          <p className="font-medium text-white">{role.label}</p>
                          <p className="text-xs text-slate-400">{role.desc}</p>
                        </div>
                        {newAdminData.role === role.value && <Check className="w-4 h-4 text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Admin privileges grant access to sensitive user data and platform controls.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={createAdmin} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!newAdminData.userId}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Admin
                </Button>
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-600">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editAdmin && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                Edit Admin: {editAdmin.name || editAdmin.email}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setEditAdmin(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-6">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        onClick={() => updateAdmin(editAdmin.admin_id, { role: role.value })}
                        className={`p-3 rounded-lg border flex items-center gap-2 transition-colors ${
                          editAdmin.role === role.value 
                            ? 'border-blue-500 bg-blue-600/20' 
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${role.color}`} />
                        <span className="font-medium text-white text-sm">{role.label}</span>
                        {editAdmin.role === role.value && <Check className="w-4 h-4 text-blue-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Permissions</label>
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.name} className="bg-slate-700/30 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">{group.name}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {group.permissions.map((perm) => {
                          const isEnabled = editAdmin.permissions?.[perm.key];
                          return (
                            <button
                              key={perm.key}
                              onClick={() => {
                                const newPerms = {
                                  ...editAdmin.permissions,
                                  [perm.key]: !isEnabled
                                };
                                updateAdmin(editAdmin.admin_id, { permissions: newPerms });
                                setEditAdmin({ ...editAdmin, permissions: newPerms });
                              }}
                              className={`p-2 rounded text-sm flex items-center justify-between transition-colors ${
                                isEnabled 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-slate-600/50 text-slate-400 border border-slate-600'
                              }`}
                            >
                              <span>{perm.label}</span>
                              {isEnabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="font-medium text-white">Admin Status</p>
                  <p className="text-sm text-slate-400">Enable or disable this admin account</p>
                </div>
                <Button
                  variant={editAdmin.is_active ? "destructive" : "default"}
                  size="sm"
                  onClick={() => {
                    updateAdmin(editAdmin.admin_id, { is_active: !editAdmin.is_active });
                    setEditAdmin({ ...editAdmin, is_active: !editAdmin.is_active });
                  }}
                >
                  {editAdmin.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>

              {/* Close */}
              <Button variant="outline" onClick={() => setEditAdmin(null)} className="w-full border-slate-600">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
