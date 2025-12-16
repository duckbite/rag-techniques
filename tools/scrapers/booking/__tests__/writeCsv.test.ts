import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { BookingCsvRow } from "../types";
import { writeBookingCsv } from "../writeCsv";

describe("writeBookingCsv", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "booking-csv-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes header and rows with proper types", () => {
    const rows: BookingCsvRow[] = [
      {
        hotelId: "sample-hotel.en-gb",
        hotelName: "Sample Hotel",
        hotelAddress: "Main Street 1, Den Bosch",
        postalCode: "",
        addressRegion: "",
        city: "Den Bosch",
        country: "Netherlands",
        hotelRating: 8.7,
        reviewCount: 1234,
        latitude: "",
        longitude: "",
        hotelUrl: "https://www.booking.com/hotel/nl/sample-hotel.en-gb.html",
        description: "",
        roomName: "Double Room",
        maxOccupancyText: "Max. people: 2",
        maxOccupancy: 2,
        bedTypes: "",
        roomHighlights: "Free WiFi; Parking",
        includedFacilities: "",
        priceCurrent: 129,
        pricePerNight: 129,
        priceOriginal: "",
        currency: "EUR",
        priceText: "€ 129",
        cancellationPolicy: "Free cancellation",
        mealPlan: "",
        scrapedAt: "2025-12-16T00:00:00.000Z"
      }
    ];

    const target = path.join(tempDir, "booking-data.csv");
    writeBookingCsv(rows, target);

    const content = fs.readFileSync(target, "utf-8").trim();
    const lines = content.split("\n");
    expect(lines.length).toBe(2);

    const header = lines[0];
    expect(header).toContain("hotelId");
    expect(header).toContain("pricePerNight");

    const row = lines[1];
    expect(row).toContain("sample-hotel.en-gb");
    expect(row).toContain("129");
    expect(row).toContain("Free cancellation");
  });
});


