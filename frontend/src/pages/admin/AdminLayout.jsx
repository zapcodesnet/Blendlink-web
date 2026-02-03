import React, { useState, useEffect, useContext, createContext } from "react";
import { useNavigate, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../App";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Shield, Users, Palette, Layout, GitBranch, Bot, 
  Settings, FileText, BarChart3, LogOut, Menu, X,
  ChevronRight, Home, Bell, Search, ZoomIn, ZoomOut,
  RotateCcw, Maximize2, FlaskConical, Wallet, Lock,
  Crown, UserPlus, Code
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
import AdminWithdrawals from "./AdminWithdrawals";
import AdminNotificationSettings from "./AdminNotificationSettings";
import AdminSecurityDashboard from "./AdminSecurityDashboard";
import AdminOrphans from "./AdminOrphans";
import AdminDiamondLeaders from "./AdminDiamondLeaders";
import AdminUIEditor from "./AdminUIEditor";
import AdminWalletManagement from "./AdminWalletManagement";

// Import real-time components
import { useAdminWebSocket } from "../../hooks/useAdminWebSocket";
import { AdminRealtimeStatus, RealtimeMetricsPanel } from "../../components/admin/AdminRealtimeStatus";

// Admin Context
export const AdminContext = createContext(null);

// Admin API
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Safe fetch helper - reads body only once to avoid "body stream already read" errors
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
  
  // Read body as text first to avoid body stream errors
  const rawText = await response.text();
  
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.error('JSON parse error:', e);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || 'Request failed');
  }
  
  return data;
};

