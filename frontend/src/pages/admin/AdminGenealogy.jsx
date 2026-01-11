import React, { useState, useEffect } from "react";
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

// Tree Node Component
function TreeNode({ node, depth, onSelect, selectedUser, dragMode, setDragSource, dragSource, handleDrop }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  const nodeClass = selectedUser === node.user_id 
    ? 'bg-blue-600/20 border border-blue-500' 
    : dragSource === node.user_id 
      ? 'bg-purple-600/20 border border-purple-500'
      : 'bg-slate-800 border border-slate-700 hover:border-slate-500';

  return (
    <div className="relative">
      {depth > 0 && (
        <div className="absolute -left-6 top-0 w-6 h-6 border-l-2 border-b-2 border-slate-600 rounded-bl-lg" />
      )}
      
      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${nodeClass}`}
        onClick={() => onSelect(node.user_id)}
        draggable={dragMode}
        onDragStart={() => setDragSource(node.user_id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(node.user_id)}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-slate-400 hover:text-white"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : <div className="w-4" />}
        
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
          <User className="w-4 h-4 text-slate-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm truncate">{node.name}</p>
          <p className="text-xs text-slate-400 truncate">{node.email}</p>
        </div>
        
        <div className="text-right">
          <p className="text-xs text-amber-400 font-medium">{node.bl_coins?.toLocaleString() || 0} BL</p>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="ml-8 mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeNode 
              key={child.user_id} 
              node={child} 
              depth={depth + 1}
              onSelect={onSelect}
              selectedUser={selectedUser}
              dragMode={dragMode}
              setDragSource={setDragSource}
              dragSource={dragSource}
              handleDrop={handleDrop}
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
  const [userGenealogy, setUserGenealogy] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [dragMode, setDragMode] = useState(false);
  const [dragSource, setDragSource] = useState(null);
  const [reassignModal, setReassignModal] = useState(null);

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

  const handleDrop = (targetUserId) => {
    if (!dragSource || dragSource === targetUserId) {
      setDragSource(null);
      return;
    }
    setReassignModal({ userId: dragSource, newUplineId: targetUserId });
    setDragSource(null);
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
      toast.success("Upline reassigned!");
      setReassignModal(null);
      loadTrees();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-400" />
            Genealogy Tree
          </h1>
          <p className="text-slate-400">Visual hierarchy - Drag to reassign uplines</p>
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

      {dragMode && (
        <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-3 flex items-center gap-3">
          <Move className="w-5 h-5 text-purple-400" />
          <p className="text-purple-300 text-sm">Drag a user and drop onto another to reassign upline</p>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 p-4 min-h-[400px] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : trees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <GitBranch className="w-12 h-12 mb-4 opacity-50" />
              <p>No genealogy data found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {trees.map((tree) => (
                <TreeNode 
                  key={tree.user_id} 
                  node={tree} 
                  depth={0}
                  onSelect={loadUserGenealogy}
                  selectedUser={selectedUser}
                  dragMode={dragMode}
                  setDragSource={setDragSource}
                  dragSource={dragSource}
                  handleDrop={handleDrop}
                />
              ))}
            </div>
          )}
        </div>

        {userGenealogy && (
          <div className="w-80 bg-slate-800 rounded-xl border border-slate-700 p-4">
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

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                <User className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-white">{userGenealogy.user?.name}</p>
                <p className="text-sm text-slate-400">{userGenealogy.user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Level 1</p>
                <p className="text-xl font-bold text-blue-400">{userGenealogy.stats?.level1_count || 0}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Level 2</p>
                <p className="text-xl font-bold text-green-400">{userGenealogy.stats?.level2_count || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {reassignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Confirm Reassignment</h3>
            <p className="text-slate-300 mb-4">Move user to new upline?</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setReassignModal(null)}>Cancel</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleReassign}>
                <Save className="w-4 h-4 mr-2" /> Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
