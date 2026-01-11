import React, { useState, useEffect } from "react";
import { useNavigate, Routes, Route, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Users, Search, Filter, MoreVertical, Eye, Ban, 
  Trash2, CheckCircle, XCircle, Mail, Calendar,
  Coins, ArrowLeft, MessageSquare, Image, Shield
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const adminApiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Request failed');
  return data;
};

export default function AdminUsers() {
  return (
    <Routes>
      <Route index element={<UsersList />} />
      <Route path=":userId" element={<UserDetail />} />
    </Routes>
  );
}

function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionModal, setActionModal] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { skip: page * 20, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      const data = await adminApiRequest(`/admin-system/users?${new URLSearchParams(params)}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    loadUsers();
  };

  const handleAction = async (action, userId, data = {}) => {
    try {
      switch (action) {
        case 'suspend':
          await adminApiRequest(`/admin-system/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify(data) });
          toast.success("User suspended");
          break;
        case 'unsuspend':
          await adminApiRequest(`/admin-system/users/${userId}/unsuspend`, { method: 'POST' });
          toast.success("User unsuspended");
          break;
        case 'ban':
          await adminApiRequest(`/admin-system/users/${userId}/ban`, { method: 'POST', body: JSON.stringify(data) });
          toast.success("User banned");
          break;
        case 'delete':
          await adminApiRequest(`/admin-system/users/${userId}`, { method: 'DELETE' });
          toast.success("User deleted");
          break;
      }
      loadUsers();
      setActionModal(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-400">{total} total users</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or username..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">BL Coins</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Joined</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.user_id} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-sm text-slate-400">@{user.username || 'no-username'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-amber-400 font-medium">{user.bl_coins?.toLocaleString() || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    {user.is_banned ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">Banned</span>
                    ) : user.is_suspended ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">Suspended</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Active</span>
                    )}
                    {user.is_admin && (
                      <span className="ml-2 px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">Admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white"
                        onClick={() => navigate(`/admin/users/${user.user_id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-white"
                          onClick={() => setSelectedUser(selectedUser === user.user_id ? null : user.user_id)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                        {selectedUser === user.user_id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-10">
                            {user.is_suspended ? (
                              <button
                                onClick={() => handleAction('unsuspend', user.user_id)}
                                className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-slate-600 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" /> Unsuspend
                              </button>
                            ) : (
                              <button
                                onClick={() => setActionModal({ type: 'suspend', userId: user.user_id })}
                                className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-slate-600 flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" /> Suspend
                              </button>
                            )}
                            {!user.is_banned && (
                              <button
                                onClick={() => setActionModal({ type: 'ban', userId: user.user_id })}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-600 flex items-center gap-2"
                              >
                                <Ban className="w-4 h-4" /> Ban
                              </button>
                            )}
                            <button
                              onClick={() => setActionModal({ type: 'delete', userId: user.user_id })}
                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-600 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {page * 20 + 1} to {Math.min((page + 1) * 20, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="border-slate-600 text-slate-300"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * 20 >= total}
                onClick={() => setPage(p => p + 1)}
                className="border-slate-600 text-slate-300"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">
              {actionModal.type === 'suspend' && 'Suspend User'}
              {actionModal.type === 'ban' && 'Ban User'}
              {actionModal.type === 'delete' && 'Delete User'}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleAction(actionModal.type, actionModal.userId, {
                reason: formData.get('reason'),
                duration_days: actionModal.type === 'suspend' ? parseInt(formData.get('duration')) : undefined,
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Reason</label>
                  <textarea
                    name="reason"
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Enter reason..."
                    required
                  />
                </div>
                {actionModal.type === 'suspend' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Duration (days)</label>
                    <input
                      type="number"
                      name="duration"
                      min="1"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="Leave empty for permanent"
                    />
                  </div>
                )}
                {actionModal.type === 'delete' && (
                  <p className="text-red-400 text-sm">This action cannot be undone!</p>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setActionModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className={
                  actionModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 
                  actionModal.type === 'ban' ? 'bg-red-600 hover:bg-red-700' : 
                  'bg-yellow-600 hover:bg-yellow-700'
                }>
                  Confirm
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [albums, setAlbums] = useState([]);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await adminApiRequest(`/admin-system/users/${userId}`);
        setUser(data);
      } catch (error) {
        toast.error("Failed to load user");
        navigate('/admin/users');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [userId, navigate]);

  const loadPrivateData = async (type) => {
    try {
      if (type === 'albums') {
        const data = await adminApiRequest(`/admin-system/users/${userId}/private-albums`);
        setAlbums(data);
      } else if (type === 'messages') {
        const data = await adminApiRequest(`/admin-system/users/${userId}/private-messages`);
        setMessages(data);
      }
    } catch (error) {
      toast.error(`Failed to load ${type}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
          <p className="text-slate-400">{user?.email}</p>
        </div>
      </div>

      {/* User Card */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-12 h-12 text-slate-400" />
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-400">Username</p>
              <p className="text-white">@{user?.username || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">BL Coins</p>
              <p className="text-amber-400 font-bold">{user?.bl_coins?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Referral Code</p>
              <p className="text-white font-mono">{user?.referral_code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Status</p>
              {user?.is_banned ? (
                <span className="text-red-400">Banned</span>
              ) : user?.is_suspended ? (
                <span className="text-yellow-400">Suspended</span>
              ) : (
                <span className="text-green-400">Active</span>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-400">Joined</p>
              <p className="text-white">{new Date(user?.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Posts</p>
              <p className="text-white">{user?.stats?.posts_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Listings</p>
              <p className="text-white">{user?.stats?.listings_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Referrals</p>
              <p className="text-white">{user?.stats?.referrals_count || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {['profile', 'albums', 'messages'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'profile') loadPrivateData(tab);
            }}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'albums' && <Image className="w-4 h-4 inline mr-2" />}
            {tab === 'messages' && <MessageSquare className="w-4 h-4 inline mr-2" />}
            {tab === 'profile' && <Users className="w-4 h-4 inline mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">Bio</h3>
          <p className="text-slate-300">{user?.bio || 'No bio provided'}</p>
        </div>
      )}

      {activeTab === 'albums' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Private Albums</h3>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">AUDIT LOGGED</span>
          </div>
          {albums.length === 0 ? (
            <p className="text-slate-400">No albums found</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {albums.map((album) => (
                <div key={album.album_id} className="bg-slate-700 rounded-lg p-3">
                  <p className="font-medium text-white truncate">{album.name}</p>
                  <p className="text-sm text-slate-400">{album.items_count || 0} items</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Private Messages</h3>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">AUDIT LOGGED - GDPR</span>
          </div>
          {messages.length === 0 ? (
            <p className="text-slate-400">No messages found</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.message_id} className="bg-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-blue-400">
                      {msg.sender_id === userId ? 'Sent' : 'Received'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
