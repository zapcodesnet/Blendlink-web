/**
 * Face Detection Service using face-api.js (TensorFlow.js)
 * 
 * Client-side face detection for:
 * - Detecting faces in minted photos
 * - Real-time face detection during selfie capture
 * - Face matching for authenticity verification
 */

import * as faceapi from 'face-api.js';

// Model URLs - loaded from CDN
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

class FaceDetectionService {
  constructor() {
    this.initialized = false;
    this.initializing = false;
    this.initPromise = null;
  }

  /**
   * Initialize face-api.js models
   * Loads: tinyFaceDetector, faceLandmark68Net, faceRecognitionNet
   */
  async initialize() {
    if (this.initialized) return true;
    if (this.initializing) return this.initPromise;

    this.initializing = true;
    this.initPromise = this._loadModels();
    
    try {
      await this.initPromise;
      this.initialized = true;
      console.log('[FaceDetection] Models loaded successfully');
      return true;
    } catch (error) {
      console.error('[FaceDetection] Failed to load models:', error);
      this.initializing = false;
      throw error;
    }
  }

  async _loadModels() {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }

  /**
   * Detect faces in an image
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input - Image source
   * @param {Object} customOptions - Optional custom detection options
   * @returns {Object} Detection result with face data
   */
  async detectFaces(input, customOptions = {}) {
    await this.initialize();

    // FIXED: Much lower threshold for better detection on mobile
    // scoreThreshold 0.3 catches more faces (was 0.5 - too strict)
    // inputSize 224 is faster and works well for selfies
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: customOptions.inputSize || 224,
      scoreThreshold: customOptions.scoreThreshold || 0.3,
    });

    const detections = await faceapi
      .detectAllFaces(input, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return {
        hasFace: false,
        faceCount: 0,
        faces: [],
        score: 0,
      };
    }

    // Calculate face prominence score (0-100)
    // Based on face size relative to image and detection confidence
    const imageArea = input.width * input.height;
    const largestFace = detections.reduce((prev, curr) => {
      const prevArea = prev.detection.box.width * prev.detection.box.height;
      const currArea = curr.detection.box.width * curr.detection.box.height;
      return currArea > prevArea ? curr : prev;
    });

    const faceArea = largestFace.detection.box.width * largestFace.detection.box.height;
    const areaRatio = faceArea / imageArea;
    const confidenceScore = largestFace.detection.score;

    // Score formula: 50% from area ratio, 50% from confidence
    // Area ratio of 10%+ gets max score
    const areaNormalized = Math.min(areaRatio / 0.1, 1);
    const score = Math.round((areaNormalized * 50) + (confidenceScore * 50));

    return {
      hasFace: true,
      faceCount: detections.length,
      faces: detections.map(d => ({
        box: d.detection.box,
        confidence: d.detection.score,
        landmarks: d.landmarks,
        descriptor: d.descriptor,
      })),
      score: Math.min(score, 100),
      largestFace: {
        box: largestFace.detection.box,
        confidence: largestFace.detection.score,
        descriptor: largestFace.descriptor,
      },
    };
  }

  /**
   * Detect face in image from URL
   * @param {string} imageUrl - URL of the image
   * @returns {Object} Detection result
   */
  async detectFaceFromUrl(imageUrl) {
    const img = await this._loadImage(imageUrl);
    return this.detectFaces(img);
  }

  /**
   * Detect face from base64 data
   * @param {string} base64Data - Base64 encoded image data
   * @returns {Object} Detection result
   */
  async detectFaceFromBase64(base64Data) {
    const img = await this._loadImageFromBase64(base64Data);
    return this.detectFaces(img);
  }

  /**
   * Compare two faces and return similarity score
   * @param {Float32Array} descriptor1 - Face descriptor from first image
   * @param {Float32Array} descriptor2 - Face descriptor from second image
   * @returns {number} Similarity score 0-100 (100 = identical)
   */
  compareFaces(descriptor1, descriptor2) {
    if (!descriptor1 || !descriptor2) {
      return 0;
    }

    // Euclidean distance between face descriptors
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    
    // Convert distance to similarity score
    // Distance of 0 = 100% similar, distance of 0.6+ = 0% similar
    const maxDistance = 0.6;
    const similarity = Math.max(0, 1 - (distance / maxDistance));
    
    return Math.round(similarity * 100);
  }

  /**
   * Match a selfie against a reference photo
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} selfie - Selfie input
   * @param {HTMLImageElement|string} reference - Reference photo (element or URL)
   * @returns {Object} Match result with score
   */
  async matchSelfieToPhoto(selfie, reference) {
    await this.initialize();

    // Detect face in selfie
    const selfieResult = await this.detectFaces(selfie);
    if (!selfieResult.hasFace) {
      return {
        success: false,
        error: 'No face detected in selfie',
        score: 0,
      };
    }

    // Load reference if it's a URL
    let referenceInput = reference;
    if (typeof reference === 'string') {
      referenceInput = await this._loadImage(reference);
    }

    // Detect face in reference photo
    const referenceResult = await this.detectFaces(referenceInput);
    if (!referenceResult.hasFace) {
      return {
        success: false,
        error: 'No face detected in reference photo',
        score: 0,
      };
    }

    // Compare face descriptors
    const similarity = this.compareFaces(
      selfieResult.largestFace.descriptor,
      referenceResult.largestFace.descriptor
    );

    return {
      success: similarity >= 60, // 60% threshold for a match
      score: similarity,
      selfieConfidence: selfieResult.largestFace.confidence,
      referenceConfidence: referenceResult.largestFace.confidence,
      message: similarity >= 80 
        ? 'Excellent match!' 
        : similarity >= 60 
          ? 'Good match' 
          : 'Faces do not match',
    };
  }

  /**
   * Draw face detection overlay on canvas
   * @param {HTMLCanvasElement} canvas - Canvas to draw on
   * @param {Object} detection - Face detection result
   */
  drawDetection(canvas, detection) {
    const ctx = canvas.getContext('2d');
    
    if (!detection.hasFace) return;

    detection.faces.forEach(face => {
      const { x, y, width, height } = face.box;
      
      // Draw bounding box
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw confidence score
      ctx.fillStyle = '#A855F7';
      ctx.font = '14px sans-serif';
      ctx.fillText(
        `${Math.round(face.confidence * 100)}%`,
        x,
        y > 20 ? y - 5 : y + height + 15
      );
    });
  }

  /**
   * Real-time face detection from video element
   * @param {HTMLVideoElement} video - Video element
   * @param {HTMLCanvasElement} overlay - Canvas for overlay
   * @param {function} onDetection - Callback on each detection
   * @returns {function} Stop function
   */
  startRealTimeDetection(video, overlay, onDetection) {
    let running = true;
    let frameCount = 0;

    const detect = async () => {
      if (!running) return;

      try {
        // FIXED: Use very lenient settings for real-time detection
        // Only process every 3rd frame to reduce CPU load on mobile
        frameCount++;
        if (frameCount % 3 !== 0) {
          if (running) requestAnimationFrame(detect);
          return;
        }

        const result = await this.detectFaces(video, {
          inputSize: 160,       // Smaller = faster for real-time
          scoreThreshold: 0.2,  // Very lenient for live preview
        });
        
        // Clear and draw overlay
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        this.drawDetection(overlay, result);

        if (onDetection) {
          onDetection(result);
        }
      } catch (error) {
        console.error('[FaceDetection] Real-time error:', error);
      }

      if (running) {
        requestAnimationFrame(detect);
      }
    };

    this.initialize().then(detect);

    // Return stop function
    return () => {
      running = false;
    };
  }

  // Helper: Load image from URL
  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // Helper: Load image from base64
  _loadImageFromBase64(base64Data) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      
      // Add data URL prefix if not present
      if (!base64Data.startsWith('data:')) {
        img.src = `data:image/jpeg;base64,${base64Data}`;
      } else {
        img.src = base64Data;
      }
    });
  }
}

// Export singleton instance
export const faceDetectionService = new FaceDetectionService();

// Export class for testing
export { FaceDetectionService };
