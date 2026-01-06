import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "./components/ui/sonner";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Feed from "./pages/Feed";
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

// Components
import BottomNav from "./components/BottomNav";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth context
export const AuthContext = React.createContext(null);

// Import React
import React from "react";

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const [user, setUser] = useState(location.state?.user || null);

  useEffect(() => {
    if (location.state?.user) return;
    
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        setUser(response.data);
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        navigate("/login", { replace: true });
      }
    };
    
    checkAuth();
  }, [navigate, location.state]);

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
    <AuthContext.Provider value={{ user, setUser }}>
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
  
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check for session_id in URL fragment (for Google OAuth callback)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
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
