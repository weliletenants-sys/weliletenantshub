import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Undo2, User, Calendar, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

export interface UndoHistoryEntry {
  id: string;
  paymentId: string;
  tenantName: string;
  actionType: 'verify' | 'reject';
  undoneAt: Date;
  previousStatus: string;
  rejectionReason?: string;
}

interface UndoHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: UndoHistoryEntry[];
  onClearHistory: () => void;
}

export const UndoHistoryDialog = ({ 
  open, 
  onOpenChange, 
  history,
  onClearHistory 
}: UndoHistoryDialogProps) => {
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.undoneAt).getTime() - new Date(a.undoneAt).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5" />
                Undo History
              </DialogTitle>
              <DialogDescription>
                All reversed verification and rejection actions
              </DialogDescription>
            </div>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearHistory}
              >
                Clear History
              </Button>
            )}
          </div>
        </DialogHeader>

        {history.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Undo2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No undo actions recorded yet</p>
            <p className="text-sm mt-1">Actions you reverse will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {sortedHistory.map((entry) => (
                <Card key={entry.id} className="border-l-4" style={{
                  borderLeftColor: entry.actionType === 'verify' 
                    ? 'hsl(var(--success))' 
                    : 'hsl(var(--destructive))'
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{entry.tenantName}</span>
                        </div>
                        <Badge 
                          variant={entry.actionType === 'verify' ? 'default' : 'destructive'}
                          className="mb-2"
                        >
                          {entry.actionType === 'verify' ? 'Verification' : 'Rejection'} Undone
                        </Badge>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center gap-1 justify-end mb-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.undoneAt), 'MMM dd, yyyy')}
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          {format(new Date(entry.undoneAt), 'hh:mm a')}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-md p-3 space-y-2">
                      <div className="flex items-start gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-muted-foreground mb-1">
                            <strong>Action:</strong> {entry.actionType === 'verify' 
                              ? 'Verified payment was reverted' 
                              : 'Rejected payment was reverted'}
                          </p>
                          <p className="text-muted-foreground">
                            <strong>Reverted to:</strong> {entry.previousStatus}
                          </p>
                          {entry.rejectionReason && entry.actionType === 'reject' && (
                            <p className="text-muted-foreground mt-2">
                              <strong>Original rejection reason:</strong> {entry.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      Payment ID: {entry.paymentId.slice(0, 8)}...
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
