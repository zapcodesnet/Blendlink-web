import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import api from "../services/api";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Gift, AlertTriangle, CheckCircle2 } from "lucide-react";

// Disclaimer text
const DISCLAIMER_TEXT = `Blendlink involves financial risks, including potential loss of money. All activities are for entertainment and networking purposes. Users must comply with local laws. BL coins have no cash value and are not redeemable for real money.

By creating an account, you acknowledge that:
• You are at least 18 years old
• You understand the risks involved with any financial activities on this platform
• BL coins are virtual currency with no real-world cash value
• You are responsible for complying with your local laws and regulations
• Blendlink is not responsible for any losses incurred through platform activities`;

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
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
    
    // Show disclaimer if not yet accepted
    if (!disclaimerAccepted) {
      setShowDisclaimer(true);
      return;
    }
    
    await submitRegistration();
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      const response = await api.auth.register({
        email: form.email,
        password: form.password,
        name: form.name,
        username: form.username,
        referral_code: form.referral_code || undefined,
        disclaimer_accepted: true,
      });
      
      const bonus = response.bl_coins_bonus || 50000;
      toast.success(`Account created! You earned ${bonus.toLocaleString()} BL Coins!`);
      navigate("/home");
    } catch (error) {
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDisclaimer = () => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    submitRegistration();
  };

  const handleGoogleSignup = () => {
    // Show disclaimer first for Google signup too
    if (!disclaimerAccepted) {
      setShowDisclaimer(true);
      return;
    }
    api.auth.googleAuth();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Important Disclaimer</h2>
                  <p className="text-sm text-muted-foreground">Please read before continuing</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert">
                {DISCLAIMER_TEXT.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-sm text-muted-foreground mb-4 whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDisclaimer(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary"
                onClick={handleAcceptDisclaimer}
                disabled={loading}
                data-testid="accept-disclaimer-btn"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {loading ? "Creating..." : "I Understand & Accept"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
            <img 
              src="/blendlink-logo.png" 
              alt="Blendlink" 
              className="w-32 h-32 object-contain mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-muted-foreground mt-1">Get 50,000 BL Coins welcome bonus!</p>
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
              <p className="text-xs text-muted-foreground">
                Both you and your referrer get 50,000 BL coins bonus!
              </p>
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

          {/* Sync info */}
          <p className="text-center mt-4 text-xs text-muted-foreground">
            🔄 Your account syncs with the Blendlink mobile app
          </p>
          
          {/* Disclaimer note */}
          <p className="text-center mt-2 text-xs text-muted-foreground/60">
            By signing up, you agree to our terms and disclaimer
          </p>
        </div>
      </div>
    </div>
  );
}
