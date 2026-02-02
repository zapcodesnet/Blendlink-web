import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import ComingSoonPlaceholder from "../components/ComingSoonPlaceholder";
import LinkPreview, { extractUrls } from "../components/LinkPreview";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, MessageCircle, Share2, Plus, MoreHorizontal,
  Home as HomeIcon, Building, Briefcase, Settings, Bell, Search,
  RefreshCw, Coins, Users, ShoppingBag, Gavel, ExternalLink, X
} from "lucide-react";

// Loading skeleton component for posts
const PostSkeleton = () => (
  <div className="bg-card rounded-xl border border-border/50 animate-pulse">
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-muted"></div>
        <div className="flex-1">
          <div className="h-4 w-24 bg-muted rounded mb-2"></div>
          <div className="h-3 w-16 bg-muted rounded"></div>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-muted rounded"></div>
        <div className="h-4 w-3/4 bg-muted rounded"></div>
      </div>
      <div className="h-48 bg-muted rounded-lg mb-4"></div>
      <div className="flex gap-4">
        <div className="h-8 w-16 bg-muted rounded"></div>
        <div className="h-8 w-16 bg-muted rounded"></div>
        <div className="h-8 w-16 bg-muted rounded"></div>
      </div>
    </div>
  </div>
);

// Story skeleton
const StorySkeleton = () => (
  <div className="flex-shrink-0 flex flex-col items-center gap-1 animate-pulse">
    <div className="w-16 h-16 rounded-full bg-muted"></div>
    <div className="h-3 w-12 bg-muted rounded"></div>
  </div>
);

