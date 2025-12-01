import fs from "node:fs";
import path from "node:path";

/**
 * A CSV row represented as a key-value object.
 *
 * Column headers become keys, and cell values become string values.
 * All values are stored as strings; numeric conversion should be done by callers.
 */
export type CsvRow = Record<string, string>;

/**
 * Splits a CSV line into cells, handling quoted fields and escaped quotes.
 *
 * This function properly handles CSV edge cases:
 * - Quoted fields containing commas: `"Smith, John",123`
 * - Escaped quotes within fields: `"He said ""Hello"""`
 * - Fields without quotes: `Name,Age,City`
 *
 * **Algorithm**: Uses a state machine to track whether we're inside quotes.
 * When inside quotes, commas are treated as literal characters. Double quotes
 * (`""`) are treated as escaped quotes and converted to single quotes.
 *
 * @param line - A single CSV line (may contain newlines if quoted)
 * @param delimiter - The delimiter character (typically `,` or `;`)
 * @returns Array of cell values (trimmed of whitespace)
 *
 * @example
 * ```typescript
 * const cells = splitLine('"Name, Full",Age,"City, State"', ",");
 * // Returns: ["Name, Full", "Age", "City, State"]
 * ```
 */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

/**
 * Options for parsing CSV content.
 *
 * - `delimiter`: Character used to separate fields (defaults to comma)
 * - `skipEmptyLines`: Whether to ignore lines with no content (defaults to true)
 */
export interface CsvParseOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
}

/**
 * Parses CSV content into an array of row objects.
 *
 * This function converts raw CSV text into structured data suitable for RAG ingestion.
 * It handles:
 * - Header row detection (first non-empty line)
 * - Quoted fields with commas and escaped quotes
 * - Row validation (ensures all rows have the same number of columns)
 * - Empty line filtering (optional)
 *
 * **CSV format expectations**:
 * - First line must contain headers
 * - All subsequent lines must have the same number of columns as headers
 * - Fields may be quoted with double quotes
 * - Escaped quotes use double-double quotes (`""`)
 *
 * @param content - Raw CSV file content as a string
 * @param options - Parsing options (delimiter, skipEmptyLines)
 * @returns Array of CsvRow objects, one per data row
 * @throws Error if rows have inconsistent column counts
 *
 * @example
 * ```typescript
 * const csv = "Name,Age\nJohn,30\nJane,25";
 * const rows = parseCsv(csv);
 * // Returns: [{ Name: "John", Age: "30" }, { Name: "Jane", Age: "25" }]
 * ```
 */
export function parseCsv(content: string, options: CsvParseOptions = {}): CsvRow[] {
  const delimiter = options.delimiter ?? ",";
  const skipEmptyLines = options.skipEmptyLines ?? true;
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => (skipEmptyLines ? line.length > 0 : true));

  if (lines.length === 0) {
    return [];
  }

  const headers = splitLine(lines[0], delimiter);
  return lines.slice(1).map((line, rowIndex) => {
    const values = splitLine(line, delimiter);
    if (values.length !== headers.length) {
      throw new Error(`Row ${rowIndex + 1} has ${values.length} values, expected ${headers.length}`);
    }
    return headers.reduce<CsvRow>((row, header, idx) => {
      row[header] = values[idx];
      return row;
    }, {});
  });
}

/**
 * Loads and parses a CSV file from disk.
 *
 * This is a convenience function that combines file reading and CSV parsing.
 * It resolves the file path, checks for existence, reads the file as UTF-8,
 * and parses it into row objects.
 *
 * @param filePath - Path to the CSV file (relative or absolute)
 * @param options - Parsing options (delimiter, skipEmptyLines)
 * @returns Array of CsvRow objects parsed from the file
 * @throws Error if the file doesn't exist or contains invalid CSV
 *
 * @example
 * ```typescript
 * const rows = loadCsv("./data/companies.csv");
 * // Returns array of row objects with company data
 * ```
 */
export function loadCsv(filePath: string, options: CsvParseOptions = {}): CsvRow[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`CSV file not found at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  return parseCsv(raw, options);
}

