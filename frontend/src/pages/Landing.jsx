import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import LanguageSelector from "../components/LanguageSelector";
import { getToken } from "../services/api";
import { 
  Users, ShoppingBag, Home, Briefcase, Gamepad2, Gift, 
  Coins, Share2, ChevronRight, Smartphone, Bell, Zap,
  ChevronLeft, Eye, ShoppingCart
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Featured Item Card Component
const FeaturedItemCard = ({ item, type, onViewDetails }) => {
  const typeColors = {
    product: 'from-blue-500 to-cyan-500',
    rental: 'from-green-500 to-emerald-500',
    service: 'from-purple-500 to-pink-500'
  };
  
  const typeLabels = {
    product: 'Product',
    rental: 'Rental',
    service: 'Service'
  };
  
  return (
    <div 
      className="flex-shrink-0 w-64 md:w-72 bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={() => onViewDetails(item, type)}
      data-testid={`featured-${type}-${item.id}`}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="relative h-40 overflow-hidden" style={{ touchAction: 'pan-y' }}>
        <img 
          src={item.image || `https://ui-avatars.com/api/?name=${item.title.replace(/\s/g, '+')}&background=random&size=256`}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 pointer-events-none"
          draggable={false}
        />
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs text-white bg-gradient-to-r ${typeColors[type]} pointer-events-none`}>
          {typeLabels[type]}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pointer-events-none">
          <p className="text-white font-bold text-lg">${item.price}</p>
        </div>
      </div>
      <div className="p-4" style={{ touchAction: 'pan-y' }}>
        <h3 className="font-semibold truncate">{item.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{item.location || 'Online'}</span>
          <Button size="sm" variant="ghost" className="text-primary">
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
        </div>
      </div>
    </div>
  );
};

// Featured Listings Carousel
const FeaturedListingsCarousel = ({ onViewDetails }) => {
  const [items, setItems] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(0);
  const scrollRef = useRef(null);
  const categories = ['all', 'products', 'rentals', 'services'];
  
  // Generate sample items if no real data (moved before useEffect)
  const generateSampleItems = () => {
    return [
      { id: 1, title: 'iPhone 15 Pro', description: 'Latest Apple smartphone', price: 999, type: 'product', location: 'New York' },
      { id: 2, title: 'Downtown Apartment', description: '2BR modern apartment', price: 2500, type: 'rental', location: 'Los Angeles' },
      { id: 3, title: 'Web Development', description: 'Full stack developer', price: 75, type: 'service', location: 'Remote' },
      { id: 4, title: 'MacBook Pro M3', description: 'Powerful laptop', price: 1999, type: 'product', location: 'Chicago' },
      { id: 5, title: 'Beach House', description: '3BR vacation rental', price: 350, type: 'rental', location: 'Miami' },
      { id: 6, title: 'Logo Design', description: 'Professional branding', price: 150, type: 'service', location: 'Remote' },
      { id: 7, title: 'Gaming Console', description: 'PS5 with games', price: 450, type: 'product', location: 'Seattle' },
      { id: 8, title: 'Studio Apartment', description: 'Cozy studio', price: 1200, type: 'rental', location: 'Austin' },
      { id: 9, title: 'Photography', description: 'Event photographer', price: 200, type: 'service', location: 'Denver' },
    ];
  };
  
  useEffect(() => {
    // Fetch featured listings
    const fetchFeaturedItems = async () => {
      try {
        const [productsRes, rentalsRes, servicesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/marketplace/listings?limit=6`).then(r => r.ok ? r.json() : []),
          fetch(`${API_BASE_URL}/api/rentals?limit=6`).then(r => r.ok ? r.json() : []),
          fetch(`${API_BASE_URL}/api/services?limit=6`).then(r => r.ok ? r.json() : [])
        ]);
        
        const products = (productsRes.listings || productsRes || []).map(p => ({
          id: p.listing_id || p.id,
          title: p.title,
          description: p.description,
          price: p.price,
          image: p.images?.[0] || p.image,
          location: p.location,
          type: 'product'
        }));
        
        const rentals = (rentalsRes.rentals || rentalsRes || []).map(r => ({
          id: r.rental_id || r.id,
          title: r.title,
          description: r.description,
          price: r.price_per_month || r.price,
          image: r.images?.[0] || r.image,
          location: r.location || r.address,
          type: 'rental'
        }));
        
        const services = (servicesRes.services || servicesRes || []).map(s => ({
          id: s.service_id || s.id,
          title: s.title,
          description: s.description,
          price: s.price_per_hour || s.hourly_rate || s.price,
          image: s.images?.[0] || s.image,
          location: s.location,
          type: 'service'
        }));
        
        // Interleave items for alternating display
        const maxLen = Math.max(products.length, rentals.length, services.length);
        const interleaved = [];
        for (let i = 0; i < maxLen; i++) {
          if (products[i]) interleaved.push(products[i]);
          if (rentals[i]) interleaved.push(rentals[i]);
          if (services[i]) interleaved.push(services[i]);
        }
        
        setItems(interleaved.length > 0 ? interleaved : generateSampleItems());
      } catch (err) {
        console.log('Using sample data:', err);
        setItems(generateSampleItems());
      }
    };
    
    fetchFeaturedItems();
  }, []);
  
  const filteredItems = currentCategory === 0 ? items : 
    items.filter(item => {
      if (currentCategory === 1) return item.type === 'product';
      if (currentCategory === 2) return item.type === 'rental';
      if (currentCategory === 3) return item.type === 'service';
      return true;
    });
  
  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  
  // Auto-rotate categories
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCategory(prev => (prev + 1) % categories.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <section className="py-12 px-4 bg-gradient-to-b from-transparent via-muted/30 to-transparent">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Explore What&apos;s Available</h2>
            <p className="text-muted-foreground">Products, rentals, and services from our community</p>
          </div>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            {categories.map((cat, i) => (
              <Button
                key={cat}
                variant={currentCategory === i ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentCategory(i)}
                className="capitalize"
                data-testid={`filter-${cat}`}
              >
                {cat === 'all' ? 'All' : cat}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="relative">
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y'  // Allow both horizontal and vertical scroll
            }}
          >
            {filteredItems.map((item, i) => (
              <FeaturedItemCard 
                key={`${item.type}-${item.id}-${i}`} 
                item={item} 
                type={item.type}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
          
          {filteredItems.length > 3 && (
            <>
              <button 
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-background transition hidden md:block"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-background transition hidden md:block"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

// Recently Viewed Section
const RecentlyViewedSection = ({ onViewDetails }) => {
  const { t } = useTranslation();
  const [recentItems, setRecentItems] = useState(() => {
    // Initialize from localStorage
    try {
      return JSON.parse(localStorage.getItem('blendlink_recently_viewed') || '[]');
    } catch {
      return [];
    }
  });
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('blendlink_recently_viewed');
    setRecentItems([]);
  };

  if (recentItems.length === 0) return null;

  return (
    <section className="py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">{t('landing.recently_viewed') || 'Recently Viewed'}</h2>
            <span className="text-sm text-muted-foreground">({recentItems.length})</span>
          </div>
          <button 
            onClick={clearHistory}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('landing.clear_history') || 'Clear History'}
          </button>
        </div>
        
        <div className="relative">
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y'  // Allow both horizontal and vertical scroll
            }}
          >
            {recentItems.map((item, i) => (
              <div
                key={`recent-${item.listing_id}-${i}`}
                className="flex-shrink-0 w-48 bg-card rounded-xl overflow-hidden shadow hover:shadow-lg transition-all duration-300 cursor-pointer group snap-start"
                onClick={() => onViewDetails({ id: item.listing_id }, 'product')}
                data-testid={`recent-${item.listing_id}`}
              >
                <div className="relative h-32 overflow-hidden bg-muted">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white font-bold">${item.price?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{item.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{item.category || 'Item'}</p>
                </div>
              </div>
            ))}
          </div>
          
          {recentItems.length > 4 && (
            <>
              <button 
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-lg hover:bg-background transition hidden md:block"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-lg hover:bg-background transition hidden md:block"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Redirect authenticated users to /feed
  useEffect(() => {
    const token = getToken();
    if (token) {
      navigate('/feed', { replace: true });
    }
  }, [navigate]);

  const features = [
    { icon: Users, title: "Social Network", desc: "Connect with friends, share posts & stories" },
    { icon: ShoppingBag, title: t('nav.marketplace') || "Marketplace", desc: "Buy & sell items with zero fees" },
    { icon: Home, title: t('nav.rentals') || "Property Rentals", desc: "Find your perfect home" },
    { icon: Briefcase, title: t('nav.services') || "Services", desc: "Hire professionals or offer your skills" },
    { icon: Gamepad2, title: t('nav.games') || "Games", desc: "Play & win BL Coins" },
    { icon: Gift, title: "Raffles", desc: "Enter contests for big prizes" },
    { icon: Coins, title: t('wallet.bl_coins') || "BL Coins", desc: "Earn rewards for every activity" },
    { icon: Share2, title: t('nav.referrals') || "Referrals", desc: "Invite friends & earn together" },
  ];
  
  // Handle viewing item details - works for all users including guests
  const handleViewDetails = (item, type) => {
    // Navigate to item detail page based on type - public marketplace for all
    if (item) {
      const routes = {
        product: `/marketplace/${item.id}`,
        rental: `/rentals/${item.id}`,
        service: `/services/${item.id}`
      };
      navigate(routes[type] || '/marketplace');
    }
  };

  return (
    <div 
      className="landing-page-scroll-container"
      data-testid="landing-page"
    >
      {/* Header - Mobile Optimized */}
      <header className="glass sticky top-0 z-50 border-b border-border/50 safe-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2">
              <img 
                src="/blendlink-logo.png" 
                alt="Blendlink" 
                className="h-10 sm:h-14 w-auto object-contain"
              />
              <span className="font-bold text-xl sm:text-2xl hidden xs:inline">Blendlink</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector compact className="hidden sm:block" />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/login")}
                data-testid="login-btn"
                className="text-sm sm:text-base px-2 sm:px-4"
              >
                {t('auth.login') || 'Login'}
              </Button>
              <Button 
                onClick={() => navigate("/register")}
                size="sm"
                className="rounded-full text-sm sm:text-base px-3 sm:px-4"
                data-testid="get-started-btn"
              >
                {t('auth.get_started') || 'Get Started'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Language Selector */}
      <div className="sm:hidden px-4 py-2 flex justify-center">
        <LanguageSelector />
      </div>

      {/* Featured Listings Carousel - TOP OF PAGE */}
      <FeaturedListingsCarousel onViewDetails={handleViewDetails} />

      {/* Recently Viewed Section */}
      <RecentlyViewedSection onViewDetails={handleViewDetails} />

      {/* Super App Badge + Browse Marketplace Section */}
      <section className="py-6 sm:py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
            {t('landing.super_app') || 'Your All-in-One Super App'}
          </div>
          
          {/* Browse Marketplace Link */}
          <div>
            <Button 
              variant="link" 
              className="text-muted-foreground hover:text-primary text-sm sm:text-base"
              onClick={() => navigate('/marketplace')}
              data-testid="browse-marketplace-link"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('landing.browse_marketplace') || 'Browse the Marketplace'}
            </Button>
          </div>
        </div>
      </section>

      {/* Hero Section - Mobile Optimized */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-20 relative">
          <div className="text-center max-w-3xl mx-auto animate-slide-up">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight">
              {t('landing.hero_title') || 'Social, Shop, Play &'}<br />
              <span className="bl-coin-text">{t('landing.hero_highlight') || 'Earn Rewards'}</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              {t('landing.hero_subtitle') || 'Connect with friends, buy & sell items, find rentals, hire services, play games, and earn BL Coins — all in one app.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <Button 
                size="lg" 
                className="rounded-full text-base sm:text-lg px-6 sm:px-8 shadow-lg shadow-primary/25 w-full sm:w-auto"
                onClick={() => navigate("/register")}
                data-testid="hero-cta-btn"
              >
                {t('landing.start_earning') || 'Start Earning Today'}
                <ChevronRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="rounded-full text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
                onClick={() => navigate("/login")}
                data-testid="have-account-btn"
              >
                I Have an Account
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Mobile Optimized */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-base sm:text-lg">One app, endless possibilities</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 stagger-children">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl card-hover"
                data-testid={`feature-${feature.title.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1 text-sm sm:text-base">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BL Coins Section - Mobile Optimized */}
      <section className="py-12 sm:py-20 px-4 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bl-coin-gradient flex items-center justify-center mb-4 sm:mb-6 animate-pulse-glow">
                  <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
                  Earn <span className="text-green-500">Real Cash</span> and <span className="bl-coin-text">BL Coins</span>
                </h2>
                <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">
                  Get rewarded for everything you do. Sell in Marketplace to earn real cash. 
                  Post content, like, share, comment, create page, invite friends, play games, 
                  and complete tasks to earn BL Coins you can spend in-app.
                </p>
                <ul className="space-y-2 sm:space-y-3">
                  {[
                    "50,000 BL Coins welcome bonus",
                    "50,000 BL Coins when you invite a friend and joined",
                    "2,000+ BL Coins daily login rewards",
                    "3% - 4% per Level 1 referral",
                    "1% - 2% per Level 2 referral"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative hidden md:block">
                <div className="aspect-square max-w-sm mx-auto bg-gradient-to-br from-primary/20 to-amber-500/20 rounded-3xl flex items-center justify-center">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 bl-coin-gradient rounded-full flex items-center justify-center shadow-2xl">
                    <span className="text-white font-bold text-3xl sm:text-4xl">BL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PWA Section - Mobile Optimized */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-green-500/10 text-green-600 text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            <Smartphone className="w-3 h-3 sm:w-4 sm:h-4" />
            Install as App
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Works Like a Native App
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Add Blendlink to your home screen for the best experience. 
            Fast, offline-capable, and always at your fingertips.
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted text-xs sm:text-sm">
              <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Push Notifications</span>
            </div>
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted text-xs sm:text-sm">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Instant Loading</span>
            </div>
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted text-xs sm:text-sm">
              <Smartphone className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Home Screen Icon</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Mobile Optimized */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Ready to Join?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8 px-2">
            Create your free account and start earning BL Coins today.
          </p>
          <Button 
            size="lg" 
            className="rounded-full text-base sm:text-lg px-8 sm:px-10 shadow-lg shadow-primary/25 w-full sm:w-auto"
            onClick={() => navigate("/register")}
            data-testid="bottom-cta-btn"
          >
            Create Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <img 
                src="/blendlink-logo.png" 
                alt="Blendlink" 
                className="h-12 w-auto object-contain"
              />
              <span className="font-semibold text-lg">Blendlink</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link 
                to="/privacypolicy" 
                className="text-muted-foreground hover:text-primary transition-colors"
                data-testid="footer-privacy-link"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/termsofservice" 
                className="text-muted-foreground hover:text-primary transition-colors"
                data-testid="footer-terms-link"
              >
                Terms of Service
              </Link>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            © 2026 Blendlink. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
