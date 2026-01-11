import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { GitBranch, Users, RefreshCw, Move, User } from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminGenealogy() {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragMode, setDragMode] = useState(false);

  useEffect(() => {
    loadTrees();
  }, []);

  const loadTrees = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/genealogy/tree?max_depth=3`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTrees(data.trees || [data.tree].filter(Boolean));
    } catch (error) {
      toast.error("Failed to load genealogy tree");
    } finally {
      setLoading(false);
    }
  };

  const renderNode = (node, depth = 0) => {
    if (depth > 3) return null;
    return (
      <div key={node.user_id} className="ml-4 border-l border-slate-600 pl-4 py-1">
        <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg border border-slate-700">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-white text-sm">{node.name}</span>
          <span className="text-amber-400 text-xs ml-auto">{node.bl_coins || 0} BL</span>
        </div>
        {node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-400" />
            Genealogy Tree
          </h1>
          <p className="text-slate-400">Visual team hierarchy</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={dragMode ? "default" : "outline"}
            className={dragMode ? "bg-purple-600" : "border-slate-600"}
            onClick={() => setDragMode(!dragMode)}
          >
            <Move className="w-4 h-4 mr-2" />
            Edit Mode
          </Button>
          <Button onClick={loadTrees} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : trees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p>No genealogy data found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trees.map(tree => renderNode(tree))}
          </div>
        )}
      </div>
    </div>
  );
}
