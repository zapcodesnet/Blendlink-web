import React, { useState, useEffect, useContext, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { AuthContext } from "../App";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  ThumbsUp,
  MessageCircle,
  UserPlus,
  UserCheck,
  Share2,
  Users,
  Calendar,
  Coins,
  Sparkles,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Loader2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

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

// Notification type icons and colors (Facebook-style)
const NOTIFICATION_CONFIG = {
  reaction: {
    icon: ThumbsUp,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  comment: {
    icon: MessageCircle,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  friend_request: {
    icon: UserPlus,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  friend_accepted: {
    icon: UserCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  post_share: {
    icon: Share2,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  page_subscribe: {
    icon: Users,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  group_join: {
    icon: Users,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
  },
  event_rsvp: {
    icon: Calendar,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  bl_coins_earned: {
    icon: Coins,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  diamond_status: {
    icon: Sparkles,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  system: {
    icon: Bell,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  },
};

// Time ago helper
const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Single Notification Item Component (Facebook-style)
const NotificationItem = ({ notification, onMarkRead, onDelete }) => {
  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.system;
  const Icon = config.icon;
  const isUnread = !notification.is_read;

  const handleClick = () => {
    if (isUnread) {
      onMarkRead([notification.notification_id]);
    }
    
    // Navigate based on notification type and data
    const data = notification.data || {};
    if (data.post_id) {
      window.location.href = `/feed#post-${data.post_id}`;
    } else if (data.user_id || data.from_user_id) {
      window.location.href = `/profile/${data.user_id || data.from_user_id}`;
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
        isUnread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
      }`}
      onClick={handleClick}
      data-testid={`notification-${notification.notification_id}`}
    >
      {/* Icon */}
      <div className={`p-2 rounded-full ${config.bgColor}`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isUnread ? 'font-semibold' : ''}`}>
          {notification.title}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {getTimeAgo(notification.created_at)}
        </p>
      </div>
      
      {/* Unread indicator */}
      {isUnread && (
        <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-2" />
      )}
      
      {/* Delete button (shown on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.notification_id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
        title="Delete notification"
      >
        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
};

// Main Notifications Page
export default function Notifications() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread
  const [hasMore, setHasMore] = useState(true);

  const loadNotifications = useCallback(async (skip = 0, append = false) => {
    try {
      const unreadOnly = filter === 'unread';
      const data = await apiRequest(
        `/notifications/?skip=${skip}&limit=20&unread_only=${unreadOnly}`
      );
      
      if (append) {
        setNotifications(prev => [...prev, ...data.notifications]);
      } else {
        setNotifications(data.notifications);
      }
      setUnreadCount(data.unread_count);
      setHasMore(data.notifications.length === 20);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    }
  }, [filter]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadNotifications();
      setIsLoading(false);
    };
    init();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkRead = async (notificationIds) => {
    try {
      await apiRequest('/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ notification_ids: notificationIds }),
      });
      
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.notification_id) 
            ? { ...n, is_read: true } 
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await apiRequest(`/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleLoadMore = () => {
    loadNotifications(notifications.length, true);
  };

  // Group notifications by date (Facebook-style)
  const groupNotificationsByDate = useCallback((notifications) => {
    const groups = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    notifications.forEach(notification => {
      const date = new Date(notification.created_at).toDateString();
      let label;
      
      if (date === today) {
        label = 'Today';
      } else if (date === yesterday) {
        label = 'Yesterday';
      } else {
        label = new Date(notification.created_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      }
      
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(notification);
    });

    return groups;
  }, []);

  const groupedNotifications = groupNotificationsByDate(notifications);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="notifications-page">
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/settings/notifications">
              <Button variant="ghost" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
          </div>
          
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-primary"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="p-8 text-center">
              <BellOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No notifications</h3>
              <p className="text-muted-foreground text-sm">
                {filter === 'unread' 
                  ? "You're all caught up! No unread notifications." 
                  : "You don't have any notifications yet. Interact with posts and friends to see updates here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
                  {dateLabel}
                </h3>
                <Card className="bg-card divide-y divide-border">
                  {items.map((notification) => (
                    <div key={notification.notification_id} className="group">
                      <NotificationItem
                        notification={notification}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </Card>
              </div>
            ))}
            
            {/* Load More */}
            {hasMore && (
              <div className="text-center py-4">
                <Button variant="outline" onClick={handleLoadMore}>
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats Card */}
        <Card className="mt-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/10">
                  <Coins className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-semibold">Keep engaging to earn more!</p>
                  <p className="text-sm text-muted-foreground">
                    React, comment, and post to earn BL coins
                  </p>
                </div>
              </div>
              <Link to="/analytics">
                <Button variant="ghost" size="sm">
                  View Stats <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
