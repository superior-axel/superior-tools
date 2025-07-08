import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {

  const { input } = await req.json()
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const names = input
    .split(/[\t\n\r]+| {2,}/)
    .map(e => e.trim())
    .filter(e => e.length > 0)
    .filter((name, _, arr) => !arr.some(other => other !== name && other.includes(name)))

  const AUTH_HEADERS = {
    'Content-Type': 'application/json',
    'Cookie': process.env.FENCE360_COOKIE || ''
  }

  const dedupedLeads: Record<string, any> = {}
  const queryGroups: Record<string, any[]> = {}

  const fetchLeadsByName = async (query: string) => {
    const url = `https://www.fence360.net/x/v2/search?q=${encodeURIComponent(query)}`
    try {
      const res = await fetch(url, { method: 'GET', headers: AUTH_HEADERS })
      if (!res.ok) throw new Error(`Failed ${res.status}`)
      return await res.json()
    } catch (err: any) {
      return { error: err.message }
    }
  }

  const fetchContractsByLeadId = async (leadId: string) => {
    const url = `https://www.fence360.net/x/v4/contracts/by-lead/${leadId}`
    try {
      const res = await fetch(url, { method: 'GET', headers: AUTH_HEADERS })
      if (!res.ok) throw new Error(`Failed ${res.status}`)
      return await res.json()
    } catch (err: any) {
      console.error(`Error fetching contracts for lead ${leadId}:`, err.message)
      return []
    }
  }

  const fetchContractDetails = async (contractId: string) => {
    const url = `https://www.fence360.net/x/v4/contracts/${contractId}`
    try {
      const res = await fetch(url, { method: 'GET', headers: AUTH_HEADERS })
      if (!res.ok) throw new Error(`Failed to fetch contract ${contractId}`)
      return await res.json()
    } catch (err: any) {
      console.error(`Error fetching contract ${contractId}:`, err.message)
      return {}
    }
  }

    const trySubParts = async (name: string): Promise<{ query: string; leads: any[] }[]> => {
    const parts = name.trim().split(/\s+/)
    const allLeads: { query: string; leads: any[] }[] = []

    for (let i = parts.length; i > 0; i--) {
        const sub = parts.slice(0, i).join(' ')
        if (sub.length >= 3) {
        const res = await fetchLeadsByName(sub)
        if (res.leads && res.leads.length > 0) {
            allLeads.push({ query: sub, leads: res.leads })
            return allLeads
        }
        }
    }

    return allLeads
    }

  const processName = async (name: string) => {
    const hits = await trySubParts(name)

    for (const { query, leads } of hits) {
      for (const lead of leads) {
        const fullName = `${lead.first_name} ${lead.last_name}`

        if (!dedupedLeads[lead.id]) {
          dedupedLeads[lead.id] = { name: fullName, matchedBy: new Set([query]) }
        } else {
          dedupedLeads[lead.id].matchedBy.add(query)
        }

        if (!queryGroups[query]) queryGroups[query] = []
        if (!queryGroups[query].some(l => l.id === lead.id)) {
          queryGroups[query].push({ id: lead.id, name: fullName })
        }
      }
    }
  }

  const groupByMatchedQueries = () => {
    const leadMap: Record<string, any[]> = {}

    for (const [id, { name, matchedBy }] of Object.entries(dedupedLeads)) {
      const queries = [...matchedBy as Set<string>]
      queries.sort((a, b) => (queryGroups[b]?.length || 0) - (queryGroups[a]?.length || 0))
      const key = queries.join(', ')

      if (!leadMap[key]) leadMap[key] = []
      leadMap[key].push({ id, name })
    }

    return leadMap
  }

  const buildContractMap = async (leadMap: Record<string, any[]>) => {
    const contractMap: Record<string, any[]> = {}

    for (const leadList of Object.values(leadMap)) {
      for (const lead of leadList) {
        if (contractMap[lead.id]) continue

        const contracts = await fetchContractsByLeadId(lead.id)
        const enrichedContracts = await Promise.all(
          contracts.map(async (contract: any) => {
            const detail = await fetchContractDetails(contract.id)
            const c = detail?.contract || {}

            const rep_price_adjustment = c.rep_price_adjustment || 0
            const ach_discount = c.ach_discount || 0
            const subtotal = c.subtotal || 0
            const discount_rate = c.discount_amount || 0
            const normalized_discount = (1 - discount_rate) * 100
            const total = subtotal / normalized_discount * 100 + rep_price_adjustment - ach_discount

            return {
              id: contract.id,
              subtotal,
              total,
              discount: {
                rep_price_adjustment,
                ach_discount,
                discount_rate
              }
            }
          })
        )

        contractMap[lead.id] = enrichedContracts
      }
    }

    return contractMap
  }

  // Run processing
  for (const name of names) {
    await processName(name)
  }

  const leadMap = groupByMatchedQueries()
  const contractMap = await buildContractMap(leadMap)

  const rows: any[] = []

  for (const [queries, leadList] of Object.entries(leadMap)) {
    for (const lead of leadList) {
      const contracts = contractMap[lead.id] || []

      if (contracts.length > 0) {
        for (const contract of contracts) {
          const discounts = contract.discount || {}
          rows.push({
            query: queries,
            lead_id: lead.id,
            lead_name: lead.name,
            contract_id: contract.id,
            subtotal: contract.subtotal || 0,
            total: contract.total,
            rep_discount: discounts.rep_price_adjustment || 0,
            ach_discount: discounts.ach_discount || 0,
            discount_rate: discounts.discount_rate || 0
          })
        }
      } else {
        rows.push({
          query: queries,
          lead_id: lead.id,
          lead_name: lead.name,
          contract_id: null,
          subtotal: 0,
          total: 0,
          rep_discount: 0,
          ach_discount: 0,
          discount_rate: 0
        })
      }
    }
  }

  return NextResponse.json({ results: rows })
}
