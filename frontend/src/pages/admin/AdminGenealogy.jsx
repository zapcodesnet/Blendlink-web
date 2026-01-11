import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  GitBranch, Search, ZoomIn, ZoomOut, Maximize2,
  User, ChevronDown, ChevronRight, Users, RefreshCw,
  Move, ArrowRight, Save, X
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const adminApiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Request failed');
  return data;
};

export default function AdminGenealogy() {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGenealogy, setUserGenealogy] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [dragMode, setDragMode] = useState(false);
  const [dragSource, setDragSource] = useState(null);
  const [reassignModal, setReassignModal] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    loadTrees();
  }, []);

  const loadTrees = async () => {
    setLoading(true);
    try {
      const data = await adminApiRequest('/genealogy/tree?max_depth=5');
      setTrees(data.trees || [data.tree].filter(Boolean));
    } catch (error) {
      toast.error("Failed to load genealogy tree");
    } finally {
      setLoading(false);
    }
  };

  const loadUserGenealogy = async (userId) => {
    try {
      const data = await adminApiRequest(`/genealogy/user/${userId}`);
      setUserGenealogy(data);
      setSelectedUser(userId);
    } catch (error) {
      toast.error("Failed to load user genealogy");
    }
  };

  const handleReassign = async () => {
    if (!reassignModal) return;
    try {
      await adminApiRequest('/genealogy/reassign', {
        method: 'POST',
        body: JSON.stringify({
          user_id: reassignModal.userId,
          new_upline_id: reassignModal.newUplineId
        })
      });
      toast.success("Upline reassigned successfully!");
      setReassignModal(null);
      loadTrees();
      if (selectedUser) loadUserGenealogy(selectedUser);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDrop = (targetUserId) => {
    if (!dragSource || dragSource === targetUserId) {
      setDragSource(null);
      return;
    }
    setReassignModal({
      userId: dragSource,
      newUplineId: targetUserId
    });
    setDragSource(null);
  };

  // Recursive tree node component
  const TreeNode = ({ node, depth = 0, isLast = true }) => {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div className="relative">
        {/* Connection line */}
        {depth > 0 && (
          <div className="absolute -left-6 top-0 w-6 h-6 border-l-2 border-b-2 border-slate-600 rounded-bl-lg" />
        )}
        
        {/* Node */}
        <div
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
            selectedUser === node.user_id ? 'bg-blue-600/20 border border-blue-500' : 
            dragSource === node.user_id ? 'bg-purple-600/20 border border-purple-500' :
            'bg-slate-800 border border-slate-700 hover:border-slate-500'
          }`}
          onClick={() => loadUserGenealogy(node.user_id)}
          draggable={dragMode}
          onDragStart={() => setDragSource(node.user_id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(node.user_id)}
        >
          {hasChildren && (
            <button 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-slate-400 hover:text-white"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
            {node.avatar ? (
              <img src={node.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white text-sm truncate">{node.name}</p>
            <p className="text-xs text-slate-400 truncate">{node.email}</p>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-amber-400 font-medium">{node.bl_coins?.toLocaleString() || 0} BL</p>
            {hasChildren && (
              <p className="text-xs text-slate-500">{node.children_count} direct</p>
            )}
          </div>
          
          {!node.is_active && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">Inactive</span>
          )}
        </div>

        {/* Children */}
        {expanded && hasChildren && (
          <div className="ml-8 mt-2 space-y-2 relative">
            {/* Vertical line */}
            <div className="absolute left-[-14px] top-0 bottom-4 w-0.5 bg-slate-700" />
            
            {node.children.map((child, i) => (
              <TreeNode 
                key={child.user_id} 
                node={child} 
                depth={depth + 1}
                isLast={i === node.children.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-400" />
            Genealogy Tree
          </h1>
          <p className="text-slate-400">
            Visual hierarchy • Drag to reassign uplines (Admin only)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={dragMode ? "default" : "outline"}
            className={dragMode ? "bg-purple-600" : "border-slate-600"}
            onClick={() => setDragMode(!dragMode)}
          >
            <Move className="w-4 h-4 mr-2" />
            {dragMode ? 'Editing' : 'Edit Mode'}
          </Button>
          <Button onClick={loadTrees} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Drag Mode Info */}
      {dragMode && (
        <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-3 flex items-center gap-3 flex-shrink-0">
          <Move className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-purple-300 font-medium">Edit Mode Active</p>
            <p className="text-purple-400 text-sm">Drag a user node and drop onto another user to reassign their upline</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users in tree..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Tree View */}
        <div 
          ref={containerRef}
          className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 p-4 overflow-auto"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : trees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <GitBranch className="w-12 h-12 mb-4 opacity-50" />
              <p>No genealogy data found</p>
              <p className="text-sm">Users will appear here when they have referrals</p>
            </div>
          ) : (
            <div className="space-y-6">
              {trees.map((tree) => (
                <div key={tree.user_id} className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Users className="w-4 h-4" />
                    Root: {tree.name}
                  </div>
                  <TreeNode node={tree} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Detail Panel */}
        {userGenealogy && (
          <div className="w-80 bg-slate-800 rounded-xl border border-slate-700 p-4 flex-shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">User Details</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setSelectedUser(null); setUserGenealogy(null); }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                {userGenealogy.user?.avatar ? (
                  <img src={userGenealogy.user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-white">{userGenealogy.user?.name}</p>
                <p className="text-sm text-slate-400">{userGenealogy.user?.email}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Level 1</p>
                <p className="text-xl font-bold text-blue-400">{userGenealogy.stats?.level1_count || 0}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Level 2</p>
                <p className="text-xl font-bold text-green-400">{userGenealogy.stats?.level2_count || 0}</p>
              </div>
              <div className="col-span-2 bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Total Downline</p>
                <p className="text-xl font-bold text-purple-400">{userGenealogy.stats?.total_downline || 0}</p>
              </div>
            </div>

            {/* Upline */}
            {userGenealogy.upline && (
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-2">Upline (Sponsor)</p>
                <div 
                  className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-700"
                  onClick={() => loadUserGenealogy(userGenealogy.upline.user_id)}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm">{userGenealogy.upline.name}</p>
                    <p className="text-xs text-slate-400">{userGenealogy.upline.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Level 1 Downlines */}
            {userGenealogy.level1_downlines?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-2">Level 1 Downlines ({userGenealogy.level1_downlines.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {userGenealogy.level1_downlines.map((user) => (
                    <div 
                      key={user.user_id}
                      className="bg-slate-700/50 rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-slate-700"
                      onClick={() => loadUserGenealogy(user.user_id)}
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center">
                        <User className="w-3 h-3 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{user.name}</p>
                      </div>
                      <span className="text-xs text-amber-400">{user.bl_coins?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Level 2 Downlines */}
            {userGenealogy.level2_downlines?.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Level 2 Downlines ({userGenealogy.level2_downlines.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {userGenealogy.level2_downlines.map((user) => (
                    <div 
                      key={user.user_id}
                      className="bg-slate-700/50 rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-slate-700"
                      onClick={() => loadUserGenealogy(user.user_id)}
                    >
                      <div className="w-6 h-6 rounded-full bg-green-600/30 flex items-center justify-center">
                        <User className="w-3 h-3 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{user.name}</p>
                      </div>
                      <span className="text-xs text-amber-400">{user.bl_coins?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="fixed bottom-24 right-8 flex flex-col gap-2 bg-slate-800 rounded-lg border border-slate-700 p-2">
        <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="text-slate-400 hover:text-white">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <span className="text-xs text-slate-400 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="text-slate-400 hover:text-white">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setZoom(1)} className="text-slate-400 hover:text-white">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-purple-400" />
              Confirm Upline Reassignment
            </h3>
            <p className="text-slate-300 mb-4">
              Are you sure you want to move this user to a new upline? This will affect their commission structure.
            </p>
            <div className="bg-slate-700/50 rounded-lg p-4 mb-4 flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-400">User</p>
                <p className="text-white font-medium truncate">{reassignModal.userId}</p>
              </div>
              <ArrowRight className="text-purple-400" />
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-400">New Upline</p>
                <p className="text-white font-medium truncate">{reassignModal.newUplineId}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setReassignModal(null)}>
                Cancel
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleReassign}>
                <Save className="w-4 h-4 mr-2" />
                Confirm Reassignment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
