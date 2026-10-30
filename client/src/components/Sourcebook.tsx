import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { sourcebookName } from "@shared/sourcebooks";
import { Portal } from "@radix-ui/react-tooltip";

/** Focusable text leaves surrounding labels/checkboxes clickable. */
export function Sourcebook({ source }: { source: string }) {
  const name = sourcebookName(source);
  return <Tooltip delayDuration={200}>
    <TooltipTrigger asChild>
      <span tabIndex={0} aria-label={name} className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        data-sourcebook={source}>{source}</span>
    </TooltipTrigger>
    <Portal><TooltipContent side="top" className="max-w-xs whitespace-normal">{name}</TooltipContent></Portal>
  </Tooltip>;
}
