import { setTimeout as delay } from "node:timers/promises";
import { logger } from "../../../shared/typescript/utils/logging";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; DuckbiteHotelScraper/0.1; +https://duckbite.nl)";

export interface FetchOptions {
  headers?: Record<string, string>;
}

/**
 * Perform a single HTTP GET request using the global fetch API.
 *
 * This helper wraps Node's built-in `fetch` with a consistent user-agent and
 * basic error handling so all scraper calls share the same behavior.
 *
 * @param url - Absolute URL to fetch.
 * @param init - Optional overrides (headers, etc.).
 * @returns Raw HTML body as a string.
 * @throws Error when the response status is not 2xx.
 */
export async function fetchHtml(url: string, init: FetchOptions = {}): Promise<string> {
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept-Language": "en-US,en;q=0.9",
    ...init.headers
  };

  logger.debug("Fetching HTML", { url });

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.warn("Non-OK response from Booking.com", {
      url,
      status: response.status,
      statusText: response.statusText
    });
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText} ${text}`);
  }

  return response.text();
}

/**
 * Fetch HTML with automatic retries and a small delay between attempts.
 *
 * This helps the scraper be a bit more resilient to transient network or
 * 5xx errors while still failing fast when Booking.com rejects requests.
 *
 * @param url - Absolute URL to fetch.
 * @param retries - Maximum number of attempts (default: 3).
 * @param backoffMs - Delay between attempts in milliseconds (default: 1000).
 */
export async function fetchHtmlWithRetry(
  url: string,
  retries = 3,
  backoffMs = 1000
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fetchHtml(url);
    } catch (error) {
      lastError = error;
      logger.warn("Fetch attempt failed", { url, attempt, error: String(error) });
      if (attempt < retries) {
        // Polite delay before the next attempt
        // eslint-disable-next-line no-await-in-loop
        await delay(backoffMs);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${url} after ${retries} attempts`);
}


