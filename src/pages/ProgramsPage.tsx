import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";

export default function ProgramsPage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/application-programs"
        title="List Application Programs"
        description="Search and list KNX application programs."
      />

      <ParamsTable params={[
        { name: "search", type: "string", description: "Full-text search on program name" },
        { name: "manufacturerId", type: "string", description: "Filter by manufacturer" },
        { name: "productId", type: "string", description: "Filter by product" },
        { name: "version", type: "string", description: "Exact version match" },
        { name: "limit", type: "integer", defaultValue: "50", description: "Results per page (1–200)" },
        { name: "offset", type: "integer", defaultValue: "0", description: "Pagination offset" },
      ]} />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/application-programs"
        queryParams={[
          { name: "search", placeholder: "dimming" },
          { name: "manufacturerId", placeholder: "M-0008" },
          { name: "limit", placeholder: "50", defaultValue: "10" },
        ]}
        onExecute={async (params) => api.programs.list(params)}
      />
    </div>
  );
}
