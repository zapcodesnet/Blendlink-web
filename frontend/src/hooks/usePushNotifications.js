/**
 * usePushNotifications Hook
 * Manages browser push notification subscriptions for admin users
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// VAPID public key for web push (you should generate your own)
// This is a placeholder - in production, generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check support on mount
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  // Check if already subscribed
  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      
      if (existingSub) {
        setSubscription(existingSub);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, []);

  // Request permission and subscribe
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    setLoading(true);

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Notification permission denied');
        setLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push manager
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      setSubscription(pushSubscription);

      // Send subscription to backend
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/admin/notifications/subscribe-web-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: pushSubscription.toJSON(),
          user_agent: navigator.userAgent,
          platform: 'web'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register subscription with server');
      }

      setIsSubscribed(true);
      toast.success('Push notifications enabled!');
      return true;

    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to enable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!subscription) return false;

    setLoading(true);

    try {
      // Unsubscribe from push manager
      await subscription.unsubscribe();

      // Notify backend
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/admin/notifications/unsubscribe-web-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });

      setSubscription(null);
      setIsSubscribed(false);
      toast.success('Push notifications disabled');
      return true;

    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('Failed to disable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    const token = localStorage.getItem('blendlink_token');
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/notifications/test-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Test notification sent!');
      } else {
        throw new Error('Failed to send test');
      }
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}

export default usePushNotifications;
