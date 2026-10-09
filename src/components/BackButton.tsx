import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ fallback = "/app", label = "Voltar" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground"
      onClick={() => {
        if (window.history.length > 1) router.history.back();
        else router.navigate({ to: fallback });
      }}
    >
      <ArrowLeft />
      {label}
    </Button>
  );
}
