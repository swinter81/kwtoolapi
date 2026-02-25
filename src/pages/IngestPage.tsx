import { EndpointHeader } from "@/components/EndpointHeader";
import { ParamsTable } from "@/components/ParamsTable";
import { TryItPanel } from "@/components/TryItPanel";
import { api } from "@/lib/api";

const IngestPage = () => {
  return (
    <div className="space-y-10">
      <EndpointHeader
        method="POST"
        path="/v1/ingest/{resource}"
        title="Ingest Data"
        description="Insert or update (upsert) records into the KNXforge database. Requires the X-API-Secret header for authentication. Supports manufacturers, products, application_programs, and dpts resources."
      />

      <section>
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        <p className="text-muted-foreground mb-4">
          All ingest requests must include the <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono">X-API-Secret</code> header with a valid secret. Requests without a valid secret will receive a <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono">401 Unauthorized</code> response.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Path Parameters</h2>
        <ParamsTable
          params={[
            { name: "resource", type: "string", required: true, description: "The resource to upsert. One of: manufacturers, products, application_programs, dpts" },
          ]}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Request Body</h2>
        <p className="text-muted-foreground mb-4">
          Send a single object or an array of objects (max 100). Records are upserted based on their unique KNX identifier.
        </p>

        <h3 className="text-lg font-medium mb-2">Manufacturer Fields</h3>
        <ParamsTable
          params={[
            { name: "knxManufacturerId", type: "string", required: true, description: 'KNX manufacturer ID (e.g. "M-0001")' },
            { name: "hexCode", type: "string", required: true, description: 'Hex code (e.g. "0001")' },
            { name: "name", type: "string", required: false, description: "Full name" },
            { name: "shortName", type: "string", required: false, description: "Short name" },
            { name: "country", type: "string", required: false, description: "Country code" },
            { name: "websiteUrl", type: "string", required: false, description: "Website URL" },
          ]}
        />

        <h3 className="text-lg font-medium mt-6 mb-2">Product Fields</h3>
        <ParamsTable
          params={[
            { name: "knxProductId", type: "string", required: true, description: "KNX product ID" },
            { name: "manufacturerId", type: "string", required: false, description: "Manufacturer UUID" },
            { name: "name", type: "string", required: false, description: "Product name" },
            { name: "orderNumber", type: "string", required: false, description: "Order number" },
            { name: "description", type: "string", required: false, description: "Description" },
            { name: "mediumTypes", type: "string[]", required: false, description: "Medium types array" },
          ]}
        />

        <h3 className="text-lg font-medium mt-6 mb-2">Application Program Fields</h3>
        <ParamsTable
          params={[
            { name: "knxApplicationId", type: "string", required: true, description: "KNX application ID" },
            { name: "name", type: "string", required: false, description: "Program name" },
            { name: "version", type: "string", required: false, description: "Version string" },
            { name: "manufacturerId", type: "string", required: false, description: "Manufacturer UUID" },
            { name: "productId", type: "string", required: false, description: "Product UUID" },
          ]}
        />

        <h3 className="text-lg font-medium mt-6 mb-2">DPT Fields</h3>
        <ParamsTable
          params={[
            { name: "dptId", type: "string", required: true, description: 'DPT ID (e.g. "DPST-1-1")' },
            { name: "number", type: "string", required: true, description: 'DPT number (e.g. "1.001")' },
            { name: "name", type: "string", required: true, description: "DPT name" },
            { name: "mainNumber", type: "integer", required: true, description: "Main type number" },
            { name: "subNumber", type: "integer", required: true, description: "Sub type number" },
          ]}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Try It</h2>
        <TryItPanel
          method="POST"
          endpoint="/v1/ingest/{resource}"
          pathParams={[
            { name: "resource", placeholder: "manufacturers" },
          ]}
          queryParams={[
            { name: "secret", placeholder: "Your X-API-Secret value" },
          ]}
          bodyTemplate={JSON.stringify([
            {
              knxManufacturerId: "M-0999",
              hexCode: "0999",
              name: "Test Manufacturer",
              shortName: "TestMfr",
              country: "DE",
            },
          ], null, 2)}
          onExecute={async (params, body) => {
            return api.ingest(params.resource, body ? JSON.parse(body) : [], params.secret);
          }}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Example cURL</h2>
        <pre className="p-4 rounded-lg bg-code-bg text-code-foreground text-xs font-mono leading-relaxed overflow-auto">
{`curl -X POST \\
  https://milfaoakcaenjsgkdamh.supabase.co/functions/v1/public-api-ingest/manufacturers \\
  -H "Content-Type: application/json" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -d '[{"knxManufacturerId":"M-0999","hexCode":"0999","name":"Test"}]'`}
        </pre>
      </section>
    </div>
  );
};

export default IngestPage;
