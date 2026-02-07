/**
 * ULTRA PREMIUM Landing Page
 * 
 * Redesigned with the new glassmorphism design language:
 * - Light mode with subtle gradient background
 * - Strong glassmorphism effects
 * - Cyan (#00F0FF) and magenta (#FF00CC) accents
 * - Premium typography and generous spacing
 */

import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getToken } from "../services/api";
import { 
  Users, ShoppingBag, Home, Briefcase, Gamepad2, Gift, 
  Coins, Share2, ChevronRight, Smartphone, Bell, Zap,
  ChevronLeft, Eye, Star, Sparkles, ArrowRight, Play
} from "lucide-react";
import "../styles/premium-design-system.css";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Premium Feature Card Component
const FeatureCard = ({ icon: Icon, title, description, gradient, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="bl-glass p-8 flex flex-col items-center text-center group cursor-pointer"
    style={{ borderRadius: '28px' }}
  >
    <div 
      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
      style={{ background: gradient }}
    >
      <Icon className="w-8 h-8 text-white" strokeWidth={2} />
    </div>
    <h3 className="text-xl font-bold mb-3" style={{ color: '#001F3F' }}>{title}</h3>
    <p className="text-base" style={{ color: '#606080' }}>{description}</p>
  </motion.div>
);

// Premium Stat Card
const StatCard = ({ value, label, icon: Icon }) => (
  <motion.div
    whileHover={{ scale: 1.05, y: -5 }}
    className="bl-glass px-8 py-6 text-center"
    style={{ borderRadius: '24px' }}
  >
    <div className="flex items-center justify-center gap-2 mb-2">
      <Icon className="w-6 h-6" style={{ color: '#00F0FF' }} />
      <span className="text-3xl font-bold" style={{ color: '#001F3F' }}>{value}</span>
    </div>
    <span className="text-sm font-medium" style={{ color: '#606080' }}>{label}</span>
  </motion.div>
);

// Featured Item Card - Premium Style
const FeaturedItemCard = ({ item, type, onViewDetails }) => {
  const typeColors = {
    product: 'linear-gradient(135deg, #00F0FF 0%, #00B4D8 100%)',
    rental: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    service: 'linear-gradient(135deg, #8B5CF6 0%, #FF00CC 100%)'
  };
  
  const typeLabels = {
    product: 'Product',
    rental: 'Rental',
    service: 'Service'
  };
  
  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      className="flex-shrink-0 w-72 bl-glass overflow-hidden cursor-pointer group"
      onClick={() => onViewDetails?.(item, type)}
      style={{ borderRadius: '24px' }}
    >
      <div className="relative h-44 overflow-hidden">
        <img 
          src={item.image || `https://ui-avatars.com/api/?name=${item.title?.replace(/\s/g, '+')}&background=random&size=256`}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          draggable={false}
        />
        <div 
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white"
          style={{ background: typeColors[type] }}
        >
          {typeLabels[type]}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-white font-bold text-xl">${item.price}</p>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-lg mb-1 truncate" style={{ color: '#001F3F' }}>{item.title}</h3>
        <p className="text-sm truncate mb-3" style={{ color: '#606080' }}>{item.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: '#9090B0' }}>{item.location || 'Online'}</span>
          <span 
            className="text-sm font-semibold flex items-center gap-1"
            style={{ color: '#00F0FF' }}
          >
            View <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [featuredItems, setFeaturedItems] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    if (token) {
      navigate('/feed');
    }
    
    // Fetch featured items
    fetchFeaturedItems();
  }, [navigate]);

  const fetchFeaturedItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketplace/listings?limit=6`);
      if (response.ok) {
        const data = await response.json();
        setFeaturedItems((data.listings || []).map(p => ({
          id: p.listing_id || p.id,
          title: p.title,
          description: p.description,
          price: p.price,
          image: p.images?.[0] || p.image,
          location: p.location,
          type: 'product'
        })));
      }
    } catch (err) {
      // Use sample data
      setFeaturedItems([
        { id: 1, title: 'iPhone 15 Pro', description: 'Latest Apple smartphone', price: 999, type: 'product', location: 'New York' },
        { id: 2, title: 'MacBook Pro M3', description: 'Powerful laptop', price: 1999, type: 'product', location: 'Chicago' },
        { id: 3, title: 'Web Development', description: 'Full stack developer', price: 75, type: 'service', location: 'Remote' },
        { id: 4, title: 'Beach House', description: '3BR vacation rental', price: 350, type: 'rental', location: 'Miami' },
      ]);
    }
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const features = [
    { icon: ShoppingBag, title: 'Marketplace', description: 'Buy and sell products, rentals, and services in our trusted community marketplace.', gradient: 'linear-gradient(135deg, #00F0FF, #00B4D8)' },
    { icon: Users, title: 'Social Network', description: 'Connect with friends, share updates, and build meaningful relationships.', gradient: 'linear-gradient(135deg, #8B5CF6, #6366F1)' },
    { icon: Coins, title: 'BL Coins', description: 'Earn rewards, participate in activities, and unlock exclusive benefits.', gradient: 'linear-gradient(135deg, #F59E0B, #EAB308)' },
    { icon: Gamepad2, title: 'Photo Battles', description: 'Compete in exciting photo battles and win amazing prizes.', gradient: 'linear-gradient(135deg, #FF00CC, #EC4899)' },
    { icon: Gift, title: 'Raffles', description: 'Enter exclusive raffles and win incredible rewards daily.', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
    { icon: Share2, title: 'Referrals', description: 'Invite friends and earn bonus coins for every successful referral.', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  ];

  return (
    <div className="bl-premium-bg min-h-screen">
      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      >
        <div 
          className="max-w-7xl mx-auto flex items-center justify-between bl-glass px-6 py-3"
          style={{ borderRadius: '20px' }}
        >
          <Link to="/" className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00F0FF, #FF00CC)' }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ color: '#001F3F' }}>Blendlink</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link 
              to="/login"
              className="px-5 py-2.5 rounded-xl font-semibold transition-all hover:bg-white/50"
              style={{ color: '#001F3F' }}
            >
              Sign In
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link 
                to="/register"
                className="px-6 py-2.5 rounded-xl font-bold text-white"
                style={{ 
                  background: 'linear-gradient(135deg, #00F0FF, #FF00CC)',
                  boxShadow: '0 4px 20px rgba(0, 240, 255, 0.3)'
                }}
              >
                Get Started
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Hero Text */}
            <motion.div 
              className="flex-1 text-center lg:text-left"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                style={{ 
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid rgba(0, 240, 255, 0.3)'
                }}
              >
                <Star className="w-4 h-4" style={{ color: '#00F0FF' }} />
                <span className="text-sm font-semibold" style={{ color: '#00F0FF' }}>
                  The #1 Super App
                </span>
              </motion.div>

              <h1 
                className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight"
                style={{ color: '#001F3F', letterSpacing: '-2px' }}
              >
                Everything You Need,{' '}
                <span 
                  style={{ 
                    background: 'linear-gradient(135deg, #00F0FF, #FF00CC)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  One Platform
                </span>
              </h1>

              <p 
                className="text-xl md:text-2xl mb-10 max-w-2xl"
                style={{ color: '#606080', lineHeight: 1.6 }}
              >
                Marketplace, social networking, rewards, games, and more. 
                Join millions building their future on Blendlink.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link 
                    to="/register"
                    className="bl-btn-primary px-10 py-5 text-lg"
                    style={{ borderRadius: '20px', height: 'auto' }}
                    data-testid="hero-cta-btn"
                  >
                    <Zap className="w-5 h-5" />
                    Start Free Today
                  </Link>
                </motion.div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.7)',
                    color: '#001F3F',
                    border: '1px solid rgba(0, 240, 255, 0.3)'
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #00F0FF, #00B4D8)' }}
                  >
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                  Watch Demo
                </motion.button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 mt-12 justify-center lg:justify-start">
                <div>
                  <p className="text-3xl font-bold" style={{ color: '#001F3F' }}>2M+</p>
                  <p className="text-sm" style={{ color: '#606080' }}>Active Users</p>
                </div>
                <div className="w-px h-12 bg-gray-200"></div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: '#001F3F' }}>$50M+</p>
                  <p className="text-sm" style={{ color: '#606080' }}>Traded</p>
                </div>
                <div className="w-px h-12 bg-gray-200"></div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: '#001F3F' }}>4.9★</p>
                  <p className="text-sm" style={{ color: '#606080' }}>App Rating</p>
                </div>
              </div>
            </motion.div>

            {/* Hero Visual */}
            <motion.div 
              className="flex-1 relative"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div 
                className="relative w-full max-w-lg mx-auto"
                style={{ aspectRatio: '1' }}
              >
                {/* Glow effects */}
                <div 
                  className="absolute top-0 left-0 w-full h-full rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(0, 240, 255, 0.2) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                  }}
                />
                <div 
                  className="absolute bottom-0 right-0 w-3/4 h-3/4 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 0, 204, 0.15) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                  }}
                />
                
                {/* Mock phone */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10 bl-glass p-4"
                  style={{ borderRadius: '40px' }}
                >
                  <div 
                    className="rounded-3xl overflow-hidden"
                    style={{ 
                      background: 'linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%)',
                      aspectRatio: '9/16',
                    }}
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-400 to-pink-400"></div>
                        <div>
                          <div className="h-4 w-24 rounded bg-gray-200"></div>
                          <div className="h-3 w-16 rounded bg-gray-100 mt-2"></div>
                        </div>
                      </div>
                      <div className="h-32 rounded-2xl bg-gradient-to-r from-cyan-100 to-pink-100"></div>
                      <div className="flex gap-3">
                        <div className="h-10 flex-1 rounded-xl bg-gray-100"></div>
                        <div className="h-10 flex-1 rounded-xl bg-gray-100"></div>
                      </div>
                      <div className="h-24 rounded-2xl bg-gradient-to-r from-purple-100 to-blue-100"></div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: '#001F3F' }}
            >
              Everything in One Place
            </h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#606080' }}>
              Discover all the features that make Blendlink the ultimate super app
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      {featuredItems.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div 
              className="flex items-center justify-between mb-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div>
                <h2 
                  className="text-3xl md:text-4xl font-bold mb-2"
                  style={{ color: '#001F3F' }}
                >
                  Featured Listings
                </h2>
                <p style={{ color: '#606080' }}>
                  Discover what&apos;s trending on our marketplace
                </p>
              </div>
              <div className="hidden md:flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => scroll('left')}
                  className="w-12 h-12 rounded-full flex items-center justify-center bl-glass"
                >
                  <ChevronLeft className="w-6 h-6" style={{ color: '#001F3F' }} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => scroll('right')}
                  className="w-12 h-12 rounded-full flex items-center justify-center bl-glass"
                >
                  <ChevronRight className="w-6 h-6" style={{ color: '#001F3F' }} />
                </motion.button>
              </div>
            </motion.div>

            <div 
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
              style={{ scrollbarWidth: 'none' }}
            >
              {featuredItems.map((item, i) => (
                <FeaturedItemCard 
                  key={`${item.type}-${item.id}-${i}`}
                  item={item}
                  type={item.type}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bl-glass p-12 md:p-16 text-center"
            style={{ borderRadius: '36px' }}
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8"
              style={{ background: 'linear-gradient(135deg, #00F0FF, #FF00CC)' }}
            >
              <Gift className="w-10 h-10 text-white" />
            </motion.div>
            
            <h2 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: '#001F3F' }}
            >
              Get 50,000 BL Coins Free
            </h2>
            <p 
              className="text-xl mb-10 max-w-2xl mx-auto"
              style={{ color: '#606080' }}
            >
              Sign up today and receive 50,000 BL Coins to start your journey. 
              Plus earn more through referrals!
            </p>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link 
                to="/register"
                className="bl-btn-primary inline-flex px-12 py-5 text-lg"
                style={{ borderRadius: '20px', height: 'auto', width: 'auto' }}
              >
                Claim Your Bonus Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t" style={{ borderColor: 'rgba(0, 31, 63, 0.1)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00F0FF, #FF00CC)' }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold" style={{ color: '#001F3F' }}>Blendlink</span>
            </div>
            
            <div className="flex items-center gap-8">
              <Link to="/privacy" className="text-sm hover:underline" style={{ color: '#606080' }}>Privacy</Link>
              <Link to="/terms" className="text-sm hover:underline" style={{ color: '#606080' }}>Terms</Link>
              <a href="mailto:support@blendlink.net" className="text-sm hover:underline" style={{ color: '#606080' }}>Contact</a>
            </div>
            
            <p className="text-sm" style={{ color: '#9090B0' }}>
              © 2026 Blendlink. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
