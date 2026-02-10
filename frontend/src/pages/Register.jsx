/**
 * Premium Light Mode Register Page
 * 
 * Redesigned to match the new Blendlink 2025-2026 design language
 */

import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
      navigate("/feed");
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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 280,
        damping: 26,
      },
    },
  };

  return (
    <div className="bl-premium-bg min-h-screen flex flex-col items-center px-6 py-8 bl-safe-top bl-safe-bottom relative overflow-hidden">
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
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bl-glass-strong max-w-lg w-full max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
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
                <motion.button
                  className="bl-btn-primary flex-1"
                  onClick={handleAcceptDisclaimer}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="accept-disclaimer-btn"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {loading ? "Creating..." : "I Accept"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back Button */}
      <motion.div 
        className="w-full max-w-[400px] mb-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <button
          onClick={() => navigate("/")}
          className="bl-btn-social w-11 h-11"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--bl-gray-medium)' }} />
        </button>
      </motion.div>

      <motion.div
        className="w-full max-w-[400px] relative z-10 flex-1"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Avatar with Plus Icon */}
        <motion.div 
          className="flex justify-center mb-6"
          variants={itemVariants}
        >
          <div className="bl-avatar bl-animate-glow relative">
            <img 
              src="https://customer-assets.emergentagent.com/job_857ca676-869a-4a5c-aa17-a86be06ad92a/artifacts/fb7jx2y8_Blendlink%20logo%20transparent%20background%20PNG.png"
              alt="Blendlink Logo"
              className="bl-avatar-logo"
            />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div className="text-center mb-6" variants={itemVariants}>
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
        </motion.div>

        {/* Google Signup */}
        <motion.div variants={itemVariants}>
          <motion.button
            type="button"
            className="bl-btn-secondary mb-5 gap-3"
            onClick={handleGoogleSignup}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid="google-signup-btn"
          >
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </motion.button>
        </motion.div>

        {/* Divider */}
        <motion.div className="bl-divider" variants={itemVariants}>
          <span className="bl-divider-text">or</span>
        </motion.div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
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
          </motion.div>

          {/* Username */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
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
          </motion.div>

          {/* Email */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
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
          </motion.div>

          {/* Password */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
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
          </motion.div>

          {/* Referral Code */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
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
          </motion.div>

          {/* Create Account Button */}
          <motion.div variants={itemVariants}>
            <motion.button
              type="submit"
              className="bl-btn-primary mt-2"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              data-testid="register-submit-btn"
            >
              {loading ? (
                <motion.div
                  className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                "Create Account"
              )}
            </motion.button>
          </motion.div>
        </form>

        {/* Footer - Sign In Link */}
        <motion.p 
          className="text-center mt-8 bl-text-body"
          variants={itemVariants}
        >
          Already have an account?{" "}
          <Link to="/login" className="bl-link">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
