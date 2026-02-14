import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  FlaskConical, Play, Pause, Check, Trash2, Plus,
  ChevronDown, ChevronUp, Eye, Target, TrendingUp,
  RefreshCw, Download, Filter, BarChart3
} from "lucide-react";

const API_BASE = getApiUrl();

const TEST_TYPES = [
  { id: 'ui_element', label: 'UI Element', icon: '🎨', desc: 'Button colors, layouts, CTAs' },
  { id: 'feature', label: 'Feature', icon: '⚡', desc: 'Different features/flows' },
  { id: 'content', label: 'Content', icon: '📝', desc: 'Copy, images, messaging' },
  { id: 'onboarding', label: 'Onboarding', icon: '🚀', desc: 'User onboarding flows' },
  { id: 'pricing', label: 'Pricing', icon: '💰', desc: 'Pricing experiments' },
];

export default function AdminABTesting() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadTests = useCallback(async () => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const url = filter === 'all' 
        ? `${API_BASE}/api/ab-testing/tests`
        : `${API_BASE}/api/ab-testing/tests?status=${filter}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTests(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to load A/B tests");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const updateStatus = async (testId, status) => {
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/ab-testing/tests/${testId}/status?status=${status}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(`Test ${status === 'active' ? 'activated' : status}`);
      loadTests();
    } catch (error) {
      toast.error("Failed to update test");
    }
  };

  const deleteTest = async (testId) => {
    if (!confirm("Delete this test? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem('blendlink_token');
      await fetch(`${API_BASE}/api/ab-testing/tests/${testId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success("Test deleted");
      loadTests();
    } catch (error) {
      toast.error("Failed to delete test");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'paused': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" />
            A/B Testing
          </h1>
          <p className="text-slate-400">Create and manage experiments with configurable splits</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadTests} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" /> New Test
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'active', 'draft', 'paused', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
              filter === f 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 text-center">
          <FlaskConical className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No A/B Tests</h3>
          <p className="text-slate-400 mb-4">Create your first experiment to optimize conversions</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600">
            Create Test
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <TestCard 
              key={test.test_id} 
              test={test}
              onStatusChange={updateStatus}
              onDelete={deleteTest}
              onSelect={() => setSelectedTest(test)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTestModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadTests();
          }}
        />
      )}
    </div>
  );
}

