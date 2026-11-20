import { getAllRequests, createRequest } from "../../../lib/requests-store";
import { validateNewRequest } from "../../../lib/validation";

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

// STEP 3: POST request handling — save a new request with status "New".
export async function POST(request) {
  try {
    // STEP 5: Server-side validation — reject bad input with 400 before saving.
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }
    const { error, value } = validateNewRequest(body);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const saved = await createRequest(value);
    return Response.json({ request: saved }, { status: 201 });
  } catch (error) {
    console.error("POST /api/requests failed:", error);
    return Response.json(
      { error: "Could not save the request. Please try again." },
      { status: 500 }
    );
  }
}
