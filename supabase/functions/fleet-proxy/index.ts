import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FLEET_API_BASE = "http://chinamdvr.com:8088";

// Whitelist of allowed endpoints for security
const ALLOWED_ENDPOINTS = [
  "/StandardApiAction_login.action",
  "/StandardApiAction_queryUserVehicle.action",
  "/StandardApiAction_getDeviceOlStatus.action",
  "/StandardApiAction_logout.action",
  "/StandardApiAction_getDeviceByVehicle.action",
  "/StandardApiAction_getDeviceStatus.action"
];

interface ProxyRequest {
  endpoint: string;
  params: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { endpoint, params }: ProxyRequest = await req.json();

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: "Endpoint not allowed" }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const queryString = new URLSearchParams(params).toString();
    const apiUrl = `${FLEET_API_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`;

    const apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const responseText = await apiResponse.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError);
      data = { error: "Invalid JSON response", raw: responseText };
    }

    return new Response(
      JSON.stringify(data),
      {
        status: apiResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Proxy error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to proxy request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
