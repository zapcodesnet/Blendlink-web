import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Facebook } from 'lucide-react';
import { FacebookShareOverlay } from './FacebookShareOverlay';

// Contextual floating action button for quick access to Facebook Group
// Only shows after user has visited the group in current session
export const BackToGroupFAB = () => {
  const [showFAB, setShowFAB] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Check if user has visited the group in this session
  useEffect(() => {
    const checkVisited = () => {
      const visited = sessionStorage.getItem('visited_fb_group');
      setShowFAB(visited === 'true');
    };
    
    checkVisited();
    
    // Listen for storage changes
    window.addEventListener('storage', checkVisited);
    
    // Also check periodically in case sessionStorage was updated in same tab
    const interval = setInterval(checkVisited, 1000);
    
    return () => {
      window.removeEventListener('storage', checkVisited);
      clearInterval(interval);
    };
  }, []);
  
  const handleClick = () => {
    setShowOverlay(true);
  };
  
  const handleVisitGroup = () => {
    // Update session storage
    sessionStorage.setItem('visited_fb_group', 'true');
    setShowFAB(true);
  };
  
  if (!showFAB) return null;
  
  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-pink-500/30 flex items-center justify-center transition-all hover:shadow-xl hover:shadow-pink-500/40"
          data-testid="back-to-group-fab"
          aria-label="Back to Blendlink Community Group"
        >
          <Facebook className="w-6 h-6 text-white" />
          
          {/* Tooltip on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg whitespace-nowrap shadow-lg"
              >
                Back to Group
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Pulse animation */}
          <span className="absolute inset-0 rounded-full bg-pink-500 animate-ping opacity-20" />
        </motion.button>
      </AnimatePresence>
      
      {/* Share Overlay */}
      <FacebookShareOverlay
        isOpen={showOverlay}
        onClose={() => setShowOverlay(false)}
        onVisitGroup={handleVisitGroup}
      />
    </>
  );
};

export default BackToGroupFAB;
