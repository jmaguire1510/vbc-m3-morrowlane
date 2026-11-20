// STEP 2: CSV parsing for the seed data.
// Handles quoted fields (some descriptions contain commas) and "" escapes.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop blank lines.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

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

// Turns parsed rows into objects keyed by the header row.
export function csvToObjects(text) {
  const [header, ...rows] = parseCsv(text);
  return rows.map((values) => {
    const record = {};
    header.forEach((name, index) => {
      record[name.trim()] = values[index] ?? "";
    });
    return record;
  });
}

// STEP 6: Build a whole CSV document (header + rows), CRLF line endings.
export function toCsv(columns, records) {
  const lines = [columns.join(",")].concat(
    records.map((r) => toCsvRow(columns.map((c) => r[c])))
  );
  return lines.join("\r\n") + "\r\n";
}
