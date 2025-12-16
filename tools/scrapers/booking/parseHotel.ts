import * as cheerio from "cheerio";
import type { Hotel, Room } from "./types";
import { extractHotelIdFromUrl } from "./parseListing";

interface HotelMetadata {
  name?: string;
  description?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  aggregateRating?: {
    ratingValue?: number;
    reviewCount?: number;
  };
  hasMap?: string;
  url?: string;
}

function parsePrice(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\s+/g, "");
  const normalized = cleaned.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isNaN(value) ? undefined : value;
}

/**
 * Extract per-night price from priceText.
 * Looks for patterns like "€ X.XX × N nights" or calculates from total price / nights.
 */
function parsePricePerNight(priceText: string | undefined | null, totalPrice: number | undefined): number | undefined {
  if (!priceText) return undefined;

  // Pattern: "€ 350.60 × 5 nights" - extract the per-night price before the ×
  const perNightMatch = priceText.match(/€\s*([\d.,]+)\s*×\s*\d+\s*nights?/i);
  if (perNightMatch) {
    const perNightStr = perNightMatch[1];
    return parsePrice(perNightStr);
  }

  // Pattern: "€ X.XX per night" or "X.XX/night"
  const perNightPattern = priceText.match(/([\d.,]+)\s*(?:€|EUR)?\s*(?:per|\/)\s*nights?/i);
  if (perNightPattern) {
    return parsePrice(perNightPattern[1]);
  }

  // If we have total price and can find number of nights, calculate per-night
  const nightsMatch = priceText.match(/(\d+)\s*nights?/i);
  if (nightsMatch && totalPrice) {
    const nights = Number.parseInt(nightsMatch[1] ?? "", 10);
    if (nights > 0 && Number.isFinite(nights)) {
      return totalPrice / nights;
    }
  }

  // If no nights mentioned and we have a total price, assume it's per night
  if (totalPrice && !nightsMatch) {
    return totalPrice;
  }

  return undefined;
}

function inferCurrency(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  if (raw.includes("€")) return "EUR";
  return undefined;
}

