import * as cheerio from "cheerio";
import { logger } from "../../../shared/typescript/utils/logging";
import type { Hotel } from "./types";

/**
 * Result of parsing a single search results page.
 */
export interface ListingPageParseResult {
  hotels: Hotel[];
  /** Absolute URLs to hotel detail pages discovered on this page. */
  hotelUrls: string[];
  /** Absolute URL of the next page of results, if any. */
  nextPageUrl?: string;
}

/**
 * Normalize relative Booking.com URLs to absolute URLs.
 *
 * @param href - Raw href attribute from the page.
 * @returns Absolute URL string or undefined when the input is not usable.
 */
function normalizeBookingUrl(href: string | undefined | null): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http")) return href;
  if (!href.startsWith("/")) return undefined;
  return `https://www.booking.com${href}`;
}

/**
 * Derive a stable hotel identifier from a Booking.com URL.
 *
 * Typical hotel detail URLs look like:
 *   https://www.booking.com/hotel/nl/hotel-slug.en-gb.html
 *
 * We take the last non-empty path segment without extension as the id.
 */
export function extractHotelIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return last.replace(/\.html$/i, "");
  } catch {
    return url;
  }
}

/**
 * Parse a Booking.com search results HTML page for Den Bosch.
 *
 * This function extracts high-level hotel metadata from property cards and
 * identifies the URL for the next results page (if present).
 *
 * It is intentionally tolerant of minor HTML changes: unknown fields are
 * treated as optional and missing values are logged but do not abort parsing.
 *
 * @param html - Raw HTML of a search results page.
 * @param city - Normalized city name to attach to each hotel.
 * @param country - Normalized country name to attach to each hotel.
 */
export function parseListingPage(
  html: string,
  city: string,
  country: string
): ListingPageParseResult {
  const $ = cheerio.load(html);
  const hotels: Hotel[] = [];
  const hotelUrls: string[] = [];

  /**
   * Booking.com does not consistently expose `data-testid="property-card"`
   * attributes across locales. Instead of relying on those attributes, we
   * treat every anchor whose href contains `/hotel/` as a potential hotel
   * details link, and then de-duplicate based on the canonical URL
   * (path without query string).
   */
  const anchorByCanonicalUrl = new Map<string, cheerio.Cheerio<any>>();

  $("a[href*='/hotel/']").each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) return;

    // Ignore non-country-specific or generic hotel index links.
    if (!href.includes("/hotel/nl/")) return;
    if (href.includes("/hotel/index")) return;

    const hotelUrl = normalizeBookingUrl(href);
    if (!hotelUrl) return;

    const canonicalUrl = hotelUrl.split("?")[0]!;
    if (!anchorByCanonicalUrl.has(canonicalUrl)) {
      anchorByCanonicalUrl.set(canonicalUrl, anchor);
    }
  });

  anchorByCanonicalUrl.forEach((anchor, canonicalUrl) => {
    const hotelUrl = canonicalUrl;

    // Try to infer hotel name from the anchor text (the heading link)
    const titleText = anchor.text().trim();

    // Walk up to the nearest list item container which holds the rest of the
    // hotel metadata (rating, address snippet, etc.).
    const card = anchor.closest("li").length > 0 ? anchor.closest("li") : anchor.parent();

    const cardText = card.text();

    // Address is not explicitly marked up, but the "Den Bosch · Show on map"
    // link gives us a stable snippet to work with. If we can't find anything,
    // fall back to a generic city + country string so the hotel remains usable.
    const mapLink = card.find("a:contains('Show on map')").first();
    let addressText = mapLink.text().trim();
    if (!addressText) {
      addressText = `${city}, ${country}`;
    }

    // Heuristic rating / review parsing from the text block
    let hotelRating: number | undefined;
    const ratingMatch = cardText.match(/Scored\s+([\d.,]+)/);
    if (ratingMatch?.[1]) {
      const ratingValue = Number.parseFloat(ratingMatch[1].replace(",", "."));
      if (!Number.isNaN(ratingValue)) {
        hotelRating = ratingValue;
      }
    }

    let reviewCount: number | undefined;
    const reviewsMatch = cardText.match(/([\d.,]+)\s+reviews/);
    if (reviewsMatch?.[1]) {
      const countValue = Number.parseInt(reviewsMatch[1].replace(/[.,]/g, ""), 10);
      if (!Number.isNaN(countValue)) {
        reviewCount = countValue;
      }
    }

    if (!titleText || !hotelUrl) {
      logger.debug("Skipping potential hotel anchor with missing core fields", {
        titleText,
        hotelUrl
      });
      return;
    }

    const hotelId = extractHotelIdFromUrl(hotelUrl);

    hotels.push({
      hotelId,
      hotelName: titleText,
      hotelAddress: addressText,
      city,
      country,
      hotelRating,
      reviewCount,
      hotelUrl
    });
    hotelUrls.push(hotelUrl);
  });

  let nextPageUrl: string | undefined;
  const nextLink = $("a[aria-label='Next page'], a[rel='next']").first();
  if (nextLink.length > 0) {
    nextPageUrl = normalizeBookingUrl(nextLink.attr("href")) ?? undefined;
  }

  return { hotels, hotelUrls, nextPageUrl };
}


