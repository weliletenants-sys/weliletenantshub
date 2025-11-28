import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Bug, Shield, X } from "lucide-react";
import { ChangelogEntry } from "@/data/changelog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ChangelogEntry[];
  isUpdate?: boolean;
}

const getChangeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Sparkles className="h-4 w-4 text-blue-600" />;
    case 'improvement':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'fix':
      return <Bug className="h-4 w-4 text-orange-600" />;
    case 'security':
      return <Shield className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
};

const getChangeBadgeVariant = (type: string) => {
  switch (type) {
    case 'feature':
      return "default";
    case 'improvement':
      return "secondary";
    case 'fix':
      return "outline";
    case 'security':
      return "destructive";
    default:
      return "outline";
  }
};

export const ChangelogDialog = ({ open, onOpenChange, entries, isUpdate = false }: ChangelogDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <DialogTitle className="text-2xl">
                {isUpdate ? "What's New" : "Release Notes"}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            {isUpdate 
              ? "Your app has been updated with exciting new features and improvements!" 
              : "View all release notes and changes"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <div 
                key={entry.version}
                className={`space-y-3 ${index !== entries.length - 1 ? 'pb-6 border-b' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-base font-bold px-3 py-1">
                      v{entry.version}
                    </Badge>
                    {index === 0 && (
                      <Badge className="bg-green-600">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(entry.date), "MMM d, yyyy")}
                  </span>
                </div>

                <div className="space-y-2">
                  {entry.changes.map((change, changeIndex) => (
                    <div 
                      key={changeIndex}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="mt-0.5">
                        {getChangeIcon(change.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getChangeBadgeVariant(change.type)}
                            className="text-xs capitalize"
                          >
                            {change.type}
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed">
                          {change.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {isUpdate && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => onOpenChange(false)}>
              Got it, thanks!
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
