import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { 
  Shield, Lock, Mail, ArrowRight, RefreshCw,
  Eye, EyeOff, AlertTriangle, CheckCircle, Clock
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = credentials, 2 = OTP verification
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Step 1: Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Step 2: OTP
  const [sessionToken, setSessionToken] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const otpRefs = useRef([]);
  
  // Countdown timers
  useEffect(() => {
    let interval;
    if (otpExpiry > 0) {
      interval = setInterval(() => {
        setOtpExpiry(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpExpiry]);
  
  useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);
  
  // Check if already logged in as admin
  useEffect(() => {
    const token = localStorage.getItem("blendlink_token");
    if (token) {
      // Verify if it's a valid admin session
      fetch(`${API_BASE}/api/admin-auth/secure/check-session`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) {
            // Not a valid admin session, clear and stay on login
            return { valid: false };
          }
          return res.json();
        })
        .then(data => {
          if (data.valid) {
            navigate("/admin");
          }
        })
        .catch(() => {
          // Silently fail - user stays on login page
        });
    }
  }, [navigate]);
  
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin-auth/secure/login/step1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }
      
      // Move to step 2
      setSessionToken(data.session_token);
      setOtpExpiry(data.expires_in);
      setMaskedEmail(data.email_masked);
      setResendCooldown(60);
      setStep(2);
      toast.success("Verification code sent to your email!");
      
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      
    } catch (error) {
      toast.error(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits entered
    if (value && index === 5 && newOtp.every(d => d)) {
      handleStep2Submit(newOtp.join(""));
    }
  };
  
  const handleOtpKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("");
        const newOtp = [...otpCode];
        digits.forEach((d, i) => {
          if (i < 6) newOtp[i] = d;
        });
        setOtpCode(newOtp);
        if (digits.length === 6) {
          handleStep2Submit(newOtp.join(""));
        }
      });
    }
  };
  
  const handleStep2Submit = async (code = null) => {
    const otpString = code || otpCode.join("");
    if (otpString.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin-auth/secure/login/step2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          otp_code: otpString,
          session_token: sessionToken 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Verification failed");
      }
      
      // Store token and redirect - also set last activity for auto-logout
      localStorage.setItem("blendlink_token", data.token);
      localStorage.setItem("blendlink_user", JSON.stringify(data.user));
      localStorage.setItem("admin_last_activity", Date.now().toString());
      
      toast.success("Welcome to Admin Panel!");
      navigate("/admin");
      
    } catch (error) {
      toast.error(error.message || "Verification failed. Please try again.");
      // Clear OTP on error
      setOtpCode(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };
  
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin-auth/secure/login/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, session_token: sessionToken }),
      });
      
      // Clone response before reading to avoid "body stream already read" error
      const responseClone = response.clone();
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        try {
          data = await responseClone.json();
        } catch {
          throw new Error("Server error. Please try again.");
        }
      }
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to resend code");
      }
      
      setOtpExpiry(data.expires_in);
      setResendCooldown(60);
      setOtpCode(["", "", "", "", "", ""]);
      toast.success("New verification code sent!");
      otpRefs.current[0]?.focus();
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-slate-400 mt-1">Blendlink Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl">
          {step === 1 ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Sign In</h2>
                <p className="text-slate-400 text-sm mt-1">Enter your admin credentials</p>
              </div>
              
              <form onSubmit={handleStep1Submit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@blendlink.net"
                      className="pl-10 bg-slate-700/50 border-slate-600 focus:border-blue-500"
                      required
                      data-testid="admin-email-input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-slate-700/50 border-slate-600 focus:border-blue-500"
                      required
                      data-testid="admin-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  disabled={loading}
                  data-testid="admin-login-submit"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-5 h-5 mr-2" />
                  )}
                  Continue
                </Button>
              </form>
              
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-300 font-medium">Secure Authentication</p>
                    <p className="text-xs text-slate-400 mt-1">
                      A verification code will be sent to your registered email after password verification.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Verify Your Identity</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Enter the 6-digit code sent to <span className="text-blue-400">{maskedEmail}</span>
                </p>
              </div>
              
              {/* OTP Timer */}
              <div className={`flex items-center justify-center gap-2 mb-6 p-3 rounded-lg ${
                otpExpiry > 60 ? 'bg-green-500/10 border border-green-500/20' : 
                otpExpiry > 0 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                'bg-red-500/10 border border-red-500/20'
              }`}>
                <Clock className={`w-5 h-5 ${
                  otpExpiry > 60 ? 'text-green-400' : 
                  otpExpiry > 0 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className={`font-mono font-medium ${
                  otpExpiry > 60 ? 'text-green-400' : 
                  otpExpiry > 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {otpExpiry > 0 ? formatTime(otpExpiry) : 'Code expired'}
                </span>
              </div>
              
              {/* OTP Input */}
              <div className="flex justify-center gap-3 mb-6">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-slate-700/50 border-2 border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
                    data-testid={`otp-input-${index}`}
                  />
                ))}
              </div>
              
              {/* Verify Button */}
              <Button 
                onClick={() => handleStep2Submit()}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 mb-4"
                disabled={loading || otpCode.join("").length !== 6}
                data-testid="verify-otp-submit"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                Verify & Sign In
              </Button>
              
              {/* Resend / Back */}
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => {
                    setStep(1);
                    setOtpCode(["", "", "", "", "", ""]);
                    setSessionToken("");
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ← Back to login
                </button>
                
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className={`flex items-center gap-1 ${
                    resendCooldown > 0 ? 'text-slate-500' : 'text-blue-400 hover:text-blue-300'
                  } transition-colors`}
                >
                  <RefreshCw className="w-4 h-4" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
              
              {/* Warning for expired */}
              {otpExpiry === 0 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">
                    Your verification code has expired. Please request a new code.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Protected by Blendlink Security • Unauthorized access is prohibited
        </p>
      </div>
    </div>
  );
}
