import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Loader2, Sparkles, Copy, Download, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { haptics } from "@/utils/haptics";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReleaseNotesGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (notes: string) => void;
}

export const ReleaseNotesGenerator = ({ open, onOpenChange, onGenerated }: ReleaseNotesGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>(new Date());
  const [generatedNotes, setGeneratedNotes] = useState("");
  const [commitCount, setCommitCount] = useState(0);
  const [missingSecret, setMissingSecret] = useState(false);

  const handleGenerate = async () => {
    if (!owner || !repo) {
      toast.error("Please enter repository owner and name");
      return;
    }

    try {
      setIsGenerating(true);
      setMissingSecret(false);
      haptics.light();

      const { data, error } = await supabase.functions.invoke('generate-release-notes', {
        body: {
          owner,
          repo,
          fromDate: fromDate?.toISOString(),
          toDate: toDate?.toISOString(),
        }
      });

      if (error) throw error;

      if (data.missingSecret) {
        setMissingSecret(true);
        toast.error("GitHub token not configured");
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setGeneratedNotes(data.markdown);
      setCommitCount(data.commitCount);
      haptics.success();
      toast.success(`Generated release notes from ${data.commitCount} commits`);

      if (onGenerated) {
        onGenerated(data.markdown);
      }
    } catch (error: any) {
      console.error('Error generating release notes:', error);
      toast.error(error.message || "Failed to generate release notes");
      haptics.error();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedNotes) {
      navigator.clipboard.writeText(generatedNotes);
      toast.success("Release notes copied to clipboard");
      haptics.success();
    }
  };

  const handleDownload = () => {
    if (generatedNotes) {
      const blob = new Blob([generatedNotes], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `release-notes-${format(new Date(), 'yyyy-MM-dd')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Release notes downloaded");
      haptics.success();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Release Notes from Git Commits
          </DialogTitle>
          <DialogDescription>
            Automatically pull commits from your GitHub repository and generate formatted release notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Repository Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner">Repository Owner</Label>
                  <Input
                    id="owner"
                    placeholder="e.g., facebook"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repo">Repository Name</Label>
                  <Input
                    id="repo"
                    placeholder="e.g., react"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !fromDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, "PPP") : "Select start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={setFromDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(toDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={(date) => date && setToDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {missingSecret && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    GitHub token not configured. Please add a <code className="font-mono bg-background px-1 py-0.5 rounded">GITHUB_TOKEN</code> secret in your Lovable Cloud settings with a valid GitHub personal access token.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !owner || !repo}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Release Notes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Notes */}
          {generatedNotes && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">Generated Release Notes</h3>
                  <Badge variant="secondary">{commitCount} commits</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-4">
                  <Textarea
                    value={generatedNotes}
                    onChange={(e) => setGeneratedNotes(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Generated release notes will appear here..."
                  />
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                You can edit the generated notes above before using them. The notes are categorized based on commit message conventions.
              </p>
            </div>
          )}

          {/* Help Text */}
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2">💡 Tips</h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Use conventional commit prefixes (feat:, fix:, improve:) for better categorization</li>
                <li>Commits are automatically grouped into Features, Fixes, Improvements, and Maintenance</li>
                <li>Merge commits are automatically excluded from the release notes</li>
                <li>Leave "From Date" empty to include all commits up to "To Date"</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};