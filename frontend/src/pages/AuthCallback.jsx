import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { API } from "../App";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        toast.error("Invalid authentication response");
        navigate("/login", { replace: true });
        return;
      }

      const sessionId = sessionIdMatch[1];

      try {
        const response = await axios.post(
          `${API}/auth/google-session`,
          { session_id: sessionId },
          { withCredentials: true }
        );
        
        toast.success("Welcome to Blendlink!");
        navigate("/feed", { state: { user: response.data.user }, replace: true });
      } catch (error) {
        console.error("Auth error:", error);
        toast.error("Authentication failed. Please try again.");
        navigate("/login", { replace: true });
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
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
