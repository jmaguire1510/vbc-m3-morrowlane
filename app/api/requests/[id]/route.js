import { updateRequestStatus } from "../../../../lib/requests-store";
import { validateStatusUpdate } from "../../../../lib/validation";

// STEP 6: PATCH /api/requests/[id] — update one request's status.
export async function PATCH(request, { params }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const { error, value: status } = validateStatusUpdate(body);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const { id: rawId } = await params;
    const id = Number(rawId);
    const updated = Number.isInteger(id)
      ? await updateRequestStatus(id, status)
      : null;
    if (!updated) {
      return Response.json(
        { error: `No request found with id ${rawId}.` },
        { status: 404 }
      );
    }

    return Response.json({ request: updated }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/requests/[id] failed:", error);
    return Response.json(
      { error: "Could not update the status. Please try again." },
      { status: 500 }
    );
  }
}
