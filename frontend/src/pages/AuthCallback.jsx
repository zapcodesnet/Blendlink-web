import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState("Processing...");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = location.hash;
      console.log("AuthCallback: Processing hash:", hash);
      
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.error("AuthCallback: No session_id found in hash");
        setError("Invalid authentication response - no session ID");
        toast.error("Invalid authentication response");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
        return;
      }

      const sessionId = sessionIdMatch[1];
      console.log("AuthCallback: Found session_id:", sessionId.substring(0, 10) + "...");
      setStatus("Verifying your Google account...");

      try {
        await api.auth.handleGoogleCallback(sessionId);
        setStatus("Success! Redirecting...");
        toast.success("Welcome to Blendlink!");
        navigate("/feed", { replace: true });
      } catch (error) {
        console.error("AuthCallback: Auth error:", error);
        const errorMsg = error.message || "Authentication failed";
        setError(errorMsg);
        
        // More specific error messages
        if (errorMsg.includes("Failed to fetch") || errorMsg.includes("Network") || errorMsg.includes("Unable to connect")) {
          toast.error("Server connection failed. Please ensure the app is deployed and try again.");
        } else if (errorMsg.includes("Invalid session") || errorMsg.includes("401")) {
          toast.error("Session expired. Please try signing in again.");
        } else {
          toast.error("Authentication failed: " + errorMsg);
        }
        
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    };

    processSession();
  }, [navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bl-coin-gradient flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white font-bold text-2xl">BL</span>
        </div>
        <p className="text-muted-foreground">{status}</p>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
