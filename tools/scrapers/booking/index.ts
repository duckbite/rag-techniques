import fs from "node:fs";
import path from "node:path";
import { logger } from "../../../shared/typescript/utils/logging";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { parseListingPage } from "./parseListing";
import { parseHotelSnapshot, parseHotelRoomsSnapshot } from "./parseHotel";
import type { BookingCsvRow, Hotel, Room } from "./types";
import { writeBookingCsv } from "./writeCsv";
import { launchBrowser, loadPageHtml } from "./browser";

async function collectHotelsFromListingSnapshot(): Promise<Hotel[]> {
  const city = "Den Bosch";
  const country = "Netherlands";
  const snapshotPath = path.resolve(__dirname, "snapshots/hotels_in_den_bosch.html");

  if (!fs.existsSync(snapshotPath)) return [];

  logger.info("Loading listing snapshot from disk", { snapshotPath });
  const html = fs.readFileSync(snapshotPath, "utf-8");
  const { hotels } = parseListingPage(html, city, country);
  logger.info("Collected hotels for Den Bosch", { count: hotels.length });
  return hotels;
}

async function collectHotelsFromDetailSnapshots(): Promise<Hotel[]> {
  const dir = path.resolve(__dirname, "snapshots");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".html") && f !== ".ds_store");

  const hotels: Hotel[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const urlGuess = `https://www.booking.com/hotel/${file.replace(".html", "")}.html`;
    const html = fs.readFileSync(fullPath, "utf-8");
    const hotel = parseHotelSnapshot(html, urlGuess);
    if (hotel) {
      hotels.push(hotel);
    }
  }
  logger.info("Collected hotels from detail snapshots", { count: hotels.length });
  return hotels;
}

async function buildRowsFromHotelAndRooms(hotel: Hotel, rooms: Room[], scrapedAt: string): Promise<BookingCsvRow[]> {
  if (rooms.length === 0) {
    return [
      {
        hotelId: hotel.hotelId,
        hotelName: hotel.hotelName,
        hotelAddress: hotel.hotelAddress,
        postalCode: hotel.postalCode ?? "",
        addressRegion: hotel.addressRegion ?? "",
        city: hotel.city,
        country: hotel.country,
        hotelRating: hotel.hotelRating ?? "",
        reviewCount: hotel.reviewCount ?? "",
        latitude: hotel.latitude ?? "",
        longitude: hotel.longitude ?? "",
        hotelUrl: hotel.hotelUrl,
        description: hotel.description ?? "",
        roomName: "",
        maxOccupancyText: "",
        maxOccupancy: "",
        bedTypes: "",
        roomHighlights: "",
        includedFacilities: "",
        priceCurrent: "",
        priceOriginal: "",
        currency: "",
        priceText: "",
        cancellationPolicy: "",
        mealPlan: "",
        scrapedAt
      }
    ];
  }

  return rooms.map((room) => ({
    hotelId: hotel.hotelId,
    hotelName: hotel.hotelName,
    hotelAddress: hotel.hotelAddress,
    postalCode: hotel.postalCode ?? "",
    addressRegion: hotel.addressRegion ?? "",
    city: hotel.city,
    country: hotel.country,
    hotelRating: hotel.hotelRating ?? "",
    reviewCount: hotel.reviewCount ?? "",
    latitude: hotel.latitude ?? "",
    longitude: hotel.longitude ?? "",
    hotelUrl: hotel.hotelUrl,
    description: hotel.description ?? "",
    roomName: room.roomName,
    maxOccupancyText: room.maxOccupancyText ?? "",
    maxOccupancy: room.maxOccupancy ?? "",
    bedTypes: room.bedTypes ?? "",
    roomHighlights: room.roomHighlights ?? "",
    includedFacilities: room.includedFacilities ?? "",
    priceCurrent: room.priceCurrent ?? "",
    priceOriginal: room.priceOriginal ?? "",
    currency: room.currency ?? "",
    priceText: room.priceText ?? "",
    cancellationPolicy: room.cancellationPolicy ?? "",
    mealPlan: room.mealPlan ?? "",
    scrapedAt
  }));
}

async function main(): Promise<void> {
  loadEnv();

  try {
    const dir = path.resolve(__dirname, "snapshots");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".html") && f !== ".ds_store");

    const scrapedAt = new Date().toISOString();
    const allRows: BookingCsvRow[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const urlGuess = `https://www.booking.com/hotel/${file.replace(".html", "")}.html`;
      const html = fs.readFileSync(fullPath, "utf-8");

      const hotel = parseHotelSnapshot(html, urlGuess);
      if (!hotel) {
        logger.warn("Skipping snapshot without parsable hotel metadata", { file });
        continue;
      }

      const rooms = parseHotelRoomsSnapshot(html, hotel.hotelUrl);
      const rowsForHotel = await buildRowsFromHotelAndRooms(hotel, rooms, scrapedAt);
      allRows.push(...rowsForHotel);
    }

    const csvPath = path.resolve(
      __dirname,
      "../../../shared/assets/data/booking-data.csv"
    );

    writeBookingCsv(allRows, csvPath);

    logger.info("Completed Booking.com scrape for Den Bosch", {
      hotelCount: allRows.length,
      rowCount: allRows.length,
      csvPath
    });
  } catch (error) {
    logger.error("Booking.com scraper failed", { error: String(error) });
    process.exitCode = 1;
  }
}

// Execute when run via `ts-node` or `node` on compiled output.
if (require.main === module) {
  // eslint-disable-next-line no-console
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}


