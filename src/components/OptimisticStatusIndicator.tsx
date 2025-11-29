import { useOptimisticStatusStore, getStatusIcon, getStatusColor } from "@/hooks/useOptimisticStatus";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export const OptimisticStatusIndicator = () => {
  const { operations, removeOperation, clearCompleted } = useOptimisticStatusStore();

  if (operations.length === 0) return null;

  const pendingCount = operations.filter(op => op.status === 'pending').length;
  const errorCount = operations.filter(op => op.status === 'error').length;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <Card className="shadow-lg border-2">
        <div className="p-3 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Updates</h3>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {pendingCount} pending
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {errorCount} failed
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {operations.some(op => op.status !== 'pending') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                  className="h-6 px-2 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Operations List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {operations.map((operation) => {
                const Icon = getStatusIcon(operation.status);
                const colorClass = getStatusColor(operation.status);

                return (
                  <motion.div
                    key={operation.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          colorClass,
                          operation.status === 'pending' && "animate-spin"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {operation.description}
                        </p>
                        {operation.error && (
                          <p className="text-xs text-destructive truncate">
                            {operation.error}
                          </p>
                        )}
                      </div>
                      {operation.status === 'error' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOperation(operation.id)}
                          className="h-6 w-6 p-0 flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