export default function Feed() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Profile picture modal state (for double-click to view full size)
  const [fullSizeAvatar, setFullSizeAvatar] = useState(null);
  const clickTimeoutRef = useRef(null);
  
  // Handle avatar click with single/double click detection
  const handleAvatarClick = useCallback((userId, avatarUrl, userName) => {
    if (clickTimeoutRef.current) {
      // Double click detected - show full size modal
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (avatarUrl) {
        setFullSizeAvatar({ url: avatarUrl, name: userName });
      }
    } else {
      // Single click - navigate to profile after delay
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        navigate(`/profile/${userId}`);
      }, 250); // 250ms delay to detect double click
    }
  }, [navigate]);

  // Fetch feed data with error handling
  const fetchFeed = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const feedPosts = await api.posts.getFeed();
      if (Array.isArray(feedPosts) && feedPosts.length > 0) {
        setPosts(feedPosts);
      } else {
        // Fallback to explore if feed is empty
        const explorePosts = await api.posts.getExplore();
        setPosts(Array.isArray(explorePosts) ? explorePosts : []);
      }
    } catch (error) {
      console.error("Feed error:", error);
      // Try explore on error
      try {
        const explorePosts = await api.posts.getExplore();
        setPosts(Array.isArray(explorePosts) ? explorePosts : []);
      } catch {
        setPosts([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch stories separately (non-blocking)
  const fetchStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const storiesData = await api.posts.getStories();
      setStories(Array.isArray(storiesData) ? storiesData : []);
    } catch (error) {
      console.error("Stories error:", error);
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  // Initial load - fetch feed first, then stories
  useEffect(() => {
    fetchFeed();
    // Defer stories loading slightly
    const timer = setTimeout(fetchStories, 100);
    return () => clearTimeout(timer);
  }, [fetchFeed, fetchStories]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeed(false);
    fetchStories();
  };

  const handleLike = async (postId) => {
    try {
      const response = await api.posts.likePost(postId);
      setPosts(posts.map(p => {
        if (p.post_id === postId) {
          return {
            ...p,
            liked: response.liked,
            likes_count: response.liked ? p.likes_count + 1 : p.likes_count - 1
          };
        }
        return p;
      }));
    } catch (error) {
      toast.error(error.message || "Failed to like post");
    }
  };

  const handleClaimDaily = async () => {
    setClaiming(true);
    try {
      const result = await api.wallet.claimDaily();
      toast.success(`Claimed ${result.coins_earned?.toLocaleString()} BL Coins!`);
      setUser({ ...user, bl_coins: result.new_balance });
    } catch (error) {
      toast.error(error.message || "Already claimed today");
    } finally {
      setClaiming(false);
    }
  };

  const quickLinks = [
    { icon: HomeIcon, label: "Rentals", path: "/rentals", color: "bg-emerald-500" },
    { icon: Building, label: "Market", path: "/marketplace", color: "bg-blue-500" },
    { icon: Briefcase, label: "Services", path: "/services", color: "bg-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/blendlink-logo.png" 
              alt="Blendlink" 
              className="h-12 w-auto object-contain"
            />
            <span className="font-bold text-xl">Blendlink</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Daily Claim Banner */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="bl-coin-gradient rounded-xl p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-white/80">Daily Reward</p>
                <p className="font-bold">Claim 10,000 BL Coins</p>
              </div>
            </div>
            <Button 
              size="sm" 
              className="bg-white text-amber-600 hover:bg-white/90"
              onClick={handleClaimDaily}
              disabled={claiming}
              data-testid="claim-daily-btn"
            >
              {claiming ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Claim"}
            </Button>
          </div>
        </div>

        {/* Stories */}
        <div className="px-4 py-4 border-b border-border/50">
          <div className="flex gap-4 overflow-x-auto hide-scrollbar">
            {/* Add Story */}
            <button 
              className="flex flex-col items-center flex-shrink-0"
              onClick={() => navigate("/create-post", { state: { isStory: true } })}
              data-testid="add-story-btn"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-primary/50">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs mt-1 text-muted-foreground">Add Story</span>
            </button>
            
            {/* Story Skeletons while loading */}
            {storiesLoading && (
              <>
                <StorySkeleton />
                <StorySkeleton />
                <StorySkeleton />
              </>
            )}
            
            {/* User Stories */}
            {!storiesLoading && stories.map((story) => (
              <div key={story.post_id} className="flex flex-col items-center flex-shrink-0">
                <div className="story-ring">
                  <div className="story-ring-inner">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={story.user?.avatar || story.user?.picture} loading="lazy" />
                      <AvatarFallback>{story.user?.name?.[0]}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <span className="text-xs mt-1 truncate w-16 text-center">{story.user?.name?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="px-4 py-4 border-b border-border/50">
          <div className="flex gap-3">
            {quickLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="flex-1 flex flex-col items-center p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                data-testid={`quick-${link.label.toLowerCase()}`}
              >
                <div className={`w-10 h-10 rounded-full ${link.color} flex items-center justify-center mb-2`}>
                  <link.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium">{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="px-4 py-2 flex justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Feed'}
          </Button>
        </div>

        {/* Posts */}
        <div className="divide-y divide-border/50">
          {loading ? (
            <div className="p-4 space-y-4">
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <ComingSoonPlaceholder
              icon={Users}
              title="Social Feed Coming Soon"
              description="Connect with friends, share posts and stories"
            />
          ) : (
            posts.map((post) => (
              <article key={post.post_id} className="p-4" data-testid={`post-${post.post_id}`}>
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar 
                    className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" 
                    onClick={() => handleAvatarClick(
                      post.user?.user_id, 
                      post.user?.avatar || post.user?.picture,
                      post.user?.name
                    )}
                    data-testid={`post-avatar-${post.post_id}`}
                  >
                    <AvatarImage src={post.user?.avatar || post.user?.picture} />
                    <AvatarFallback>{post.user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{post.user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </div>

                {/* Post Content */}
                <p className="mb-3 whitespace-pre-wrap">{post.content}</p>

                {/* Marketplace Listing Card - for listing posts */}
                {post.post_type === 'marketplace_listing' && post.listing_id && (
                  <div 
                    className="mb-3 p-4 bg-muted/30 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/marketplace/${post.listing_id}`)}
                    data-testid={`listing-card-${post.listing_id}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {post.is_auction ? (
                        <Gavel className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-xs font-medium text-muted-foreground">
                        {post.is_auction ? 'Auction Listing' : 'Marketplace Listing'}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-1">{post.listing_title}</h3>
                    <p className="text-lg font-bold text-primary">
                      {post.is_auction ? 'Starting at ' : ''}${post.listing_price?.toFixed(2) || '0.00'}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground capitalize">{post.listing_category}</span>
                      <span className="text-xs text-primary flex items-center gap-1">
                        View Listing <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                )}

                {/* URL Link Preview */}
                {(() => {
                  const urls = extractUrls(post.content);
                  return urls.length > 0 ? (
                    <LinkPreview url={urls[0]} className="mb-3" />
                  ) : null;
                })()}

                {/* Post Images - Lazy loaded */}
                {post.images?.length > 0 && (
                  <div className="mb-3 rounded-xl overflow-hidden">
                    <img 
                      src={post.images[0]} 
                      alt="Post" 
                      className="w-full object-cover max-h-96"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}

                {/* Post Actions */}
                <div className="flex items-center gap-4">
                  <button 
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    onClick={() => handleLike(post.post_id)}
                    data-testid={`like-${post.post_id}`}
                  >
                    <Heart className={`w-5 h-5 ${post.liked ? 'fill-red-500 text-red-500' : ''}`} />
                    <span className="text-sm">{post.likes_count || 0}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{post.comments_count || 0}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {/* FAB */}
      <Button
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 w-14 h-14 rounded-full shadow-lg shadow-primary/25"
        onClick={() => navigate("/create-post")}
        data-testid="fab-create-post"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}
