import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import { 
  GitBranch, Users, RefreshCw, Move, User, Search,
  ChevronRight, ChevronDown, Eye,
  UserPlus, X, ArrowRight, AlertTriangle, Check,
  Network, ZoomIn, ZoomOut
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// TreeNode component moved outside to prevent re-creation on every render
function TreeNode({ node, depth = 0, isExpanded = true, selectedUser, onSelectUser, onReassign }) {
  const [expanded, setExpanded] = useState(isExpanded && depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-4 border-l-2 border-slate-600 pl-4 py-1" data-testid={`tree-node-${node.user_id}`}>
      <div 
        className={`flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer group ${selectedUser === node.user_id ? 'border-blue-500 ring-1 ring-blue-500/50' : ''}`}
        onClick={() => onSelectUser(node.user_id)}
      >
        {hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-1 hover:bg-slate-700 rounded"
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}
        
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {node.avatar ? (
            <img src={node.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-slate-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate">{node.name || "Unknown"}</span>
            {node.rank === "diamond_leader" && (
              <Badge className="bg-blue-500/20 text-blue-400 text-xs">Diamond</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">@{node.username || node.email?.split('@')[0]}</p>
        </div>
        
        <div className="text-right flex-shrink-0">
          <p className="text-amber-400 text-sm font-medium">{(node.bl_coins || 0).toLocaleString()} BL</p>
          <p className="text-xs text-slate-500">{node.referral_count || 0} refs</p>
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-white"
            onClick={(e) => { e.stopPropagation(); onSelectUser(node.user_id); }}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-white"
            onClick={(e) => { 
              e.stopPropagation(); 
              onReassign(node.user_id);
            }}
          >
            <Move className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map(child => (
            <TreeNode 
              key={child.user_id} 
              node={child} 
              depth={depth + 1} 
              selectedUser={selectedUser}
              onSelectUser={onSelectUser}
              onReassign={onReassign}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminGenealogy() {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignData, setReassignData] = useState({ userId: "", newUplineId: "", reason: "" });
  const [maxDepth, setMaxDepth] = useState(3);
  const [orphans, setOrphans] = useState([]);
  const [showOrphans, setShowOrphans] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    loadTrees();
    loadOrphans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDepth]);

  const loadTrees = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getGenealogyTree(null, maxDepth);
      setTrees(data.trees || [data.tree].filter(Boolean));
    } catch (error) {
      toast.error("Failed to load genealogy tree: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrphans = async () => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/admin/genealogy/orphans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOrphans(data.orphans || []);
    } catch (error) {
      console.error("Failed to load orphans:", error);
    }
  };

  const loadUserNetwork = async (userId) => {
    try {
      const data = await adminAPI.getUserNetwork(userId);
      setNetworkData(data);
      setSelectedUser(userId);
    } catch (error) {
      toast.error("Failed to load user network: " + error.message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await adminAPI.searchUsers({ query: searchQuery, limit: 10 });
      setSearchResults(data.users || []);
    } catch (error) {
      toast.error("Search failed");
    }
  };

  const handleReassign = async () => {
    if (!reassignData.userId || !reassignData.newUplineId || !reassignData.reason) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await adminAPI.reassignDownline(reassignData.userId, reassignData.newUplineId, reassignData.reason);
      toast.success("User reassigned successfully");
      setShowReassignModal(false);
      setReassignData({ userId: "", newUplineId: "", reason: "" });
      loadTrees();
      if (selectedUser) loadUserNetwork(selectedUser);
    } catch (error) {
      toast.error("Reassignment failed: " + error.message);
    }
  };

  const TreeNode = ({ node, depth = 0, isExpanded = true }) => {
    const [expanded, setExpanded] = useState(isExpanded && depth < 2);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div className="ml-4 border-l-2 border-slate-600 pl-4 py-1" data-testid={`tree-node-${node.user_id}`}>
        <div 
          className={`flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer group ${selectedUser === node.user_id ? 'border-blue-500 ring-1 ring-blue-500/50' : ''}`}
          onClick={() => loadUserNetwork(node.user_id)}
        >
          {hasChildren && (
            <button 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-1 hover:bg-slate-700 rounded"
            >
              {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {node.avatar ? (
              <img src={node.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium truncate">{node.name || "Unknown"}</span>
              {node.rank === "diamond_leader" && (
                <Badge className="bg-blue-500/20 text-blue-400 text-xs">Diamond</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">@{node.username || node.email?.split('@')[0]}</p>
          </div>
          
          <div className="text-right flex-shrink-0">
            <p className="text-amber-400 text-sm font-medium">{(node.bl_coins || 0).toLocaleString()} BL</p>
            <p className="text-xs text-slate-500">{node.referral_count || 0} refs</p>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white"
              onClick={(e) => { e.stopPropagation(); loadUserNetwork(node.user_id); }}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white"
              onClick={(e) => { 
                e.stopPropagation(); 
                setReassignData({ ...reassignData, userId: node.user_id });
                setShowReassignModal(true);
              }}
            >
              <Move className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        {expanded && hasChildren && (
          <div className="mt-1">
            {node.children.map(child => (
              <TreeNode key={child.user_id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-400" />
            Genealogy Management
          </h1>
          <p className="text-slate-400">Visual team hierarchy with drag-and-drop reassignment</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showOrphans ? "default" : "outline"}
            className={showOrphans ? "" : "border-slate-600"}
            onClick={() => setShowOrphans(!showOrphans)}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Orphans ({orphans.length})
          </Button>
          <Button
            variant="outline"
            className="border-slate-600"
            onClick={() => setShowReassignModal(true)}
          >
            <Move className="w-4 h-4 mr-2" />
            Reassign User
          </Button>
          <Button onClick={loadTrees} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search users to view network..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); handleSearch(); }}
            className="pl-10 bg-slate-800 border-slate-700"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
              {searchResults.map(user => (
                <button
                  key={user.user_id}
                  onClick={() => { loadUserNetwork(user.user_id); setSearchQuery(""); setSearchResults([]); }}
                  className="w-full p-3 text-left hover:bg-slate-700 flex items-center gap-3"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-white text-sm">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Depth Control */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Depth:</span>
          <select
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {[1, 2, 3, 4, 5].map(d => (
              <option key={d} value={d}>{d} levels</option>
            ))}
          </select>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <Button variant="ghost" size="icon" onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="h-8 w-8">
            <ZoomOut className="w-4 h-4 text-slate-400" />
          </Button>
          <span className="text-xs text-slate-400 w-10 text-center">{zoomLevel}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoomLevel(z => Math.min(150, z + 10))} className="h-8 w-8">
            <ZoomIn className="w-4 h-4 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Orphans Panel */}
      {showOrphans && orphans.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-yellow-500/30 p-4">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Orphan Users (No Upline)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {orphans.map(orphan => (
              <div key={orphan.user_id} className="p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-white text-sm">{orphan.name}</p>
                    <p className="text-xs text-slate-500">{orphan.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setReassignData({ userId: orphan.user_id, newUplineId: "", reason: "Orphan assignment" });
                    setShowReassignModal(true);
                  }}
                >
                  Assign
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree View */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 p-4 min-h-[500px] overflow-auto">
          <div 
            style={{ 
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top left',
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : trees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Network className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">No genealogy data found</p>
                <p className="text-sm text-slate-500 mt-1">Users without referrers appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trees.map(tree => (
                  <TreeNode key={tree.user_id} node={tree} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Network Detail Panel */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          {networkData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Network Details</h3>
                <Button variant="ghost" size="icon" onClick={() => { setNetworkData(null); setSelectedUser(null); }}>
                  <X className="w-4 h-4 text-slate-400" />
                </Button>
              </div>

              {/* User Info */}
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                    {networkData.user?.avatar ? (
                      <img src={networkData.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{networkData.user?.name}</p>
                    <p className="text-sm text-slate-400">{networkData.user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">L1 Downline</p>
                  <p className="text-xl font-bold text-white">{networkData.stats?.l1_count || 0}</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <p className="text-xs text-purple-400">L2 Downline</p>
                  <p className="text-xl font-bold text-white">{networkData.stats?.l2_count || 0}</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-xs text-green-400">Total Network</p>
                  <p className="text-xl font-bold text-white">{networkData.stats?.total_network || 0}</p>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs text-amber-400">Upline Depth</p>
                  <p className="text-xl font-bold text-white">{networkData.stats?.upline_depth || 0}</p>
                </div>
              </div>

              {/* Upline Chain */}
              {networkData.upline?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Upline Chain</h4>
                  <div className="space-y-1">
                    {networkData.upline.map((up, i) => (
                      <div key={up.user_id} className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 w-6">L{i + 1}</span>
                        <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded flex-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-white truncate">{up.name}</span>
                          {up.rank === "diamond_leader" && (
                            <Badge className="bg-blue-500/20 text-blue-400 text-xs">Diamond</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* L1 Downline Preview */}
              {networkData.l1_downline?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Direct Referrals (L1)</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {networkData.l1_downline.slice(0, 10).map(down => (
                      <button
                        key={down.user_id}
                        onClick={() => loadUserNetwork(down.user_id)}
                        className="w-full flex items-center gap-2 p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors"
                      >
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="text-white text-sm truncate flex-1 text-left">{down.name}</span>
                        <span className="text-amber-400 text-xs">{down.bl_coins || 0} BL</span>
                      </button>
                    ))}
                    {networkData.l1_downline.length > 10 && (
                      <p className="text-xs text-slate-500 text-center py-2">
                        +{networkData.l1_downline.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <Button
                className="w-full"
                onClick={() => {
                  setReassignData({ userId: selectedUser, newUplineId: "", reason: "" });
                  setShowReassignModal(true);
                }}
              >
                <Move className="w-4 h-4 mr-2" />
                Reassign This User
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Eye className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-center">Select a user from the tree to view their network details</p>
            </div>
          )}
        </div>
      </div>

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Move className="w-5 h-5 text-blue-400" />
                Reassign User
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowReassignModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  This will change the user's referral relationship and may affect commission calculations.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">User to Move</label>
                <Input
                  value={reassignData.userId}
                  onChange={(e) => setReassignData({ ...reassignData, userId: e.target.value })}
                  placeholder="Enter user ID"
                  className="bg-slate-700 border-slate-600"
                />
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">New Upline User ID</label>
                <Input
                  value={reassignData.newUplineId}
                  onChange={(e) => setReassignData({ ...reassignData, newUplineId: e.target.value })}
                  placeholder="Enter new upline user ID"
                  className="bg-slate-700 border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Reason (for audit log)</label>
                <Input
                  value={reassignData.reason}
                  onChange={(e) => setReassignData({ ...reassignData, reason: e.target.value })}
                  placeholder="Enter reason for reassignment"
                  className="bg-slate-700 border-slate-600"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleReassign} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Reassign
                </Button>
                <Button variant="outline" onClick={() => setShowReassignModal(false)} className="border-slate-600">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
