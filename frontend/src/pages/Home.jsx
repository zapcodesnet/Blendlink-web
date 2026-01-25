import React, { useEffect, useState, useContext, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, Image, Swords, ExternalLink, RefreshCw, Facebook, Heart, MessageCircle, Share2, Coins } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AuthContext } from '../App';

// Elfsight Facebook Feed Widget Component
// To set up: Create free widget at https://elfsight.com/facebook-feed-widget/create/
// Connect your Facebook page, customize, and copy the widget ID
const ELFSIGHT_WIDGET_ID = null; // Set to your Elfsight widget ID like "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

const SocialFeedEmbed = ({ pageUrl }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // If no widget ID configured, show the promotional fallback
    if (!ELFSIGHT_WIDGET_ID) {
      setLoaded(true);
      return;
    }

    // Load Elfsight platform script
    const loadElfsight = () => {
      if (document.querySelector('script[src*="elfsight.com"]')) {
        setLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://static.elfsight.com/platform/platform.js';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-use-service-core', 'true');
      
      script.onload = () => {
        setLoaded(true);
      };
      
      script.onerror = () => {
        setError(true);
      };

      document.body.appendChild(script);
    };

    loadElfsight();

    // Check if widget rendered after timeout
    const checkRender = setTimeout(() => {
      if (containerRef.current) {
        const widget = containerRef.current.querySelector('.elfsight-app-' + ELFSIGHT_WIDGET_ID);
        if (widget && widget.clientHeight < 50) {
          setError(true);
        }
      }
    }, 8000);

    return () => clearTimeout(checkRender);
  }, []);

  // Show promotional community section when no widget ID is configured
  if (!ELFSIGHT_WIDGET_ID) {
    return (
      <div className="space-y-4">
        {/* Community Engagement Card */}
        <div className="bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-pink-900/20 rounded-2xl p-5 border border-blue-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-lg"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-full w-12 h-12 flex items-center justify-center">
                <Facebook className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-white font-bold">Blendlink Community</h3>
              <p className="text-blue-300 text-xs">@blendlinkapp</p>
            </div>
          </div>
          
          {/* Engagement CTA */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Coins className="w-5 h-5" />
              <span className="font-semibold text-sm">Earn BL Coins!</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Like, comment, and share our posts to earn rewards. Post your minted photos on Facebook for bonus coins!
            </p>
          </div>

          {/* Quick Stats Preview */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-800/40 rounded-lg p-3 text-center">
              <Heart className="w-5 h-5 text-pink-400 mx-auto mb-1" />
              <span className="text-xs text-gray-400">Like = 5 BL</span>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 text-center">
              <MessageCircle className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <span className="text-xs text-gray-400">Comment = 10 BL</span>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 text-center">
              <Share2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <span className="text-xs text-gray-400">Share = 25 BL</span>
            </div>
          </div>

          {/* Visit Facebook Button */}
          <a 
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium transition-all shadow-lg shadow-blue-500/20"
            data-testid="facebook-page-link"
          >
            <Facebook className="w-5 h-5" />
            Visit Blendlink on Facebook
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Fallback text */}
        <p className="text-center text-gray-500 text-xs">
          If feed does not load,{' '}
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
            visit Blendlink Community on Facebook
          </a>
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-6 text-center border border-gray-700/50" data-testid="facebook-fallback">
        <div className="relative mx-auto w-16 h-16 mb-4">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl"></div>
          <div className="relative bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center">
            <Facebook className="w-8 h-8 text-white" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Blendlink Community</h3>
        <p className="text-gray-400 text-sm mb-4 max-w-xs mx-auto">
          Unable to load feed. Visit our page directly!
        </p>
        <a 
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium transition-all"
          data-testid="facebook-page-link"
        >
          <Facebook className="w-5 h-5" />
          Visit Facebook Page
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }

  // Elfsight widget embed
  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Loading state */}
      {!loaded && (
        <div className="flex items-center justify-center bg-gray-800/50 rounded-2xl min-h-[300px]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading Community Feed...</p>
          </div>
        </div>
      )}
      
      {/* Elfsight Widget Container */}
      {loaded && ELFSIGHT_WIDGET_ID && (
        <div 
          className={`elfsight-app-${ELFSIGHT_WIDGET_ID}`}
          data-elfsight-app-lazy
        ></div>
      )}
      
      {/* Fallback link */}
      <p className="text-center text-gray-500 text-xs">
        If feed does not load,{' '}
        <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
          visit Blendlink Community on Facebook
        </a>
      </p>
    </div>
  );
};

const Home = () => {
  const { user } = useContext(AuthContext);

  return (
    <div data-testid="home-page" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pb-24 md:pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 blur-3xl" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-6">
          {/* Welcome message */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6"
          >
            {user && (
              <p data-testid="welcome-user-name" className="text-purple-400 text-sm font-medium mb-2">
                Welcome back, {user.first_name || user.username || 'Member'}!
              </p>
            )}
            <h1 data-testid="home-title" className="text-2xl md:text-3xl font-bold text-white mb-2">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Welcome to Blendlink Community
              </span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              Latest Updates & Rewards
            </p>
          </motion.div>

          {/* Quick Action Buttons - Above the feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-3 gap-2 md:gap-4 mb-6"
          >
            <Link to="/minted-photos" className="block" data-testid="mint-photo-btn">
              <Button 
                className="w-full h-auto py-3 px-2 md:px-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95"
              >
                <Camera className="w-5 h-5" />
                <span className="text-xs md:text-sm font-medium">Mint Photo</span>
              </Button>
            </Link>
            
            <Link to="/minted-photos" className="block" data-testid="my-photos-btn">
              <Button 
                className="w-full h-auto py-3 px-2 md:px-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl shadow-lg shadow-pink-500/20 transition-all active:scale-95"
              >
                <Image className="w-5 h-5" />
                <span className="text-xs md:text-sm font-medium">My Photos</span>
              </Button>
            </Link>
            
            <Link to="/photo-game" className="block" data-testid="auction-battle-btn">
              <Button 
                className="w-full h-auto py-3 px-2 md:px-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Swords className="w-5 h-5" />
                <span className="text-xs md:text-sm font-medium">Auction Battle</span>
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Facebook Embed Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-2xl mx-auto px-4"
        data-testid="facebook-feed-section"
      >
        <div className="bg-gray-800/30 rounded-2xl p-4 md:p-5 border border-gray-700/50">
          {/* Section header with engagement text */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Facebook className="w-5 h-5 text-blue-500" />
              <span className="text-white font-semibold text-base">Welcome to Blendlink Community!</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Like, comment, and share posts here to earn BL coins. Post your minted photos directly on Facebook for bonuses!
            </p>
          </div>
          
          {/* Social Feed Embed */}
          <SocialFeedEmbed 
            pageUrl="https://www.facebook.com/blendlinkapp"
          />
        </div>
      </motion.div>

      {/* Bottom Quick Actions - Fixed on mobile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="max-w-2xl mx-auto px-4 mt-6"
      >
        <div className="bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-blue-600/10 rounded-2xl p-4 border border-gray-700/50">
          <p className="text-center text-gray-400 text-sm mb-3">
            Ready to earn rewards?
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/minted-photos" data-testid="bottom-mint-btn">
              <Button 
                variant="outline" 
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 text-sm"
              >
                <Camera className="w-4 h-4 mr-1" />
                Mint New
              </Button>
            </Link>
            <Link to="/photo-game" data-testid="bottom-battle-btn">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-sm"
              >
                <Swords className="w-4 h-4 mr-1" />
                Join Battle
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Home;
