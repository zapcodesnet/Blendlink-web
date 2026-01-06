import React, { useContext } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Gamepad2, Coins, User } from "lucide-react";
import { AuthContext } from "../App";

export const BottomNav = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const navItems = [
    { path: "/feed", icon: Home, label: "Home" },
    { path: "/marketplace", icon: ShoppingBag, label: "Market" },
    { path: "/games", icon: Gamepad2, label: "Games" },
    { path: "/wallet", icon: Coins, label: "Wallet" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  // Hide on certain pages
  const hiddenPaths = ["/messages/"];
  if (hiddenPaths.some(p => location.pathname.includes(p))) {
    return null;
  }

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav 
        className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 md:hidden z-50 bottom-nav"
        data-testid="bottom-nav"
      >
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
                            (item.path === "/profile" && location.pathname.startsWith("/profile"));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full touch-target transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "scale-110" : ""}`} />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav 
        className="fixed left-0 top-0 bottom-0 w-20 glass border-r border-border/50 hidden md:flex flex-col items-center py-6 z-50"
        data-testid="desktop-sidebar"
      >
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bl-coin-gradient flex items-center justify-center mb-8">
          <span className="text-white font-bold text-lg">BL</span>
        </div>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
                            (item.path === "/profile" && location.pathname.startsWith("/profile"));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                data-testid={`sidebar-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs mt-1">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* User Balance */}
        {user && (
          <div className="mt-auto">
            <div className="flex flex-col items-center px-2 py-3 rounded-xl bg-amber-500/10">
              <Coins className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-xs font-medium text-amber-600">
                {Math.floor(user.bl_coins)}
              </span>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default BottomNav;
