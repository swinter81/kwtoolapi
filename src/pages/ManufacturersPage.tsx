import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";

export default function ManufacturersPage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/manufacturers"
        title="List Manufacturers"
        description="List all known KNX manufacturers with optional search and filtering."
      />

      <ParamsTable params={[
        { name: "search", type: "string", description: "Full-text search on name and short name" },
        { name: "hexCode", type: "string", description: "Filter by exact hex code (e.g., 0008)" },
        { name: "limit", type: "integer", defaultValue: "50", description: "Results per page (1–200)" },
        { name: "offset", type: "integer", defaultValue: "0", description: "Pagination offset" },
        { name: "sort", type: "string", defaultValue: "name", description: "Sort field: name, hexCode, productCount" },
        { name: "order", type: "string", defaultValue: "asc", description: "Sort order: asc, desc" },
      ]} />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/manufacturers"
        queryParams={[
          { name: "search", placeholder: "gira" },
          { name: "limit", placeholder: "50", defaultValue: "10" },
        ]}
        onExecute={async (params) => api.manufacturers.list(params)}
      />

      <Separator className="my-10" />

      <EndpointHeader
        method="GET"
        path="/v1/manufacturers/{manufacturerId}"
        title="Get Manufacturer"
        description="Get a single manufacturer by public ID or KNX manufacturer ID."
      />

      <TryItPanel
        method="GET"
        endpoint="/v1/manufacturers/{manufacturerId}"
        pathParams={[{ name: "manufacturerId", placeholder: "M-0008" }]}
        onExecute={async (params) => api.manufacturers.get(params.manufacturerId || 'M-0008')}
      />
    </div>
  );
}
