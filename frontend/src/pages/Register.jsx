import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Gift } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ 
    email: "", 
    password: "", 
    name: "", 
    username: "",
    referral_code: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name || !form.username) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, form, {
        withCredentials: true
      });
      toast.success("Account created! Welcome to Blendlink!");
      navigate("/feed", { state: { user: response.data } });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleSignup = () => {
    const redirectUrl = window.location.origin + "/feed";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/")}
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-slide-up">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bl-coin-gradient flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">BL</span>
            </div>
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-muted-foreground mt-1">Get 100 BL Coins welcome bonus!</p>
          </div>

          {/* Google Signup */}
          <Button
            variant="outline"
            className="w-full mb-6 h-12 text-base"
            onClick={handleGoogleSignup}
            data-testid="google-signup-btn"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  className="pl-10 h-12"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  className="pl-10 h-12"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  data-testid="username-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10 h-12"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  data-testid="email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password (min 6 chars)"
                  className="pl-10 pr-10 h-12"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  data-testid="password-input"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral">Referral Code (Optional)</Label>
              <div className="relative">
                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="referral"
                  type="text"
                  placeholder="Enter referral code"
                  className="pl-10 h-12"
                  value={form.referral_code}
                  onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
                  data-testid="referral-input"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base rounded-full"
              disabled={loading}
              data-testid="register-submit-btn"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center mt-6 text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
