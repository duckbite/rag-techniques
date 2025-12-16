import fs from "node:fs";
import path from "node:path";
import { logger } from "../../../shared/typescript/utils/logging";
import type { BookingCsvRow } from "./types";

/**
 * Escape a single value for safe inclusion in a CSV file.
 *
 * The algorithm follows RFC 4180-style rules:
 * - Values containing commas, quotes or newlines are wrapped in double quotes.
 * - Double quotes inside values are escaped by doubling them.
 */
function escapeCsvValue(value: string): string {
  if (value.includes('"')) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  if (value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value}"`;
  }

  return value;
}

/**
 * Convert a typed CSV row into a line of comma-separated values.
 *
 * Numeric fields are rendered as plain numbers (no quotes) and booleans as
 * `"true"` / `"false"`. Optional fields use the empty string when absent,
 * which keeps the schema stable for downstream consumers.
 */
function formatRow(row: BookingCsvRow, headers: string[]): string {
  const cells = headers.map((header) => {
    const value = (row as unknown as Record<string, unknown>)[header];

    if (value === "" || value === undefined || value === null) {
      return "";
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value.toString() : "";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return String(value);
  });

  return cells.map(escapeCsvValue).join(",");
}

/**
 * Write an array of `BookingCsvRow` objects to a CSV file.
 *
 * This helper ensures the directory exists, overwrites any existing file,
 * and logs a short summary when finished.
 *
 * @param rows - Flattened hotel/room rows to persist.
 * @param absolutePath - Absolute path to the CSV file.
 */
export function writeBookingCsv(rows: BookingCsvRow[], absolutePath: string): void {
  const headers: (keyof BookingCsvRow)[] = [
    "hotelId",
    "hotelName",
    "hotelAddress",
    "city",
    "postalCode",
    "addressRegion",
    "country",
    "hotelRating",
    "reviewCount",
    "latitude",
    "longitude",
    "hotelUrl",
    "description",
    "roomName",
    "maxOccupancyText",
    "maxOccupancy",
    "bedTypes",
    "roomHighlights",
    "includedFacilities",
    "priceCurrent",
    "pricePerNight",
    "priceOriginal",
    "currency",
    "priceText",
    "cancellationPolicy",
    "mealPlan",
    "scrapedAt"
  ];

  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lines = [
    headers.join(","),
    ...rows.map((row) => formatRow(row, headers as string[]))
  ];

  fs.writeFileSync(absolutePath, `${lines.join("\n")}\n`, "utf-8");

  logger.info("Wrote Booking.com hotel CSV", {
    path: absolutePath,
    rowCount: rows.length
  });
}


