import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Database, Cpu, Terminal, Zap, Globe, Search, BarChart3, FileText } from "lucide-react";

const Index = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.stats().then(res => setStats(res?.data));
  }, []);

  return (
    <div>
      <div className="mb-12">
        <Badge variant="secondary" className="mb-4 text-xs font-mono">v1.0.0</Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          KNXforge Device Lookup API
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          A publicly accessible, read-only REST API that resolves KNX manufacturer codes,
          product IDs, and application program identifiers into human-readable names and metadata.
          Includes detailed communication objects, parameters, technical specifications, and functional blocks per product.
        </p>
      </div>

      {/* Quick start */}
      <Card className="mb-8 border-2 border-primary/20 bg-accent/30">
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Start
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            The fastest way to look up any KNX ID — use the Resolve endpoint:
          </p>
          <pre className="bg-code-bg text-code-foreground rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`curl "https://api.knxforge.dev/v1/resolve/M-0008_H-0012" \\
  -H "X-API-Key: knxf_pk_a1b2c3d4e5f6"`}
          </pre>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Globe className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.manufacturers?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Manufacturers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Cpu className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.products?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Terminal className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.applicationPrograms?.total || 0}</p>
                <p className="text-xs text-muted-foreground">App Programs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <FileText className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.documents?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Auth & Rate limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-3">Authentication</h3>
            <p className="text-sm text-muted-foreground mb-3">
              API keys are optional but recommended. Without a key, you're limited to 30 req/min.
            </p>
            <pre className="bg-code-bg text-code-foreground rounded-lg p-3 text-xs font-mono">
              X-API-Key: knxf_pk_a1b2c3d4e5f6
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-3">Rate Limits</h3>
            <div className="space-y-2 text-sm">
              {[
                { tier: 'Anonymous', limit: '30 req/min', color: 'bg-muted' },
                { tier: 'Free', limit: '300 req/min', color: 'bg-accent' },
                { tier: 'Pro', limit: '3,000 req/min', color: 'bg-primary/10' },
              ].map(t => (
                <div key={t.tier} className={`flex justify-between items-center px-3 py-2 rounded-md ${t.color}`}>
                  <span className="font-medium">{t.tier}</span>
                  <span className="text-muted-foreground font-mono text-xs">{t.limit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Base URL */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold mb-3">Base URL</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">Production</Badge>
              <code className="text-sm font-mono">https://api.knxforge.dev/v1</code>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">Staging</Badge>
              <code className="text-sm font-mono">https://api-staging.knxforge.dev/v1</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
