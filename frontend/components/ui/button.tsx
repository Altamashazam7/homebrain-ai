import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#f6a623] text-[#17212b] shadow-sm hover:bg-[#e99612]",
        outline: "border border-[#e1e6eb] bg-white text-[#263544] hover:bg-[#f7f8fa]",
        ghost: "text-[#596775] hover:bg-[#f1f3f6]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonStyles({ variant, size, className }))} {...props} />;
}
