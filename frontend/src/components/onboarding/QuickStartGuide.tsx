import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle, Circle, Settings, Users, Package,
  ShoppingCart, ArrowRight, Trophy, Zap, Clock,
} from 'lucide-react';
import { fetchApi } from '../../services/api';

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  route?: string;
}

interface QuickStartGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickStartGuide: React.FC<QuickStartGuideProps> = ({ isOpen, onClose }) => {
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    step1: false, step2: false, step3: false,
    step4: false, step5: false, step6: false,
  });
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentStore = async () => {
    try {
      const response = await fetchApi('/stores/current') as any;
      if (response?.id) { setCurrentStoreId(response.id); return response.id; }
    } catch (e) { /* silent */ }
    return null;
  };

  const loadProgress = async (storeId: string) => {
    try {
      setIsLoading(true);
      const response = await fetchApi(`/quickstart/progress/${storeId}`) as any;
      if (response?.success && response?.data?.progress) {
        setCompletedSteps(response.data.progress);
        localStorage.setItem(`quickstart-completed-${storeId}`, JSON.stringify(response.data.progress));
      } else {
        const saved = localStorage.getItem(`quickstart-completed-${storeId}`);
        if (saved) setCompletedSteps(JSON.parse(saved));
      }
    } catch {
      const saved = localStorage.getItem(`quickstart-completed-${storeId}`);
      if (saved) setCompletedSteps(JSON.parse(saved));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStep = async (stepId: string) => {
    const storeId = currentStoreId ?? await getCurrentStore();
    if (!storeId) return;
    const next = !completedSteps[stepId];
    try {
      setIsLoading(true);
      const res = await fetchApi(`/quickstart/step/${storeId}/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: next }),
      }) as any;
      if (res?.success) {
        const updated = { ...completedSteps, [stepId]: next };
        setCompletedSteps(updated);
        localStorage.setItem(`quickstart-completed-${storeId}`, JSON.stringify(updated));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getCurrentStore().then(id => { if (id) loadProgress(id); });
  }, []);

  useEffect(() => {
    if (currentStoreId) loadProgress(currentStoreId);
  }, [currentStoreId]);

  const steps: QuickStartStep[] = [
    { id: 'step1', title: 'Store Settings & Tax',   description: 'Configure store details and tax settings', icon: Settings,     route: '/settings' },
    { id: 'step2', title: 'Add Team Members',         description: 'Invite users and assign roles',           icon: Users,        route: '/team' },
    { id: 'step3', title: 'Add Suppliers',            description: 'Set up your vendor network',              icon: Package,      route: '/suppliers' },
    { id: 'step4', title: 'Add Products',             description: 'Build your inventory catalog',            icon: Package,      route: '/products' },
    { id: 'step5', title: 'Create GRN',               description: 'Receive your first inventory',            icon: Package,      route: '/goods-receiving' },
    { id: 'step6', title: 'Make First Sale',          description: 'Process your first transaction',          icon: ShoppingCart, route: '/pos' },
  ];

  const completedCount = steps.filter(s => completedSteps[s.id]).length;
  const total          = steps.length;
  const pct            = Math.round((completedCount / total) * 100);
  const allDone        = completedCount === total;
  const remaining      = total - completedCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-4.5 w-4.5 text-primary" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Quick Start Guide</h2>
              <p className="text-xs text-muted-foreground">Get your store ready in a few steps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div className="px-6 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Trophy size={13} className="text-primary" />
              Setup Progress
            </span>
            <span className="text-xs text-muted-foreground">
              {allDone ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle size={12} /> All done!
                </span>
              ) : (
                <>{completedCount} of {total} completed</>
              )}
            </span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!allDone && (
            <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock size={10} />
              ~{remaining * 5} min remaining
            </p>
          )}
        </div>

        {/* ── Steps ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const done = completedSteps[step.id];

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-3.5 rounded-xl border transition-colors ${
                  done
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800/40'
                    : 'border-border bg-background hover:bg-muted/40'
                }`}
              >
                {/* Step number / icon */}
                <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                  done
                    ? 'bg-green-500 text-white'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {done ? <CheckCircle size={16} /> : <Icon size={16} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${done ? 'text-green-700 dark:text-green-400 line-through' : 'text-foreground'}`}>
                    {idx + 1}. {step.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.description}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {step.route && (
                    <a
                      href={step.route}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        done
                          ? 'text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-primary text-white hover:bg-primary-dark'
                      }`}
                    >
                      <ArrowRight size={11} />
                      {done ? 'Review' : 'Go'}
                    </a>
                  )}
                  <button
                    onClick={() => toggleStep(step.id)}
                    disabled={isLoading}
                    title={done ? 'Mark as incomplete' : 'Mark as complete'}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                      done
                        ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {done ? <CheckCircle size={15} /> : <Circle size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Click the circle on any step to mark it complete
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickStartGuide;
