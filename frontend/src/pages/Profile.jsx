import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { 
  Settings, Grid3X3, Heart, Bookmark, Share2, 
  Users, MessageCircle, Coins, ArrowLeft, Edit
} from "lucide-react";

export default function Profile() {
  const { user: currentUser, setUser } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = !id || id === currentUser?.user_id;

  useEffect(() => {
    fetchProfile();
    fetchPosts();
  }, [id]);

  const fetchProfile = async () => {
    try {
      if (isOwnProfile) {
        setProfile(currentUser);
      } else {
        const response = await axios.get(`${API}/users/${id}`);
        setProfile(response.data);
        checkFollowStatus();
      }
    } catch (error) {
      console.error("Profile error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const userId = id || currentUser?.user_id;
      const response = await axios.get(`${API}/users/${userId}/posts`);
      setPosts(response.data);
    } catch (error) {
      console.error("Posts error:", error);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const response = await axios.get(`${API}/users/${currentUser?.user_id}/following`, { 
        withCredentials: true 
      });
      setIsFollowing(response.data.includes(id));
    } catch (error) {
      console.error("Follow status error:", error);
    }
  };

  const handleFollow = async () => {
    try {
      const response = await axios.post(`${API}/users/${id}/follow`, {}, { withCredentials: true });
      setIsFollowing(response.data.following);
      setProfile(prev => ({
        ...prev,
        followers_count: prev.followers_count + (response.data.following ? 1 : -1)
      }));
      toast.success(response.data.following ? "Following!" : "Unfollowed");
    } catch (error) {
      toast.error("Failed to follow");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          {!isOwnProfile && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="font-bold flex-1">{profile?.username || "Profile"}</h1>
          {isOwnProfile && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="flex items-start gap-6 mb-6">
          <Avatar className="w-20 h-20 md:w-24 md:h-24">
            <AvatarImage src={profile?.avatar} />
            <AvatarFallback className="text-2xl">{profile?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.name}</h2>
            <p className="text-muted-foreground">@{profile?.username}</p>
            {profile?.bio && <p className="mt-2">{profile?.bio}</p>}
            
            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <p className="font-bold">{posts.length}</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{profile?.followers_count || 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{profile?.following_count || 0}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          {isOwnProfile ? (
            <>
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={() => navigate("/settings")}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={() => navigate("/referrals")}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </>
          ) : (
            <>
              <Button 
                className={`flex-1 rounded-full ${isFollowing ? "bg-muted text-foreground" : ""}`}
                onClick={handleFollow}
                data-testid="follow-btn"
              >
                <Users className="w-4 h-4 mr-2" />
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={() => navigate(`/messages/${id}`)}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>
            </>
          )}
        </div>

        {/* BL Coins (own profile only) */}
        {isOwnProfile && (
          <div className="bl-coin-gradient rounded-xl p-4 text-white mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white/80 text-sm">BL Coins</p>
                <p className="text-2xl font-bold">{Math.floor(profile?.bl_coins || 0)}</p>
              </div>
            </div>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => navigate("/wallet")}
              className="bg-white/20 text-white hover:bg-white/30"
            >
              View Wallet
            </Button>
          </div>
        )}

        {/* Posts Grid */}
        <div className="border-t border-border/50 pt-4">
          <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
            <Grid3X3 className="w-4 h-4" />
            <span className="text-sm font-medium">Posts</span>
          </div>
          
          {posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No posts yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <div 
                  key={post.post_id}
                  className="aspect-square bg-muted rounded overflow-hidden cursor-pointer"
                >
                  {post.images?.[0] ? (
                    <img 
                      src={post.images[0]} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-xs text-muted-foreground text-center">
                      {post.content?.slice(0, 50)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
