import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Loader2, Camera, Coins } from 'lucide-react';

// Particle component for explosion effect
const Particle = ({ index, color }) => {
  const angle = (index / 20) * Math.PI * 2;
  const distance = 80 + Math.random() * 60;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  const size = 4 + Math.random() * 8;
  
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
      animate={{
        x: x,
        y: y,
        opacity: [1, 1, 0],
        scale: [0, 1.5, 0.5],
      }}
      transition={{
        duration: 1.2,
        ease: "easeOut",
        delay: index * 0.02,
      }}
    />
  );
};

// Sparkle trail particle
const SparkleParticle = ({ delay }) => {
  const x = (Math.random() - 0.5) * 200;
  const y = (Math.random() - 0.5) * 200;
  
  return (
    <motion.div
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={{
        x: x,
        y: y,
        opacity: [0, 1, 1, 0],
        scale: [0, 1, 1, 0],
      }}
      transition={{
        duration: 2,
        delay: delay,
        ease: "easeOut",
      }}
    >
      <Sparkles className="w-4 h-4 text-yellow-400" />
    </motion.div>
  );
};

// Floating coin animation
const FloatingCoin = ({ delay, direction }) => (
  <motion.div
    className="absolute"
    style={{
      left: direction === 'left' ? '20%' : '80%',
      top: '60%',
    }}
    initial={{ y: 0, opacity: 0, scale: 0 }}
    animate={{
      y: [-20, -80],
      opacity: [0, 1, 1, 0],
      scale: [0, 1, 1, 0.5],
      rotate: [0, 360],
    }}
    transition={{
      duration: 1.5,
      delay: delay,
      ease: "easeOut",
    }}
  >
    <Coins className="w-6 h-6 text-yellow-500" />
  </motion.div>
);

