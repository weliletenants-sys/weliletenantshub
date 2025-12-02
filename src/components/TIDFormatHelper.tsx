import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TIDFormatHelperProps {
  value: string;
  onChange: (value: string) => void;
  paymentMethod: string;
  tidExists?: boolean;
  checkingTid?: boolean;
  tidFormatError?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function TIDFormatHelper({
  value,
  onChange,
  paymentMethod,
  tidExists = false,
  checkingTid = false,
  tidFormatError = "",
  required = true,
  disabled = false,
  id = "payment-id",
}: TIDFormatHelperProps) {
  // Extract digit count (after prefix)
  const getDigitCount = () => {
    if (!value) return 0;
    const match = value.match(/\d+$/);
    return match ? match[0].length : 0;
  };

  const digitCount = getDigitCount();
  const expectedDigits = paymentMethod === "mtn" ? 11 : paymentMethod === "airtel" ? 12 : 0;
  const progressPercent = expectedDigits > 0 ? (digitCount / expectedDigits) * 100 : 0;

  // Format examples and hints
  const getFormatHint = () => {
    switch (paymentMethod) {
      case "mtn":
        return {
          format: "MTN-XXXXXXXXXXX",
          example: "MTN-12345678901",
          description: "11 digits after MTN-",
          prefix: "MTN-",
        };
      case "airtel":
        return {
          format: "ATL-XXXXXXXXXXXX",
          example: "ATL-123456789012",
          description: "12 digits after ATL-",
          prefix: "ATL-",
        };
      default:
        return {
          format: "Any format",
          example: "CASH-001",
          description: "Required to prevent double entry",
          prefix: "",
        };
    }
  };

  const hint = getFormatHint();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>Transaction ID (TID) *</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-2">
                <div>
                  <p className="font-semibold text-xs mb-1">Format:</p>
                  <p className="font-mono text-xs text-primary">{hint.format}</p>
                </div>
                <div>
                  <p className="font-semibold text-xs mb-1">Example:</p>
                  <p className="font-mono text-xs text-muted-foreground">{hint.example}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{hint.description}</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="relative">
        <Input
          id={id}
          type="text"
          placeholder={`Enter ${hint.format}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={cn(
            "font-mono",
            (tidExists || tidFormatError) && "border-destructive focus-visible:ring-destructive",
            checkingTid && "pr-10"
          )}
        />
        {checkingTid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Real-time digit counter and progress for MTN/Airtel */}
      {expectedDigits > 0 && value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Digit count: {digitCount}/{expectedDigits}
            </span>
            <span
              className={cn(
                "font-semibold",
                digitCount === expectedDigits && !tidFormatError
                  ? "text-green-600"
                  : digitCount > expectedDigits
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {digitCount === expectedDigits && !tidFormatError
                ? "Complete ✓"
                : digitCount > expectedDigits
                ? "Too many digits"
                : `${expectedDigits - digitCount} more`}
            </span>
          </div>
          <Progress
            value={progressPercent}
            className={cn(
              "h-1.5",
              digitCount === expectedDigits && !tidFormatError && "[&>div]:bg-green-600"
            )}
          />
        </div>
      )}

      {/* Validation feedback */}
      {tidFormatError && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive font-medium">{tidFormatError}</p>
        </div>
      )}

      {tidExists && !tidFormatError && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive font-medium">
            This Transaction ID already exists in the system. Please use a different TID to avoid
            double entry.
          </p>
        </div>
      )}

      {!tidExists && !tidFormatError && value && !checkingTid && (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 className="h-3 w-3" />
          TID available
        </div>
      )}

      {/* Format hint for cash */}
      {paymentMethod === "cash" && !tidFormatError && (
        <p className="text-xs text-muted-foreground">{hint.description}</p>
      )}
    </div>
  );
}
