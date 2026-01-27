import React, { useContext, useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  Home, ShoppingBag, Bell, Coins, User, MoreHorizontal, 
  Image, Facebook, X, ChevronUp 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../App";
import { FacebookShareOverlay } from "./FacebookShareOverlay";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export const BottomNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFacebookOverlay, setShowFacebookOverlay] = useState(false);
  const moreMenuRef = useRef(null);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem('blendlink_token');
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/api/notifications/?limit=1`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unread_count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch notification count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };
    
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Main navigation items (5 items)
  const mainNavItems = [
    { path: "/feed", icon: Home, label: t('nav.home') || "Home" },
    { path: "/marketplace", icon: ShoppingBag, label: t('nav.marketplace') || "Market" },
    { path: "/notifications", icon: Bell, label: t('notifications.title') || "Alerts", badge: unreadCount },
    { path: "/wallet", icon: Coins, label: t('nav.wallet') || "Wallet" },
    { path: "/profile", icon: User, label: t('nav.profile') || "Profile" },
  ];

  // "More" menu items
  const moreMenuItems = [
    { 
      id: "minted-photos",
      path: "/minted-photos", 
      icon: Image, 
      label: "Minted Photos",
      description: "Your photo collectibles",
      action: () => {
        navigate('/minted-photos');
        setShowMoreMenu(false);
      }
    },
    { 
      id: "facebook-group",
      path: null, 
      icon: Facebook, 
      label: "Community Group",
      description: "Share & earn BL coins",
      action: () => {
        setShowMoreMenu(false);
        setShowFacebookOverlay(true);
      }
    },
  ];

  // Hide on certain pages
  const hiddenPaths = ["/messages/"];
  if (hiddenPaths.some(p => location.pathname.includes(p))) {
    return null;
  }

  const handleVisitGroup = () => {
    sessionStorage.setItem('visited_fb_group', 'true');
  };

  return (
    <>
      {/* Mobile Bottom Nav - Semi-transparent floating */}
      <nav 
        className="fixed bottom-0 left-0 right-0 md:hidden z-50"
        data-testid="bottom-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Floating container with enhanced glass effect - 60% opacity */}
        <div className="mx-3 mb-2 rounded-2xl bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-around h-16 px-1">
            {mainNavItems.map((item, index) => {
              const isActive = location.pathname === item.path || 
                              (item.path === "/profile" && location.pathname.startsWith("/profile"));
              
              // Insert "More" button after Wallet (index 3)
              if (index === 4) {
                return (
                  <React.Fragment key="more-and-profile">
                    {/* More Menu Button */}
                    <div ref={moreMenuRef} className="relative">
                      <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all touch-target ${
                          showMoreMenu 
                            ? "bg-gradient-to-br from-purple-600/30 to-pink-600/30 text-pink-400" 
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                        data-testid="nav-more"
                      >
                        <div className="relative">
                          {showMoreMenu ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <MoreHorizontal className="w-5 h-5" />
                          )}
                        </div>
                        <span className="text-[10px] mt-0.5 font-medium">More</span>
                      </button>

                      {/* More Menu Popup */}
                      <AnimatePresence>
                        {showMoreMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full mb-2 right-0 w-56 bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/30 overflow-hidden"
                            data-testid="more-menu"
                          >
                            {moreMenuItems.map((menuItem) => (
                              <button
                                key={menuItem.id}
                                onClick={menuItem.action}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
                                data-testid={`more-menu-${menuItem.id}`}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                  menuItem.id === 'facebook-group' 
                                    ? 'bg-gradient-to-br from-blue-600 to-blue-700' 
                                    : 'bg-gradient-to-br from-purple-600 to-pink-600'
                                }`}>
                                  <menuItem.icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-white text-sm">{menuItem.label}</p>
                                  <p className="text-xs text-gray-400">{menuItem.description}</p>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Profile (last item) */}
                    <NavLink
                      to={item.path}
                      className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all touch-target ${
                        isActive 
                          ? "bg-primary/20 text-primary" 
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <div className="relative">
                        <item.icon className={`w-5 h-5 ${isActive ? "scale-110" : ""}`} />
                        {item.badge > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[14px] h-3.5 flex items-center justify-center rounded-full px-1">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                    </NavLink>
                  </React.Fragment>
                );
              }
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all touch-target ${
                    isActive 
                      ? "bg-primary/20 text-primary" 
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${isActive ? "scale-110" : ""}`} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[14px] h-3.5 flex items-center justify-center rounded-full px-1">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav 
        className="fixed left-0 top-0 bottom-0 w-24 bg-gray-900/90 backdrop-blur-xl border-r border-gray-700/50 hidden md:flex flex-col items-center py-6 z-50"
        data-testid="desktop-sidebar"
      >
        {/* Logo */}
        <div className="w-16 h-16 flex items-center justify-center mb-8">
          <img 
            src="/blendlink-logo.png" 
            alt="Blendlink" 
            className="w-full h-full object-contain"
          />
        </div>

        {/* Main Nav Items */}
        <div className="flex-1 flex flex-col items-center gap-2">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path || 
                            (item.path === "/profile" && location.pathname.startsWith("/profile"));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors relative ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
                data-testid={`sidebar-${item.label.toLowerCase()}`}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1">{item.label}</span>
              </NavLink>
            );
          })}

          {/* Divider */}
          <div className="w-10 h-px bg-gray-700 my-2" />

          {/* More Menu Items - Direct on Desktop */}
          {moreMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors relative ${
                item.path && location.pathname === item.path
                  ? "bg-primary/10 text-primary" 
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
              data-testid={`sidebar-${item.id}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] mt-1 text-center leading-tight">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* User Balance */}
        {user && (
          <div className="mt-auto">
            <div className="flex flex-col items-center px-2 py-3 rounded-xl bg-amber-500/10">
              <Coins className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-xs font-medium text-amber-600">
                {Math.floor(user.bl_coins || 0)}
              </span>
            </div>
          </div>
        )}
      </nav>

      {/* Facebook Share Overlay */}
      <FacebookShareOverlay
        isOpen={showFacebookOverlay}
        onClose={() => setShowFacebookOverlay(false)}
        onVisitGroup={handleVisitGroup}
      />
    </>
  );
};

export default BottomNav;