function parseJsonLd($: cheerio.CheerioAPI): HotelMetadata | undefined {
  const scripts = $("script[type='application/ld+json']");
  for (const el of scripts.toArray()) {
    const text = $(el).contents().text();
    try {
      const parsed = JSON.parse(text) as HotelMetadata | HotelMetadata[];
      if (Array.isArray(parsed)) {
        const hotelEntry = parsed.find(
          (item) => typeof item === "object" && item && (item as any)["@type"] === "Hotel"
        );
        if (hotelEntry) return hotelEntry;
      } else if ((parsed as any)["@type"] === "Hotel") {
        return parsed;
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return undefined;
}

function parseCoordsFromHasMap(hasMap?: string): { latitude?: number; longitude?: number } {
  if (!hasMap) return {};
  const match = hasMap.match(/center=([\d.\-]+),([\d.\-]+)/);
  if (match) {
    const latitude = Number.parseFloat(match[1] ?? "");
    const longitude = Number.parseFloat(match[2] ?? "");
    return {
      latitude: Number.isNaN(latitude) ? undefined : latitude,
      longitude: Number.isNaN(longitude) ? undefined : longitude
    };
  }
  return {};
}

/**
 * Parse hotel-level details from a Booking.com hotel detail page (snapshot).
 *
 * @param html - Raw HTML of the hotel details page.
 * @param fallbackUrl - Optional URL used to derive the hotelId when canonical is missing.
 */
export function parseHotelSnapshot(html: string, fallbackUrl?: string): Hotel | undefined {
  const $ = cheerio.load(html);

  const canonicalUrl = $("link[rel='canonical']").attr("href") ?? fallbackUrl;
  if (!canonicalUrl) return undefined;

  const hotelId = extractHotelIdFromUrl(canonicalUrl);

  const jsonLd = parseJsonLd($);

  const ogTitle = $("meta[property='og:title']").attr("content") ?? $("title").text();

  const name =
    jsonLd?.name ??
    (ogTitle ? ogTitle.split(",")[0]?.replace("★", "").trim() : undefined) ??
    $("title").text().split(",")[0]?.trim();

  const description =
    jsonLd?.description ?? $("meta[name='description']").attr("content") ?? "";

  const address = jsonLd?.address ?? {};
  const coords = parseCoordsFromHasMap(jsonLd?.hasMap);
  const rating = jsonLd?.aggregateRating?.ratingValue;
  const reviewCount = jsonLd?.aggregateRating?.reviewCount;

  let city = address.addressLocality ?? "";
  let country = address.addressCountry ?? "";
  if ((!city || !country) && ogTitle) {
    const parts = ogTitle.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      city = city || parts[1];
      country = country || parts[2];
    }
  }

  return {
    hotelId,
    hotelName: name ?? hotelId,
    hotelAddress: address.streetAddress ?? "",
    postalCode: address.postalCode,
    addressRegion: address.addressRegion,
    city,
    country,
    hotelRating: rating,
    reviewCount,
    latitude: coords.latitude,
    longitude: coords.longitude,
    description,
    hotelUrl: canonicalUrl
  };
}

/**
 * Parse room-level information from a Booking.com hotel detail snapshot.
 *
 * This uses the legacy `hprt-*` room table markup that is present in the saved
 * HTML, without relying on client-side rendering.
 */
export function parseHotelRoomsSnapshot(html: string, hotelUrl: string): Room[] {
  const $ = cheerio.load(html);
  const hotelId = extractHotelIdFromUrl(hotelUrl);
  const rooms: Room[] = [];

  $(".hprt-roomtype-block.hprt-roomtype-name").each((_index, element) => {
    const roomBlock = $(element);
    const roomName = roomBlock.find(".hprt-roomtype-icon-link").text().trim();
    if (!roomName) return;

    const row = roomBlock.closest("tr");

    const occupancyNode = row
      .find(".bui-u-sr-only")
      .filter((_i, el) => $(el).text().includes("Max. people"))
      .first();
    const maxOccupancyText = occupancyNode.text().trim();
    const occMatch = maxOccupancyText.match(/(\d+)/);
    const maxOccupancy = occMatch ? Number.parseInt(occMatch[1] ?? "", 10) : undefined;

    const bedTypes = row
      .find(".rt-bed-types li")
      .toArray()
      .map((li) => $(li).text().replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 0)
      .join("; ");

    const roomHighlights = row
      .find(".hprt-facilities-block .hprt-facilities-facility span")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 0)
      .join("; ");

    const includedFacilities = row
      .find(".hprt-facilities-others .hprt-facilities-facility")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 0)
      .join("; ");

    const priceBlock = row.find(".hprt-price-block").first();
    const priceCurrentText = priceBlock
      .find(".bui-price-display__value")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const priceOriginalText = priceBlock
      .find(".bui-price-display__original")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const priceText = priceBlock.text().replace(/\s+/g, " ").trim();

    const priceCurrent = parsePrice(priceCurrentText || priceText);
    const priceOriginal = parsePrice(priceOriginalText);
    const pricePerNight = parsePricePerNight(priceText, priceCurrent);
    const currency =
      inferCurrency(priceCurrentText || priceOriginalText || priceText) ?? "";

    const cancellationPolicy = row
      .find(".hprt-conditions, .hprt-conditions-title, .hprt-conditions-text")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const mealPlan = row
      .find("[data-component='hotel/new-rooms-table/mealplan'], .hprt-conditions-mealplan")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    rooms.push({
      hotelId,
      roomName,
      maxOccupancyText,
      maxOccupancy,
      bedTypes: bedTypes || undefined,
      roomHighlights: roomHighlights || undefined,
      includedFacilities: includedFacilities || undefined,
      priceCurrent,
      pricePerNight,
      priceOriginal,
      currency: currency || undefined,
      priceText,
      cancellationPolicy: cancellationPolicy || undefined,
      mealPlan: mealPlan || undefined
    });
  });

  return rooms;
}