// Main Mint Animation Component
export const MintAnimation = ({
  isVisible,
  onComplete,
  photoUrl,
  photoName = "Photo",
  blCost = 500,
  transactionHash,
}) => {
  const [stage, setStage] = useState(0); // 0: analyzing, 1: minting, 2: confirming, 3: complete
  const [progress, setProgress] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  
  const stages = [
    { label: "Analyzing photo...", sublabel: "AI scanning content", icon: Camera },
    { label: "Minting collectible...", sublabel: "Creating unique token", icon: Sparkles },
    { label: "Confirming transaction...", sublabel: "Securing ownership", icon: Loader2 },
    { label: "Mint Complete!", sublabel: `${blCost} BL coins spent`, icon: Check },
  ];
  
  useEffect(() => {
    if (!isVisible) {
      setStage(0);
      setProgress(0);
      setShowParticles(false);
      return;
    }
    
    // Simulate minting process
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 60);
    
    // Stage transitions
    const stageTimers = [
      setTimeout(() => setStage(1), 1000),
      setTimeout(() => setStage(2), 2000),
      setTimeout(() => {
        setStage(3);
        setShowParticles(true);
      }, 3000),
      setTimeout(() => {
        onComplete?.();
      }, 5000),
    ];
    
    return () => {
      clearInterval(progressInterval);
      stageTimers.forEach(t => clearTimeout(t));
    };
  }, [isVisible, onComplete]);
  
  const particleColors = [
    '#FFD700', '#FFA500', '#FF6347', '#FFB6C1', 
    '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C'
  ];
  
  if (!isVisible) return null;
  
  const CurrentIcon = stages[stage].icon;
  
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop with blur */}
        <motion.div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        
        {/* Main content */}
        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
        >
          {/* Photo preview with glow */}
          <motion.div
            className="relative mb-8"
            animate={{
              boxShadow: stage === 3 
                ? ['0 0 20px #FFD700', '0 0 60px #FFD700', '0 0 20px #FFD700']
                : '0 0 20px rgba(139, 92, 246, 0.5)',
            }}
            transition={{ duration: 1, repeat: stage < 3 ? Infinity : 0 }}
          >
            {/* Photo container */}
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-4 border-purple-500/50">
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt={photoName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <Camera className="w-16 h-16 text-white/50" />
                </div>
              )}
              
              {/* Scanning overlay */}
              {stage === 0 && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-b from-cyan-500/30 to-transparent"
                  animate={{ top: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              
              {/* Minting glow overlay */}
              {stage === 1 && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-yellow-500/40 to-orange-500/40"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
              
              {/* Success checkmark overlay */}
              {stage === 3 && (
                <motion.div
                  className="absolute inset-0 bg-green-500/30 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 10 }}
                  >
                    <Check className="w-20 h-20 text-white" strokeWidth={3} />
                  </motion.div>
                </motion.div>
              )}
            </div>
            
            {/* Particle explosion on complete */}
            {showParticles && (
              <>
                {[...Array(20)].map((_, i) => (
                  <Particle 
                    key={i} 
                    index={i} 
                    color={particleColors[i % particleColors.length]} 
                  />
                ))}
                {[...Array(10)].map((_, i) => (
                  <SparkleParticle key={`sparkle-${i}`} delay={i * 0.1} />
                ))}
                <FloatingCoin delay={0.2} direction="left" />
                <FloatingCoin delay={0.4} direction="right" />
                <FloatingCoin delay={0.6} direction="left" />
              </>
            )}
          </motion.div>
          
          {/* Status text */}
          <motion.div
            className="text-center mb-6"
            key={stage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <motion.div
                animate={stage < 3 ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: stage < 3 ? Infinity : 0, ease: "linear" }}
              >
                <CurrentIcon 
                  className={`w-6 h-6 ${stage === 3 ? 'text-green-400' : 'text-purple-400'}`} 
                />
              </motion.div>
              <h3 className="text-xl font-bold text-white">
                {stages[stage].label}
              </h3>
            </div>
            <p className="text-gray-400 text-sm">
              {stages[stage].sublabel}
            </p>
          </motion.div>
          
          {/* Progress bar */}
          <div className="w-72 mb-6">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  stage === 3 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                    : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{progress}%</span>
              <span>{stage === 3 ? 'Complete' : 'Processing...'}</span>
            </div>
          </div>
          
          {/* Transaction hash (mock) */}
          {stage >= 2 && (
            <motion.div
              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
              <code className="text-xs text-purple-400 font-mono break-all">
                {transactionHash || `0x${Math.random().toString(16).slice(2, 18)}...${Math.random().toString(16).slice(2, 10)}`}
              </code>
            </motion.div>
          )}
          
          {/* BL cost indicator */}
          {stage === 3 && (
            <motion.div
              className="mt-4 flex items-center gap-2 text-yellow-400"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Coins className="w-5 h-5" />
              <span className="font-bold">-{blCost} BL</span>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Compact inline mint animation for cards/lists
export const MintBadge = ({ isMinting, isMinted }) => {
  if (isMinting) {
    return (
      <motion.div
        className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-full"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
        <span className="text-xs text-purple-400">Minting...</span>
      </motion.div>
    );
  }
  
  if (isMinted) {
    return (
      <motion.div
        className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring" }}
      >
        <Check className="w-3 h-3 text-green-400" />
        <span className="text-xs text-green-400">Minted</span>
      </motion.div>
    );
  }
  
  return null;
};

// Hook for using mint animation
export const useMintAnimation = () => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationData, setAnimationData] = useState(null);
  
  const startAnimation = useCallback((data) => {
    setAnimationData(data);
    setIsAnimating(true);
  }, []);
  
  const handleComplete = useCallback(() => {
    setIsAnimating(false);
    setAnimationData(null);
  }, []);
  
  return {
    isAnimating,
    animationData,
    startAnimation,
    handleComplete,
    MintAnimationComponent: isAnimating ? (
      <MintAnimation
        isVisible={isAnimating}
        onComplete={handleComplete}
        photoUrl={animationData?.photoUrl}
        photoName={animationData?.photoName}
        blCost={animationData?.blCost || 500}
        transactionHash={animationData?.transactionHash}
      />
    ) : null,
  };
};

export default MintAnimation;
