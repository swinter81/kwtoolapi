import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";

export default function DptsPage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/dpts"
        title="List Data Point Types"
        description="List all KNX Data Point Types. Based on publicly documented ISO 14543 / KNX standard identifiers."
      />

      <ParamsTable params={[
        { name: "search", type: "string", description: "Search by DPT number, name, or description" },
        { name: "mainNumber", type: "integer", description: "Filter by main DPT number (e.g., 1 for all 1.xxx)" },
        { name: "limit", type: "integer", defaultValue: "100", description: "Results per page" },
        { name: "offset", type: "integer", defaultValue: "0", description: "Pagination offset" },
      ]} />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/dpts"
        queryParams={[
          { name: "mainNumber", placeholder: "1" },
          { name: "search", placeholder: "temperature" },
          { name: "limit", placeholder: "100", defaultValue: "20" },
        ]}
        onExecute={async (params) => api.dpts.list(params)}
      />

      <Separator className="my-10" />

      <EndpointHeader
        method="GET"
        path="/v1/dpts/{dptNumber}"
        title="Get a Data Point Type"
        description="Get a single DPT by number."
      />

      <TryItPanel
        method="GET"
        endpoint="/v1/dpts/{dptNumber}"
        pathParams={[{ name: "dptNumber", placeholder: "1.001" }]}
        onExecute={async (params) => api.dpts.get(params.dptNumber || '1.001')}
      />
    </div>
  );
}
