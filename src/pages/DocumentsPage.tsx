import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";

export default function DocumentsPage() {
  return (
    <div>
      <EndpointHeader
        method="GET"
        path="/v1/documents"
        title="List Documents"
        description="Search and list crawled documents and datasheets."
      />

      <ParamsTable params={[
        { name: "search", type: "string", description: "Search in document title and filename" },
        { name: "sourceId", type: "string", description: "Filter by crawl source ID" },
        { name: "documentType", type: "string", description: "Filter by type: datasheet, manual, catalog, etc." },
        { name: "limit", type: "integer", defaultValue: "50", description: "Results per page (1–200)" },
        { name: "offset", type: "integer", defaultValue: "0", description: "Pagination offset" },
      ]} />

      <h3 className="text-lg font-semibold mb-4">Try it</h3>
      <TryItPanel
        method="GET"
        endpoint="/v1/documents"
        queryParams={[
          { name: "search", placeholder: "datasheet" },
          { name: "documentType", placeholder: "datasheet" },
          { name: "limit", placeholder: "50", defaultValue: "5" },
        ]}
        onExecute={async (params) => api.documents.list(params)}
      />

      <Separator className="my-10" />

      <EndpointHeader
        method="GET"
        path="/v1/documents/{documentId}"
        title="Get Document"
        description="Get detailed metadata for a single document, including download URL."
      />

      <TryItPanel
        method="GET"
        endpoint="/v1/documents/{documentId}"
        pathParams={[{ name: "documentId", placeholder: "document UUID" }]}
        onExecute={async (params) => api.documents.get(params.documentId)}
      />

      <Separator className="my-10" />

      <EndpointHeader
        method="GET"
        path="/v1/documents/{documentId}/text"
        title="Get Document Text"
        description="Get the full extracted text content of a document, assembled from all chunks."
      />

      <TryItPanel
        method="GET"
        endpoint="/v1/documents/{documentId}/text"
        pathParams={[{ name: "documentId", placeholder: "document UUID" }]}
        onExecute={async (params) => api.documents.text(params.documentId)}
      />
    </div>
  );
}
