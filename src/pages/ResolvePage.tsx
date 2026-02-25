import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";

export default function ResolvePage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/resolve/{knxId}"
        title="Resolve a KNX ID"
        description="The core utility endpoint. Pass any KNX identifier and get back everything known about it. Automatically detects the ID type."
      />

      <ParamsTable
        title="Path Parameters"
        params={[
          { name: "knxId", type: "string", required: true, description: "Any KNX identifier: M-0008, M-0008_H-0012, M-0008_A-0034-00-AB01" },
        ]}
      />

      <ParamsTable
        title="Type Detection"
        params={[
          { name: "M-XXXX", type: "pattern", description: "Detected as manufacturer" },
          { name: "M-XXXX_H-XXXX", type: "pattern", description: "Detected as product" },
          { name: "M-XXXX_A-XXXX-XX-XXXX", type: "pattern", description: "Detected as application_program" },
          { name: "M-XXXX_H-XXXX.HP-XXXX-XX-XX", type: "pattern", description: "Detected as hardware_program_mapping" },
        ]}
      />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/resolve/{knxId}"
        pathParams={[{ name: "knxId", placeholder: "M-0008_H-0012" }]}
        onExecute={async (params) => {
          const knxId = params.knxId || 'M-0008';
          return api.resolve.single(knxId);
        }}
      />

      <Separator className="my-10" />

      <EndpointHeader
        method="POST"
        path="/v1/resolve"
        title="Batch Resolve KNX IDs"
        description="Resolve up to 200 KNX identifiers in a single request. Essential for efficiently rendering device tables."
      />

      <TryItPanel
        method="POST"
        endpoint="/v1/resolve"
        bodyTemplate={JSON.stringify({ knxIds: ["M-0008", "M-0008_H-0012", "M-FFFF"] }, null, 2)}
        onExecute={async (_, body) => {
          const parsed = JSON.parse(body || '{}');
          return api.resolve.batch(parsed.knxIds || []);
        }}
      />
    </div>
  );
}
