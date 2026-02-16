import { useState, useEffect, createContext, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import api, { getToken, getStoredUser, setStoredUser } from "./services/api";

// i18n initialization
import './i18n';

// ============== PERFORMANCE: Lazy Loading Page Components ==============
// Critical pages loaded synchronously for fast initial render
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";

// Pages loaded lazily for code splitting
const Home = lazy(() => import("./pages/Home"));
const Feed = lazy(() => import("./pages/Feed"));
const SocialFeed = lazy(() => import("./pages/SocialFeed"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Rentals = lazy(() => import("./pages/Rentals"));
const Services = lazy(() => import("./pages/Services"));
const Games = lazy(() => import("./pages/Games"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));
const Chat = lazy(() => import("./pages/Chat"));
const Settings = lazy(() => import("./pages/Settings"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Raffles = lazy(() => import("./pages/Raffles"));

// Media Sales Pages - lazy loaded
const MediaUpload = lazy(() => import("./pages/MediaUpload"));
const MyMedia = lazy(() => import("./pages/MyMedia"));
const MediaForSale = lazy(() => import("./pages/MediaForSale"));
const Offers = lazy(() => import("./pages/Offers"));
const Contract = lazy(() => import("./pages/Contract"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const CoinsPurchaseSuccess = lazy(() => import("./pages/CoinsPurchaseSuccess"));

// Referral/Earnings Pages - lazy loaded
const EarningsDashboard = lazy(() => import("./pages/EarningsDashboard"));
const Withdraw = lazy(() => import("./pages/Withdraw"));

// Admin System - lazy loaded (large bundle)
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));

// AI Generation - lazy loaded (heavy)
const AIGeneration = lazy(() => import("./pages/AIGeneration"));
const AIGallery = lazy(() => import("./pages/AIGallery"));
const AICollections = lazy(() => import("./pages/AICollections"));
const AICollectionDetail = lazy(() => import("./pages/AICollectionDetail"));

// Social Analytics & Notifications
const Notifications = lazy(() => import("./pages/Notifications"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const AICreate = lazy(() => import("./pages/AICreate"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const GuestMarketplace = lazy(() => import("./pages/GuestMarketplace"));
const Albums = lazy(() => import("./pages/Albums"));
const AIListingCreator = lazy(() => import("./pages/AIListingCreator"));
const Casino = lazy(() => import("./pages/Casino"));
const PokerTournament = lazy(() => import("./pages/PokerTournament").then(m => ({ default: m.default })));
const PokerLobby = lazy(() => import("./pages/PokerTournament").then(m => ({ default: m.PokerLobby })));
const Friends = lazy(() => import("./pages/Friends"));
const Groups = lazy(() => import("./pages/Groups"));
const Events = lazy(() => import("./pages/Events"));
const Pages = lazy(() => import("./pages/Pages"));
const MyTeam = lazy(() => import("./pages/MyTeam"));

// Member Pages System - Business pages with dashboards
const MemberPagesListing = lazy(() => import("./components/member-pages/MemberPagesListing"));
const MemberPageDashboard = lazy(() => import("./components/member-pages/MemberPageDashboard"));
const PublicPageView = lazy(() => import("./components/member-pages/PublicPageView"));

// Game components - Heavy, always lazy load
const MintedPhotos = lazy(() => import("./pages/MintedPhotos"));
const PhotoGameArena = lazy(() => import("./pages/PhotoGameArena"));
const BattleReplayPage = lazy(() => import("./pages/BattleReplayPage"));

const SubscriptionTiers = lazy(() => import("./pages/SubscriptionTiers"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const MarketplaceOffers = lazy(() => import("./pages/MarketplaceOffers"));
const GoogleStaffLogin = lazy(() => import("./pages/GoogleStaffLogin"));

// Components
import BottomNav from "./components/BottomNav";
import BackToGroupFAB from "./components/BackToGroupFAB";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import LanguageSelector from "./components/LanguageSelector";
import LanguageTour, { useLanguageTour } from "./components/LanguageTour";
import { getApiUrl } from "./utils/runtimeConfig";

// API base URL - connected to internal backend with runtime detection for production
export const API_BASE_URL = getApiUrl();

// Auth context
export const AuthContext = createContext(null);

// Cart context for global cart state
export const CartContext = createContext(null);

// Nav visibility context - controls bottom nav visibility in game states
export const NavContext = createContext({ 
  hideNav: false, 
  setHideNav: () => {} 
});

// Re-export api for backward compatibility
export { api };

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const [hideNav, setHideNav] = useState(false);

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
      <NavContext.Provider value={{ hideNav, setHideNav }}>
        <div className="pb-20 md:pb-0 md:pl-20">
          {children}
          {!hideNav && <BottomNav />}
          <BackToGroupFAB />
        </div>
      </NavContext.Provider>
    </AuthContext.Provider>
  );
};

// Loading fallback for lazy-loaded components - Minimal for 60fps feel
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" 
           style={{ animationDuration: '0.6s' }} />
      <span className="text-sm text-gray-500">Loading...</span>
    </div>
  </div>
);

// App Router
function AppRouter() {
  const location = useLocation();
  
  // Check for session_id in URL fragment (for Google OAuth callback)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/google" element={<GoogleStaffLogin />} />
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
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      <Route path="/payment-cancelled" element={<PaymentCancel />} />
      <Route path="/coins-purchase-success" element={<CoinsPurchaseSuccess />} />
      <Route path="/coins-purchase-cancelled" element={<Navigate to="/wallet" replace />} />
      
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
      <Route path="/battle/:sessionId" element={<BattleReplayPage />} />
      <Route path="/replay/:replayId" element={<BattleReplayPage />} />
      <Route path="/subscription" element={<ProtectedRoute><SubscriptionTiers /></ProtectedRoute>} />
      <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionTiers /></ProtectedRoute>} />
      
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
      
      {/* Member Business Pages System */}
      <Route path="/member-pages" element={<ProtectedRoute><MemberPagesListing /></ProtectedRoute>} />
      <Route path="/member-pages/:pageId" element={<ProtectedRoute><MemberPageDashboard /></ProtectedRoute>} />
      
      {/* Public Page View (custom slug - must be after all other routes to catch remaining slugs) */}
      <Route path="/p/:slug" element={<PublicPageView />} />
      
      {/* Seller Dashboard Routes */}
      <Route path="/seller-dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
      
      {/* Marketplace Offers */}
      <Route path="/marketplace-offers" element={<ProtectedRoute><MarketplaceOffers /></ProtectedRoute>} />
      
      {/* Admin System - Secure Login */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      {/* Admin System - Full Admin Panel (Protected) */}
      <Route path="/admin/*" element={<AdminLayout />} />
      
      {/* Public Member Pages - Custom Slug Route (e.g., /minimart, /my-store)
          MUST be LAST before catch-all to avoid conflicts with other routes
          This allows shareable links like blendlink.net/minimart */}
      <Route path="/:slug" element={<PublicPageView />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
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
