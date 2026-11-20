import { getAllRequests } from "../../../lib/requests-store";

// STEP 2: GET requests endpoint — every request, newest first.
export async function GET() {
  try {
    const requests = await getAllRequests();
    return Response.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/requests failed:", error);
    return Response.json(
      { error: "Could not load requests. Please try again." },
      { status: 500 }
    );
  }
}
