import { useState } from 'react';
import { usePlanStore } from '../store/planStore';
import { Plus, Copy, Trash2, Edit2, Check, X } from 'lucide-react';

export function PlanSelector() {
  const { plans, activePlanId, setActivePlan, createPlan, deletePlan, duplicatePlan, renamePlan } = usePlanStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanStartSemester, setNewPlanStartSemester] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = () => {
    if (newPlanName.trim()) {
      createPlan(newPlanName.trim(), 2025, newPlanStartSemester);
      setNewPlanName('');
      setNewPlanStartSemester(1);
      setIsCreating(false);
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      renamePlan(editingId, editName.trim());
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Study Plans</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-anu-gold text-white rounded-lg hover:bg-anu-gold-dark transition-colors text-sm"
        >
          <Plus size={16} />
          New Plan
        </button>
      </div>

      {isCreating && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <input
            type="text"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Plan name..."
            className="flex-1 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
            autoFocus
          />
          <select
            value={newPlanStartSemester}
            onChange={(e) => setNewPlanStartSemester(Number(e.target.value) as 1 | 2)}
            className="px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold bg-white"
            title="Start semester"
          >
            <option value={1}>Start S1</option>
            <option value={2}>Start S2</option>
          </select>
          <button
            onClick={handleCreate}
            className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            <Check size={18} />
          </button>
          <button
            onClick={() => { setIsCreating(false); setNewPlanName(''); setNewPlanStartSemester(1); }}
            className="p-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all cursor-pointer ${
              plan.id === activePlanId
                ? 'bg-anu-blue text-white border-anu-blue'
                : 'bg-white text-gray-700 border-gray-200 hover:border-anu-gold'
            }`}
            onClick={() => setActivePlan(plan.id)}
          >
            {editingId === plan.id ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="px-2 py-0.5 text-gray-800 border rounded focus:outline-none focus:ring-2 focus:ring-anu-gold"
                  autoFocus
                />
                <button onClick={handleSaveEdit} className="p-1 hover:bg-white/20 rounded">
                  <Check size={14} />
                </button>
                <button onClick={handleCancelEdit} className="p-1 hover:bg-white/20 rounded">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium">{plan.name}</span>
                <span className={`text-xs ${plan.id === activePlanId ? 'text-white/70' : 'text-gray-400'}`}>
                  ({plan.courses.length} courses)
                </span>

                <div className={`hidden group-hover:flex items-center gap-1 ml-2 ${
                  plan.id === activePlanId ? '' : ''
                }`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(plan.id, plan.name); }}
                    className="p-1 hover:bg-white/20 rounded"
                    title="Rename"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicatePlan(plan.id); }}
                    className="p-1 hover:bg-white/20 rounded"
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  {plans.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
                      className="p-1 hover:bg-red-500/50 rounded text-red-300"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
