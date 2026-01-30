/**
 * SelfieMatchModal Component
 * 
 * Live video selfie match for Authenticity bonus verification.
 * Uses TensorFlow.js face-api.js for client-side face detection.
 * Per user specs:
 * - Up to 3 tries (100 BL coins each)
 * - Camera capture and face comparison
 * - Adds up to 5% Authenticity bonus to minted photos
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, X, RefreshCw, Check, AlertCircle, 
  Loader2, Coins, Shield, Sparkles, User, Scan
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import api from '../../services/api';
import { faceDetectionService } from '../../services/faceDetection';

// Constants per spec
const COST_PER_ATTEMPT = 100; // BL coins
const MAX_ATTEMPTS = 3;

// Convert file/blob to base64
const toBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data URL prefix to get pure base64
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

// Get MIME type from data URL
const getMimeType = (dataUrl) => {
  const match = dataUrl.match(/data:([^;]+);/);
  return match ? match[1] : 'image/jpeg';
};

export const SelfieMatchModal = ({ 
  isOpen, 
  onClose, 
  photo, // The minted photo to match against
  onSuccess, // Callback when match succeeds
  userBalance = 0, // User's BL coin balance
}) => {
  // Confirmation state - shows accept/decline before camera
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [declineWarning, setDeclineWarning] = useState(false);
  
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' for front camera
  
  // Face detection state
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceScore, setFaceScore] = useState(0);
  const [loadingModels, setLoadingModels] = useState(false);
  const [clientMatchResult, setClientMatchResult] = useState(null);
  
  // Match state
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const stopDetectionRef = useRef(null);
  
  // Check if user can afford an attempt
  const canAffordAttempt = userBalance >= COST_PER_ATTEMPT;
  const attemptsRemaining = MAX_ATTEMPTS - attemptsUsed;
  const hasAttemptsLeft = attemptsRemaining > 0;
  
  // Initialize face detection models
  useEffect(() => {
    const initModels = async () => {
      setLoadingModels(true);
      try {
        await faceDetectionService.initialize();
      } catch (err) {
        console.error('Failed to load face detection models:', err);
      } finally {
        setLoadingModels(false);
      }
    };
    initModels();
  }, []);
  
  // Start real-time face detection when camera is active
  useEffect(() => {
    if (cameraActive && videoRef.current && overlayRef.current) {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      
      // Set overlay size to match video
      overlay.width = video.videoWidth || 640;
      overlay.height = video.videoHeight || 480;
      
      // Start real-time detection
      stopDetectionRef.current = faceDetectionService.startRealTimeDetection(
        video,
        overlay,
        (result) => {
          setFaceDetected(result.hasFace);
          setFaceScore(result.score || 0);
        }
      );
    }
    
    return () => {
      if (stopDetectionRef.current) {
        stopDetectionRef.current();
        stopDetectionRef.current = null;
      }
    };
  }, [cameraActive]);
  
  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError' 
          ? 'Camera permission denied. Please allow camera access.'
          : err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Failed to start camera. Please try again.'
      );
    }
  }, [facingMode]);
  
  // Stop camera
  const stopCamera = useCallback(() => {
    // Stop face detection
    if (stopDetectionRef.current) {
      stopDetectionRef.current();
      stopDetectionRef.current = null;
    }
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
    setFaceScore(0);
  }, []);
  
  // Capture photo from video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas (mirror for selfie)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    // Get image data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    
    // Stop camera after capture
    stopCamera();
  }, [stopCamera]);
  
  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setMatchResult(null);
    startCamera();
  }, [startCamera]);
  
  // Submit selfie for matching
  const submitMatch = useCallback(async () => {
    if (!capturedImage || !photo?.mint_id) return;
    
    if (!canAffordAttempt) {
      toast.error(`Insufficient balance. Need ${COST_PER_ATTEMPT} BL coins.`);
      return;
    }
    
    if (!hasAttemptsLeft) {
      toast.error('Maximum attempts reached for this photo.');
      return;
    }
    
    setIsMatching(true);
    setMatchResult(null);
    
    try {
      // Convert captured image to base64
      const base64Data = capturedImage.split(',')[1];
      const mimeType = getMimeType(capturedImage);
      
      const response = await api.post(`/minting/photo/${photo.mint_id}/selfie-match`, {
        selfie_base64: base64Data,
        mime_type: mimeType,
      });
      
      const data = response.data;
      
      setAttemptsUsed(prev => prev + 1);
      
      if (data.success) {
        setMatchResult({
          success: true,
          score: data.match_score,
          confidence: data.confidence,
          bonus: data.authenticity_bonus_added,
          totalAuthenticity: data.total_authenticity,
          notes: data.notes,
        });
        
        toast.success(`Match successful! +${data.authenticity_bonus_added}% Authenticity bonus added!`);
        
        // Callback on success
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        setMatchResult({
          success: false,
          score: data.match_score,
          message: data.message || 'Face match failed',
          notes: data.notes,
        });
        
        toast.error(data.message || 'Face match failed. Try again with better lighting.');
      }
    } catch (err) {
      console.error('Match error:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to process selfie match';
      toast.error(errorMsg);
      setMatchResult({
        success: false,
        message: errorMsg,
      });
    } finally {
      setIsMatching(false);
    }
  }, [capturedImage, photo, canAffordAttempt, hasAttemptsLeft, onSuccess]);
  
  // Toggle camera facing mode
  const toggleCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);
  
  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, capturedImage, startCamera, stopCamera]);
  
  // Fetch current attempts used
  useEffect(() => {
    if (isOpen && photo?.mint_id) {
      api.get(`/minting/photo/${photo.mint_id}/authenticity-status`)
        .then(res => {
          setAttemptsUsed(res.data.selfie_match_attempts || 0);
        })
        .catch(() => {});
    }
  }, [isOpen, photo?.mint_id]);
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700"
          data-testid="selfie-match-modal"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Selfie Verification</h3>
                <p className="text-xs text-gray-400">Add Authenticity bonus to your photo</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              data-testid="close-selfie-modal"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4">
            {/* Info banner */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-purple-300 font-medium">Earn up to +5% Authenticity Bonus</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Take a live selfie matching the person in your photo. Better matches = higher bonus!
                  </p>
                </div>
              </div>
            </div>
            
            {/* Attempts and cost info */}
            <div className="flex justify-between items-center mb-4 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">
                  Attempts: <span className="text-white font-bold">{attemptsRemaining}/{MAX_ATTEMPTS}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-300">
                  Cost: <span className="text-yellow-400 font-bold">{COST_PER_ATTEMPT} BL</span>
                </span>
              </div>
            </div>
            
            {/* Reference photo */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Your minted photo:</p>
              <div className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg">
                {photo?.image_url ? (
                  <img 
                    src={photo.image_url} 
                    alt={photo.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{photo?.name || 'Photo'}</p>
                  <p className="text-xs text-gray-400">
                    Current Authenticity: {photo?.authenticity_score || 0}%
                  </p>
                </div>
              </div>
            </div>
            
            {/* Camera/Captured view */}
            <div className="relative aspect-[4/3] bg-gray-800 rounded-xl overflow-hidden mb-4">
              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Camera error */}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                  <p className="text-red-300 mb-4">{cameraError}</p>
                  <Button onClick={startCamera} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              )}
              
              {/* Video preview */}
              {!cameraError && !capturedImage && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]" // Mirror for selfie
                  />
                  
                  {/* Face detection overlay canvas */}
                  <canvas
                    ref={overlayRef}
                    className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
                  />
                  
                  {/* Camera loading */}
                  {!cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    </div>
                  )}
                  
                  {/* Loading models indicator */}
                  {loadingModels && (
                    <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-black/70 rounded text-xs text-purple-300">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading face detection...
                    </div>
                  )}
                  
                  {/* Face detection status */}
                  {cameraActive && !loadingModels && (
                    <div className={`absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded text-xs ${
                      faceDetected ? 'bg-green-500/80 text-white' : 'bg-yellow-500/80 text-black'
                    }`}>
                      <Scan className="w-3 h-3" />
                      {faceDetected 
                        ? `Face detected (${faceScore}%)`
                        : 'No face - position your face in view'
                      }
                    </div>
                  )}
                  
                  {/* Face guide overlay */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-60 border-2 border-dashed rounded-full transition-colors ${
                        faceDetected ? 'border-green-400/70' : 'border-purple-400/50'
                      }`} />
                      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-purple-300">
                        {faceDetected 
                          ? '✓ Face detected - ready to capture!'
                          : 'Position your face in the oval'
                        }
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Captured image preview */}
              {capturedImage && (
                <img 
                  src={capturedImage} 
                  alt="Captured selfie"
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Match result overlay */}
              <AnimatePresence>
                {matchResult && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 flex flex-col items-center justify-center ${
                      matchResult.success ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}
                  >
                    {matchResult.success ? (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4"
                        >
                          <Check className="w-10 h-10 text-white" />
                        </motion.div>
                        <p className="text-2xl font-bold text-green-400">Match Success!</p>
                        <p className="text-lg text-white mt-2">
                          +{matchResult.bonus}% Authenticity Added
                        </p>
                        <p className="text-sm text-gray-300 mt-1">
                          Match Score: {matchResult.score}%
                        </p>
                      </>
                    ) : (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-4"
                        >
                          <X className="w-10 h-10 text-white" />
                        </motion.div>
                        <p className="text-2xl font-bold text-red-400">Match Failed</p>
                        <p className="text-sm text-gray-300 mt-2">
                          {matchResult.message}
                        </p>
                        {matchResult.score !== undefined && (
                          <p className="text-xs text-gray-400 mt-1">
                            Score: {matchResult.score}% (need higher)
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-3">
              {!capturedImage && cameraActive && (
                <>
                  <Button
                    onClick={toggleCamera}
                    variant="outline"
                    className="flex-1"
                    data-testid="toggle-camera-btn"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Flip Camera
                  </Button>
                  <Button
                    onClick={capturePhoto}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    data-testid="capture-btn"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                </>
              )}
              
              {capturedImage && !matchResult && (
                <>
                  <Button
                    onClick={retakePhoto}
                    variant="outline"
                    className="flex-1"
                    disabled={isMatching}
                    data-testid="retake-btn"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retake
                  </Button>
                  <Button
                    onClick={submitMatch}
                    disabled={isMatching || !canAffordAttempt || !hasAttemptsLeft}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
                    data-testid="submit-match-btn"
                  >
                    {isMatching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Matching...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Verify ({COST_PER_ATTEMPT} BL)
                      </>
                    )}
                  </Button>
                </>
              )}
              
              {matchResult && (
                <>
                  {!matchResult.success && hasAttemptsLeft && (
                    <Button
                      onClick={retakePhoto}
                      variant="outline"
                      className="flex-1"
                      data-testid="try-again-btn"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  )}
                  <Button
                    onClick={onClose}
                    className="flex-1 bg-gray-700 hover:bg-gray-600"
                    data-testid="done-btn"
                  >
                    Done
                  </Button>
                </>
              )}
            </div>
            
            {/* Balance warning */}
            {!canAffordAttempt && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Insufficient balance. You need {COST_PER_ATTEMPT} BL coins.
                  </span>
                </div>
              </div>
            )}
            
            {/* No attempts warning */}
            {!hasAttemptsLeft && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Maximum attempts reached for this photo.
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SelfieMatchModal;
