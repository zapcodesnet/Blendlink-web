/**
 * ULTRA PREMIUM Login Page
 * 
 * Dramatically upgraded with:
 * - Strong glassmorphism (heavy blur, transparency)
 * - Very large rounded corners (32px+)
 * - Generous whitespace and breathing room
 * - Vibrant cyan-to-magenta gradient button
 * - Premium typography and micro-details
 * - Subtle animated background effects
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api from "../services/api";
import { Eye, EyeOff, Mail, Lock, User, Check } from "lucide-react";
import "../styles/premium-design-system.css";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setLoading(true);
    try {
      await api.auth.login(form.email, form.password);
      toast.success("Welcome back!");
      navigate("/profile");
    } catch (error) {
      const errorMsg = error.message || "Login failed";
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("Network")) {
        toast.error("Unable to connect to server. Please check your internet connection.");
      } else if (errorMsg.includes("Invalid credentials") || errorMsg.includes("401")) {
        toast.error("Invalid email or password. Please try again.");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    api.auth.googleAuth();
  };

  // Ultra-smooth animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 220,
        damping: 22,
      },
    },
  };

  return (
    <div className="bl-premium-bg min-h-screen flex flex-col items-center justify-center px-6 py-16 bl-safe-top bl-safe-bottom relative">
      {/* Extra ambient glow orbs */}
      <div 
        className="absolute top-[5%] left-[10%] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div 
        className="absolute bottom-[10%] right-[5%] w-[250px] h-[250px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 0, 204, 0.1) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />
      <div 
        className="absolute top-[40%] right-[20%] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <motion.div
        className="w-full max-w-[380px] relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Avatar with Blendlink Logo */}
        <motion.div 
          className="flex justify-center mb-10"
          variants={itemVariants}
        >
          <div className="bl-avatar bl-animate-glow">
            <img 
              src="https://customer-assets.emergentagent.com/job_857ca676-869a-4a5c-aa17-a86be06ad92a/artifacts/fb7jx2y8_Blendlink%20logo%20transparent%20background%20PNG.png"
              alt="Blendlink Logo"
              className="bl-avatar-logo"
            />
          </div>
        </motion.div>

        {/* Headline - Extra large and bold */}
        <motion.div className="text-center mb-10" variants={itemVariants}>
          <h1 
            className="bl-heading-xl mb-4"
            style={{ letterSpacing: '-1px' }}
          >
            Welcome back
          </h1>
          <p className="bl-text-body">
            Please sign in to continue
          </p>
        </motion.div>

        {/* Form with generous spacing */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
            <Mail 
              className="bl-input-icon" 
              strokeWidth={2}
              style={{ 
                color: focusedField === 'email' ? '#00F0FF' : undefined,
                filter: focusedField === 'email' ? 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6))' : undefined,
              }}
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

          {/* Password Input */}
          <motion.div className="bl-input-wrapper" variants={itemVariants}>
            <Lock 
              className="bl-input-icon" 
              strokeWidth={2}
              style={{ 
                color: focusedField === 'password' ? '#00F0FF' : undefined,
                filter: focusedField === 'password' ? 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6))' : undefined,
              }}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="bl-glass-input"
              style={{ paddingRight: '58px' }}
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
              style={{ 
                color: showPassword ? '#00F0FF' : undefined,
                filter: showPassword ? 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.5))' : undefined,
              }}
            >
              {showPassword ? <EyeOff strokeWidth={2} /> : <Eye strokeWidth={2} />}
            </button>
          </motion.div>

          {/* Remember Me & Forgot Password */}
          <motion.div 
            className="flex items-center justify-between pt-1"
            variants={itemVariants}
          >
            <button
              type="button"
              className="flex items-center gap-3 group"
              onClick={() => setRememberMe(!rememberMe)}
            >
              <div 
                className={`bl-checkbox ${rememberMe ? 'checked' : ''}`}
              >
                {rememberMe && <Check size={14} strokeWidth={3} color="white" />}
              </div>
              <span className="bl-text-sm" style={{ color: '#606080' }}>
                Remember me
              </span>
            </button>

            <Link 
              to="/forgot-password" 
              className="bl-link bl-text-sm"
            >
              Forgot password?
            </Link>
          </motion.div>

          {/* Sign In Button - Most eye-catching element */}
          <motion.div variants={itemVariants} className="pt-3">
            <motion.button
              type="submit"
              className="bl-btn-primary"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -3 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <motion.div
                  className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                "Sign In"
              )}
            </motion.button>
          </motion.div>
        </form>

        {/* Footer - Sign Up Link */}
        <motion.p 
          className="text-center mt-12 bl-text-body"
          variants={itemVariants}
        >
          Don&apos;t have an account?{" "}
          <Link to="/register" className="bl-link">
            Sign up
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
