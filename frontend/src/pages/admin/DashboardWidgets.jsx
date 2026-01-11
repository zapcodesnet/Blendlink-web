import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  Users, ShoppingBag, Coins, TrendingUp, BarChart3, Calendar,
  Activity, Shield, Eye, Settings, GripVertical, X, Plus, Check
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Available widget types
const WIDGET_TYPES = {
  total_users: { label: 'Total Users', icon: Users, color: 'blue', size: 'small' },
  new_users_7d: { label: 'New Users (7d)', icon: TrendingUp, color: 'green', size: 'small' },
  new_users_30d: { label: 'New Users (30d)', icon: TrendingUp, color: 'cyan', size: 'small' },
  suspended_users: { label: 'Suspended Users', icon: Users, color: 'yellow', size: 'small' },
  banned_users: { label: 'Banned Users', icon: Shield, color: 'red', size: 'small' },
  total_posts: { label: 'Total Posts', icon: Activity, color: 'purple', size: 'small' },
  total_listings: { label: 'Marketplace Listings', icon: ShoppingBag, color: 'pink', size: 'small' },
  total_bl_coins: { label: 'BL Coins Circulation', icon: Coins, color: 'amber', size: 'small' },
  total_admins: { label: 'Admins', icon: Shield, color: 'indigo', size: 'small' },
  total_albums: { label: 'Albums', icon: Eye, color: 'teal', size: 'small' },
  recent_users: { label: 'Recent Users', icon: Users, color: 'blue', size: 'large' },
  quick_stats: { label: 'Quick Stats', icon: BarChart3, color: 'green', size: 'large' },
};

const DEFAULT_WIDGETS = ['total_users', 'new_users_7d', 'total_bl_coins', 'total_admins', 'recent_users'];

