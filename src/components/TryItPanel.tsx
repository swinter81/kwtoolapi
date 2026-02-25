import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Play, Loader2 } from "lucide-react";

interface TryItPanelProps {
  method: "GET" | "POST";
  endpoint: string;
  pathParams?: { name: string; placeholder: string }[];
  queryParams?: { name: string; placeholder: string; defaultValue?: string }[];
  bodyTemplate?: string;
  onExecute: (params: Record<string, string>, body?: string) => Promise<any>;
}

export function TryItPanel({ method, endpoint, pathParams, queryParams, bodyTemplate, onExecute }: TryItPanelProps) {
  const [params, setParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    pathParams?.forEach(p => { initial[p.name] = ''; });
    queryParams?.forEach(p => { initial[p.name] = p.defaultValue || ''; });
    return initial;
  });
  const [body, setBody] = useState(bodyTemplate || '');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    try {
      const result = await onExecute(params, method === 'POST' ? body : undefined);
      setResponse(result);
    } catch (e: any) {
      setResponse({ error: { code: 'CLIENT_ERROR', message: e.message } });
    }
    setLoading(false);
  };

  const responseStr = response ? JSON.stringify(response, null, 2) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(responseStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const methodColor = method === 'GET' ? 'bg-endpoint-get' : 'bg-endpoint-post';

  return (
    <Card className="overflow-hidden border-2">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3 mb-4">
          <Badge className={`${methodColor} text-primary-foreground font-mono text-xs px-2.5 py-1`}>
            {method}
          </Badge>
          <code className="text-sm font-mono text-foreground">{endpoint}</code>
        </div>

        {pathParams?.map(p => (
          <div key={p.name} className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{p.name}</label>
            <Input
              placeholder={p.placeholder}
              value={params[p.name] || ''}
              onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
              className="font-mono text-sm"
            />
          </div>
        ))}

        {queryParams?.map(p => (
          <div key={p.name} className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{p.name}</label>
            <Input
              placeholder={p.placeholder}
              value={params[p.name] || ''}
              onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
              className="font-mono text-sm"
            />
          </div>
        ))}

        {method === 'POST' && (
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Request Body</label>
            <textarea
              className="w-full h-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>
        )}

        <Button onClick={handleExecute} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Send Request
        </Button>
      </div>

      {response && (
        <div className="relative">
          <div className="flex items-center justify-between p-3 bg-code-bg border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Response</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5">
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <pre className="p-4 overflow-auto max-h-96 bg-code-bg text-code-foreground text-xs font-mono leading-relaxed">
            {responseStr}
          </pre>
        </div>
      )}
    </Card>
  );
}