function TestCard({ test, onStatusChange, onDelete, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  
  const totalImpressions = test.variants?.reduce((sum, v) => sum + (v.impressions || 0), 0) || 0;
  const totalConversions = test.variants?.reduce((sum, v) => sum + (v.conversions || 0), 0) || 0;
  const overallRate = totalImpressions > 0 ? (totalConversions / totalImpressions * 100).toFixed(1) : 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'paused': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white">{test.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${getStatusColor(test.status)}`}>
                {test.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>{TEST_TYPES.find(t => t.id === test.test_type)?.icon} {test.test_type?.replace('_', ' ')}</span>
              <span>•</span>
              <span><Eye className="w-3 h-3 inline mr-1" />{totalImpressions.toLocaleString()} impressions</span>
              <span>•</span>
              <span><Target className="w-3 h-3 inline mr-1" />{totalConversions.toLocaleString()} conversions</span>
              <span>•</span>
              <span className="text-green-400"><TrendingUp className="w-3 h-3 inline mr-1" />{overallRate}% rate</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {test.status === 'draft' && (
              <Button size="sm" onClick={() => onStatusChange(test.test_id, 'active')} className="bg-green-600 hover:bg-green-700">
                <Play className="w-3 h-3 mr-1" /> Activate
              </Button>
            )}
            {test.status === 'active' && (
              <>
                <Button size="sm" variant="outline" onClick={() => onStatusChange(test.test_id, 'paused')} className="border-yellow-500/50 text-yellow-400">
                  <Pause className="w-3 h-3 mr-1" /> Pause
                </Button>
                <Button size="sm" variant="outline" onClick={() => onStatusChange(test.test_id, 'completed')} className="border-blue-500/50 text-blue-400">
                  <Check className="w-3 h-3 mr-1" /> Complete
                </Button>
              </>
            )}
            {test.status === 'paused' && (
              <Button size="sm" onClick={() => onStatusChange(test.test_id, 'active')} className="bg-green-600 hover:bg-green-700">
                <Play className="w-3 h-3 mr-1" /> Resume
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onDelete(test.test_id)} className="text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {test.description && (
            <p className="text-slate-400 text-sm">{test.description}</p>
          )}

          {/* Variants */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Variants Performance</h4>
            <div className="space-y-3">
              {test.variants?.map((variant, index) => {
                const rate = variant.impressions > 0 
                  ? (variant.conversions / variant.impressions * 100).toFixed(1) 
                  : 0;
                const isWinning = test.variants.every(v => 
                  v.variant_id === variant.variant_id || 
                  (variant.impressions > 0 && v.impressions > 0 && 
                   (variant.conversions / variant.impressions) >= (v.conversions / v.impressions))
                );
                
                return (
                  <div key={variant.variant_id || index} className="bg-slate-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">{variant.name}</span>
                        <span className="text-slate-500 text-sm">{variant.percentage}% traffic</span>
                        {isWinning && test.status !== 'draft' && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
                            Leading
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">{variant.impressions || 0} views</span>
                        <span className="text-slate-400">{variant.conversions || 0} conv</span>
                        <span className={`font-medium ${parseFloat(rate) > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                          {rate}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                        style={{ width: `${Math.min(parseFloat(rate) * 5, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div className="flex gap-8 text-sm text-slate-400">
            <div>
              <span className="text-slate-500">Created:</span>{' '}
              {new Date(test.created_at).toLocaleDateString()}
            </div>
            {test.start_date && (
              <div>
                <span className="text-slate-500">Started:</span>{' '}
                {new Date(test.start_date).toLocaleDateString()}
              </div>
            )}
            {test.end_date && (
              <div>
                <span className="text-slate-500">Ended:</span>{' '}
                {new Date(test.end_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTestModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [testType, setTestType] = useState('ui_element');
  const [variants, setVariants] = useState([
    { name: 'Control', percentage: 50 },
    { name: 'Variant A', percentage: 50 },
  ]);
  const [creating, setCreating] = useState(false);

  const addVariant = () => {
    if (variants.length >= 4) return;
    const equalSplit = Math.floor(100 / (variants.length + 1));
    const newVariants = variants.map(v => ({ ...v, percentage: equalSplit }));
    newVariants.push({ name: `Variant ${String.fromCharCode(65 + variants.length - 1)}`, percentage: equalSplit });
    // Adjust last one to make total 100
    const total = newVariants.reduce((sum, v) => sum + v.percentage, 0);
    if (total !== 100) {
      newVariants[newVariants.length - 1].percentage += (100 - total);
    }
    setVariants(newVariants);
  };

  const removeVariant = (index) => {
    if (variants.length <= 2) return;
    const newVariants = variants.filter((_, i) => i !== index);
    // Redistribute percentages
    const equalSplit = Math.floor(100 / newVariants.length);
    newVariants.forEach((v, i) => {
      v.percentage = i === newVariants.length - 1 ? 100 - (equalSplit * (newVariants.length - 1)) : equalSplit;
    });
    setVariants(newVariants);
  };

  const updateVariant = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = field === 'percentage' ? parseInt(value) || 0 : value;
    setVariants(newVariants);
  };

  const totalPercentage = variants.reduce((sum, v) => sum + v.percentage, 0);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a test name");
      return;
    }
    if (Math.abs(totalPercentage - 100) > 0.5) {
      toast.error("Variant percentages must sum to 100%");
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE}/api/ab-testing/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          test_type: testType,
          variants: variants.map(v => ({
            name: v.name,
            percentage: v.percentage,
            config: {},
          })),
        })
      });
      
      if (!response.ok) throw new Error('Failed to create test');
      
      toast.success("A/B test created successfully");
      onCreated();
    } catch (error) {
      toast.error("Failed to create test");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Create A/B Test</h2>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Test Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Button Color Experiment"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you testing?"
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Test Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Test Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TEST_TYPES.slice(0, 3).map((type) => (
                <button
                  key={type.id}
                  onClick={() => setTestType(type.id)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    testType === type.id 
                      ? 'border-purple-500 bg-purple-500/10 text-white' 
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span className="text-xl">{type.icon}</span>
                  <p className="text-xs mt-1">{type.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Variants</label>
              <span className={`text-sm ${Math.abs(totalPercentage - 100) < 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPercentage}% total
              </span>
            </div>
            <div className="space-y-2">
              {variants.map((variant, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e) => updateVariant(index, 'name', e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={variant.percentage}
                      onChange={(e) => updateVariant(index, 'percentage', e.target.value)}
                      min={1}
                      max={99}
                      className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-slate-400 ml-1">%</span>
                  </div>
                  {variants.length > 2 && (
                    <button 
                      onClick={() => removeVariant(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {variants.length < 4 && (
              <button
                onClick={addVariant}
                className="mt-2 w-full py-2 border border-dashed border-slate-600 rounded-lg text-purple-400 hover:border-purple-500 transition-colors text-sm"
              >
                + Add Variant
              </button>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={creating}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {creating ? 'Creating...' : 'Create Test'}
          </Button>
        </div>
      </div>
    </div>
  );
}
