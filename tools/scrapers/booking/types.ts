/**
 * Normalized representation of a single hotel in Den Bosch as shown on Booking.com.
 *
 * This interface focuses on textual and numeric metadata that is stable enough
 * to power demos and RAG examples, and explicitly avoids binary/image data.
 */
export interface Hotel {
  /** Stable identifier derived from the Booking.com URL (e.g. slug or numeric id). */
  hotelId: string;
  /** Human-readable hotel name. */
  hotelName: string;
  /** Full street address as rendered on the page. */
  hotelAddress: string;
  /** Postal code if available. */
  postalCode?: string;
  /** Region / state if available. */
  addressRegion?: string;
  /** City name (for this task, typically 's-Hertogenbosch / Den Bosch). */
  city: string;
  /** Country name (e.g. "Netherlands"). */
  country: string;
  /** Optional star or user rating on a 0–10 scale, if available. */
  hotelRating?: number;
  /** Optional number of reviews shown next to the rating. */
  reviewCount?: number;
  /** Optional latitude if present in metadata. */
  latitude?: number;
  /** Optional longitude if present in metadata. */
  longitude?: number;
  /** Optional short description. */
  description?: string;
  /** Canonical Booking.com URL for the hotel details page. */
  hotelUrl: string;
}

/**
 * Normalized representation of a single bookable room option for a hotel,
 * enriched with as much textual context as is reasonably extractable from the
 * Booking.com room table markup.
 */
export interface Room {
  /** Identifier that ties the room back to its hotel. */
  hotelId: string;
  /** Human-readable room name or type (e.g. "Double Room with City View"). */
  roomName: string;
  /** Raw occupancy text (e.g. "Max. people: 2"). */
  maxOccupancyText?: string;
  /** Parsed maximum occupancy as a number when available. */
  maxOccupancy?: number;
  /** Bed configuration, e.g. "1 queen bed; 1 sofa bed". */
  bedTypes?: string;
  /** Short badges / highlights (size, view, AC, private bathroom, etc.). */
  roomHighlights?: string;
  /** Longer list of included facilities for this room. */
  includedFacilities?: string;
  /** Current total price for the stay (numeric, without currency symbol). */
  priceCurrent?: number;
  /** Original/strikethrough price if shown (numeric). */
  priceOriginal?: number;
  /** Three-letter currency code if it can be inferred (e.g. "EUR"). */
  currency?: string;
  /** Raw price text as shown in the UI. */
  priceText?: string;
  /** Cancellation / prepayment policy text for this room+rate. */
  cancellationPolicy?: string;
  /** Meal plan information (e.g. "Breakfast included"). */
  mealPlan?: string;
}

/**
 * Flattened CSV row representation combining hotel and room information.
 *
 * Numbers and booleans are kept as proper `number` / `boolean` types here.
 * When we write the CSV, numeric fields are rendered as plain numbers (e.g. `129.0`)
 * and booleans as `"true"` / `"false"` so downstream tools can infer types correctly.
 */
export interface BookingCsvRow {
  hotelId: string;
  hotelName: string;
  hotelAddress: string;
  postalCode: string;
  addressRegion: string;
  city: string;
  country: string;
  hotelRating: number | "";
  reviewCount: number | "";
  latitude: number | "";
  longitude: number | "";
  hotelUrl: string;
  description: string;
  // Room-level fields (one row per room option)
  roomName: string;
  maxOccupancyText: string;
  maxOccupancy: number | "";
  bedTypes: string;
  roomHighlights: string;
  includedFacilities: string;
  priceCurrent: number | "";
  priceOriginal: number | "";
  currency: string;
  priceText: string;
  cancellationPolicy: string;
  mealPlan: string;
  /** ISO-8601 timestamp representing when this row was scraped. */
  scrapedAt: string;
}


