/**
 * Premium Light Mode Register Page
 * 
 * Redesigned to match the new Blendlink 2025-2026 design language
 */

import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api from "../services/api";
import { Eye, EyeOff, Mail, Lock, User, UserPlus, Gift, AlertTriangle, CheckCircle2, ArrowLeft, Check } from "lucide-react";
import "../styles/premium-design-system.css";

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [referralLocked, setReferralLocked] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [form, setForm] = useState({ 
    email: "", 
    password: "", 
    name: "", 
    username: "",
    referral_code: ""
  });

  // Auto-populate referral code from URL parameter and lock it
  useEffect(() => {
    const refCode = searchParams.get('ref') || searchParams.get('referral');
    if (refCode) {
      setForm(prev => ({ ...prev, referral_code: refCode.toUpperCase() }));
      setReferralLocked(true);
    }
  }, [searchParams]);

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
      navigate("/profile");
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
    <div className="bl-premium-bg min-h-screen flex flex-col items-center px-6 py-8 bl-safe-top bl-safe-bottom relative">
      {/* Background subtle glow effects */}
      <div 
        className="absolute top-[-15%] right-[-15%] w-[45%] h-[45%] rounded-full opacity-25 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 0, 204, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div 
        className="absolute bottom-[-5%] left-[-10%] w-[35%] h-[35%] rounded-full opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Disclaimer Modal */}
      <AnimatePresence>
        {showDisclaimer && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"}}}
          >
            <div 
              className="bl-glass-strong max-w-lg w-full max-h-[90vh] overflow-hidden"}}}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="p-6 border-b border-gray-200/50">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255, 180, 0, 0.15)' }}
                  >
                    <AlertTriangle className="w-6 h-6" style={{ color: '#FF9500' }} />
                  </div>
                  <div>
                    <h2 className="bl-heading-md" style={{ fontSize: '20px' }}>Important Disclaimer</h2>
                    <p className="bl-text-sm">Please read before continuing</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 max-h-[50vh] overflow-y-auto">
                {DISCLAIMER_TEXT.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="bl-text-body text-sm mb-4 whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
              
              <div className="p-6 border-t border-gray-200/50 flex gap-3">
                <button
                  className="bl-btn-secondary flex-1"
                  onClick={() => setShowDisclaimer(false)}
                >
                  Cancel
                </button>
                <button
                  className="bl-btn-primary flex-1"
                  onClick={handleAcceptDisclaimer}
                  disabled={loading}}}
                  data-testid="accept-disclaimer-btn"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {loading ? "Creating..." : "I Accept"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Back Button */}
      <div 
        className="w-full max-w-[400px] mb-4"}}
        transition={{ delay: 0.1 }}
      >
        <button
          onClick={() => navigate("/")}
          className="bl-btn-social w-11 h-11"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--bl-gray-medium)' }} />
        </button>
      </div>

      <div
        className="w-full max-w-[400px] relative z-10 flex-1"
        initial="hidden"
        animate="visible"
      >
        {/* Avatar with Plus Icon */}
        <div 
          className="flex justify-center mb-6"
        >
          <div className="bl-avatar bl-animate-glow relative">
            <img 
              src="https://customer-assets.emergentagent.com/job_857ca676-869a-4a5c-aa17-a86be06ad92a/artifacts/fb7jx2y8_Blendlink%20logo%20transparent%20background%20PNG.png"
              alt="Blendlink Logo"
              className="bl-avatar-logo"
            />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-6">
          <h1 className="bl-heading-xl mb-2" style={{ fontSize: '34px' }}>
            Create Account
          </h1>
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0, 240, 255, 0.1)' }}
          >
            <Gift className="w-4 h-4" style={{ color: 'var(--bl-cyan)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--bl-cyan)' }}>
              Get 50,000 BL Coins bonus!
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="bl-input-wrapper">
            <User 
              className="bl-input-icon" 
              strokeWidth={2}
              style={{ color: focusedField === 'name' ? '#00F0FF' : undefined }}
            />
            <input
              type="text"
              placeholder="Full name"
              className="bl-glass-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              data-testid="name-input"
            />
          </div>

          {/* Username */}
          <div className="bl-input-wrapper">
            <span 
              className="bl-input-icon font-bold text-lg"
              style={{ color: focusedField === 'username' ? '#00F0FF' : 'var(--bl-gray-light)' }}
            >
              @
            </span>
            <input
              type="text"
              placeholder="Username"
              className="bl-glass-input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              data-testid="username-input"
            />
          </div>

          {/* Email */}
          <div className="bl-input-wrapper">
            <Mail 
              className="bl-input-icon" 
              strokeWidth={2}
              style={{ color: focusedField === 'email' ? '#00F0FF' : undefined }}
            />
            <input
              type="email"
              placeholder="Email address"
              className="bl-glass-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              data-testid="email-input"
            />
          </div>

          {/* Password */}
          <div className="bl-input-wrapper">
            <Lock 
              className="bl-input-icon" 
              strokeWidth={2}
              style={{ color: focusedField === 'password' ? '#00F0FF' : undefined }}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 6 characters)"
              className="bl-glass-input"
              style={{ paddingRight: '52px' }}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              data-testid="password-input"
            />
            <button
              type="button"
              className="bl-input-toggle"
              onClick={() => setShowPassword(!showPassword)}
              style={{ color: showPassword ? '#00F0FF' : undefined }}
            >
              {showPassword ? <EyeOff strokeWidth={2} /> : <Eye strokeWidth={2} />}
            </button>
          </div>

          {/* Referral Code */}
          <div className="bl-input-wrapper">
            <Gift 
              className="bl-input-icon" 
              strokeWidth={2}
              style={{ color: focusedField === 'referral' ? '#00F0FF' : undefined }}
            />
            <input
              type="text"
              placeholder="Referral code (optional)"
              className="bl-glass-input"
              value={form.referral_code}
              onChange={(e) => !referralLocked && setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
              onFocus={() => setFocusedField('referral')}
              onBlur={() => setFocusedField(null)}
              readOnly={referralLocked}
              style={{ 
                opacity: referralLocked ? 0.8 : 1,
                background: referralLocked ? 'rgba(0, 240, 255, 0.08)' : undefined,
              }}
              data-testid="referral-input"
            />
            {referralLocked && (
              <div 
                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(0, 240, 255, 0.15)', color: 'var(--bl-cyan)' }}
              >
                <Check size={12} />
                Applied
              </div>
            )}
          </div>

          {/* Create Account Button */}
          <div>
            <button
              type="submit"
              className="bl-btn-primary mt-2"
              disabled={loading}}}
              data-testid="register-submit-btn"
            >
              {loading ? (
                <div
                  className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full"}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>

        {/* Footer - Sign In Link */}
        <p 
          className="text-center mt-8 bl-text-body"
        >
          Already have an account?{" "}
          <Link to="/login" className="bl-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
