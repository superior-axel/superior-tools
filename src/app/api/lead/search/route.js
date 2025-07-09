export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('names');

    if (!raw || raw.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid names' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const inputNames = Array.from(new Set(
      raw
        .split(/[\t\n]+| {2,}/)               // split on tabs, newlines, or 2+ spaces
        .flatMap(entry =>
          entry
            .split(/\/| - | -|-/)             // split names on "/", " - ", "-" and variations
            .map(name => name.trim())
            .filter(name => {
              // Strip trailing "-D"
              if (name.endsWith("-D")) name = name.slice(0, -2).trim();
              // Only keep full names with at least two words
              return name.split(" ").length >= 2;
            })
        )
    ));

    const results = [];

    for (const name of inputNames) {
      const parts = name.split(/\s+/);
      let leads = [];
      let flag = 'no match';

      for (let i = parts.length; i > 0; i--) {
        const sub = parts.slice(0, i).join(' ');
        const fetched = await fetchLeadByName(sub);

        if (fetched.length > 0) {
          leads = fetched;
          flag = i === parts.length ? 'exact match' : 'partial match';
          break;
        }
      }

      results.push({ query: name, status: flag, leads });
    }

    return Response.json({ count: results.length, results });
  } catch (err) {
    console.error('GET /api/lead/search-multiple error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
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
