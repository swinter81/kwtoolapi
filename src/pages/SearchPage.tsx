import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";

export default function SearchPage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/search"
        title="Unified Search"
        description="Search across all entity types simultaneously — manufacturers, products, and application programs."
      />

      <ParamsTable params={[
        { name: "q", type: "string", required: true, description: "Search query (min 2 characters)" },
        { name: "types", type: "string", defaultValue: "all", description: "Comma-separated: manufacturer,product,application_program" },
        { name: "limit", type: "integer", defaultValue: "20", description: "Results per type (1–50)" },
      ]} />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/search"
        queryParams={[
          { name: "q", placeholder: "gira switch", defaultValue: "gira" },
          { name: "types", placeholder: "all", defaultValue: "all" },
          { name: "limit", placeholder: "20", defaultValue: "20" },
        ]}
        onExecute={async (params) => api.search(params)}
      />
    </div>
  );
}
