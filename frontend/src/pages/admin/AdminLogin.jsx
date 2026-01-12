import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { 
  Shield, Lock, Mail, ArrowRight, RefreshCw,
  Eye, EyeOff, CheckCircle, Clock
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
  
  const otpRefs = useRef([]);
  
  // OTP expiry countdown timer
  useEffect(() => {
    let interval;
    if (otpExpiry > 0) {
      interval = setInterval(() => {
        setOtpExpiry(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpExpiry]);
  
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
  
  // Safe fetch helper that handles response body properly
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

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    
    setLoading(true);
    try {
      const result = await safeFetch(`${API_BASE}/api/admin-auth/secure/login/step1`, {
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
      
      // Move to step 2
      setSessionToken(result.data.session_token);
      setOtpExpiry(result.data.expires_in);
      setMaskedEmail(result.data.email_masked);
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
    if (value && !/^\d$/.test(value)) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all filled
    if (value && index === 5) {
      const fullCode = [...newOtp.slice(0, 5), value].join("");
      if (fullCode.length === 6) {
        handleStep2Submit(fullCode);
      }
    }
  };
  
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };
  
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtpCode(newOtp);
      handleStep2Submit(pastedData);
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
      const result = await safeFetch(`${API_BASE}/api/admin-auth/secure/login/step2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          otp_code: otpString,
          session_token: sessionToken 
        }),
      });
      
      if (!result.ok) {
        const errorMsg = result.data?.detail || result.rawText || "Verification failed";
        throw new Error(errorMsg);
      }
      
      if (result.parseError || !result.data) {
        throw new Error("Invalid server response");
      }
      
      // Store token and redirect
      localStorage.setItem("blendlink_token", result.data.token);
      localStorage.setItem("blendlink_user", JSON.stringify(result.data.user));
      localStorage.setItem("admin_last_activity", Date.now().toString());
      
      toast.success("Welcome to Admin Panel!");
      navigate("/admin");
      
    } catch (error) {
      toast.error(error.message || "Verification failed. Please try again.");
      setOtpCode(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Blendlink Management System</p>
        </div>
        
        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          {step === 1 ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Sign In</h2>
                <p className="text-slate-400 text-sm mt-1">Enter your admin credentials</p>
              </div>
              
              <form onSubmit={handleStep1Submit}>
                <div className="space-y-4">
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
                      />
                    </div>
                  </div>
                  
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
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
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
              
              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="flex items-start gap-3 text-sm">
                  <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300 font-medium">Secure Authentication</p>
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
              <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
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
              
              {/* Back button only - no resend */}
              <div className="flex items-center justify-center text-sm">
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
              </div>
              
              {/* Code expired message */}
              {otpExpiry === 0 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                  <p className="text-red-400 text-sm">
                    Your code has expired. Please go back and try again.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Protected by 2FA email verification • Session timeout: 5 minutes
        </p>
      </div>
    </div>
  );
}
