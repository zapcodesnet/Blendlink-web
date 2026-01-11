import { useState, useEffect, createContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import api, { getToken, getStoredUser, setStoredUser } from "./services/api";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Feed from "./pages/Feed";
import SocialFeed from "./pages/SocialFeed";
import Marketplace from "./pages/Marketplace";
import Rentals from "./pages/Rentals";
import Services from "./pages/Services";
import Games from "./pages/Games";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import CreatePost from "./pages/CreatePost";
import CreateListing from "./pages/CreateListing";
import ListingDetail from "./pages/ListingDetail";
import PropertyDetail from "./pages/PropertyDetail";
import ServiceDetail from "./pages/ServiceDetail";
import Referrals from "./pages/Referrals";
import Raffles from "./pages/Raffles";

// Media Sales Pages
import MediaUpload from "./pages/MediaUpload";
import MyMedia from "./pages/MyMedia";
import MediaForSale from "./pages/MediaForSale";
import Offers from "./pages/Offers";
import Contract from "./pages/Contract";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";

// Referral/Earnings Pages
import EarningsDashboard from "./pages/EarningsDashboard";
import Withdraw from "./pages/Withdraw";
import AdminDashboard from "./pages/AdminDashboard";

// Admin System (New)
import AdminLayout from "./pages/admin/AdminLayout";

// Social Analytics & Notifications
import Notifications from "./pages/Notifications";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AICreate from "./pages/AICreate";
import SellerDashboard from "./pages/SellerDashboard";
import GuestMarketplace from "./pages/GuestMarketplace";
import Albums from "./pages/Albums";
import AIListingCreator from "./pages/AIListingCreator";
import Casino from "./pages/Casino";
import Friends from "./pages/Friends";
import Groups from "./pages/Groups";
import Events from "./pages/Events";
import Pages from "./pages/Pages";

// Components
import BottomNav from "./components/BottomNav";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

// API base URL - connected to internal backend
export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Auth context
export const AuthContext = createContext(null);

// Re-export api for backward compatibility
export { api };

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      const storedUser = getStoredUser();
      
      if (!token) {
        setIsAuthenticated(false);
        navigate("/login", { replace: true });
        return;
      }

      // Try to get fresh user data
      try {
        const profile = await api.auth.getProfile();
        const balance = await api.wallet.getBalance();
        const userData = {
          ...profile,
          bl_coins: balance.balance,
        };
        setStoredUser(userData);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        // If API fails but we have stored user, use that
        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          navigate("/login", { replace: true });
        }
      }
    };
    
    checkAuth();
  }, [navigate]);

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    setStoredUser(updatedUser);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser }}>
      <div className="pb-20 md:pb-0 md:pl-20">
        {children}
        <BottomNav />
      </div>
    </AuthContext.Provider>
  );
};

// App Router
function AppRouter() {
  const location = useLocation();
  
  // Check for session_id in URL fragment (for Google OAuth callback)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/marketplace/guest" element={<GuestMarketplace />} />
      <Route path="/feed" element={<ProtectedRoute><SocialFeed /></ProtectedRoute>} />
      <Route path="/social" element={<ProtectedRoute><SocialFeed /></ProtectedRoute>} />
      <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
      <Route path="/marketplace/:id" element={<ProtectedRoute><ListingDetail /></ProtectedRoute>} />
      <Route path="/marketplace/create" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
      <Route path="/rentals" element={<ProtectedRoute><Rentals /></ProtectedRoute>} />
      <Route path="/rentals/:id" element={<ProtectedRoute><PropertyDetail /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
      <Route path="/services/:id" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
      <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/messages/:id" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/create-post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
      <Route path="/raffles" element={<ProtectedRoute><Raffles /></ProtectedRoute>} />
      
      {/* Media Sales Routes */}
      <Route path="/upload-media" element={<ProtectedRoute><MediaUpload /></ProtectedRoute>} />
      <Route path="/my-media" element={<ProtectedRoute><MyMedia /></ProtectedRoute>} />
      <Route path="/media-for-sale" element={<MediaForSale />} />
      <Route path="/offers" element={<ProtectedRoute><Offers /></ProtectedRoute>} />
      <Route path="/contract/:contractId" element={<Contract />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      
      {/* Earnings/Referral Routes */}
      <Route path="/earnings" element={<ProtectedRoute><EarningsDashboard /></ProtectedRoute>} />
      <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
      
      {/* Notifications & Analytics Routes */}
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
      <Route path="/ai-create" element={<ProtectedRoute><AICreate /></ProtectedRoute>} />
      
      {/* Albums Routes */}
      <Route path="/albums" element={<ProtectedRoute><Albums /></ProtectedRoute>} />
      
      {/* AI Listing Creator Route */}
      <Route path="/ai-listing-creator" element={<ProtectedRoute><AIListingCreator /></ProtectedRoute>} />
      
      {/* Casino Routes */}
      <Route path="/casino" element={<ProtectedRoute><Casino /></ProtectedRoute>} />
      
      {/* Social Features Routes */}
      <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/groups/:id" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/pages" element={<ProtectedRoute><Pages /></ProtectedRoute>} />
      <Route path="/pages/:id" element={<ProtectedRoute><Pages /></ProtectedRoute>} />
      
      {/* Seller Dashboard Routes */}
      <Route path="/seller-dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
      <Toaster position="top-center" richColors />
      <PWAInstallPrompt />
    </BrowserRouter>
  );
}

export default App;
