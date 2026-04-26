import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

export function CuraLogo({
  className,
  size = "md",
  variant = "filled",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "filled" | "inline";
}) {
  const sizes = {
    sm: { icon: "h-4 w-4", text: "text-base", box: "p-1" },
    md: { icon: "h-5 w-5", text: "text-xl", box: "p-1.5" },
    lg: { icon: "h-7 w-7", text: "text-3xl", box: "p-2" },
  };
  if (variant === "inline") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 font-bold tracking-tight text-primary", className)}>
        <HeartPulse className={sizes[size].icon} strokeWidth={2.5} />
        <span className={sizes[size].text}>Cura AI</span>
      </div>
    );
  }
  return (
    <div className={cn("inline-flex items-center gap-2 font-bold tracking-tight text-primary", className)}>
      <span className={cn("relative inline-flex items-center justify-center rounded-lg gradient-primary shadow-floating", sizes[size].box)}>
        <HeartPulse className={cn("text-primary-foreground", sizes[size].icon)} strokeWidth={2.5} />
      </span>
      <span className={sizes[size].text}>Cura AI</span>
    </div>
  );
}
