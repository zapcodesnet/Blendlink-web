import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { MedalShowcase } from "../components/MedalShowcase";
import UnifiedPhotoCard from "../components/photo/UnifiedPhotoCard";
import { 
  Settings, Grid3X3, Heart, Bookmark, Share2, 
  Users, MessageCircle, Coins, ArrowLeft, Edit, Copy,
  TrendingUp, Wallet, Crown, Shield, FolderOpen, Sparkles, ShoppingBag,
  Users2, Calendar, FileText, Image
} from "lucide-react";

export default function Profile() {
  const { user: currentUser, setUser } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [mintedPhotos, setMintedPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('photos'); // 'photos' | 'posts'

  const isOwnProfile = !id || id === currentUser?.user_id;

  useEffect(() => {
    fetchProfile();
    fetchPosts();
    fetchMintedPhotos();
  }, [id]);

  const fetchProfile = async () => {
    try {
      if (isOwnProfile) {
        // Fetch fresh profile data
        const freshProfile = await api.auth.getProfile();
        const balance = await api.wallet.getBalance();
        const profileData = {
          ...freshProfile,
          bl_coins: balance.balance,
        };
        setProfile(profileData);
        setUser(profileData);
      } else {
        const userData = await api.users.getUser(id);
        setProfile(userData);
        checkFollowStatus();
      }
    } catch (error) {
      console.error("Profile error:", error);
      // Fallback to stored user
      setProfile(currentUser);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const userId = id || currentUser?.user_id;
      const userPosts = await api.users.getUserPosts(userId);
      setPosts(Array.isArray(userPosts) ? userPosts : []);
    } catch (error) {
      console.error("Posts error:", error);
      setPosts([]);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const following = await api.users.getFollowing(currentUser?.user_id);
      setIsFollowing(following.includes(id));
    } catch (error) {
      console.error("Follow status error:", error);
    }
  };

  const fetchMintedPhotos = async () => {
    try {
      const userId = id || currentUser?.user_id;
      // Get user's public minted photos
      const response = await api.minting.getUserPhotos(userId);
      // Filter to only show public photos
      const publicPhotos = (response.photos || []).filter(p => !p.is_private);
      setMintedPhotos(publicPhotos);
    } catch (error) {
      console.error("Failed to fetch minted photos:", error);
      setMintedPhotos([]);
    }
  };

  const handleFollow = async () => {
    try {
      const response = await api.users.followUser(id);
      setIsFollowing(response.following);
      setProfile(prev => ({
        ...prev,
        followers_count: prev.followers_count + (response.following ? 1 : -1)
      }));
      toast.success(response.following ? "Following!" : "Unfollowed");
    } catch (error) {
      toast.error(error.message || "Failed to follow");
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(profile?.referral_code || "");
    toast.success("Referral code copied!");
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
            <AvatarImage src={profile?.profile_picture || profile?.avatar || profile?.picture} />
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
                <p className="font-bold">{profile?.followers_count || profile?.direct_recruits_count || 0}</p>
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

        {/* BL Coins & Referral - HIDDEN per user request */}
        {/* 
        {isOwnProfile && (
          <>
            <div className="bl-coin-gradient rounded-xl p-4 text-white mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">BL Coins</p>
                  <p className="text-2xl font-bold">{(profile?.bl_coins || 0).toLocaleString()}</p>
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
        */}

        {isOwnProfile && (
          <>
            {/* Referral Code */}
            {profile?.referral_code && (
              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Your Referral Code</p>
                    <p className="font-mono text-lg font-bold">{profile.referral_code}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={copyReferralCode}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {/* Media Sales Shortcuts */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Admin Panel Button - Only visible to admins */}
              {(profile?.is_admin || profile?.admin_role) && (
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2 col-span-2 border-2 border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20"
                  onClick={() => navigate("/admin")}
                  data-testid="admin-panel-btn"
                >
                  <Shield className="w-6 h-6 text-blue-500" />
                  <span className="font-semibold text-blue-500">Admin Panel</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {profile?.admin_role?.replace('_', ' ') || 'Administrator'}
                  </span>
                </Button>
              )}
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/albums")}
                data-testid="albums-btn"
              >
                <FolderOpen className="w-6 h-6 text-purple-500" />
                <span>My Albums</span>
              </Button>
              {/* AI Listing button hidden per user request - code preserved */}
              {false && (
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate("/ai-listing-creator")}
                  data-testid="ai-listing-btn"
                >
                  <Sparkles className="w-6 h-6 text-amber-500" />
                  <span>AI Listing</span>
                </Button>
              )}
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/seller-dashboard")}
                data-testid="seller-dashboard-btn"
              >
                <ShoppingBag className="w-6 h-6 text-green-500" />
                <span>Seller Tools</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/earnings")}
                data-testid="earnings-btn"
              >
                <TrendingUp className="w-6 h-6 text-green-500" />
                <span>Earnings</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/withdraw")}
                data-testid="withdraw-btn"
              >
                <Wallet className="w-6 h-6 text-blue-500" />
                <span>Withdraw</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/upload-media")}
                data-testid="upload-media-btn"
              >
                <Grid3X3 className="w-6 h-6" />
                <span>Upload Media</span>
              </Button>
            </div>

            {/* Admin Button (only for admins) */}
            {profile?.is_admin && (
              <Button 
                className="w-full mb-6 bg-gradient-to-r from-purple-500 to-indigo-600"
                onClick={() => navigate("/admin")}
                data-testid="admin-btn"
              >
                <Shield className="w-5 h-5 mr-2" />
                Admin Dashboard
              </Button>
            )}

            {/* Offers & Browse */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/offers")}
                data-testid="offers-btn"
              >
                <Coins className="w-6 h-6" />
                <span>Offers</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/media-for-sale")}
                data-testid="browse-media-btn"
              >
                <Bookmark className="w-6 h-6" />
                <span>Browse Media</span>
              </Button>
            </div>

            {/* Social Features */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">SOCIAL</h3>
              <div className="grid grid-cols-4 gap-2">
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => navigate("/friends")}
                  data-testid="friends-btn"
                >
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-xs">Friends</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => navigate("/groups")}
                  data-testid="groups-btn"
                >
                  <Users2 className="w-5 h-5 text-purple-500" />
                  <span className="text-xs">Groups</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => navigate("/events")}
                  data-testid="events-btn"
                >
                  <Calendar className="w-5 h-5 text-pink-500" />
                  <span className="text-xs">Events</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col gap-1"
                  onClick={() => navigate("/pages")}
                  data-testid="pages-btn"
                >
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs">Pages</span>
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Medal Showcase Section */}
        <div className="mb-6" data-testid="medal-showcase-section">
          <MedalShowcase 
            userId={profile?.user_id || id} 
            isOwnProfile={isOwnProfile} 
          />
        </div>

        {/* Tabs: Minted Photos / Posts */}
        <div className="border-t border-border/50 pt-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setActiveTab('photos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'photos' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="photos-tab"
            >
              <Image className="w-4 h-4" />
              <span className="text-sm font-medium">Minted ({mintedPhotos.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'posts' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="posts-tab"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="text-sm font-medium">Posts ({posts.length})</span>
            </button>
          </div>

          {/* Minted Photos Gallery */}
          {activeTab === 'photos' && (
            <div data-testid="minted-photos-gallery">
              {mintedPhotos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No minted photos yet</p>
                  {isOwnProfile && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => navigate('/minted-photos')}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Mint Your First Photo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {mintedPhotos.slice(0, 12).map(photo => (
                    <UnifiedPhotoCard
                      key={photo.mint_id}
                      photo={photo}
                      onClick={() => navigate('/minted-photos')}
                      size="small"
                      showStats={true}
                      showStamina={false}
                    />
                  ))}
                </div>
              )}
              {mintedPhotos.length > 12 && (
                <div className="text-center mt-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('/minted-photos')}
                  >
                    View all {mintedPhotos.length} photos →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Posts Grid */}
          {activeTab === 'posts' && (
            <div data-testid="posts-grid">
              {posts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No posts yet</p>
                  <p className="text-xs mt-1">Social features coming soon to mobile API</p>
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
          )}
        </div>

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
    </div>
  );
}
