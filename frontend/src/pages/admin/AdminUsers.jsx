import React, { useState, useEffect } from "react";
import { useNavigate, Routes, Route, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { Users, Search, Eye, MoreVertical, ArrowLeft } from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

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
  const [total, setTotal] = useState(0);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const params = new URLSearchParams({ skip: 0, limit: 20 });
      if (search) params.append('search', search);
      const response = await fetch(`${API_BASE}/api/admin-system/users?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-slate-400">{total} total users</p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white"
        />
      </form>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">BL Coins</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No users found</td>
              </tr>
            ) : users.map((user) => (
              <tr key={user.user_id} className="hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="font-medium text-white">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">{user.email}</td>
                <td className="px-4 py-3 text-amber-400">{user.bl_coins?.toLocaleString() || 0}</td>
                <td className="px-4 py-3">
                  {user.is_banned ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">Banned</span>
                  ) : user.is_suspended ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">Suspended</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/users/${user.user_id}`)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('blendlink_token');
        const response = await fetch(`${API_BASE}/api/admin-system/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')} className="text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
          <p className="text-slate-400">{user?.email}</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-400">BL Coins</p>
            <p className="text-xl font-bold text-amber-400">{user?.bl_coins?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Referral Code</p>
            <p className="text-white font-mono">{user?.referral_code || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Posts</p>
            <p className="text-white">{user?.stats?.posts_count || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Referrals</p>
            <p className="text-white">{user?.stats?.referrals_count || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
