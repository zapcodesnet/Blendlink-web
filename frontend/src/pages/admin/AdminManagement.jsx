import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Shield, Plus, Trash2, Edit2, UserPlus, Check, X,
  Crown, User, Eye, Settings, RefreshCw
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', icon: Crown, color: 'text-amber-400', desc: 'Full access to everything' },
  { value: 'co_admin', label: 'Co-Admin', icon: Shield, color: 'text-blue-400', desc: 'Manage themes, pages, users (no admin mgmt)' },
  { value: 'moderator', label: 'Moderator', icon: Eye, color: 'text-green-400', desc: 'View/suspend users, view private content' },
  { value: 'support', label: 'Support', icon: User, color: 'text-slate-400', desc: 'View-only access' },
];

const PERMISSIONS = [
  { key: 'view_users', label: 'View Users' },
  { key: 'edit_users', label: 'Edit Users' },
  { key: 'delete_users', label: 'Delete Users' },
  { key: 'suspend_users', label: 'Suspend Users' },
  { key: 'view_private_content', label: 'View Private Content' },
  { key: 'manage_themes', label: 'Manage Themes' },
  { key: 'manage_pages', label: 'Manage Pages' },
  { key: 'manage_genealogy', label: 'Manage Genealogy' },
  { key: 'manage_admins', label: 'Manage Admins' },
  { key: 'view_audit_logs', label: 'View Audit Logs' },
  { key: 'use_ai_assistant', label: 'Use AI Assistant' },
  { key: 'access_analytics', label: 'Access Analytics' },
  { key: 'manage_withdrawals', label: 'Manage Withdrawals' },
];

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/admin-system/admins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAdmins(data || []);
    } catch (error) {
      toast.error("Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setUsers([]);
      return;
    }
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/admin-system/users?search=${query}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Search failed");
    }
  };

  const createAdmin = async (userId, role) => {
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/admin-system/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, role })
      });
      toast.success("Admin created");
      setShowAddModal(false);
      loadAdmins();
    } catch (error) {
      toast.error("Failed to create admin");
    }
  };

  const updateAdmin = async (adminId, updates) => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const params = new URLSearchParams(updates);
      await fetch(`${API_BASE}/api/admin-system/admins/${adminId}?${params}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success("Admin updated");
      setEditAdmin(null);
      loadAdmins();
    } catch (error) {
      toast.error("Failed to update admin");
    }
  };

  const deactivateAdmin = async (adminId) => {
    if (!confirm("Deactivate this admin?")) return;
    await updateAdmin(adminId, { is_active: false });
  };

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            Admin Management
          </h1>
          <p className="text-slate-400">{admins.length} administrators</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="w-4 h-4 mr-2" /> Add Admin
          </Button>
          <Button onClick={loadAdmins} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-4 gap-3">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <div key={role.value} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${role.color}`} />
                <span className="font-medium text-white text-sm">{role.label}</span>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No admins found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {admins.map((admin) => {
              const roleInfo = getRoleInfo(admin.role);
              const RoleIcon = roleInfo.icon;
              return (
                <div key={admin.admin_id} className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{admin.user?.name || 'Unknown'}</h3>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${roleInfo.color} bg-slate-700`}>
                        <RoleIcon className="w-3 h-3" /> {roleInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{admin.user?.email || admin.user_id}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Last login: {admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}
                    </p>
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
                      onClick={() => deactivateAdmin(admin.admin_id)}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Add New Admin</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Search User</label>
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => { setSearchUser(e.target.value); searchUsers(e.target.value); }}
                  placeholder="Search by name or email..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
                {users.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-slate-700 rounded-lg border border-slate-600">
                    {users.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => {
                          const role = prompt("Enter role (super_admin, co_admin, moderator, support):", "moderator");
                          if (role) createAdmin(user.user_id, role);
                        }}
                        className="w-full p-2 text-left hover:bg-slate-600 text-white text-sm"
                      >
                        {user.name} ({user.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Edit Admin: {editAdmin.user?.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <div className="space-y-2">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        onClick={() => updateAdmin(editAdmin.admin_id, { role: role.value })}
                        className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                          editAdmin.role === role.value 
                            ? 'border-blue-500 bg-blue-600/20' 
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${role.color}`} />
                        <div className="text-left">
                          <p className="font-medium text-white">{role.label}</p>
                          <p className="text-xs text-slate-400">{role.desc}</p>
                        </div>
                        {editAdmin.role === role.value && <Check className="w-4 h-4 text-blue-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setEditAdmin(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
