import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loading({
  text = "Loading...",
  className,
  iconClassName,
  inline = false,
}: {
  text?: string;
  className?: string;
  iconClassName?: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Loader2
          aria-label="Loading"
          role="status"
          className={cn("h-4 w-4 animate-spin", iconClassName)}
        />
        {text ? <span className="ml-2 text-sm">{text}</span> : null}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-muted-foreground", className)}>
      <Loader2 className={cn("mb-2 h-8 w-8 animate-spin", iconClassName)} />
      <p className="text-sm">{text}</p>
    </div>
  );
}