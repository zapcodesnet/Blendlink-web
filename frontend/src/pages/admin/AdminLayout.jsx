import React, { useState, useEffect, useContext, createContext } from "react";
import { useNavigate, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../App";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Shield, Users, Palette, Layout, GitBranch, Bot, 
  Settings, FileText, BarChart3, LogOut, Menu, X,
  ChevronRight, Home, Bell, Search
} from "lucide-react";

// Import admin components
import AdminUsers from "./AdminUsers";
import AdminThemes from "./AdminThemes";
import AdminGenealogy from "./AdminGenealogy";
import AdminAI from "./AdminAI";
import AdminPages from "./AdminPages";
import AdminManagement from "./AdminManagement";
import AdminAudit from "./AdminAudit";
import AdminAnalytics from "./AdminAnalytics";
import AdminSettings from "./AdminSettings";
import DashboardWidgets from "./DashboardWidgets";
import AdminABTesting from "./AdminABTesting";

// Admin Context
export const AdminContext = createContext(null);

// Admin API
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const adminApiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}/api${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Request failed');
  }
  return data;
};

export const adminAPI = {
  getProfile: () => adminApiRequest('/admin-system/me'),
  getDashboard: () => adminApiRequest('/admin-system/dashboard'),
};

// Admin Layout Component
export default function AdminLayout() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const data = await adminAPI.getProfile();
        setAdminData(data);
      } catch (error) {
        toast.error("Admin access required");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    
    if (!user) {
      navigate('/login');
      return;
    }
    
    checkAdmin();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: Shield, label: 'Admins', path: '/admin/admins' },
    { icon: Palette, label: 'Themes', path: '/admin/themes' },
    { icon: Layout, label: 'Pages', path: '/admin/pages' },
    { icon: GitBranch, label: 'Genealogy', path: '/admin/genealogy' },
    { icon: Bot, label: 'AI Assistant', path: '/admin/ai' },
    { icon: FileText, label: 'Audit Logs', path: '/admin/audit' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <AdminContext.Provider value={{ adminData, setAdminData }}>
      <div className="min-h-screen bg-slate-900 flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col`}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="font-bold text-white text-lg">Admin</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    active 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-700">
            <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {adminData?.user?.name?.charAt(0) || 'A'}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{adminData?.user?.name}</p>
                  <p className="text-xs text-slate-400 truncate">{adminData?.admin?.role || 'Super Admin'}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-3 text-slate-400 hover:text-white"
                onClick={() => navigate('/')}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Exit Admin
              </Button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-slate-400">
              <Link to="/admin" className="hover:text-white">Admin</Link>
              {location.pathname !== '/admin' && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-white capitalize">
                    {location.pathname.split('/').pop()}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="w-64 bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">3</span>
              </Button>
            </div>
          </header>

          <div className="h-[calc(100vh-4rem)] overflow-y-auto p-6">
            <Routes>
              <Route index element={<AdminDashboardHome />} />
              <Route path="users/*" element={<AdminUsers />} />
              <Route path="admins" element={<AdminManagement />} />
              <Route path="themes" element={<AdminThemes />} />
              <Route path="pages" element={<AdminPages />} />
              <Route path="genealogy" element={<AdminGenealogy />} />
              <Route path="ai" element={<AdminAI />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="settings" element={<AdminSettings />} />
            </Routes>
          </div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}

// Dashboard Home Component
function AdminDashboardHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await adminAPI.getDashboard();
        setStats(data);
      } catch (error) {
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.users?.total || 0, color: 'blue' },
    { label: 'New (7 days)', value: stats?.users?.new_7d || 0, color: 'green' },
    { label: 'Suspended', value: stats?.users?.suspended || 0, color: 'yellow' },
    { label: 'Banned', value: stats?.users?.banned || 0, color: 'red' },
  ];

  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400">Welcome to the Blendlink Admin Panel</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className={`rounded-xl border p-4 ${colorClasses[stat.color]}`}>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Recent Users</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {stats?.recent_users?.slice(0, 5).map((user) => (
            <div key={user.user_id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
              </div>
              <span className="text-sm text-slate-400">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Placeholder component for unimplemented pages
function PlaceholderPage({ title }) {
  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-slate-400">This feature is coming soon.</p>
    </div>
  );
}
