import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import ComingSoonPlaceholder from "../components/ComingSoonPlaceholder";
import LinkPreview, { extractUrls } from "../components/LinkPreview";
import { 
  Heart, MessageCircle, Share2, Plus, MoreHorizontal,
  Home as HomeIcon, Building, Briefcase, Settings, Bell, Search,
  RefreshCw, Coins, Users
} from "lucide-react";

export default function Feed() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetchFeed();
    fetchStories();
  }, []);

  const fetchFeed = async () => {
    try {
      const feedPosts = await api.posts.getFeed();
      if (Array.isArray(feedPosts)) {
        setPosts(feedPosts);
      } else {
        // If feed is empty or not available, try explore
        const explorePosts = await api.posts.getExplore();
        setPosts(Array.isArray(explorePosts) ? explorePosts : []);
      }
    } catch (error) {
      console.error("Feed error:", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStories = async () => {
    try {
      const storiesData = await api.posts.getStories();
      setStories(Array.isArray(storiesData) ? storiesData : []);
    } catch (error) {
      console.error("Stories error:", error);
      setStories([]);
    }
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
            
            {/* User Stories */}
            {stories.map((story) => (
              <div key={story.post_id} className="flex flex-col items-center flex-shrink-0">
                <div className="story-ring">
                  <div className="story-ring-inner">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={story.user?.avatar || story.user?.picture} />
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

        {/* Posts */}
        <div className="divide-y divide-border/50">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
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
                    className="w-10 h-10 cursor-pointer" 
                    onClick={() => navigate(`/profile/${post.user?.user_id}`)}
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

                {/* Post Images */}
                {post.images?.length > 0 && (
                  <div className="mb-3 rounded-xl overflow-hidden">
                    <img 
                      src={post.images[0]} 
                      alt="Post" 
                      className="w-full object-cover max-h-96"
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
