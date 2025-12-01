import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { useRipple } from "@/hooks/useRipple";
import { haptics } from "@/utils/haptics";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:scale-[0.97] touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:scale-[1.02]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg hover:scale-[1.02]",
        outline: "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent hover:shadow-md",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-14 px-6 py-3 min-h-[56px] md:h-12 md:min-h-[48px]",
        sm: "h-12 px-4 py-2 min-h-[48px] md:h-10 md:min-h-[40px]",
        lg: "h-16 px-8 py-4 min-h-[64px] text-lg md:h-14 md:min-h-[56px]",
        icon: "h-14 w-14 min-h-[56px] min-w-[56px] md:h-12 md:w-12 md:min-h-[48px] md:min-w-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  disableRipple?: boolean;
  disableHaptics?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disableRipple = false, disableHaptics = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const createRipple = useRipple();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableRipple && !props.disabled) {
        createRipple(e);
      }
      if (!disableHaptics && !props.disabled) {
        haptics.light();
      }
      onClick?.(e);
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), "ripple-container")}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
