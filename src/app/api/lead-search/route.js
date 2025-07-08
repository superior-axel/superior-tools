export async function POST(req) {
  try {
    const { input } = await req.json();

    const names = input
      .split(/[\t\n\r]+| {2,}/)
      .map(e => e.trim())
      .filter(e => e.length > 0)
      .filter((name, _, arr) =>
        !arr.some(other => other !== name && other.includes(name))
      );

    const dedupedLeads = {};
    const queryGroups = {};

    for (const name of names) {
      await processName(name, dedupedLeads, queryGroups);
    }

    const leadMap = groupByMatchedQueries(dedupedLeads, queryGroups);
    const contractMap = await buildContractMap(leadMap);
    const results = buildResults(leadMap, contractMap);

    return Response.json({ results });
  } catch (err) {
    console.error('API Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'Cookie': process.env.FENCE360_COOKIE || '',
};




const fetchLeadsByName = async (query) => {
  const url = `https://www.fence360.net/x/v2/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    if (!res.ok) throw new Error(`Failed ${res.status}`);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
};

const fetchContractsByLeadId = async (leadId) => {
  const url = `https://www.fence360.net/x/v4/contracts/by-lead/${leadId}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    if (!res.ok) throw new Error(`Failed ${res.status}`);
    return await res.json(); // should be an array of contracts
  } catch (err) {
    console.error(`Error fetching contracts for lead ${leadId}:`, err.message);
    return [];
  }
};

const fetchContractDetails = async (contractId) => {
  const url = `https://www.fence360.net/x/v4/contracts/${contractId}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    if (!res.ok) throw new Error(`Failed to fetch contract ${contractId}`);
    return await res.json();
  } catch (err) {
    console.error(`Error fetching contract ${contractId}:`, err.message);
    return {};
  }
};


const trySubParts = async (name) => {
  const parts = name.trim().split(/\s+/);
  const allLeads = [];

  for (let i = parts.length; i > 0; i--) {
    const sub = parts.slice(0, i).join(' ');
    if (sub.length >= 3) {
        console.log(`Trying: ${sub}`)
      const res = await fetchLeadsByName(sub);
      if (res.leads && res.leads.length > 0) {
        allLeads.push({ query: sub, leads: res.leads });
        return allLeads;
      }
    }
  }

  return allLeads;
};



const processName = async (name, dedupedLeads, queryGroups) => {
  const hits = await trySubParts(name)
  for (const { query, leads } of hits) {
    for (const lead of leads) {
      const fullName = `${lead.first_name} ${lead.last_name}`
      if (!dedupedLeads[lead.id]) {
        dedupedLeads[lead.id] = {
          name: fullName,
          matchedBy: new Set([query]),
        }
      } else {
        dedupedLeads[lead.id].matchedBy.add(query)
      }

      if (!queryGroups[query]) queryGroups[query] = []
      if (!queryGroups[query].some((l) => l.id === lead.id)) {
        queryGroups[query].push({ id: lead.id, name: fullName })
      }
    }
  }
}

const groupByMatchedQueries = (dedupedLeads, queryGroups) => {
  const leadMap = {}
  for (const [id, { name, matchedBy }] of Object.entries(dedupedLeads)) {
    const queries = [...matchedBy]
    queries.sort(
      (a, b) => (queryGroups[b]?.length || 0) - (queryGroups[a]?.length || 0)
    )
    const key = queries.join(', ')
    if (!leadMap[key]) leadMap[key] = []
    leadMap[key].push({ id, name })
  }
  return leadMap
}

const buildContractMap = async (leadMap) => {
  const contractMap = {}
  for (const leadList of Object.values(leadMap)) {
    for (const lead of leadList) {
      if (contractMap[lead.id]) continue
      const contracts = await fetchContractsByLeadId(lead.id)
      const enrichedContracts = await Promise.all(
        contracts.map(async (contract) => {
          const detail = await fetchContractDetails(contract.id)
          const c = detail?.contract || {}
          const rep_price_adjustment = c.rep_price_adjustment || 0
          const ach_discount = c.ach_discount || 0
          const subtotal = c.subtotal || 0
          const discount_rate = c.discount_amount || 0
          const normalized = (1 - discount_rate) * 100
          const total = (subtotal / normalized) * 100 + rep_price_adjustment - ach_discount
          return {
            id: contract.id,
            subtotal,
            total,
            discount: {
              rep_price_adjustment,
              ach_discount,
              discount_rate,
            },
          }
        })
      )
      contractMap[lead.id] = enrichedContracts
    }
  }
  return contractMap
}

const buildResults = (leadMap, contractMap) => {
  const rows = []
  for (const [queries, leadList] of Object.entries(leadMap)) {
    for (const lead of leadList) {
      const contracts = contractMap[lead.id] || []
      if (contracts.length > 0) {
        for (const contract of contracts) {
          const discounts = contract.discount || {}
          rows.push({
            searchQuery: queries,
            leadId: lead.id,
            leadName: lead.name,
            contractId: contract.id,
            subtotal: contract.subtotal || 0,
            total: contract.total,
            repDiscount: discounts.rep_price_adjustment || 0,
            achDiscount: discounts.ach_discount || 0,
            discountRate: discounts.discount_rate || 0,
          })
        }
      } else {
        rows.push({
          searchQuery: queries,
          leadId: lead.id,
          leadName: lead.name,
          contractId: null,
          subtotal: 0,
          total: 0,
          repDiscount: 0,
          achDiscount: 0,
          discountRate: 0,
        })
      }
    }
  }
  return rows
}