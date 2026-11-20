// STEP 5: Server-side validation for new requests.
// The browser form is a convenience; these rules are the real guarantee.

export const LOCATIONS = ["Minneapolis", "Chicago", "Denver", "Austin"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const MAX_DESCRIPTION_LENGTH = 500;

const FIELD_LABELS = {
  requester_name: "Requester name",
  location: "Location",
  description: "Description",
  priority: "Priority",
};

// Returns { error } for the first problem found (in form order),
// or { value } with the trimmed fields ready to save.
export function validateNewRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object with the request fields." };
  }

  const value = {};
  for (const field of Object.keys(FIELD_LABELS)) {
    const raw = body[field];
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return { error: `${FIELD_LABELS[field]} must be text.` };
    }
    const trimmed = (raw ?? "").trim();
    if (trimmed === "") {
      return { error: `${FIELD_LABELS[field]} is required.` };
    }
    value[field] = trimmed;
  }

  if (!LOCATIONS.includes(value.location)) {
    return { error: "Location must be Minneapolis, Chicago, Denver, or Austin." };
  }
  if (value.description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer (it is ${value.description.length}).`,
    };
  }
  if (!PRIORITIES.includes(value.priority)) {
    return { error: "Priority must be Low, Medium, High, or Urgent." };
  }

  return { value };
}
