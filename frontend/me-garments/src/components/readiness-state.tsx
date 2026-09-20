import { AlertCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface ReadinessStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  actionHref?: string;
}

export function ReadinessState({
  title,
  description,
  icon = <Wrench className="w-12 h-12 text-primary" />,
  actionText = "Return Home",
  actionHref = "/"
}: ReadinessStateProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mx-auto shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
        {actionText && actionHref && (
          <Button asChild size="lg" className="mt-4 rounded-full px-8">
            <Link href={actionHref}>{actionText}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <ReadinessState
      title="Something went wrong"
      description={error}
      icon={<AlertCircle className="w-12 h-12 text-destructive" />}
    />
  );
}
