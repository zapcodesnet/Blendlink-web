import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Mail, RefreshCw, LogOut, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function EmailVerificationPending({ email, onLogout }) {
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification");
      setResent(true);
      toast.success("Verification email sent! Check your inbox.");
    } catch (error) {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      api.auth.logout();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Mail className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground">Verify Your Email</h1>
        
        <p className="text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-semibold text-foreground">{email || "your email"}</span>.
          Please check your inbox and click the link to activate your account.
        </p>

        <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground space-y-2">
          <p>Didn't receive the email?</p>
          <ul className="text-left space-y-1 pl-4">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email</li>
            <li>Wait a few minutes and try again</li>
          </ul>
        </div>

        <div className="space-y-3">
          {resent ? (
            <div className="flex items-center justify-center gap-2 text-green-600 py-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Verification email resent!</span>
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="resend-verification-btn"
            >
              {resending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Resend Verification Email
            </button>
          )}
          
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted text-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
            data-testid="verification-logout-btn"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
