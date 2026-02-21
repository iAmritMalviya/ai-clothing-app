import { Badge } from "@/components/ui/badge";

interface CreditsBadgeProps {
  credits: number;
}

export function CreditsBadge({ credits }: CreditsBadgeProps) {
  return (
    <Badge variant={credits === 0 ? "destructive" : "secondary"}>
      {credits} {credits === 1 ? "credit" : "credits"} left
    </Badge>
  );
}
