import { create } from 'zustand';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export type OptimisticStatus = 'pending' | 'success' | 'error';

export interface OptimisticOperation {
  id: string;
  type: string;
  description: string;
  status: OptimisticStatus;
  timestamp: number;
  error?: string;
}

interface OptimisticStatusStore {
  operations: OptimisticOperation[];
  addOperation: (type: string, description: string) => string;
  updateOperation: (id: string, status: OptimisticStatus, error?: string) => void;
  removeOperation: (id: string) => void;
  clearCompleted: () => void;
}

export const useOptimisticStatusStore = create<OptimisticStatusStore>((set) => ({
  operations: [],
  
  addOperation: (type: string, description: string) => {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    set((state) => ({
      operations: [
        ...state.operations,
        {
          id,
          type,
          description,
          status: 'pending' as OptimisticStatus,
          timestamp: Date.now(),
        },
      ],
    }));
    return id;
  },

  updateOperation: (id: string, status: OptimisticStatus, error?: string) => {
    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, status, error } : op
      ),
    }));

    // Auto-remove successful operations after 3 seconds
    if (status === 'success') {
      setTimeout(() => {
        set((state) => ({
          operations: state.operations.filter((op) => op.id !== id),
        }));
      }, 3000);
    }
  },

  removeOperation: (id: string) => {
    set((state) => ({
      operations: state.operations.filter((op) => op.id !== id),
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      operations: state.operations.filter((op) => op.status === 'pending'),
    }));
  },
}));

export const getStatusIcon = (status: OptimisticStatus) => {
  switch (status) {
    case 'pending':
      return Loader2;
    case 'success':
      return CheckCircle2;
    case 'error':
      return XCircle;
  }
};

export const getStatusColor = (status: OptimisticStatus) => {
  switch (status) {
    case 'pending':
      return 'text-primary';
    case 'success':
      return 'text-green-500';
    case 'error':
      return 'text-destructive';
  }
};
