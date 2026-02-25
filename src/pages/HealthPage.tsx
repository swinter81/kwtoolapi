import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EndpointHeader } from "@/components/EndpointHeader";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.health().then(res => {
      setHealth(res);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/health"
        title="Health Check"
        description="Health check endpoint. No API key required."
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              {health?.status === 'ok' ? (
                <CheckCircle className="w-6 h-6 text-primary" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive" />
              )}
              <h3 className="text-xl font-bold">
                {health?.status === 'ok' ? 'All Systems Operational' : 'Service Unavailable'}
              </h3>
              <Badge variant={health?.status === 'ok' ? 'default' : 'destructive'}>
                {health?.status || 'unknown'}
              </Badge>
            </div>
            <pre className="bg-code-bg text-code-foreground rounded-lg p-4 text-sm font-mono">
              {JSON.stringify(health, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
