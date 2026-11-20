import { promises as fs } from "fs";
import path from "path";
import { csvToObjects, toCsvRow } from "./csv";

const SEED_FILE = path.join(process.cwd(), "data", "seed-requests.csv");
// STEP 3: Local storage file. Created from the seed data on the first save;
// new requests are appended as the last row.
const ENTRIES_FILE = path.join(process.cwd(), "data", "entries.csv");

const COLUMNS = [
  "id",
  "created_at",
  "requester_name",
  "location",
  "description",
  "priority",
  "status",
];

function toRecord(row, fallbackId) {
  return {
    id: row.id ? Number(row.id) : fallbackId,
    created_at: row.created_at,
    requester_name: row.requester_name,
    location: row.location,
    description: row.description,
    priority: row.priority,
    status: row.status,
  };
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// STEP 2: Read requests. The seed CSV has no id column, so ids are assigned
// 1..N in file order. STEP 3: once entries.csv exists, it is the source of truth.
async function loadRecords() {
  if (await fileExists(ENTRIES_FILE)) {
    const text = await fs.readFile(ENTRIES_FILE, "utf8");
    return csvToObjects(text).map((row) => toRecord(row));
  }
  const text = await fs.readFile(SEED_FILE, "utf8");
  return csvToObjects(text).map((row, index) => toRecord(row, index + 1));
}

export async function getAllRequests() {
  return sortNewestFirst(await loadRecords());
}

export function sortNewestFirst(records) {
  return [...records].sort((a, b) => {
    const diff = Date.parse(b.created_at) - Date.parse(a.created_at);
    return diff !== 0 ? diff : b.id - a.id;
  });
}

// STEP 3: Save a new request to data/entries.csv.
export async function createRequest(fields) {
  const records = await loadRecords();

  // First save: copy the seed rows (with their ids) into entries.csv.
  if (!(await fileExists(ENTRIES_FILE))) {
    const lines = [COLUMNS.join(",")].concat(
      records.map((r) => toCsvRow(COLUMNS.map((c) => r[c])))
    );
    await fs.writeFile(ENTRIES_FILE, lines.join("\n") + "\n", "utf8");
  }

  const nextId = records.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const record = {
    id: nextId,
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    requester_name: fields.requester_name,
    location: fields.location,
    description: fields.description,
    priority: fields.priority,
    status: "New",
  };

  await fs.appendFile(
    ENTRIES_FILE,
    toCsvRow(COLUMNS.map((c) => record[c])) + "\n",
    "utf8"
  );
  return record;
}
