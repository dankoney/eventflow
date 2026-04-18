/** Escape a field for CSV (RFC-style, quoted if needed). */
export function csvEscape(value: string): string {
  const s = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return `${head}\r\n${body}`;
}

/** Parse CSV (one row per line; supports quoted fields). */
export function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length > 0);
  return lines.map(parseCsvLine);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        q = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      q = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
