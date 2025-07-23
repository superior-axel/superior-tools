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

    const jobId = searchParams.get('id');

    if (!jobId || jobId.trim().length < 1) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid job id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const job = await fetchJobById(jobId, cookie);

    return Response.json({ job });
  } catch (err) {
    console.error('GET /api/job/fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function fetchJobById(id, cookie) {
  try {
    const url = `https://www.fence360.net/x/v5/jobs/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
      },
    });

    if (!res.ok) {
      console.error(`Failed to fetch job ${id}: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`Error fetching job ${id}:`, err.message);
    return null;
  }
}
