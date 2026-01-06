import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Smartphone, Download, ExternalLink } from "lucide-react";

// Deep link schemes
const BLENDLINK_DEEP_LINK = "blendlink://";
const APP_STORE_URL = "https://apps.apple.com/app/id[YOUR_APP_ID]";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.yourcompany.blendlink";

// Detect mobile device
const isMobile = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const isIOS = () => {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

const isAndroid = () => {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
};

export const AppOpenPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  useEffect(() => {
    // Only show on mobile devices
    if (!isMobile()) return;

    // Check if user dismissed the prompt before
    const dismissed = sessionStorage.getItem("app-prompt-dismissed");
    const permanentDismissed = localStorage.getItem("app-prompt-permanent-dismissed");
    
    if (permanentDismissed) return;

    // Show full screen prompt on first visit
    if (!dismissed) {
      setShowFullScreen(true);
    } else {
      // Show banner prompt
      setTimeout(() => setShowPrompt(true), 2000);
    }
  }, []);

  const openApp = () => {
    // Try to open the native app using deep link
    const startTime = Date.now();
    
    // Create hidden iframe to try deep link (more reliable than window.location)
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = BLENDLINK_DEEP_LINK;
    document.body.appendChild(iframe);

    // Also try window.location as backup
    setTimeout(() => {
      window.location.href = BLENDLINK_DEEP_LINK;
    }, 100);

    // Check if app opened after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
      const elapsed = Date.now() - startTime;
      
      // If still here after 2.5 seconds, app probably not installed
      if (elapsed < 2500 && document.hidden !== true) {
        // App opened, do nothing
      } else if (document.visibilityState === "visible") {
        // App not installed, redirect to store
        redirectToStore();
      }
    }, 2500);
  };

  const redirectToStore = () => {
    if (isIOS()) {
      window.location.href = APP_STORE_URL;
    } else if (isAndroid()) {
      window.location.href = PLAY_STORE_URL;
    } else {
      // Generic fallback
      window.location.href = PLAY_STORE_URL;
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    setShowFullScreen(false);
    sessionStorage.setItem("app-prompt-dismissed", "true");
  };

  const permanentDismiss = () => {
    setShowPrompt(false);
    setShowFullScreen(false);
    localStorage.setItem("app-prompt-permanent-dismissed", "true");
  };

  // Don't render on desktop
  if (!isMobile()) return null;

  // Full screen prompt
  if (showFullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* Header */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {/* App Icon */}
          <div className="w-24 h-24 rounded-3xl bl-coin-gradient flex items-center justify-center mb-6 shadow-2xl">
            <span className="text-white font-bold text-4xl">BL</span>
          </div>
          
          <h1 className="text-3xl font-bold mb-3">Blendlink</h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-sm">
            Get the best experience with our native app. Faster, smoother, and packed with features!
          </p>

          {/* Benefits */}
          <div className="space-y-3 mb-8 text-left w-full max-w-sm">
            {[
              "Push notifications for messages & updates",
              "Faster loading and offline support",
              "Native camera for posts & stories",
              "Exclusive mobile-only features",
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-500 text-sm">✓</span>
                </div>
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <Button
            size="lg"
            className="w-full max-w-sm rounded-full text-lg h-14 shadow-lg shadow-primary/25 mb-4"
            onClick={openApp}
            data-testid="open-app-btn"
          >
            <Smartphone className="w-5 h-5 mr-2" />
            Open in Blendlink App
          </Button>

          {/* Download buttons */}
          <div className="flex gap-3 w-full max-w-sm mb-6">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl"
              onClick={() => window.location.href = APP_STORE_URL}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              App Store
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl"
              onClick={() => window.location.href = PLAY_STORE_URL}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
              </svg>
              Play Store
            </Button>
          </div>
        </div>

        {/* Continue to web */}
        <div className="p-6 border-t border-border">
          <button
            onClick={dismissPrompt}
            className="w-full text-center text-muted-foreground hover:text-foreground transition-colors py-3"
            data-testid="continue-web-btn"
          >
            <ExternalLink className="w-4 h-4 inline mr-2" />
            Continue to web version
          </button>
          <p className="text-center text-xs text-muted-foreground mt-2">
            <button onClick={permanentDismiss} className="underline">
              Don't show this again
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Banner prompt
  if (showPrompt) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down safe-top">
        <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-4 shadow-lg">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="font-bold">BL</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Open in Blendlink App</p>
              <p className="text-xs text-white/80 truncate">Better experience in our app</p>
            </div>
            <Button
              size="sm"
              className="bg-white text-primary hover:bg-white/90 rounded-full"
              onClick={openApp}
              data-testid="banner-open-app"
            >
              Open
            </Button>
            <button
              onClick={dismissPrompt}
              className="p-1 hover:bg-white/20 rounded-full"
              data-testid="banner-dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// CSS animation for slide down
const style = document.createElement("style");
style.textContent = `
  @keyframes slide-down {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }
  .animate-slide-down {
    animation: slide-down 0.3s ease-out forwards;
  }
`;
if (typeof document !== "undefined" && !document.querySelector("[data-app-prompt-styles]")) {
  style.setAttribute("data-app-prompt-styles", "");
  document.head.appendChild(style);
}

export default AppOpenPrompt;
