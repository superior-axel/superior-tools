export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const cookie = req.headers.get("cookie") || req.headers.get("Cookie");

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

    const results = await fetchContractbyLeadId(raw, cookie);

    return Response.json({ results });
  } catch (err) {
    console.error('GET /api/contract/get-by-lead error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function fetchContractbyLeadId(id, cookie) {
  try {
    const url = `https://www.fence360.net/x/v4/contracts/by-lead/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();

    const allowedStatus = ['Processing'];
    return (data.filter(contract => allowedStatus.includes(contract.status)))

  } catch (err) {
    console.error(`Error fetching contract details for ${id}:`, err.message);
    return [];
  }
}
