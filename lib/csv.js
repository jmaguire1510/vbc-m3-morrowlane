// CSV writing for the export. (The STEP 2 CSV reader was removed in STEP 9,
// when storage moved from CSV files to Supabase.)

// STEP 3: Write one CSV row. Quotes any value containing a comma, quote, or
// line break, doubling inner quotes.
export function toCsvRow(values) {
  return values
    .map((value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    })
    .join(",");
}

// STEP 6: Build a whole CSV document (header + rows), CRLF line endings.
export function toCsv(columns, records) {
  const lines = [columns.join(",")].concat(
    records.map((r) => toCsvRow(columns.map((c) => r[c])))
  );
  return lines.join("\r\n") + "\r\n";
}
