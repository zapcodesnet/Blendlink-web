import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Download, Share } from "lucide-react";

export const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(console.error);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");

    if (isStandalone || dismissed) return;

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show iOS prompt after delay
    if (iOS && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <div className="pwa-install-banner rounded-2xl p-4 text-white shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 p-1">
            <img 
              src="/blendlink-logo.png" 
              alt="Blendlink" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Install Blendlink</h3>
            {isIOS ? (
              <p className="text-sm text-white/80">
                Tap <Share className="w-4 h-4 inline" /> then "Add to Home Screen"
              </p>
            ) : (
              <p className="text-sm text-white/80">
                Add to home screen for the best experience
              </p>
            )}
            {!isIOS && deferredPrompt && (
              <Button
                size="sm"
                className="mt-3 bg-white text-primary hover:bg-white/90"
                onClick={handleInstall}
                data-testid="install-pwa-btn"
              >
                Install Now
              </Button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded-full"
            data-testid="dismiss-pwa-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
