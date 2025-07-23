/**
 *
 * Batch validation endpoint that processes an array of customer names or job identifiers.
 * Determines if each entry should be validated using job ID or customer name, and performs
 * all validations in parallel. Results are returned as a map keyed by `row`.
 *
 * Input: Array of objects:
 * [
 *   { row: 0, customerName: "Amanda Myers" },
 *   { row: 1, customerName: "Steve Walsh - Job #123456" }
 * ]
 *
 * Output:
 * {
 *   "0": { customer: "Amanda Myers", result: { ... } },
 *   "1": { customer: "Steve Walsh - Job #123456", result: { ... } }
 * }
 */

export async function POST(req) {
  try {
    // Extract headers
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const cookie = req.headers.get("cookie") || req.headers.get("Cookie");

    if (!authHeader || !cookie) {
      return new Response(
        JSON.stringify({ error: "Missing authorization or cookie headers" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse and validate body
    const body = await req.json();
    if (!Array.isArray(body)) {
      return new Response(
        JSON.stringify({ error: "Invalid input. Expected an array." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const BASE_URL = "https://superior-tools.vercel.app";

    // Process entries in parallel
    const resultPromises = body.map(async ({ row, customerName }) => {
      const customer = customerName || "";

      try {
        let url = "";
        const jobIdMatch = customer.match(/Job\s*#(\d+)/i);

        if (jobIdMatch) {
          const jobId = jobIdMatch[1];
          url = `${BASE_URL}/api/validate/by-job-id?id=${jobId}`;
        } else {
          url = `${BASE_URL}/api/validate/by-lead-name?name=${encodeURIComponent(customer)}`;
        }

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Cookie: cookie
          }
        });

        if (!res.ok) {
          const errorDetail = await res.json().catch(() => ({}));
          return [row, {
            customer,
            result: { error: `Failed (${res.status})`, detail: errorDetail }
          }];
        }

        const data = await res.json();
        return [row, {
          customer,
          result: data.result ?? data
        }];

      } catch (err) {
        return [row, {
          customer,
          result: { error: "Exception", detail: err.message }
        }];
      }
    });

    const resultEntries = await Promise.all(resultPromises);

    // Convert array of [row, result] into a map object
    const resultMap = Object.fromEntries(resultEntries);

    return new Response(
      JSON.stringify(resultMap),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("POST /api/contract/batch error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