export const adminAPI = {
  // New production admin system endpoints
  login: (email, password, totp_code = null) => adminApiRequest('/admin-auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totp_code }),
  }),
  getProfile: () => adminApiRequest('/admin-auth/me'),
  logout: () => adminApiRequest('/admin-auth/logout', { method: 'POST' }),
  
  // 2FA
  setup2FA: () => adminApiRequest('/admin-auth/2fa/setup', { method: 'POST' }),
  verify2FA: (code) => adminApiRequest('/admin-auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ totp_code: code }),
  }),
  
  // Dashboard (fallback to old endpoint if new not available)
  getDashboard: () => adminApiRequest('/admin-system/dashboard').catch(() => ({})),
  
  // User Management
  searchUsers: (params) => adminApiRequest(`/admin/users/search?${new URLSearchParams(params)}`),
  getUser: (userId) => adminApiRequest(`/admin/users/${userId}`),
  suspendUser: (userId, reason, duration) => adminApiRequest(`/admin/users/${userId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason, notify_user: true, duration_days: duration }),
  }),
  banUser: (userId, reason) => adminApiRequest(`/admin/users/${userId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ reason, notify_user: true }),
  }),
  
  // Financial
  getFinancialOverview: () => adminApiRequest('/admin/finance/overview'),
  adjustBalance: (userId, currency, amount, reason) => adminApiRequest(`/admin/finance/adjust-balance/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ currency, amount, reason, notify_user: true }),
  }),
  
  // Genealogy
  getGenealogyTree: (rootUserId, maxDepth = 3) => {
    const params = new URLSearchParams({ max_depth: maxDepth });
    if (rootUserId) params.append('root_user_id', rootUserId);
    return adminApiRequest(`/admin/genealogy/tree?${params}`);
  },
  getUserNetwork: (userId) => adminApiRequest(`/admin/genealogy/user/${userId}/network`),
  reassignDownline: (userId, newUplineId, reason) => adminApiRequest('/admin/genealogy/reassign', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, new_upline_id: newUplineId, reason, notify_users: true }),
  }),
  
  // System
  getSystemHealth: () => adminApiRequest('/admin/system/health'),
  getActivityFeed: (limit = 50) => adminApiRequest(`/admin/system/activity-feed?limit=${limit}`),
  getAnalytics: (period = '7d') => adminApiRequest(`/admin/system/analytics?period=${period}`),
  
  // Role Management
  listAdmins: () => adminApiRequest('/admin/roles/admins'),
  createAdmin: (userId, role, permissions) => adminApiRequest('/admin/roles/admins', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role, permissions }),
  }),
};

// Admin Layout Component
export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Real-time WebSocket connection
  const { 
    isConnected: wsConnected, 
    metrics: realtimeMetrics, 
    notifications: realtimeNotifications,
    connectionError: wsError 
  } = useAdminWebSocket();

  // Responsive detection
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      // Auto-close sidebar on mobile
      if (width < 768) {
        setSidebarOpen(false);
      } else if (width >= 1024) {
        setSidebarOpen(true);
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(checkDevice, 100);
    });

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Load saved zoom level
  useEffect(() => {
    const savedZoom = localStorage.getItem('admin_zoom_level');
    if (savedZoom) {
      setZoomLevel(parseInt(savedZoom));
    }
  }, []);

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const token = localStorage.getItem('blendlink_token');
        
        // No token - redirect to admin login
        if (!token) {
          navigate('/admin/login');
          return;
        }
        
        // Verify admin session with secure endpoint
        const response = await fetch(`${API_BASE}/api/admin-auth/secure/check-session`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Read body as text first to avoid body stream errors
        const rawText = await response.text();
        let sessionData = {};
        try {
          sessionData = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
          console.error('Session check JSON parse error:', e);
        }
        
        if (!response.ok) {
          // Session invalid - redirect to admin login
          toast.error("Admin session expired. Please login again.");
          navigate('/admin/login');
          return;
        }
        
        if (!sessionData.valid) {
          navigate('/admin/login');
          return;
        }
        
        // Valid admin session - load admin data
        try {
          const data = await adminAPI.getProfile();
          setAdminData(data);
        } catch (profileError) {
          // If profile fails, use basic admin data from stored user
          const storedUser = localStorage.getItem('blendlink_user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setAdminData({
              admin: userData,
              stats: { total_users: 0, new_users_7d: 0 }
            });
          }
        }
      } catch (error) {
        console.error("Admin auth check failed:", error);
        navigate('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAuth();
  }, [navigate]);

  // Auto-logout after 5 minutes of inactivity
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
    let inactivityTimer;

    const resetTimer = () => {
      // Update last activity timestamp
      localStorage.setItem('admin_last_activity', Date.now().toString());
      
      // Clear existing timer
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      
      // Set new timer
      inactivityTimer = setTimeout(() => {
        // Auto-logout due to inactivity
        console.log('Admin auto-logout due to inactivity');
        localStorage.removeItem('blendlink_token');
        localStorage.removeItem('blendlink_user');
        localStorage.removeItem('admin_last_activity');
        toast.error('Session expired due to inactivity. Please login again.');
        navigate('/admin/login');
      }, INACTIVITY_TIMEOUT);
    };

    // Check if already timed out on mount
    const lastActivity = localStorage.getItem('admin_last_activity');
    if (lastActivity) {
      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceActivity > INACTIVITY_TIMEOUT) {
        // Already timed out - logout immediately
        localStorage.removeItem('blendlink_token');
        localStorage.removeItem('blendlink_user');
        localStorage.removeItem('admin_last_activity');
        navigate('/admin/login');
        return;
      }
    }

    // Activity events to track
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [navigate]);

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 10, 150);
    setZoomLevel(newZoom);
    localStorage.setItem('admin_zoom_level', newZoom.toString());
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 10, 50);
    setZoomLevel(newZoom);
    localStorage.setItem('admin_zoom_level', newZoom.toString());
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    localStorage.setItem('admin_zoom_level', '100');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

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
    { icon: Crown, label: 'Diamond Leaders', path: '/admin/diamonds' },
    { icon: UserPlus, label: 'Orphans', path: '/admin/orphans' },
    { icon: Shield, label: 'Admins', path: '/admin/admins' },
    { icon: Lock, label: 'Security', path: '/admin/security' },
    { icon: Wallet, label: 'Withdrawals', path: '/admin/withdrawals' },
    { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
    { icon: Palette, label: 'Themes', path: '/admin/themes' },
    { icon: Code, label: 'UI Editor', path: '/admin/ui-editor' },
    { icon: Layout, label: 'Pages', path: '/admin/pages' },
    { icon: GitBranch, label: 'Genealogy', path: '/admin/genealogy' },
    { icon: Bot, label: 'AI Assistant', path: '/admin/ai' },
    { icon: FileText, label: 'Audit Logs', path: '/admin/audit' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    { icon: FlaskConical, label: 'A/B Testing', path: '/admin/ab-testing' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <AdminContext.Provider value={{ adminData, setAdminData }}>
      <div className="min-h-screen min-h-[100dvh] bg-slate-900 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 sticky top-0 z-50">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-500" />
              <span className="font-bold text-white">Admin</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-slate-400 h-8 w-8">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-400 w-8 text-center">{zoomLevel}%</span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-slate-400 h-8 w-8">
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </header>
        )}

        {/* Sidebar Overlay for Mobile */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={`
            ${isMobile 
              ? `fixed left-0 top-14 bottom-0 z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
              : `${sidebarOpen ? 'w-64' : 'w-16 md:w-20'} transition-all duration-300`
            }
            ${isMobile ? 'w-72' : ''} 
            bg-slate-800 border-r border-slate-700 flex flex-col
          `}
        >
          {/* Desktop Sidebar Header */}
          {!isMobile && (
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
          )}
          
          {/* Mobile Sidebar Header */}
          {isMobile && (
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-500" />
                <span className="font-bold text-white">Admin Panel</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
          
          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors ${
                    active 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={!sidebarOpen && !isMobile ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isMobile || sidebarOpen ? '' : 'mx-auto'}`} />
                  {(sidebarOpen || isMobile) && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          
          {/* User Info & Logout */}
          <div className="border-t border-slate-700 p-4">
            {(sidebarOpen || isMobile) && (
              <div className="mb-3">
                <p className="text-white text-sm font-medium truncate">{adminData?.user?.name || 'Admin'}</p>
                <p className="text-slate-400 text-xs truncate">{adminData?.user?.email}</p>
              </div>
            )}
            <Button 
              variant="ghost" 
              className={`text-red-400 hover:text-red-300 hover:bg-red-500/10 ${sidebarOpen || isMobile ? 'w-full justify-start' : 'w-full justify-center'}`}
              onClick={() => {
                localStorage.removeItem('blendlink_token');
                navigate('/login');
              }}
            >
              <LogOut className="w-5 h-5" />
              {(sidebarOpen || isMobile) && <span className="ml-2">Logout</span>}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop Header */}
          {!isMobile && (
            <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm md:text-base overflow-hidden">
                  <Link to="/admin" className="hover:text-white flex-shrink-0">Admin</Link>
                  {location.pathname !== '/admin' && (
                    <>
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      <span className="text-white capitalize truncate">
                        {location.pathname.split('/').pop().replace('-', ' ')}
                      </span>
                    </>
                  )}
                </div>
                {/* Real-time Status Indicator */}
                <AdminRealtimeStatus 
                  isConnected={wsConnected} 
                  metrics={realtimeMetrics}
                  connectionError={wsError}
                />
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                {/* Search - Hidden on small tablets */}
                <div className="relative hidden lg:block">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-40 xl:w-64 bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleZoomOut}
                    className="text-slate-400 hover:text-white h-8 w-8"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-300 w-10 text-center font-medium">{zoomLevel}%</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleZoomIn}
                    className="text-slate-400 hover:text-white h-8 w-8"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleResetZoom}
                    className="text-slate-400 hover:text-white h-8 w-8"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={toggleFullscreen}
                    className="text-slate-400 hover:text-white h-8 w-8"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </Button>
              </div>
            </header>
          )}

          {/* Scrollable Content with Zoom */}
          <div 
            className="flex-1 overflow-auto p-3 sm:p-4 md:p-6"
            style={{ 
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top left',
              width: `${100 / (zoomLevel / 100)}%`,
              height: `${100 / (zoomLevel / 100)}%`,
            }}
          >
            <Routes>
              <Route index element={<AdminDashboardHome realtimeMetrics={realtimeMetrics} wsConnected={wsConnected} />} />
              <Route path="users/*" element={<AdminUsers />} />
              <Route path="diamonds" element={<AdminDiamondLeaders />} />
              <Route path="orphans" element={<AdminOrphans />} />
              <Route path="admins" element={<AdminManagement />} />
              <Route path="security" element={<AdminSecurityDashboard />} />
              <Route path="withdrawals" element={<AdminWithdrawals />} />
              <Route path="notifications" element={<AdminNotificationSettings />} />
              <Route path="themes" element={<AdminThemes />} />
              <Route path="ui-editor" element={<AdminUIEditor />} />
              <Route path="pages" element={<AdminPages />} />
              <Route path="genealogy" element={<AdminGenealogy />} />
              <Route path="ai" element={<AdminAI />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="ab-testing" element={<AdminABTesting />} />
              <Route path="settings" element={<AdminSettings />} />
            </Routes>
          </div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}

// Dashboard Home Component
function AdminDashboardHome({ realtimeMetrics, wsConnected }) {
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm md:text-base">Welcome to the Admin Panel</p>
      </div>

      {/* Real-time Metrics Panel */}
      <RealtimeMetricsPanel metrics={realtimeMetrics} isConnected={wsConnected} />
      
      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          label="Total Users" 
          value={stats?.users?.total || 0} 
          change={`+${stats?.users?.new_7d || 0} this week`}
          color="blue"
        />
        <StatCard 
          label="Posts" 
          value={stats?.content?.posts || 0}
          color="green"
        />
        <StatCard 
          label="Listings" 
          value={stats?.content?.listings || 0}
          color="purple"
        />
        <StatCard 
          label="BL Coins" 
          value={stats?.financial?.total_bl_coins?.toLocaleString() || 0}
          color="amber"
        />
      </div>

      {/* Quick Actions & Recent Users - Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Link to="/admin/users" className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-white">Manage Users</span>
            </Link>
            <Link to="/admin/settings" className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
              <Settings className="w-5 h-5 text-green-400" />
              <span className="text-sm text-white">Settings</span>
            </Link>
            <Link to="/admin/analytics" className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-white">Analytics</span>
            </Link>
            <Link to="/admin/ab-testing" className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
              <FlaskConical className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-white">A/B Tests</span>
            </Link>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Users</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats?.recent_users?.slice(0, 5).map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">
                      {user.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user.name}</p>
                    <p className="text-slate-400 text-xs truncate">{user.email}</p>
                  </div>
                </div>
                <span className="text-slate-400 text-xs flex-shrink-0 ml-2">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customizable Widgets */}
      <DashboardWidgets stats={stats} />
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, change, color }) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-3 md:p-4 border`}>
      <p className="text-slate-400 text-xs md:text-sm">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-white mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change && <p className="text-xs text-green-400 mt-1">{change}</p>}
    </div>
  );
}
