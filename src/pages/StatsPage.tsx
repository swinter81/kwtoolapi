import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EndpointHeader } from "@/components/EndpointHeader";
import { api } from "@/lib/api";
import { Loader2, Globe, Cpu, Terminal, Clock } from "lucide-react";

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats().then(res => {
      setStats(res?.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/stats"
        title="Registry Statistics"
        description="Get current registry statistics. Useful for monitoring and display. No authentication required."
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Manufacturers</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono font-bold">{stats.manufacturers?.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">With Products</span><span className="font-mono font-bold">{stats.manufacturers?.withProducts}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Products</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono font-bold">{stats.products?.total}</span></div>
                {stats.products?.byMediumType && Object.entries(stats.products.byMediumType).map(([k, v]: [string, any]) => (
                  <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Terminal className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Application Programs</h3>
              </div>
              <div className="text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono font-bold">{stats.applicationPrograms?.total}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Registry Info</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Last Updated</span><span className="font-mono text-xs">{stats.lastUpdated}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Data Version</span><span className="font-mono">{stats.dataVersion}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground">Failed to load statistics.</p>
      )}
    </div>
  );
}
