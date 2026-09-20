import { ReadinessState } from "@/components/readiness-state";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <ReadinessState
      title="Page Not Found"
      description="The page you are looking for does not exist or has been moved."
      icon={<FileQuestion className="w-12 h-12 text-muted-foreground" />}
      actionText="Return Home"
    />
  );
}
