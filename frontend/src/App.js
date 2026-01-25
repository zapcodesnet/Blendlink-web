import { useState, useEffect, createContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import api, { getToken, getStoredUser, setStoredUser } from "./services/api";

// i18n initialization
import './i18n';

// Pages
import Landing from "./pages/Landing";
import Home from "./pages/Home";
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

// Admin System
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";

// AI Generation
import AIGeneration from "./pages/AIGeneration";
import AIGallery from "./pages/AIGallery";
import AICollections from "./pages/AICollections";
import AICollectionDetail from "./pages/AICollectionDetail";

// Social Analytics & Notifications
import Notifications from "./pages/Notifications";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AICreate from "./pages/AICreate";
import SellerDashboard from "./pages/SellerDashboard";
import GuestMarketplace from "./pages/GuestMarketplace";
import Albums from "./pages/Albums";
import AIListingCreator from "./pages/AIListingCreator";
import Casino from "./pages/Casino";
import PokerTournament, { PokerLobby } from "./pages/PokerTournament";
import Friends from "./pages/Friends";
import Groups from "./pages/Groups";
import Events from "./pages/Events";
import Pages from "./pages/Pages";
import MyTeam from "./pages/MyTeam";
import MintedPhotos from "./pages/MintedPhotos";
import PhotoGameArena from "./pages/PhotoGameArena";
import SubscriptionTiers from "./pages/SubscriptionTiers";
import Checkout from "./pages/Checkout";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import MarketplaceOffers from "./pages/MarketplaceOffers";

// Components
import BottomNav from "./components/BottomNav";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import LanguageSelector from "./components/LanguageSelector";
import LanguageTour, { useLanguageTour } from "./components/LanguageTour";

// API base URL - connected to internal backend
export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Auth context
export const AuthContext = createContext(null);

// Cart context for global cart state
export const CartContext = createContext(null);

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

  const refreshUser = async () => {
    try {
      const profile = await api.auth.getProfile();
      const balance = await api.wallet.getBalance();
      const userData = {
        ...profile,
        bl_coins: balance.balance,
      };
      setStoredUser(userData);
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return user;
    }
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
    <AuthContext.Provider value={{ user, setUser: updateUser, refreshUser }}>
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
      <Route path="/marketplace" element={<Marketplace />} /> {/* Public - guests can browse */}
      <Route path="/marketplace/:id" element={<ListingDetail />} /> {/* Public route for guest viewing */}
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
      <Route path="/my-team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
      <Route path="/raffles" element={<ProtectedRoute><Raffles /></ProtectedRoute>} />
      <Route path="/ai-studio" element={<ProtectedRoute><AIGeneration /></ProtectedRoute>} />
      <Route path="/ai-gallery" element={<ProtectedRoute><AIGallery /></ProtectedRoute>} />
      <Route path="/ai-collections" element={<ProtectedRoute><AICollections /></ProtectedRoute>} />
      <Route path="/ai-collections/:collectionId" element={<ProtectedRoute><AICollectionDetail /></ProtectedRoute>} />
      
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
      
      {/* Minted Photos & Photo Game Routes */}
      <Route path="/minted-photos" element={<ProtectedRoute><MintedPhotos /></ProtectedRoute>} />
      <Route path="/photo-game" element={<ProtectedRoute><PhotoGameArena /></ProtectedRoute>} />
      <Route path="/photo-game-arena" element={<ProtectedRoute><PhotoGameArena /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><SubscriptionTiers /></ProtectedRoute>} />
      
      {/* AI Listing Creator Route */}
      <Route path="/ai-listing-creator" element={<ProtectedRoute><AIListingCreator /></ProtectedRoute>} />
      
      {/* Checkout Route - Accessible to guests */}
      <Route path="/checkout" element={<Checkout />} />
      
      {/* Legal Pages - Public */}
      <Route path="/privacypolicy" element={<PrivacyPolicy />} />
      <Route path="/termsofservice" element={<TermsOfService />} />
      
      {/* Casino Routes */}
      <Route path="/casino" element={<ProtectedRoute><Casino /></ProtectedRoute>} />
      <Route path="/poker" element={<ProtectedRoute><PokerLobby /></ProtectedRoute>} />
      <Route path="/poker/:tournamentId" element={<ProtectedRoute><PokerTournament /></ProtectedRoute>} />
      
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
      
      {/* Marketplace Offers */}
      <Route path="/marketplace-offers" element={<ProtectedRoute><MarketplaceOffers /></ProtectedRoute>} />
      
      {/* Admin System - Secure Login */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      {/* Admin System - Full Admin Panel (Protected) */}
      <Route path="/admin/*" element={<AdminLayout />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const { showTour, tourLanguage, closeTour } = useLanguageTour();
  
  return (
    <BrowserRouter>
      <AppRouter />
      <Toaster position="top-center" richColors />
      <PWAInstallPrompt />
      <LanguageTour 
        isOpen={showTour} 
        onClose={closeTour} 
        newLanguage={tourLanguage} 
      />
    </BrowserRouter>
  );
}

export default App;
