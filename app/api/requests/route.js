import { getAllRequests, createRequest } from "../../../lib/requests-store";

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
// (Server-side validation is added in Step 5.)
export async function POST(request) {
  try {
    const body = await request.json();
    const saved = await createRequest({
      requester_name: body.requester_name,
      location: body.location,
      description: body.description,
      priority: body.priority,
    });
    return Response.json({ request: saved }, { status: 201 });
  } catch (error) {
    console.error("POST /api/requests failed:", error);
    return Response.json(
      { error: "Could not save the request. Please try again." },
      { status: 500 }
    );
  }
}
