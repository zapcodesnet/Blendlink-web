import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { AuthContext } from "../App";
import { toast } from "sonner";
import {
  Bell,
  ThumbsUp,
  MessageCircle,
  Users,
  UserPlus,
  Share2,
  Coins,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Loader2,
  BellOff,
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

// Notification type icons and colors
const notificationConfig = {
  reaction: { icon: ThumbsUp, color: "text-amber-500", bg: "bg-amber-500/10" },
  comment: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
  friend_request: { icon: UserPlus, color: "text-green-500", bg: "bg-green-500/10" },
  friend_accepted: { icon: Users, color: "text-green-500", bg: "bg-green-500/10" },
  post_share: { icon: Share2, color: "text-purple-500", bg: "bg-purple-500/10" },
  bl_coins_earned: { icon: Coins, color: "text-amber-500", bg: "bg-amber-500/10" },
  system: { icon: Bell, color: "text-gray-500", bg: "bg-gray-500/10" },
  default: { icon: Bell, color: "text-gray-500", bg: "bg-gray-500/10" },
};

// Get time ago
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

// Notification Item Component
const NotificationItem = ({ notification, onMarkRead, onDelete }) => {
  const config = notificationConfig[notification.type] || notificationConfig.default;
  const Icon = config.icon;
  
  return (
    <div 
      className={`flex items-start p-4 border-b border-border last:border-0 transition-colors ${
        notification.is_read ? 'bg-background' : 'bg-primary/5'
      }`}
      data-testid={`notification-${notification.notification_id}`}
    >
      <div className={`p-2 rounded-full ${config.bg} mr-3 flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${notification.is_read ? 'text-muted-foreground' : ''}`}>
          {notification.title}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
        <p className="text-xs text-muted-foreground mt-2">{getTimeAgo(notification.created_at)}</p>
      </div>
      
      <div className="flex items-center space-x-1 ml-2">
        {!notification.is_read && (
          <button
            onClick={() => onMarkRead(notification.notification_id)}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            title="Mark as read"
          >
            <Check className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => onDelete(notification.notification_id)}
          className="p-2 hover:bg-muted rounded-full transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      
      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-primary ml-2 flex-shrink-0" />
      )}
    </div>
  );
};

// Main Notifications Page
export default function NotificationsPage() {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest(`/notifications/?unread_only=${filter === 'unread'}`);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await apiRequest('/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
      
      setNotifications(prev => prev.map(n => 
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      toast.error('Failed to mark notification as read');
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
      
      const notification = notifications.find(n => n.notification_id === notificationId);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      if (!notification?.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="notifications-page">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Bell className="w-6 h-6" />
              <h1 className="text-xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <Link to="/settings">
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex space-x-2">
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
              Unread ({unreadCount})
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-card rounded-b-lg">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellOff className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No notifications</h3>
              <p className="text-muted-foreground text-sm">
                {filter === 'unread' 
                  ? "You're all caught up! No unread notifications."
                  : "When you get notifications, they'll show up here."}
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.notification_id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
