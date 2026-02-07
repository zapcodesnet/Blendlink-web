/**
 * Premium Layout Component
 * 
 * Shared layout for all non-gaming pages with:
 * - Glassmorphic header/navigation
 * - Premium background gradient
 * - Bottom navigation bar
 * - Consistent styling across the app
 */

import React, { useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../../App";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import {
  Home, Search, ShoppingBag, User, Bell, Menu, X,
  Sparkles, Coins, Settings, LogOut, MessageCircle,
  Image, Gamepad2, Gift, Users, ChevronDown
} from "lucide-react";
import "../../styles/premium-design-system.css";

// Premium Header Component
export const PremiumHeader = ({ title, showBack = false, rightContent }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <header 
        className="fixed top-0 left-0 right-0 z-50 px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto flex items-center justify-between gap-4 bl-glass px-4 py-2.5"
          style={{ borderRadius: '18px' }}
        >
          {/* Left */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'rgba(0, 31, 63, 0.05)' }}
              >
                <ChevronDown className="w-5 h-5 rotate-90" style={{ color: '#001F3F' }} />
              </button>
            ) : (
              <Link to="/feed" className="flex items-center gap-2">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #00F0FF, #FF00CC)' }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </Link>
            )}
            
            {title && (
              <h1 className="text-lg font-bold" style={{ color: '#001F3F' }}>{title}</h1>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {rightContent}
            
            {user && (
              <>
                {/* Coins */}
                <Link 
                  to="/wallet"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(245, 158, 11, 0.1)' }}
                >
                  <Coins className="w-4 h-4" style={{ color: '#F59E0B' }} />
                  <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
                    {(user.bl_coins || 0).toLocaleString()}
                  </span>
                </Link>
                
                {/* Notifications */}
                <Link 
                  to="/notifications"
                  className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                  style={{ background: 'rgba(0, 31, 63, 0.05)' }}
                >
                  <Bell className="w-5 h-5" style={{ color: '#606080' }} />
                  {user.unread_notifications > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                      style={{ background: '#FF00CC' }}
                    >
                      {user.unread_notifications > 9 ? '9+' : user.unread_notifications}
                    </span>
                  )}
                </Link>
                
                {/* Profile */}
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-9 h-9 rounded-xl overflow-hidden"
                  style={{ 
                    border: '2px solid rgba(0, 240, 255, 0.3)',
                  }}
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={user.profile_picture} />
                    <AvatarFallback 
                      className="text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #00F0FF, #FF00CC)', color: 'white' }}
                    >
                      {user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </header>

      {/* Profile Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="fixed right-4 z-50 w-64 bl-glass-strong p-2"
              style={{ 
                top: 'calc(max(12px, env(safe-area-inset-top)) + 60px)',
                borderRadius: '20px'
              }}
            >
              <Link 
                to="/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors"
              >
                <User className="w-5 h-5" style={{ color: '#606080' }} />
                <span className="font-medium" style={{ color: '#001F3F' }}>Profile</span>
              </Link>
              <Link 
                to="/settings"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors"
              >
                <Settings className="w-5 h-5" style={{ color: '#606080' }} />
                <span className="font-medium" style={{ color: '#001F3F' }}>Settings</span>
              </Link>
              <hr className="my-2 border-gray-200" />
              <button 
                onClick={() => {
                  setShowMenu(false);
                  // Logout logic
                }}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors w-full"
              >
                <LogOut className="w-5 h-5 text-red-500" />
                <span className="font-medium text-red-500">Log Out</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// Premium Bottom Navigation
export const PremiumBottomNav = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  
  // Don't show on game pages
  const gameRoutes = ['/photo-game', '/casino', '/poker'];
  if (gameRoutes.some(route => location.pathname.startsWith(route))) {
    return null;
  }

  const navItems = [
    { icon: Home, label: 'Home', path: '/feed' },
    { icon: Search, label: 'Explore', path: '/marketplace' },
    { icon: Image, label: 'Photos', path: '/minted-photos' },
    { icon: MessageCircle, label: 'Chat', path: '/messages' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => {
    if (path === '/feed') return location.pathname === '/feed' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-2"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto bl-glass px-2 py-2"
        style={{ borderRadius: '24px' }}
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center py-2 px-4 rounded-2xl transition-all"
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(255, 0, 204, 0.1))' : 'transparent',
                }}
              >
                <item.icon 
                  className="w-6 h-6 mb-1"
                  style={{ 
                    color: active ? '#00F0FF' : '#9090B0',
                    filter: active ? 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.5))' : 'none'
                  }}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span 
                  className="text-[10px] font-semibold"
                  style={{ color: active ? '#00F0FF' : '#9090B0' }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </motion.div>
    </nav>
  );
};

// Main Premium Layout Wrapper
export const PremiumLayout = ({ 
  children, 
  title, 
  showHeader = true, 
  showBottomNav = true,
  showBack = false,
  headerRightContent,
  className = ""
}) => {
  return (
    <div className={`bl-premium-bg min-h-screen ${className}`}>
      {showHeader && (
        <PremiumHeader 
          title={title} 
          showBack={showBack}
          rightContent={headerRightContent}
        />
      )}
      
      <main 
        className="relative z-10"
        style={{ 
          paddingTop: showHeader ? 'calc(max(12px, env(safe-area-inset-top)) + 70px)' : '0',
          paddingBottom: showBottomNav ? 'calc(max(8px, env(safe-area-inset-bottom)) + 90px)' : '0',
        }}
      >
        {children}
      </main>
      
      {showBottomNav && <PremiumBottomNav />}
    </div>
  );
};

export default PremiumLayout;
