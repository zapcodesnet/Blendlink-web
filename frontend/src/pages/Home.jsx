import React, { useEffect, useState, useContext } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, Image, Swords, ExternalLink, RefreshCw, Facebook } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AuthContext } from '../App';

// Facebook Page Plugin Component
const FacebookEmbed = ({ pageUrl, height = 700 }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Load Facebook SDK
    const loadFacebookSDK = () => {
      // Check if SDK is already loaded
      if (window.FB) {
        window.FB.XFBML.parse();
        setLoaded(true);
        return;
      }

      // Create fb-root if it doesn't exist
      if (!document.getElementById('fb-root')) {
        const fbRoot = document.createElement('div');
        fbRoot.id = 'fb-root';
        document.body.prepend(fbRoot);
      }

      // Load SDK script
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v20.0';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        setLoaded(true);
        // Parse XFBML after a short delay
        setTimeout(() => {
          if (window.FB) {
            window.FB.XFBML.parse();
          }
        }, 500);
      };
      
      script.onerror = () => {
        setError(true);
      };

      document.body.appendChild(script);
    };

    loadFacebookSDK();

    // Set timeout for error fallback
    const timeout = setTimeout(() => {
      if (!loaded && !window.FB) {
        setError(true);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [loaded]);

  // Re-parse when component updates
  useEffect(() => {
    if (window.FB && loaded) {
      window.FB.XFBML.parse();
    }
  }, [loaded]);

  if (error) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-8 text-center border border-gray-700">
        <Facebook className="w-16 h-16 mx-auto text-blue-500 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Unable to load Facebook Feed</h3>
        <p className="text-gray-400 mb-4">The Facebook embed could not load. Visit our page directly:</p>
        <a 
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium transition-all"
        >
          <Facebook className="w-5 h-5" />
          Visit Blendlink on Facebook
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-2xl">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Loading Facebook Feed...</p>
          </div>
        </div>
      )}
      
      {/* Facebook Page Plugin */}
      <div 
        className="fb-page rounded-2xl overflow-hidden" 
        data-href={pageUrl}
        data-tabs="timeline"
        data-width=""
        data-height={height}
        data-small-header="false"
        data-adapt-container-width="true"
        data-hide-cover="false"
        data-show-facepile="true"
        data-lazy="true"
      >
        <blockquote 
          cite={pageUrl}
          className="fb-xfbml-parse-ignore"
        >
          <a href={pageUrl}>Blendlink</a>
        </blockquote>
      </div>
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
        <div className="bg-gray-800/30 rounded-2xl p-3 md:p-4 border border-gray-700/50">
          {/* Section header */}
          <div className="flex items-center gap-2 mb-3">
            <Facebook className="w-5 h-5 text-blue-500" />
            <span className="text-gray-300 font-medium text-sm">Community Updates</span>
          </div>
          
          {/* Facebook Page Plugin */}
          <FacebookEmbed 
            pageUrl="https://www.facebook.com/blendlinkapp"
            height={600}
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
