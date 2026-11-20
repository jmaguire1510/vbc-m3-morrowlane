// STEP 2: Summary calculation for the three tiles.
// "This month" = the UTC calendar month of the most recent request in the data,
// not today's month (per README).
export function calculateSummary(requests) {
  const open = requests.filter((r) => r.status !== "Complete");
  const urgentOpen = open.filter((r) => r.priority === "Urgent");

  let completedThisMonth = 0;
  const timestamps = requests
    .map((r) => Date.parse(r.created_at))
    .filter((t) => !isNaN(t));

  if (timestamps.length > 0) {
    const latest = new Date(Math.max(...timestamps));
    const year = latest.getUTCFullYear();
    const month = latest.getUTCMonth();
    completedThisMonth = requests.filter((r) => {
      const d = new Date(r.created_at);
      return (
        r.status === "Complete" &&
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month
      );
    }).length;
  }

  return {
    open_requests: open.length,
    urgent_open: urgentOpen.length,
    completed_this_month: completedThisMonth,
  };
}
