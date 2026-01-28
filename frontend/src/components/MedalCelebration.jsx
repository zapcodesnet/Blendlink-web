/**
 * MedalCelebration Component
 * 
 * Full-screen celebration animation when earning a 10-Win Streak Medal
 * Shows:
 * 1. Medal earned animation 🏅
 * 2. Bag of gold coins falling 💰
 * 3. "+10,000 BL" counter animation
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';

const MedalCelebration = ({ 
  isVisible, 
  photoName, 
  totalMedals, 
  bonusCoins = 10000,
  onComplete 
}) => {
  const [phase, setPhase] = useState(0); // 0: medal, 1: coins, 2: counter
  
  useEffect(() => {
    if (isVisible) {
      // Phase 1: Show medal (0-1.5s)
      setPhase(0);
      
      // Phase 2: Show gold coins (1.5-3s)
      const timer1 = setTimeout(() => setPhase(1), 1500);
      
      // Phase 3: Show counter (3-5s)
      const timer2 = setTimeout(() => setPhase(2), 3000);
      
      // Complete (5s)
      const timer3 = setTimeout(() => {
        onComplete?.();
      }, 5000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible, onComplete]);
  
  if (!isVisible) return null;
  
  // Generate gold coins positions
  const goldCoins = [...Array(30)].map((_, i) => ({
    id: i,
    left: 10 + Math.random() * 80,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random(),
    rotation: Math.random() * 360,
  }));
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 overflow-hidden"
        data-testid="medal-celebration"
      >
        {/* Background sparkles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full"
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: Math.random() * window.innerHeight,
                opacity: 0,
                scale: 0
              }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
        
        {/* Phase 0: Medal Animation */}
        {phase >= 0 && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              duration: 0.8
            }}
            className="absolute z-10"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                repeatType: "reverse" 
              }}
              className="text-[150px] filter drop-shadow-2xl"
            >
              🏅
            </motion.div>
          </motion.div>
        )}
        
        {/* Phase 1: Gold Coins Rain */}
        {phase >= 1 && (
          <div className="absolute inset-0 pointer-events-none">
            {goldCoins.map((coin) => (
              <motion.div
                key={coin.id}
                initial={{ 
                  y: -100, 
                  x: `${coin.left}%`,
                  rotate: 0,
                  opacity: 0
                }}
                animate={{ 
                  y: window.innerHeight + 100,
                  rotate: coin.rotation,
                  opacity: [0, 1, 1, 0]
                }}
                transition={{
                  duration: coin.duration,
                  delay: coin.delay,
                  ease: "linear"
                }}
                className="absolute text-4xl"
                style={{ left: `${coin.left}%` }}
              >
                💰
              </motion.div>
            ))}
            
            {/* Additional coin bag animations */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={`bag-${i}`}
                initial={{ 
                  y: -150, 
                  x: `${20 + i * 15}%`,
                  scale: 0
                }}
                animate={{ 
                  y: window.innerHeight / 2 - 100,
                  scale: [0, 1.5, 1]
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.1,
                  type: "spring",
                  stiffness: 100
                }}
                className="absolute text-6xl"
              >
                💰
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Phase 2: Coin Counter */}
        {phase >= 2 && (
          <motion.div
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="absolute bottom-1/3 z-20 text-center"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.2, 1] }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 rounded-2xl px-8 py-4 shadow-2xl shadow-yellow-500/50"
            >
              <motion.div className="flex items-center gap-3 justify-center">
                <Coins className="w-8 h-8 text-yellow-100" />
                <CoinCounter target={bonusCoins} />
              </motion.div>
              <p className="text-yellow-100/80 text-sm mt-2">BL Coins Added!</p>
            </motion.div>
          </motion.div>
        )}
        
        {/* Photo name and medal count */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute top-1/4 text-center z-10"
        >
          <h2 className="text-3xl font-bold text-white mb-2">{photoName}</h2>
          <p className="text-yellow-400 text-xl">
            10-Win Streak Medal #{totalMedals}!
          </p>
        </motion.div>
        
        {/* Continue hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1] }}
          transition={{ delay: 4, duration: 1 }}
          className="absolute bottom-10 text-gray-400 text-sm"
        >
          Continuing...
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};

// Animated coin counter
const CoinCounter = ({ target, duration = 1.5 }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      
      setCount(Math.floor(easeOut * target));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration]);
  
  return (
    <span className="text-4xl font-bold text-white tabular-nums">
      +{count.toLocaleString()}
    </span>
  );
};

export default MedalCelebration;
