import { fetchJobById } from "../../job/search/route";
import { fetchContractbyId } from "../../contract/search/route";

/**
 * 
 * This endpoint retrieves job and contract details based on a given job ID.
 * It validates the request using a bearer token, fetches the job, fetches the contract tied to it,
 * and extracts key summary information including lead, contract amount, rep discount, and job flags.
 * 
 * Query Parameters:
 * - id: string (Job ID to look up)
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
    // Extract and validate headers
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const cookie = req.headers.get("cookie") || req.headers.get("Cookie");

    // Unauthorized if token doesn't match secret
    if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse job ID from query string
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing job ID in query' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch job details
    const jobData = await fetchJobById(jobId, cookie);
    if (!jobData) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch associated contract
    const contractData = await fetchContractbyId(jobData.contract_id, cookie);
    if (!contractData) {
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get most recent job flag if available
    let jobFlags = null;
    const contractFlags = contractData?.job_flags?.[0]?.flags;
    if (Array.isArray(contractFlags) && contractFlags.length > 0) {
      jobFlags = contractFlags[contractFlags.length - 1]; // last flag in the array
    } else {
      jobFlags = "No flags found";
    }

    // Construct response
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
