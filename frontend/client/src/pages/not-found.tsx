import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">
            Page not found
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or was moved.
          </p>

          <button
            onClick={() => setLocation("/dashboard")}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

        </CardContent>
      </Card>
    </div>
  );
}
