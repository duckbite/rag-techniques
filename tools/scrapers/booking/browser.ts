import puppeteer, { type Browser, type Page } from "puppeteer";
import { logger } from "../../../shared/typescript/utils/logging";

/**
 * Launch a headless Chromium instance for scraping.
 *
 * We keep configuration minimal and rely on Puppeteer's defaults to look like
 * a real browser, which helps us see the same content that users see at
 * https://www.booking.com/searchresults.html?ss=Den+Bosch%2C+North+Brabant%2C+Netherlands
 */
export async function launchBrowser(): Promise<Browser> {
  logger.info("Launching Puppeteer browser");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}

/**
 * Convenience helper to open a new page and navigate to a URL, waiting until
 * the network is mostly idle so the dynamic content is rendered.
 *
 * @param browser - Puppeteer Browser instance.
 * @param url - Absolute URL to navigate to.
 */
export async function loadPageHtml(browser: Browser, url: string): Promise<string> {
  const page = await browser.newPage();
  logger.info("Opening page in Puppeteer", { url });

  // Try to look like a normal desktop Chrome.
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60_000
  });

  // Best-effort cookie banner dismissal to avoid overlays; ignore failures.
  try {
    await dismissCookieBanner(page);
  } catch (error) {
    logger.debug("Failed to dismiss cookie banner (non-fatal)", { error: String(error) });
  }

  // Give the client-side scripts some extra time to render listings.
  try {
    await page.waitForSelector("h3 a[href*='/hotel/']", { timeout: 15_000 });
  } catch {
    // Non-fatal: we will still capture whatever HTML is present.
  }

  const html = await page.content();
  await page.close();
  return html;
}

async function dismissCookieBanner(page: Page): Promise<void> {
  // Booking.com cookie banner has a dialog with buttons "Accept" / "Decline".
  const html = await page.content();
  if (!/Manage cookie settings/i.test(html)) return;
}


