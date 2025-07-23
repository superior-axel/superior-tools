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

    const body = await req.json();

    if (!Array.isArray(body)) {
      return new Response(
        JSON.stringify({ error: "Invalid input. Expected an array." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create parallel promises for each input
    const resultPromises = body.map(async ({ row, customerName }) => {
      const customer = customerName || "";

      try {
        let url = "";
        const jobIdMatch = customer.match(/Job\s*#(\d+)/i);

        if (jobIdMatch) {
          // Use jobId-based endpoint
          const jobId = jobIdMatch[1];
          url = `localhost:3000/api/validate/by-job-id?id=${jobId}`;
        } else {
          // Use customer name-based endpoint
          url = `localhost:3000/api/contract/by-lead-name?name=${encodeURIComponent(customer)}`;
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
          return {
            row,
            customer,
            result: { error: `Failed (${res.status})`, detail: errorDetail }
          };
        }

        const data = await res.json();

        return {
          row,
          customer,
          result: data.result ?? data
        };

      } catch (err) {
        return {
          row,
          customer,
          result: { error: "Exception", detail: err.message }
        };
      }
    });

    const results = await Promise.all(resultPromises);

    return new Response(
      JSON.stringify(results),
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
