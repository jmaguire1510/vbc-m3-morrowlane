import { promises as fs } from "fs";
import path from "path";
import { csvToObjects } from "./csv";

const SEED_FILE = path.join(process.cwd(), "data", "seed-requests.csv");

// STEP 2: Read requests from the seed CSV.
// The CSV has no id column, so ids are assigned 1..N in file order.
export async function getAllRequests() {
  const text = await fs.readFile(SEED_FILE, "utf8");
  const records = csvToObjects(text).map((row, index) => ({
    id: index + 1,
    created_at: row.created_at,
    requester_name: row.requester_name,
    location: row.location,
    description: row.description,
    priority: row.priority,
    status: row.status,
  }));
  return sortNewestFirst(records);
}

export function sortNewestFirst(records) {
  return [...records].sort((a, b) => {
    const diff = Date.parse(b.created_at) - Date.parse(a.created_at);
    return diff !== 0 ? diff : b.id - a.id;
  });
}
