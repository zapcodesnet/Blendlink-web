import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import { AuthContext } from "../App";
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  Video,
  Music,
  Send,
  X,
  Globe,
  Users,
  Lock,
  Sparkles,
  Plus,
  ChevronLeft,
  ChevronRight,
  Coins,
  Camera,
  Loader2,
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Privacy options
const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: Globe, description: "Anyone can see" },
  { value: "friends_only", label: "Friends", icon: Users, description: "Only friends" },
  { value: "private", label: "Only Me", icon: Lock, description: "Private" },
];

// API helper
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
};

// Story Circle Component
const StoryCircle = ({ story, isOwn, onClick }) => {
  const hasUnviewed = story?.has_unviewed;
  
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center space-y-1 flex-shrink-0 ${isOwn ? 'opacity-100' : ''}`}
      data-testid={`story-${story?.user?.user_id || 'add'}`}
    >
      <div className={`relative p-0.5 rounded-full ${
        hasUnviewed 
          ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500' 
          : 'bg-gray-300 dark:bg-gray-600'
      }`}>
        <div className="bg-background p-0.5 rounded-full">
          <Avatar className="w-14 h-14 md:w-16 md:h-16">
            <AvatarImage src={story?.user?.avatar} />
            <AvatarFallback>{story?.user?.name?.[0] || '+'}</AvatarFallback>
          </Avatar>
        </div>
        {isOwn && (
          <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-0.5">
            <Plus className="w-3 h-3" />
          </div>
        )}
      </div>
      <span className="text-xs truncate w-16 text-center">
        {isOwn ? 'Your Story' : story?.user?.name?.split(' ')[0]}
      </span>
    </button>
  );
};

// Stories Bar Component
const StoriesBar = ({ stories, onAddStory, onViewStory, currentUserId }) => {
  const scrollRef = useRef(null);
  
  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction * 200, behavior: 'smooth' });
    }
  };
  
  // Find current user's story
  const ownStory = stories.find(s => s.user?.user_id === currentUserId);
  const otherStories = stories.filter(s => s.user?.user_id !== currentUserId);
  
  return (
    <div className="relative bg-card rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex items-center space-x-4 overflow-x-auto scrollbar-hide" ref={scrollRef}>
        {/* Add/View Own Story */}
        <StoryCircle 
          story={ownStory || { user: { user_id: currentUserId, name: 'Your Story' }}}
          isOwn={true}
          onClick={ownStory ? () => onViewStory(ownStory) : onAddStory}
        />
        
        {/* Other Stories */}
        {otherStories.map((story) => (
          <StoryCircle 
            key={story.user?.user_id}
            story={story}
            onClick={() => onViewStory(story)}
          />
        ))}
      </div>
      
      {/* Scroll Buttons */}
      {stories.length > 5 && (
        <>
          <button 
            onClick={() => scroll(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1 shadow hidden md:block"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => scroll(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1 shadow hidden md:block"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
};

// Create Post Component
const CreatePostCard = ({ user, onPostCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [mediaType, setMediaType] = useState('text');
  const [mediaUrls, setMediaUrls] = useState([]);
  const [privacy, setPrivacy] = useState('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!content.trim() && mediaUrls.length === 0) {
      toast.error('Please add some content or media');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await apiRequest('/social/posts', {
        method: 'POST',
        body: JSON.stringify({ content, media_type: mediaType, media_urls: mediaUrls, privacy }),
      });
      
      toast.success(`Post created! ${result.bl_coins_earned > 0 ? `+${result.bl_coins_earned} BL coins` : ''}`);
      setContent('');
      setMediaUrls([]);
      setIsOpen(false);
      onPostCreated?.(result.post);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const PrivacyIcon = PRIVACY_OPTIONS.find(p => p.value === privacy)?.icon || Globe;
  
  return (
    <div className="bg-card rounded-xl p-4 mb-4 shadow-sm" data-testid="create-post-card">
      <div className="flex items-center space-x-3">
        <Avatar>
          <AvatarImage src={user?.avatar} />
          <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
        </Avatar>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <button 
              className="flex-1 bg-muted rounded-full px-4 py-2.5 text-left text-muted-foreground hover:bg-muted/80 transition"
              data-testid="create-post-trigger"
            >
              What's on your mind, {user?.name?.split(' ')[0]}?
            </button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Post</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* User Info & Privacy */}
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center space-x-1 text-xs bg-muted px-2 py-1 rounded">
                        <PrivacyIcon className="w-3 h-3" />
                        <span>{PRIVACY_OPTIONS.find(p => p.value === privacy)?.label}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {PRIVACY_OPTIONS.map((option) => (
                        <DropdownMenuItem 
                          key={option.value}
                          onClick={() => setPrivacy(option.value)}
                        >
                          <option.icon className="w-4 h-4 mr-2" />
                          <div>
                            <p className="font-medium">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Content */}
              <Textarea
                placeholder={`What's on your mind, ${user?.name?.split(' ')[0]}?`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px] resize-none border-0 focus-visible:ring-0 text-lg"
                data-testid="post-content-input"
              />
              
              {/* Media Preview */}
              {mediaUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {mediaUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      {mediaType === 'video' ? (
                        <video src={url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button 
                        onClick={() => setMediaUrls(mediaUrls.filter((_, idx) => idx !== i))}
                        className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Media Options */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Add to post:</span>
                  <button 
                    onClick={() => setMediaType('image')}
                    className={`p-2 rounded-full hover:bg-muted ${mediaType === 'image' ? 'bg-green-100 text-green-600' : ''}`}
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setMediaType('video')}
                    className={`p-2 rounded-full hover:bg-muted ${mediaType === 'video' ? 'bg-red-100 text-red-600' : ''}`}
                  >
                    <Video className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setMediaType('audio')}
                    className={`p-2 rounded-full hover:bg-muted ${mediaType === 'audio' ? 'bg-purple-100 text-purple-600' : ''}`}
                  >
                    <Music className="w-5 h-5" />
                  </button>
                </div>
                
                {/* BL Coins Reward Info */}
                {privacy === 'public' && (
                  <div className="flex items-center space-x-1 text-xs text-amber-600">
                    <Coins className="w-3 h-3" />
                    <span>
                      {mediaType === 'video' ? '+50' : mediaType === 'audio' ? '+30' : mediaType === 'image' ? '+20' : '+0'} BL
                    </span>
                  </div>
                )}
              </div>
              
              {/* Submit */}
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || (!content.trim() && mediaUrls.length === 0)}
                className="w-full"
                data-testid="submit-post-btn"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center justify-around mt-3 pt-3 border-t">
        <button className="flex items-center space-x-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded-lg transition">
          <Video className="w-5 h-5 text-red-500" />
          <span className="text-sm">Live Video</span>
        </button>
        <button className="flex items-center space-x-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded-lg transition">
          <ImageIcon className="w-5 h-5 text-green-500" />
          <span className="text-sm">Photo/Video</span>
        </button>
        <button className="flex items-center space-x-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded-lg transition">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span className="text-sm">AI Create</span>
        </button>
      </div>
    </div>
  );
};

// Reaction Button Component (Golden Thumbs Up / Silver Thumbs Down)
const ReactionButton = ({ post, onReact, currentUserId }) => {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const longPressTimer = useRef(null);
  
  const isOwnPost = post.user_id === currentUserId;
  const userReaction = post.user_reaction;
  const hasReacted = !!userReaction;
  
  const handleMouseDown = () => {
    if (isOwnPost || hasReacted) return;
    
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      setShowOptions(true);
    }, 500); // 0.5 second for long press (changed from 2s for better UX)
  };
  
  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    if (!isLongPressing && !isOwnPost && !hasReacted) {
      // Quick tap - golden thumbs up
      onReact(post.post_id, 'golden_thumbs_up');
    }
    setIsLongPressing(false);
  };
  
  const handleReactionSelect = (type) => {
    onReact(post.post_id, type);
    setShowOptions(false);
  };
  
  return (
    <div className="relative">
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          setIsLongPressing(false);
        }}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={isOwnPost}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
          isOwnPost ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'
        } ${userReaction === 'golden_thumbs_up' ? 'text-yellow-500' : userReaction === 'silver_thumbs_down' ? 'text-gray-400' : 'text-muted-foreground'}`}
        data-testid={`react-btn-${post.post_id}`}
      >
        <ThumbsUp className={`w-5 h-5 ${userReaction === 'golden_thumbs_up' ? 'fill-yellow-500 text-yellow-500' : ''}`} />
        <span className="text-sm">
          {hasReacted ? (userReaction === 'golden_thumbs_up' ? 'Liked' : 'Disliked') : 'Like'}
        </span>
      </button>
      
      {/* Long Press Options */}
      {showOptions && (
        <div className="absolute bottom-full left-0 mb-2 bg-card rounded-full shadow-lg p-2 flex space-x-2 animate-scale-in">
          <button
            onClick={() => handleReactionSelect('golden_thumbs_up')}
            className="p-2 hover:bg-yellow-100 rounded-full transition transform hover:scale-125"
            title="Golden Thumbs Up (+10 BL each)"
          >
            <ThumbsUp className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          </button>
          <button
            onClick={() => handleReactionSelect('silver_thumbs_down')}
            className="p-2 hover:bg-gray-100 rounded-full transition transform hover:scale-125"
            title="Silver Thumbs Down (+10 BL for you)"
          >
            <ThumbsDown className="w-6 h-6 text-gray-400 fill-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
};

// Post Card Component
const PostCard = ({ post, onReact, onComment, onShare, currentUserId }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const loadComments = async () => {
    if (comments.length > 0) return;
    setIsLoadingComments(true);
    try {
      const data = await apiRequest(`/social/posts/${post.post_id}/comments`);
      setComments(data);
    } catch (error) {
      toast.error('Failed to load comments');
    } finally {
      setIsLoadingComments(false);
    }
  };
  
  const handleToggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) loadComments();
  };
  
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const result = await apiRequest(`/social/posts/${post.post_id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment }),
      });
      setComments([...comments, result.comment]);
      setNewComment('');
      if (result.bl_coins_earned > 0) {
        toast.success(`Comment added! +${result.bl_coins_earned} BL coins`);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  const PrivacyIcon = PRIVACY_OPTIONS.find(p => p.value === post.privacy)?.icon || Globe;
  const timeAgo = getTimeAgo(post.created_at);
  
  return (
    <div className="bg-card rounded-xl shadow-sm mb-4" data-testid={`post-${post.post_id}`}>
      {/* Post Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <Link to={`/profile/${post.user?.user_id}`}>
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.user?.avatar} />
              <AvatarFallback>{post.user?.name?.[0]}</AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link to={`/profile/${post.user?.user_id}`} className="font-semibold hover:underline">
              {post.user?.name}
            </Link>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span>{timeAgo}</span>
              <span>·</span>
              <PrivacyIcon className="w-3 h-3" />
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-muted rounded-full">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Save Post</DropdownMenuItem>
            <DropdownMenuItem>Hide Post</DropdownMenuItem>
            {post.user_id === currentUserId && (
              <DropdownMenuItem className="text-destructive">Delete Post</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="whitespace-pre-wrap">{post.content}</p>
      </div>
      
      {/* Post Media */}
      {post.media_urls?.length > 0 && (
        <div className={`grid ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-0.5`}>
          {post.media_urls.map((url, i) => (
            <div key={i} className="aspect-square bg-muted">
              {post.media_type === 'video' ? (
                <video src={url} controls className="w-full h-full object-cover" />
              ) : post.media_type === 'audio' ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                  <Music className="w-16 h-16 text-white" />
                </div>
              ) : (
                <img src={url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Reaction Counts */}
      <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center space-x-2">
          {post.golden_thumbs_up_count > 0 && (
            <span className="flex items-center space-x-1">
              <ThumbsUp className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span>{post.golden_thumbs_up_count}</span>
            </span>
          )}
          {post.silver_thumbs_down_count > 0 && (
            <span className="flex items-center space-x-1">
              <ThumbsDown className="w-4 h-4 text-gray-400 fill-gray-400" />
              <span>{post.silver_thumbs_down_count}</span>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {post.comments_count > 0 && (
            <button onClick={handleToggleComments} className="hover:underline">
              {post.comments_count} comments
            </button>
          )}
          {post.shares_count > 0 && (
            <span>{post.shares_count} shares</span>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="px-4 py-1 border-t flex items-center justify-around">
        <ReactionButton post={post} onReact={onReact} currentUserId={currentUserId} />
        
        <button 
          onClick={handleToggleComments}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-muted transition text-muted-foreground"
          data-testid={`comment-btn-${post.post_id}`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">Comment</span>
        </button>
        
        <button 
          onClick={() => onShare(post)}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-muted transition text-muted-foreground"
          data-testid={`share-btn-${post.post_id}`}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-sm">Share</span>
        </button>
      </div>
      
      {/* Comments Section */}
      {showComments && (
        <div className="px-4 pb-4 border-t">
          {/* Comment Input */}
          <div className="flex items-center space-x-2 py-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center bg-muted rounded-full px-4 py-2">
              <input
                type="text"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
                className="flex-1 bg-transparent outline-none text-sm"
                data-testid={`comment-input-${post.post_id}`}
              />
              <button 
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmittingComment}
                className="text-primary disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Comments List */}
          {isLoadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.comment_id} className="flex space-x-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.user?.avatar} />
                    <AvatarFallback>{comment.user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-muted rounded-2xl px-3 py-2">
                      <p className="font-semibold text-sm">{comment.user?.name}</p>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-muted-foreground px-3">
                      <button className="hover:underline">Like</button>
                      <button className="hover:underline">Reply</button>
                      <span>{getTimeAgo(comment.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// AI Create Modal Component
const AICreateModal = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [duration, setDuration] = useState(6);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const estimateCost = async () => {
    if (!prompt.trim()) return;
    setIsEstimating(true);
    try {
      const result = await apiRequest('/ai-media/estimate-cost', {
        method: 'POST',
        body: JSON.stringify({ prompt, media_type: mediaType, duration }),
      });
      setEstimate(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsEstimating(false);
    }
  };
  
  const handleGenerate = async () => {
    if (!estimate?.can_afford) {
      toast.error('Not enough BL coins');
      return;
    }
    setIsGenerating(true);
    try {
      const result = await apiRequest('/ai-media/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, media_type: mediaType, duration }),
      });
      toast.success(`${mediaType} generated! -${result.cost_deducted} BL coins`);
      onGenerate(result);
      onClose();
    } catch (error) {
      if (error.message.includes('Need more BL coins')) {
        toast.error('Not enough BL coins. Try posting content to earn more!');
      } else {
        toast.error(error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span>AI Media Generator</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Media Type Selection */}
          <div className="flex space-x-2">
            {[
              { type: 'image', icon: ImageIcon, label: 'Image', cost: '200' },
              { type: 'video', icon: Video, label: 'Video', cost: '400' },
              { type: 'music', icon: Music, label: 'Music', cost: '300', disabled: true },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => !opt.disabled && setMediaType(opt.type)}
                disabled={opt.disabled}
                className={`flex-1 p-3 rounded-lg border-2 transition ${
                  mediaType === opt.type 
                    ? 'border-primary bg-primary/10' 
                    : 'border-transparent bg-muted'
                } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <opt.icon className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.cost} BL</p>
              </button>
            ))}
          </div>
          
          {/* Duration (for video) */}
          {mediaType === 'video' && (
            <div>
              <label className="text-sm font-medium">Duration</label>
              <div className="flex space-x-2 mt-2">
                {[4, 8, 12].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-4 py-2 rounded-lg ${
                      duration === d ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Prompt Input */}
          <div>
            <label className="text-sm font-medium">Describe what you want to create</label>
            <Textarea
              placeholder={`e.g., "A beautiful sunset over mountains with golden light" or "Add fireworks to my photo"`}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setEstimate(null);
              }}
              className="mt-2 min-h-[100px]"
            />
          </div>
          
          {/* Estimate Cost Button */}
          {!estimate && (
            <Button 
              variant="outline" 
              onClick={estimateCost}
              disabled={!prompt.trim() || isEstimating}
              className="w-full"
            >
              {isEstimating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
              Estimate Cost
            </Button>
          )}
          
          {/* Cost Estimate Display */}
          {estimate && (
            <div className={`p-4 rounded-lg ${estimate.can_afford ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
              <div className="flex justify-between items-center">
                <span className="font-medium">Estimated Cost:</span>
                <span className="text-lg font-bold flex items-center">
                  <Coins className="w-4 h-4 mr-1 text-amber-500" />
                  {estimate.estimated_cost} BL
                </span>
              </div>
              <div className="flex justify-between items-center mt-1 text-sm text-muted-foreground">
                <span>Your Balance:</span>
                <span>{estimate.current_balance} BL</span>
              </div>
              {!estimate.can_afford && (
                <p className="text-sm text-red-600 mt-2">
                  Not enough BL coins. Post content to earn more!
                </p>
              )}
            </div>
          )}
          
          {/* Generate Button */}
          {estimate && (
            <Button 
              onClick={handleGenerate}
              disabled={!estimate.can_afford || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating ({mediaType === 'video' ? '2-5 min' : '30s'})...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate {mediaType}
                </>
              )}
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground text-center">
            AI-generated content is royalty-free for personal use.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper function for time ago
const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
};

// Main Social Feed Page
export default function SocialFeed() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  
  // Load feed
  const loadFeed = useCallback(async (skip = 0) => {
    try {
      const data = await apiRequest(`/social/feed?skip=${skip}&limit=10`);
      if (skip === 0) {
        setPosts(data);
      } else {
        setPosts(prev => [...prev, ...data]);
      }
      setHasMore(data.length === 10);
    } catch (error) {
      console.error('Failed to load feed:', error);
    }
  }, []);
  
  // Load stories
  const loadStories = useCallback(async () => {
    try {
      const data = await apiRequest('/stories/');
      setStories(data);
    } catch (error) {
      console.error('Failed to load stories:', error);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadFeed(), loadStories()]);
      setIsLoading(false);
    };
    init();
  }, [loadFeed, loadStories]);
  
  // Load more posts
  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await loadFeed(posts.length);
    setIsLoadingMore(false);
  };
  
  // Handle post creation
  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };
  
  // Handle reaction
  const handleReact = async (postId, reactionType) => {
    try {
      const result = await apiRequest(`/social/posts/${postId}/react`, {
        method: 'POST',
        body: JSON.stringify({ reaction_type: reactionType }),
      });
      
      // Update post in state
      setPosts(prev => prev.map(post => {
        if (post.post_id === postId) {
          return {
            ...post,
            golden_thumbs_up_count: result.golden_thumbs_up_count,
            silver_thumbs_down_count: result.silver_thumbs_down_count,
            user_reaction: reactionType,
          };
        }
        return post;
      }));
      
      const totalEarned = result.reactor_bl_coins_earned + (result.owner_bl_coins_earned || 0);
      if (totalEarned > 0) {
        toast.success(`+${result.reactor_bl_coins_earned} BL coins for reacting!`);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // Handle share
  const handleShare = async (post) => {
    try {
      const result = await apiRequest(`/social/posts/${post.post_id}/share`, {
        method: 'POST',
        body: JSON.stringify({ content: '', privacy: 'public' }),
      });
      setPosts(prev => [result.post, ...prev]);
      toast.success(`Post shared! ${result.bl_coins_earned > 0 ? `+${result.bl_coins_earned} BL coins` : ''}`);
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // Handle AI generation
  const handleAIGenerate = (result) => {
    console.log('AI Generated:', result);
    // Could show preview modal here
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background" data-testid="social-feed-page">
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Stories */}
        <StoriesBar 
          stories={stories}
          onAddStory={() => toast.info('Story creation coming soon!')}
          onViewStory={(story) => toast.info('Story viewer coming soon!')}
          currentUserId={user?.user_id}
        />
        
        {/* Create Post */}
        <CreatePostCard user={user} onPostCreated={handlePostCreated} />
        
        {/* Posts Feed */}
        {posts.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Be the first to share something! Create a post or add friends to see their posts.
            </p>
            <Button onClick={() => navigate('/friends')}>
              Find Friends
            </Button>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                onReact={handleReact}
                onShare={handleShare}
                currentUserId={user?.user_id}
              />
            ))}
            
            {/* Load More */}
            {hasMore && (
              <div className="py-4 text-center">
                <Button 
                  variant="outline" 
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Floating AI Create Button */}
      <button
        onClick={() => setShowAIModal(true)}
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition transform hover:scale-105"
        data-testid="ai-create-fab"
      >
        <Sparkles className="w-6 h-6" />
      </button>
      
      {/* AI Create Modal */}
      <AICreateModal 
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onGenerate={handleAIGenerate}
      />
    </div>
  );
}
