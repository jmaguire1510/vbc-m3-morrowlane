import { getAllRequests } from "../../../lib/requests-store";
import { calculateSummary } from "../../../lib/summary";

// STEP 2: GET summary endpoint — feeds the three tiles.

export async function GET() {
  try {
    const requests = await getAllRequests();
    return Response.json(calculateSummary(requests), { status: 200 });
  } catch (error) {
    console.error("GET /api/summary failed:", error);
    return Response.json(
      { error: "Could not load the summary. Please try again." },
      { status: 500 }
    );
  }
}
