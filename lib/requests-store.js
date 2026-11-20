import { createClient } from "@supabase/supabase-js";

// STEP 9: Supabase persistence. Replaces the local CSV file (data/entries.csv),
// which cannot be written on Netlify (EROFS — see BUILD_LOG Step 7).
// The function names and record shapes are unchanged, so the API routes and
// front end keep the same contract.

const TABLE = "requests";

export const COLUMNS = [
  "id",
  "created_at",
  "requester_name",
  "location",
  "description",
  "priority",
  "status",
];

let client = null;

// Server-only: these variables have no NEXT_PUBLIC_ prefix, so Next.js never
// sends them to the browser. SUPABASE_ANON_KEY is the public (anon /
// publishable) key — never the service-role key.
function getClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Supabase returns timestamps like "2026-07-16T14:20:00+00:00" (sometimes with
// fractions of a second). Keep the API's "2026-07-16T14:20:00Z" format.
function toRecord(row) {
  return {
    id: Number(row.id),
    created_at: new Date(row.created_at).toISOString().replace(/\.\d{3}Z$/, "Z"),
    requester_name: row.requester_name,
    location: row.location,
    description: row.description,
    priority: row.priority,
    status: row.status,
  };
}

function check(error, action) {
  if (error) {
    throw new Error(`Supabase ${action} failed: ${error.message}`);
  }
}

// STEP 2 contract: every request, newest first.
export async function getAllRequests() {
  const { data, error } = await getClient()
    .from(TABLE)
    .select(COLUMNS.join(","))
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  check(error, "select");
  return data.map(toRecord);
}

// STEP 3 contract: save a new request. Only the four form fields are sent;
// the database assigns id, created_at and status = 'New'.
export async function createRequest(fields) {
  const { data, error } = await getClient()
    .from(TABLE)
    .insert({
      requester_name: fields.requester_name,
      location: fields.location,
      description: fields.description,
      priority: fields.priority,
    })
    .select(COLUMNS.join(","))
    .single();
  check(error, "insert");
  return toRecord(data);
}

// STEP 6 contract: update one request's status. Returns the updated record,
// or null if no request has that id.
export async function updateRequestStatus(id, status) {
  const { data, error } = await getClient()
    .from(TABLE)
    .update({ status })
    .eq("id", id)
    .select(COLUMNS.join(","));
  check(error, "update");
  return data.length > 0 ? toRecord(data[0]) : null;
}
