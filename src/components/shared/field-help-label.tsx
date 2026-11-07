import { HelpTooltip, type HelpContent } from "@/components/shared/help-tooltip";
import { Label } from "@/components/ui/label";

export function FieldHelpLabel({
  htmlFor,
  children,
  help,
}: {
  htmlFor: string;
  children: string;
  help: HelpContent;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{children}</Label>
      <HelpTooltip label={children} {...help} />
    </div>
  );
}
