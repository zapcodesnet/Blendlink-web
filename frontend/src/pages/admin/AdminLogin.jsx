import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { Shield, Lock, Mail, LogIn, Eye, EyeOff, RefreshCw } from "lucide-react";
import { getApiUrl } from "../../utils/runtimeConfig";

const API_BASE = getApiUrl();

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Check if already logged in as admin
  useEffect(() => {
    const token = localStorage.getItem("blendlink_token");
    if (token) {
      (async () => {
        try {
          const response = await fetch(`${API_BASE}/api/admin-auth/secure/check-session`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const rawText = await response.text();
          if (!response.ok) return;
          try {
            const data = JSON.parse(rawText);
            if (data.valid) {
              navigate("/admin");
            }
          } catch {
            // Invalid JSON, stay on login
          }
        } catch {
          // Network error, stay on login
        }
      })();
    }
  }, [navigate]);
  
  // Safe fetch helper
  const safeFetch = async (url, options) => {
    const response = await fetch(url, options);
    const rawText = await response.text();
    let data = null;
    let parseError = null;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      parseError = e;
    }
    return { ok: response.ok, status: response.status, data, rawText, parseError };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    
    setLoading(true);
    try {
      const result = await safeFetch(`${API_BASE}/api/admin-auth/secure/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      if (!result.ok) {
        const errorMsg = result.data?.detail || result.rawText || "Login failed";
        throw new Error(errorMsg);
      }
      
      if (result.parseError || !result.data) {
        throw new Error("Invalid server response");
      }
      
      // Store token and user data
      localStorage.setItem("blendlink_token", result.data.token);
      localStorage.setItem("blendlink_user", JSON.stringify(result.data.user));
      localStorage.setItem("admin_last_activity", Date.now().toString());
      
      toast.success("Welcome to Admin Panel!");
      navigate("/admin");
      
    } catch (error) {
      toast.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Blendlink Management System</p>
        </div>
        
        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Sign In</h2>
            <p className="text-slate-400 text-sm mt-1">Enter your admin credentials</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    placeholder="admin@example.com"
                    data-testid="admin-email-input"
                    autoComplete="email"
                  />
                </div>
              </div>
              
              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    placeholder="••••••••"
                    data-testid="admin-password-input"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
              disabled={loading}
              data-testid="admin-login-submit"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              Sign In
            </Button>
          </form>
          
          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-start gap-3 text-sm">
              <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-300 font-medium">Secure Access</p>
                <p className="text-xs text-slate-400 mt-1">
                  This area is restricted to authorized administrators only.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Protected by password authentication • Session timeout: 24 hours
        </p>
      </div>
    </div>
  );
}
