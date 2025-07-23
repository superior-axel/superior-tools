import { fetchJobById } from "../../job/search/route";
import { fetchContractbyId } from "../../contract/search/route";

/**
 * GET /api/contract/search
 * 
 * Fetches job and contract details based on a given customer name.
 * The flow involves:
 *  1. Verifying the bearer token
 *  2. Searching for a lead via the external API
 *  3. Validating that the lead is an exact match
 *  4. Getting the associated contract by lead ID
 *  5. Fetching the full contract and job details
 *  6. Extracting job flags and rep pricing adjustments
 * 
 * Query Parameters:
 * - name: string (Customer name to search)
 * 
 * Headers:
 * - Authorization: Bearer token (must match API_SECRET)
 * - Cookie: Required for fetch authentication
 * 
 * Response:
 * {
 *   leadId,
 *   leadSurname,
 *   contractId,
 *   contractAmount,
 *   jobId,
 *   jobFlags,
 *   outsideRep,
 *   discountAmount,
 *   discountDesc
 * }
 */

export async function GET(req) {
  try {
    // Step 0: Authorization
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const cookie = req.headers.get("cookie") || req.headers.get("Cookie");

    if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract customer name from query
    const { searchParams } = new URL(req.url);
    const customerName = searchParams.get('name');

    // Step 2: Fetch lead by name
    const leadResponse = await fetch(`https://superior-tools.vercel.app/api/lead/search?names=${encodeURIComponent(customerName)}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Cookie": cookie
      }
    });

    if (!leadResponse.ok) {
      throw new Error(`Lead fetch failed with status ${leadResponse.status}`);
    }

    const leadData = await leadResponse.json();
    const matchStatus = leadData.results?.[0]?.status;
    const matchedLead = leadData.results?.[0]?.leads?.[0];

    // Step 3: Validate exact match
    if (matchStatus !== 'exact match') {
      return new Response(
        JSON.stringify({ error: 'Customer name is not an exact match' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!matchedLead?.id) {
      return new Response(
        JSON.stringify({ error: 'Lead ID not found in response' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const leadId = matchedLead.id;

    // Step 4: Fetch contracts by lead ID
    const contractsResponse = await fetch(`https://superior-tools.vercel.app/api/contract/get-by-lead?id=${encodeURIComponent(leadId)}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Cookie": cookie
      }
    });

    if (!contractsResponse.ok) {
      throw new Error(`Contract fetch failed with status ${contractsResponse.status}`);
    }

    const contractList = await contractsResponse.json();

    // Validate exactly one contract
    if (!contractList.results || contractList.results.length !== 1) {
      return new Response(
        JSON.stringify({ error: 'No contract or multiple contracts found for this lead' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contractId = contractList.results[0].id;

    // Step 5: Fetch full contract details
    const contractData = await fetchContractbyId(contractId, cookie);

    const associatedJobId = contractData.job_flags?.[0]?.job_id;
    if (!associatedJobId) {
      return new Response(
        JSON.stringify({ error: 'Job ID not found in contract' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Fetch full job details
    const jobData = await fetchJobById(associatedJobId, cookie);

    // Step 7: Extract latest job flag
    let jobFlags = null;
    const contractFlags = contractData?.job_flags?.[0]?.flags;
    if (Array.isArray(contractFlags) && contractFlags.length > 0) {
      jobFlags = contractFlags[contractFlags.length - 1];
    } else {
      jobFlags = "No flags found";
    }

    // Step 8: Final result response
    const result = {
      leadId: jobData?.lead_id,
      leadSurname: jobData?.lead?.lastName,
      contractId: jobData?.contract_id,
      contractAmount: jobData?.contract_amount,
      jobId: jobData?.id,
      jobFlags: jobFlags,
      outsideRep: jobData?.lead?.outsideRep,
      discountAmount: contractData?.estimate_package_calculation_result?.rep_price_adjustment,
      discountDesc: contractData?.estimate_package_calculation_result?.rep_price_discount_description
    };

    return Response.json({ result });

  } catch (err) {
    console.error('GET /api/contract/search error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