export default function DashboardWidgets({ stats, onRefresh }) {
  const [widgets, setWidgets] = useState([]);
  const [editing, setEditing] = useState(false);
  const [availableWidgets, setAvailableWidgets] = useState([]);

  useEffect(() => {
    // Load saved widgets from localStorage
    const saved = localStorage.getItem('admin_dashboard_widgets');
    if (saved) {
      setWidgets(JSON.parse(saved));
    } else {
      setWidgets(DEFAULT_WIDGETS);
    }
  }, []);

  useEffect(() => {
    const used = new Set(widgets);
    setAvailableWidgets(Object.keys(WIDGET_TYPES).filter(k => !used.has(k)));
  }, [widgets]);

  const saveWidgets = (newWidgets) => {
    setWidgets(newWidgets);
    localStorage.setItem('admin_dashboard_widgets', JSON.stringify(newWidgets));
  };

  const addWidget = (type) => {
    saveWidgets([...widgets, type]);
  };

  const removeWidget = (index) => {
    const newWidgets = widgets.filter((_, i) => i !== index);
    saveWidgets(newWidgets);
  };

  const moveWidget = (from, to) => {
    const newWidgets = [...widgets];
    const [item] = newWidgets.splice(from, 1);
    newWidgets.splice(to, 0, item);
    saveWidgets(newWidgets);
  };

  const getWidgetValue = (type) => {
    if (!stats) return 0;
    switch (type) {
      case 'total_users': return stats.users?.total || 0;
      case 'new_users_7d': return stats.users?.new_7d || 0;
      case 'new_users_30d': return stats.users?.new_30d || 0;
      case 'suspended_users': return stats.users?.suspended || 0;
      case 'banned_users': return stats.users?.banned || 0;
      case 'total_posts': return stats.content?.posts || 0;
      case 'total_listings': return stats.content?.listings || 0;
      case 'total_bl_coins': return stats.financial?.total_bl_coins || 0;
      case 'total_admins': return stats.admins?.total || 0;
      case 'total_albums': return stats.content?.albums || 0;
      default: return 0;
    }
  };

  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };

  return (
    <div className="space-y-4">
      {/* Header with edit toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Dashboard</h2>
        <div className="flex gap-2">
          <Button
            variant={editing ? "default" : "ghost"}
            size="sm"
            onClick={() => setEditing(!editing)}
            className={editing ? "bg-blue-600" : "text-slate-400"}
          >
            <Settings className="w-4 h-4 mr-1" />
            {editing ? 'Done' : 'Customize'}
          </Button>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {widgets.map((type, index) => {
          const widget = WIDGET_TYPES[type];
          if (!widget) return null;
          
          // Skip large widgets in the small grid
          if (widget.size === 'large') return null;
          
          const Icon = widget.icon;
          const value = getWidgetValue(type);
          
          return (
            <div
              key={`${type}-${index}`}
              className={`relative rounded-xl border p-4 ${colorClasses[widget.color]} ${editing ? 'cursor-move' : ''}`}
              draggable={editing}
              onDragStart={(e) => e.dataTransfer.setData('index', index.toString())}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const from = parseInt(e.dataTransfer.getData('index'));
                moveWidget(from, index);
              }}
            >
              {editing && (
                <button
                  onClick={() => removeWidget(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {editing && (
                <GripVertical className="absolute top-2 left-2 w-4 h-4 opacity-50" />
              )}
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
              <p className="text-sm opacity-80">{widget.label}</p>
            </div>
          );
        })}

        {/* Add widget button (when editing) */}
        {editing && availableWidgets.length > 0 && (
          <div className="relative">
            <button
              onClick={() => {
                const dropdown = document.getElementById('widget-dropdown');
                dropdown.classList.toggle('hidden');
              }}
              className="w-full h-full min-h-[100px] rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              <Plus className="w-6 h-6 mb-1" />
              <span className="text-sm">Add Widget</span>
            </button>
            <div id="widget-dropdown" className="hidden absolute top-full left-0 mt-2 w-48 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-10 max-h-64 overflow-y-auto">
              {availableWidgets.filter(w => WIDGET_TYPES[w].size !== 'large').map((type) => {
                const widget = WIDGET_TYPES[type];
                const Icon = widget.icon;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      addWidget(type);
                      document.getElementById('widget-dropdown').classList.add('hidden');
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Icon className={`w-4 h-4 text-${widget.color}-400`} />
                    {widget.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Large Widgets */}
      {widgets.filter(type => WIDGET_TYPES[type]?.size === 'large').map((type, index) => {
        if (type === 'recent_users') {
          return (
            <div key={type} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative">
              {editing && (
                <button
                  onClick={() => removeWidget(widgets.indexOf(type))}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Recent Users</h3>
              </div>
              <div className="divide-y divide-slate-700">
                {stats?.recent_users?.slice(0, 5).map((user) => (
                  <div key={user.user_id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-sm text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        
        if (type === 'quick_stats') {
          return (
            <div key={type} className="bg-slate-800 rounded-xl border border-slate-700 p-6 relative">
              {editing && (
                <button
                  onClick={() => removeWidget(widgets.indexOf(type))}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <h3 className="font-semibold text-white mb-4">Quick Stats</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">{stats?.users?.total || 0}</p>
                  <p className="text-sm text-slate-400">Users</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-400">{stats?.content?.posts || 0}</p>
                  <p className="text-sm text-slate-400">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-400">{stats?.content?.listings || 0}</p>
                  <p className="text-sm text-slate-400">Listings</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-400">{(stats?.financial?.total_bl_coins || 0).toLocaleString()}</p>
                  <p className="text-sm text-slate-400">BL Coins</p>
                </div>
              </div>
            </div>
          );
        }
        
        return null;
      })}

      {/* Add Large Widget (when editing) */}
      {editing && availableWidgets.some(w => WIDGET_TYPES[w]?.size === 'large') && (
        <button
          onClick={() => {
            const largeWidget = availableWidgets.find(w => WIDGET_TYPES[w]?.size === 'large');
            if (largeWidget) addWidget(largeWidget);
          }}
          className="w-full py-8 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-sm">Add Large Widget</span>
        </button>
      )}
    </div>
  );
}
