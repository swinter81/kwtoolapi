import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";

export default function ProductsPage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/products"
        title="List Products"
        description="Search and list KNX hardware products."
      />

      <ParamsTable params={[
        { name: "search", type: "string", description: "Full-text search on product name, order number, description" },
        { name: "manufacturerId", type: "string", description: "Filter by manufacturer (public ID or KNX ID)" },
        { name: "mediumType", type: "string", description: "Filter by medium: TP, IP, RF, PL" },
        { name: "isCoupler", type: "boolean", description: "Filter for line/area/backbone couplers" },
        { name: "isIpDevice", type: "boolean", description: "Filter for IP-capable devices" },
        { name: "limit", type: "integer", defaultValue: "50", description: "Results per page (1–200)" },
        { name: "offset", type: "integer", defaultValue: "0", description: "Pagination offset" },
      ]} />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/products"
        queryParams={[
          { name: "search", placeholder: "switch actuator" },
          { name: "mediumType", placeholder: "TP" },
          { name: "limit", placeholder: "50", defaultValue: "5" },
        ]}
        onExecute={async (params) => api.products.list(params)}
      />

      <Separator className="my-10" />

      <EndpointHeader
        method="GET"
        path="/v1/products/{productId}"
        title="Get Product"
        description="Get a single product by public ID or KNX product ID."
      />

      <TryItPanel
        method="GET"
        endpoint="/v1/products/{productId}"
        pathParams={[{ name: "productId", placeholder: "M-0008_H-0012" }]}
        onExecute={async (params) => api.products.get(params.productId || 'prod_0008_h0012')}
      />
    </div>
  );
}
