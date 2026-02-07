/**
 * Landing Page - Original Simple Design
 * 
 * Clean, functional, text-heavy promotional landing page
 * No premium glassmorphism, gradients, or modern effects
 */

import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken } from "../services/api";
import { 
  Users, ShoppingBag, Home, Briefcase, Gamepad2, Gift, 
  Coins, Share2, ChevronRight, Smartphone, Bell, Download,
  ChevronLeft, MapPin, Globe
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Simple Listing Card Component
const ListingCard = ({ item, type }) => {
  const typeLabels = {
    product: 'Product',
    rental: 'Rental',
    service: 'Service'
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative h-40 bg-gray-100">
        {item.image ? (
          <img 
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
          </div>
        )}
        <span className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">
          {typeLabels[type]}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
        <p className="text-lg font-bold text-blue-600 mt-1">${item.price}</p>
        <p className="text-sm text-gray-500 truncate mt-1">{item.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {item.location || 'Online'}
          </span>
          <button className="px-4 py-1.5 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors">
            View
          </button>
        </div>
      </div>
    </div>
  );
};

// Feature Item Component
const FeatureItem = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3 py-3">
    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-blue-600" />
    </div>
    <div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  </div>
);

// Install Feature Item
const InstallFeature = ({ icon: Icon, title, description }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
      <Icon className="w-5 h-5 text-green-600" />
    </div>
    <div>
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  </div>
);

export default function Landing() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const scrollRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    if (token) {
      navigate('/feed');
    }
    
    fetchFeaturedItems();
  }, [navigate]);

  const fetchFeaturedItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketplace/listings?limit=9`);
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
      // Use sample data matching original site
      setFeaturedItems([
        { id: 1, title: 'iPhone 15 Pro', description: 'Latest Apple smartphone', price: 999, type: 'product', location: 'New York' },
        { id: 2, title: 'MacBook Pro M3', description: 'Powerful laptop', price: 1999, type: 'product', location: 'Chicago' },
        { id: 3, title: 'Gaming Console', description: 'PS5 with games', price: 450, type: 'product', location: 'Seattle' },
        { id: 4, title: 'Downtown Apartment', description: 'Modern 2BR apartment', price: 2500, type: 'rental', location: 'Los Angeles' },
        { id: 5, title: 'Beach House', description: '3BR vacation rental', price: 350, type: 'rental', location: 'Miami' },
        { id: 6, title: 'Studio Apartment', description: 'Cozy studio space', price: 1200, type: 'rental', location: 'Austin' },
        { id: 7, title: 'Web Development', description: 'Full stack developer', price: 75, type: 'service', location: 'Remote' },
        { id: 8, title: 'Logo Design', description: 'Professional branding', price: 150, type: 'service', location: 'Remote' },
        { id: 9, title: 'Photography', description: 'Event photography', price: 200, type: 'service', location: 'Denver' },
      ]);
    }
  };

  const filteredItems = selectedFilter === 'all' 
    ? featuredItems 
    : featuredItems.filter(item => item.type === selectedFilter);

  const features = [
    { icon: Users, title: 'Social Network', description: 'Connect with friends, share posts & stories' },
    { icon: ShoppingBag, title: 'Marketplace', description: 'Buy & sell items with zero fees' },
    { icon: Home, title: 'Rentals', description: 'Find your perfect home' },
    { icon: Briefcase, title: 'Services', description: 'Hire professionals or offer your skills' },
    { icon: Gamepad2, title: 'Games', description: 'Play & win BL Coins' },
    { icon: Gift, title: 'Raffles', description: 'Enter contests for big prizes' },
    { icon: Coins, title: 'BL Coins', description: 'Earn rewards for every activity' },
    { icon: Share2, title: 'Referrals', description: 'Invite friends & earn together' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Language Selector */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-2 flex justify-end">
          <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <Globe className="w-4 h-4" />
            <span>🇬🇧 English</span>
          </button>
        </div>
      </div>

      {/* Explore Section */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Explore What's Available
            </h2>
            <p className="text-gray-600">
              Products, rentals, and services from our community
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex justify-center gap-2 mb-8">
            {['all', 'product', 'rental', 'service'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === filter
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`filter-${filter}`}
              >
                {filter === 'all' ? 'All' : filter === 'product' ? 'Products' : filter === 'rental' ? 'Rentals' : 'Services'}
              </button>
            ))}
          </div>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <ListingCard key={`${item.type}-${item.id}`} item={item} type={item.type} />
            ))}
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-blue-600 font-medium mb-2">Browse the Marketplace</p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Your All-in-One Super App
          </h1>
          <p className="text-gray-500 text-sm mb-4"># Social, Shop, Play & Earn Rewards</p>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect with friends, buy & sell items, find rentals, hire services, 
            play games, and earn BL Coins — all in one app.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/register"
              className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
              data-testid="start-earning-btn"
            >
              Start Earning Today
            </Link>
            <Link 
              to="/login"
              className="px-8 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              data-testid="login-btn"
            >
              I Have an Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Everything You Need
            </h2>
            <p className="text-gray-600">One app, endless possibilities</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <FeatureItem key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Earn Real Cash and BL Coins
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Get rewarded for every activity. Sell items and earn real cash. 
              Engage with the community and earn BL Coins.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Welcome Bonus</h3>
                <p className="text-gray-600 text-sm">
                  Get <span className="font-bold text-blue-600">50,000 BL Coins</span> when you create your account
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Referral Bonuses</h3>
                <ul className="text-gray-600 text-sm space-y-1">
                  <li>• Level 1: 3-4% of referred user's earnings</li>
                  <li>• Level 2: 1-2% of secondary referrals</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Earn from Activities</h3>
                <ul className="text-gray-600 text-sm space-y-1">
                  <li>• Posting content: +100 BL Coins</li>
                  <li>• Receiving likes: +10 BL Coins each</li>
                  <li>• Daily login: +50 BL Coins</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Sales Commission</h3>
                <p className="text-gray-600 text-sm">
                  Sell items with <span className="font-bold text-green-600">zero platform fees</span>. 
                  Keep 100% of your sales.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Install as App Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Install as App
            </h2>
            <p className="text-gray-600">
              Add to your home screen for a native-like experience — fast and offline-capable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InstallFeature 
              icon={Bell} 
              title="Push Notifications" 
              description="Stay updated in real-time"
            />
            <InstallFeature 
              icon={Download} 
              title="Instant Loading" 
              description="Works offline too"
            />
            <InstallFeature 
              icon={Smartphone} 
              title="Home Screen Icon" 
              description="Quick access anytime"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-blue-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Join?
          </h2>
          <p className="text-blue-100 mb-8">
            Create your free account and start earning BL Coins today.
          </p>
          <Link 
            to="/register"
            className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            data-testid="create-account-btn"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">Blendlink</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <a href="mailto:support@blendlink.net" className="hover:text-white transition-colors">Contact</a>
            </div>
            
            <p className="text-sm">
              © 2024 Blendlink. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
