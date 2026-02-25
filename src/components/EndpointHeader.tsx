import { Badge } from "@/components/ui/badge";

interface EndpointHeaderProps {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
}

export function EndpointHeader({ method, path, title, description }: EndpointHeaderProps) {
  const methodColor = method === 'GET'
    ? 'bg-endpoint-get text-primary-foreground'
    : 'bg-endpoint-post text-primary-foreground';

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <Badge className={`${methodColor} font-mono text-xs px-2.5 py-1 rounded-md`}>
          {method}
        </Badge>
        <code className="text-lg font-mono font-semibold text-foreground">{path}</code>
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
