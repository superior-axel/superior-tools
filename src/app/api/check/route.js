// app/api/lead/search/route.js
import { NextRequest } from "next/server";

export async function POST(req) {
  try {
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    const cookie = req.headers.get("cookie") || req.headers.get("Cookie") || "";

    if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Missing body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = sanitizeData(body);
    const candidates = buildCandidates(data);

    if (candidates.length === 0) {
      return Response.json({
        status: "not found",
        matches: [],
        note: "No usable search terms could be derived from the input.",
      });
    }

    // Run all searches in parallel
    const results = await Promise.all(
      candidates.map(async (c) => {
        const leads = await fetchLeadByName(c.term, cookie);
        const count = Array.isArray(leads) ? leads.length : 0;
        return { ...c, count };
      })
    );

    const exact = results.filter((r) => r.count === 1);
    const multi = results.filter((r) => r.count > 1);

    let status = "not found";
    if (exact.length > 0) status = "found";
    else if (multi.length > 0) status = "maybe";

    const matches = status === "found" ? exact : status === "maybe" ? multi : [];

    return Response.json({
      status,
      matches: matches.map(({ category, key, term, count }) => ({
        category,
        key,
        term,
        count,
      })),
    });
  } catch (err) {
    console.error("POST /api/lead/search error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: err?.message || String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ---------------- Helpers -----------------

export async function fetchLeadByName(name, cookie) {
  try {
    const url = `https://www.fence360.net/x/v2/search?q=${encodeURIComponent(
      name
    )}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie || "",
      },
    });

    if (!res.ok) return [];

    const data = await res.json();

    const allowedTrackStates = [4, 13, 14];
    return (data.leads || []).filter((lead) =>
      allowedTrackStates.includes(lead.track_state)
    );
  } catch (err) {
    console.error(`Error fetching leads for ${name}:`, err.message);
    return [];
  }
}

function sanitizeData(input) {
  const clean = (v) =>
    typeof v === "string" ? v.trim() : v == null ? null : String(v).trim();

  return {
    first_name: clean(input.first_name) || null,
    last_name: clean(input.last_name) || null,
    personal_address: clean(input.personal_address) || null,
    personal_city: clean(input.personal_city) || null,
    personal_state: clean(input.personal_state) || null,
    personal_zip: clean(input.personal_zip) || null,
    mobile_phone: clean(input.mobile_phone) || null,
    personal_phone: clean(input.personal_phone) || null,
    business_email: clean(input.business_email) || null,
    personal_emails: clean(input.personal_emails) || null,
    deep_verified_emails: clean(input.deep_verified_emails) || null,
  };
}

function buildCandidates(data) {
  const out = [];
  const push = (category, key, term) => {
    const t = normalizeTerm(category, term);
    if (t) out.push({ category, key, term: t });
  };

  // name: first + last
  if (data.first_name && data.last_name) {
    push("name", "first_name+last_name", `${data.first_name} ${data.last_name}`);
  }

  // address: personal_address + city
  if (data.personal_address && data.personal_city) {
    push(
      "address",
      "personal_address+personal_city",
      `${data.personal_address} ${data.personal_city}`
    );
  }

  // emails
  const emailVals = splitList(data.business_email)
    .concat(splitList(data.personal_emails))
    .concat(splitList(data.deep_verified_emails));
  unique(emailVals)
    .map((e) => e.toLowerCase())
    .forEach((e) => push("email", whichEmailKey(e, data), e));

  // phones
  const phoneVals = unique(
    splitList(data.mobile_phone).concat(splitList(data.personal_phone))
  )
    .map(normalizePhone)
    .filter(Boolean);
  phoneVals.forEach((p) => push("phone", whichPhoneKey(p, data), p));

  return dedupeCandidates(out);
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .flatMap((s) => s.split(/\s+/g))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function normalizePhone(raw) {
  const plus = raw.trim().startsWith("+") ? "+" : "";
  const digits = raw.replace(/\D+/g, "");
  return (plus + digits).replace(/^\+?0+(?=\d)/, plus ? "+" : "");
}

function normalizeTerm(category, term) {
  if (!term) return null;
  const t = term.trim();
  if (!t) return null;

  if (category === "email") return t.toLowerCase();
  if (category === "phone") return normalizePhone(t);
  return t.replace(/\s+/g, " ").trim();
}

function whichEmailKey(email, data) {
  const inBusiness = containsInList(email, data.business_email);
  const inPersonal = containsInList(email, data.personal_emails);
  const inDeep = containsInList(email, data.deep_verified_emails);
  const parts = [];
  if (inBusiness) parts.push("business_email");
  if (inPersonal) parts.push("personal_emails");
  if (inDeep) parts.push("deep_verified_emails");
  return parts.join("|") || "email";
}

function whichPhoneKey(phone, data) {
  const inMobile = containsInList(phone, data.mobile_phone, true);
  const inPersonal = containsInList(phone, data.personal_phone, true);
  const parts = [];
  if (inMobile) parts.push("mobile_phone");
  if (inPersonal) parts.push("personal_phone");
  return parts.join("|") || "phone";
}

function containsInList(value, list, isPhone = false) {
  if (!list) return false;
  const norm = isPhone ? normalizePhone(value) : value.toLowerCase();
  return splitList(list).some(
    (item) =>
      (isPhone ? normalizePhone(item) : item.toLowerCase()) === norm
  );
}

function dedupeCandidates(cands) {
  const seen = new Set();
  const out = [];
  for (const c of cands) {
    const key = `${c.category}:${c.term}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}
