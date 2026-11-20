import { getAllRequests, COLUMNS } from "../../../lib/requests-store";
import { toCsv } from "../../../lib/csv";

// STEP 6: CSV export — all requests, newest first, downloaded as a file.
export async function GET() {
  try {
    const requests = await getAllRequests();
    // The leading UTF-8 byte-order mark lets Excel show characters like "—"
    // correctly; other spreadsheet tools ignore it.
    const csv = "﻿" + toCsv(COLUMNS, requests);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="morrowlane-requests.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/export failed:", error);
    return Response.json(
      { error: "Could not export requests. Please try again." },
      { status: 500 }
    );
  }
}
