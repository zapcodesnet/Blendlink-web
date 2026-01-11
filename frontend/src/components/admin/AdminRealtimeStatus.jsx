/**
 * AdminRealtimeStatus Component
 * Shows real-time connection status and live metrics in the admin panel
 */

import React from 'react';
import { Wifi, WifiOff, Activity, Users, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export function AdminRealtimeStatus({ isConnected, metrics, connectionError }) {
  return (
    <div className="flex items-center gap-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <div className="relative">
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="text-xs text-green-400 hidden sm:inline">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 hidden sm:inline">
              {connectionError ? 'Error' : 'Offline'}
            </span>
          </>
        )}
      </div>

      {/* Live Metrics (when connected) */}
      {isConnected && metrics && (
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1" title="Users Online">
            <Users className="w-3 h-3" />
            <span>{metrics.users_online || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="New Signups Today">
            <TrendingUp className="w-3 h-3" />
            <span>{metrics.new_signups?.today || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Posts This Hour">
            <Activity className="w-3 h-3" />
            <span>{metrics.content?.new_posts_hour || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function RealtimeMetricsPanel({ metrics, isConnected }) {
  if (!isConnected || !metrics) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 text-center">
        <WifiOff className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Real-time metrics unavailable</p>
        <p className="text-slate-500 text-xs mt-1">Connect to see live data</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-white">Live Metrics</h3>
        </div>
        <Badge className="bg-green-500/20 text-green-400 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Live
        </Badge>
      </div>
      
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Users Online */}
        <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{metrics.users_online || 0}</p>
          <p className="text-xs text-slate-400">Online Now</p>
        </div>

        {/* New Signups */}
        <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <TrendingUp className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{metrics.new_signups?.today || 0}</p>
          <p className="text-xs text-slate-400">Signups Today</p>
        </div>

        {/* Posts */}
        <div className="text-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <Activity className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{metrics.content?.new_posts_hour || 0}</p>
          <p className="text-xs text-slate-400">Posts/Hour</p>
        </div>

        {/* Transactions */}
        <div className="text-center p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{metrics.transactions?.count_hour || 0}</p>
          <p className="text-xs text-slate-400">Txns/Hour</p>
        </div>
      </div>

      {/* Last Update */}
      {metrics.timestamp && (
        <div className="px-4 pb-3 text-center">
          <p className="text-xs text-slate-500">
            Updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminRealtimeStatus;
