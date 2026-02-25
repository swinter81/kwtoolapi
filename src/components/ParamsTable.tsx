import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

interface ParamsTableProps {
  params: Array<{
    name: string;
    type: string;
    required?: boolean;
    defaultValue?: string;
    description: string;
  }>;
  title?: string;
}

export function ParamsTable({ params, title = "Parameters" }: ParamsTableProps) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Default</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {params.map(p => (
              <TableRow key={p.name}>
                <TableCell>
                  <code className="text-sm font-mono bg-code-bg px-1.5 py-0.5 rounded">{p.name}</code>
                  {p.required && <span className="text-destructive ml-1 text-xs">*</span>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.type}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.defaultValue || '—'}</TableCell>
                <TableCell className="text-sm">{p.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
