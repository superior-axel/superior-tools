export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const raw = searchParams.get('id');

    if (!raw || raw.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = await fetchContractbyId(raw);

    return Response.json({ results });
  } catch (err) {
    console.error('GET /api/lead/search-multiple error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function fetchContractbyId(id) {
  try {
    const url = `https://www.fence360.net/x/v4/contracts/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.FENCE360_COOKIE || '',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();

    return (data);

  } catch (err) {
    console.error(`Error fetching contract details for ${id}:`, err.message);
    return [];
  }
}
