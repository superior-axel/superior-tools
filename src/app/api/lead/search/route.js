export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.LEAD_API_SECRET;

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return jsonError("Unauthorized", 401);
    }

    const url = new URL(req.url);
    const raw = url.searchParams.get("names");

    if (!isValidNamesParam(raw)) {
      return jsonError("Missing or invalid names", 400);
    }

    const inputNames = parseInputNames(raw);
    const results = await Promise.all(inputNames.map(processNameQuery));

    return Response.json({ count: results.length, results });
  } catch (err) {
    console.error("GET /api/lead/search-multiple error:", err);
    return jsonError("Internal server error", 500, err.message);
  }
}



function isValidNamesParam(param) {
  return param && param.trim().length >= 3;
}

function parseInputNames(raw) {
  const splitPattern = /[\t\n]+| {2,}/;
  const subSplitPattern = /\/| - | -|-/;

  const cleaned = raw
    .split(splitPattern)
    .flatMap(entry =>
      entry
        .split(subSplitPattern)
        .map(name => name.trim())
        .map(stripDashD)
        .filter(name => name.split(" ").length >= 2)
    );

  return Array.from(new Set(cleaned));
}

function stripDashD(name) {
  return name.endsWith("-D") ? name.slice(0, -2).trim() : name;
}

async function processNameQuery(name) {
  const parts = name.split(/\s+/);
  let leads = [];
  let status = "no match";

  for (let i = parts.length; i > 0; i--) {
    const sub = parts.slice(0, i).join(" ");
    const fetched = await fetchLeadByName(sub);

    if (fetched.length > 0) {
      leads = fetched;
      status = i === parts.length ? "exact match" : "partial match";
      break;
    }
  }

  return { query: name, status, leads };
}

function jsonError(message, status = 500, detail) {
  return new Response(
    JSON.stringify({ error: message, ...(detail && { detail }) }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function fetchLeadByName(name) {
  try {
    const url = `https://www.fence360.net/x/v2/search?q=${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.FENCE360_COOKIE || '',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();

    return (data.leads || []).filter(lead => lead.track_state === 13 || lead.track_state === 14);

  } catch (err) {
    console.error(`Error fetching leads for ${name}:`, err.message);
    return [];
  }
}
