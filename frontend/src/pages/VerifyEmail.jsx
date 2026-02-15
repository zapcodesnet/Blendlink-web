import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getApiUrl } from "../utils/runtimeConfig";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

const API_BASE = getApiUrl();

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | success | already_verified | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      verifyToken(token);
    } else {
      setStatus("error");
      setMessage("No verification token found.");
    }
  }, [searchParams]);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (response.ok) {
        if (data.status === "already_verified") {
          setStatus("already_verified");
          setMessage(data.message);
        } else {
          setStatus("success");
          setMessage(data.message);
        }
      } else {
        setStatus("error");
        setMessage(data.detail || "Verification failed.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Unable to verify. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "verifying" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <h1 className="text-2xl font-bold text-foreground">Verifying your email...</h1>
            <p className="text-muted-foreground">Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Email Verified!</h1>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
              data-testid="verified-login-btn"
            >
              Continue to Login
            </button>
          </>
        )}

        {status === "already_verified" && (
          <>
            <div className="w-16 h-16 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Already Verified</h1>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Go to Login
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Verification Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-muted text-foreground rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
