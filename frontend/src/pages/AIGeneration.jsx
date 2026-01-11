import React, { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  Image, Video, Music, Sparkles, Download, Play, Pause,
  RefreshCw, Clock, CheckCircle, XCircle, Loader2
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AIGeneration() {
  const [activeTab, setActiveTab] = useState('image');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Image state
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  
  // Video state
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoSize, setVideoSize] = useState('1280x720');
  const [videoDuration, setVideoDuration] = useState(4);
  const [videoStatus, setVideoStatus] = useState(null);
  
  // Music state
  const [musicGenre, setMusicGenre] = useState('electronic');
  const [musicMood, setMusicMood] = useState('upbeat');
  const [musicDuration, setMusicDuration] = useState(30);
  const [musicTempo, setMusicTempo] = useState(120);
  const [musicParams, setMusicParams] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef(null);
  const scheduledNotesRef = useRef([]);

  const getToken = () => localStorage.getItem('blendlink_token');

  useEffect(() => {
    loadHistory();
    return () => stopMusic();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/history?limit=10`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.generations || []);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  // ============== IMAGE GENERATION ==============
  const generateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    setLoading(true);
    setGeneratedImages([]);
    
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ prompt: imagePrompt, number_of_images: 1 })
      });
      
      const data = await res.json();
      
      if (res.ok && data.images) {
        setGeneratedImages(data.images);
        toast.success('Image generated!');
        loadHistory();
      } else {
        throw new Error(data.detail || 'Generation failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ============== VIDEO GENERATION ==============
  const generateVideo = async () => {
    if (!videoPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    setLoading(true);
    setVideoStatus(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          prompt: videoPrompt,
          size: videoSize,
          duration: videoDuration
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Video generation started!');
        setVideoStatus({ generation_id: data.generation_id, status: 'queued' });
        pollVideoStatus(data.generation_id);
      } else {
        throw new Error(data.detail || 'Generation failed');
      }
    } catch (e) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  const pollVideoStatus = async (generationId) => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/video-status/${generationId}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setVideoStatus(data);
          
          if (data.status === 'completed') {
            toast.success('Video generated!');
            setLoading(false);
            loadHistory();
          } else if (data.status === 'failed') {
            toast.error('Video generation failed');
            setLoading(false);
          } else {
            setTimeout(poll, 5000);
          }
        }
      } catch (e) {
        console.error('Poll error:', e);
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  };

  // ============== MUSIC GENERATION ==============
  const generateMusic = async () => {
    setLoading(true);
    stopMusic();
    
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-music-params`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          genre: musicGenre,
          mood: musicMood,
          duration_seconds: musicDuration,
          tempo: musicTempo
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMusicParams(data.params);
        toast.success('Music parameters generated!');
        loadHistory();
      } else {
        throw new Error(data.detail || 'Generation failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const playMusic = () => {
    if (!musicParams) return;
    
    if (isPlaying) {
      stopMusic();
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;
      
      const { tempo, melody, synth, effects, drum_pattern, bass_pattern } = musicParams;
      const beatDuration = 60 / tempo;
      const now = ctx.currentTime;
      
      // Create master gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(ctx.destination);
      
      // Create reverb (simple delay-based)
      const delay = ctx.createDelay();
      delay.delayTime.value = effects.delay;
      const feedback = ctx.createGain();
      feedback.gain.value = effects.reverb;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(masterGain);
      
      // Play melody
      melody.forEach((note, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = synth.type;
        osc.frequency.value = 440 * Math.pow(2, (note - 9) / 12);
        
        gain.gain.setValueAtTime(0, now + i * beatDuration);
        gain.gain.linearRampToValueAtTime(0.3, now + i * beatDuration + synth.attack);
        gain.gain.linearRampToValueAtTime(0.1, now + i * beatDuration + beatDuration * 0.8);
        gain.gain.linearRampToValueAtTime(0, now + i * beatDuration + beatDuration);
        
        osc.connect(gain);
        gain.connect(masterGain);
        gain.connect(delay);
        
        osc.start(now + i * beatDuration);
        osc.stop(now + (i + 1) * beatDuration);
        
        scheduledNotesRef.current.push(osc);
      });
      
      // Play drums
      if (drum_pattern) {
        drum_pattern.kick.forEach((hit, i) => {
          if (hit) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(150, now + i * beatDuration / 4);
            osc.frequency.exponentialRampToValueAtTime(50, now + i * beatDuration / 4 + 0.1);
            gain.gain.setValueAtTime(0.5, now + i * beatDuration / 4);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * beatDuration / 4 + 0.1);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now + i * beatDuration / 4);
            osc.stop(now + i * beatDuration / 4 + 0.1);
            scheduledNotesRef.current.push(osc);
          }
        });
      }
      
      setIsPlaying(true);
      
      // Auto-stop after duration
      setTimeout(() => {
        stopMusic();
      }, musicParams.duration * 1000);
      
    } catch (e) {
      console.error('Audio error:', e);
      toast.error('Failed to play audio');
    }
  };

  const stopMusic = () => {
    scheduledNotesRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    scheduledNotesRef.current = [];
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  const downloadImage = (dataUrl, index) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `generated-image-${index + 1}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            AI Studio
          </h1>
          <p className="text-slate-400">Generate images, videos, and music with AI</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'image', icon: Image, label: 'Image' },
            { id: 'video', icon: Video, label: 'Video' },
            { id: 'music', icon: Music, label: 'Music' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          {/* IMAGE TAB */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Describe your image</label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="A futuristic city at sunset with flying cars..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-4 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              
              <Button
                onClick={generateImage}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Generate Image</>
                )}
              </Button>

              {/* Generated Images */}
              {generatedImages.length > 0 && (
                <div className="grid gap-4 mt-6">
                  {generatedImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.data_url}
                        alt={`Generated ${i + 1}`}
                        className="w-full rounded-xl"
                      />
                      <Button
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => downloadImage(img.data_url, i)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIDEO TAB */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Describe your video</label>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="A cat playing piano in a jazz club..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-4 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Size</label>
                  <select
                    value={videoSize}
                    onChange={(e) => setVideoSize(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                  >
                    <option value="1280x720">HD (1280x720)</option>
                    <option value="1792x1024">Widescreen</option>
                    <option value="1024x1792">Portrait</option>
                    <option value="1024x1024">Square</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Duration</label>
                  <select
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                  >
                    <option value={4}>4 seconds</option>
                    <option value={8}>8 seconds</option>
                    <option value={12}>12 seconds</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={generateVideo}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating (2-10 min)...</>
                ) : (
                  <><Video className="w-5 h-5 mr-2" /> Generate Video</>
                )}
              </Button>

              {/* Video Status */}
              {videoStatus && (
                <div className="bg-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {videoStatus.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : videoStatus.status === 'failed' ? (
                      <XCircle className="w-6 h-6 text-red-400" />
                    ) : (
                      <Clock className="w-6 h-6 text-yellow-400 animate-pulse" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{videoStatus.status}</p>
                      <p className="text-sm text-slate-400">{videoStatus.generation_id}</p>
                    </div>
                  </div>
                  
                  {/* AI Generated Thumbnail */}
                  {videoStatus.thumbnail_url && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-400 mb-2">AI-Generated Thumbnail</p>
                      <img 
                        src={`${API_BASE}${videoStatus.thumbnail_url}`} 
                        alt="Video thumbnail"
                        className="w-full max-w-xs rounded-lg border border-slate-600"
                      />
                    </div>
                  )}
                  
                  {videoStatus.video_url && (
                    <video
                      src={`${API_BASE}${videoStatus.video_url}`}
                      poster={videoStatus.thumbnail_url ? `${API_BASE}${videoStatus.thumbnail_url}` : undefined}
                      controls
                      className="w-full rounded-lg"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* MUSIC TAB */}
          {activeTab === 'music' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Genre</label>
                  <select
                    value={musicGenre}
                    onChange={(e) => setMusicGenre(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                  >
                    <option value="electronic">Electronic</option>
                    <option value="ambient">Ambient</option>
                    <option value="hiphop">Hip Hop</option>
                    <option value="jazz">Jazz</option>
                    <option value="classical">Classical</option>
                    <option value="rock">Rock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mood</label>
                  <select
                    value={musicMood}
                    onChange={(e) => setMusicMood(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                  >
                    <option value="upbeat">Upbeat</option>
                    <option value="relaxed">Relaxed</option>
                    <option value="energetic">Energetic</option>
                    <option value="melancholic">Melancholic</option>
                    <option value="mysterious">Mysterious</option>
                    <option value="happy">Happy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Tempo: {musicTempo} BPM</label>
                  <input
                    type="range"
                    min="60"
                    max="200"
                    value={musicTempo}
                    onChange={(e) => setMusicTempo(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Duration: {musicDuration}s</label>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={musicDuration}
                    onChange={(e) => setMusicDuration(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <Button
                onClick={generateMusic}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Music className="w-5 h-5 mr-2" /> Generate Music</>
                )}
              </Button>

              {/* Music Player */}
              {musicParams && (
                <div className="bg-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium">Generated Music</p>
                      <p className="text-sm text-slate-400">{musicParams.tempo} BPM • {musicParams.scale} scale</p>
                    </div>
                    <Button
                      onClick={playMusic}
                      variant="outline"
                      className="border-green-500 text-green-400 hover:bg-green-500/20"
                    >
                      {isPlaying ? (
                        <><Pause className="w-5 h-5 mr-2" /> Stop</>
                      ) : (
                        <><Play className="w-5 h-5 mr-2" /> Play</>
                      )}
                    </Button>
                  </div>
                  <div className="text-xs text-slate-400">
                    🎹 Synth: {musicParams.synth.type} • 
                    🎵 Notes: {musicParams.melody.length} • 
                    🥁 Drums: {musicParams.drum_pattern ? 'Yes' : 'No'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Recent Generations</h2>
            <div className="grid gap-3">
              {history.slice(0, 5).map((item) => (
                <div key={item.generation_id} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    item.type === 'image' ? 'bg-purple-500/20' :
                    item.type === 'video' ? 'bg-blue-500/20' : 'bg-green-500/20'
                  }`}>
                    {item.type === 'image' ? <Image className="w-5 h-5 text-purple-400" /> :
                     item.type === 'video' ? <Video className="w-5 h-5 text-blue-400" /> :
                     <Music className="w-5 h-5 text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.prompt || item.genre || 'Generation'}</p>
                    <p className="text-sm text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
