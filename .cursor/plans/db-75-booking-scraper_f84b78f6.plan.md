---
name: db-75-booking-scraper
overview: Implement a TypeScript/Node Booking.com scraper under tools/scrapers/booking that generates a typed CSV of Den Bosch hotel data and integrates cleanly with the existing monorepo structure and standards.
todos:
  - id: define-schema
    content: Decide and document the hotel/room CSV schema (columns and types) for Den Bosch Booking.com data.
    status: completed
  - id: design-structure
    content: Design the TypeScript scraper architecture and file layout under tools/scrapers/booking/ with pure parsing functions and a thin CLI entry.
    status: completed
    dependencies:
      - define-schema
  - id: implement-scraper
    content: Implement HTTP fetching, HTML parsing, and type normalization to scrape all Booking.com hotels in Den Bosch and their room data.
    status: completed
    dependencies:
      - design-structure
  - id: generate-csv
    content: Implement CSV row shaping and writing to shared/assets/data/booking-data.csv with correct types.
    status: completed
    dependencies:
      - implement-scraper
  - id: add-tests
    content: Add Vitest tests and HTML fixtures for parsing logic and basic data sanity checks.
    status: completed
    dependencies:
      - implement-scraper
  - id: update-docs
    content: Update project-structure, main README, and decision-log to document the new scraper and dataset.
    status: completed
    dependencies:
      - generate-csv
      - add-tests
---

# Plan for DB-75: Create demo hotel set from Booking.com

### 1. Confirm constraints and target shape

- **Clarify data fields**: Define the core hotel/room attributes to extract (e.g., hotel name, address, rating, number of reviews, price per night, room type, amenities, cancellation policy, breakfast included, free cancellation, etc.) based on Booking.com page structure.
- **Decide CSV schema**: Draft a minimal but useful CSV column list and rough types (string/number/boolean/date) and capture this in a short comment block and/or a dedicated small doc note in the scraper code.
- **Respect repo conventions**: Ensure the scraper lives under `tools/scrapers/booking/` and the resulting CSV is written to `shared/assets/data/booking-data.csv`, following existing docs about shared assets.

### 2. Design scraper architecture in TypeScript/Node

- **Folder and file layout**: Create a small, focused structure like:
- `tools/scrapers/booking/index.ts` – CLI entry point (parses args, orchestrates run).
- `tools/scrapers/booking/fetchHtml.ts` – Functions to fetch and retry Booking.com listing and detail pages (with rate-limiting and polite headers).
- `tools/scrapers/booking/parseListing.ts` – Pure functions to parse hotel cards and pagination from listing pages.
- `tools/scrapers/booking/parseHotel.ts` – Pure functions to parse individual hotel/room details from hotel detail pages.
- `tools/scrapers/booking/types.ts` – Strongly-typed interfaces for `Hotel`, `Room`, and the CSV row shape.
- `tools/scrapers/booking/writeCsv.ts` – CSV writer that takes typed rows and writes `booking-data.csv` with correct types.
- **HTTP and parsing choices**: Use a robust HTTP client (e.g., `node-fetch` or `axios`) and an HTML parser (e.g., `cheerio`) to navigate Booking.com pages without a full browser.
- **Politeness and robustness**: Add simple rate limiting (delays between requests), user-agent configuration, and basic retry/backoff on transient failures.

### 3. Implement core scraping workflow

- **Listing traversal**: Implement a function that loads the Booking.com search results for Den Bosch (NL), detects total pages, and iterates over all pages collecting hotel URLs and any per-hotel summary data (name, rating, price snippet if available).
- **Hotel detail scraping**: For each hotel URL, fetch the hotel detail page and extract room-level information and relevant hotel metadata, normalizing fields into the `Hotel`/`Room` types.
- **Type normalization**: Implement helpers that:
- Parse prices into numeric values (e.g., strip currency symbols, handle thousands separators).
- Convert booleans (e.g., "Free cancellation") from text labels.
- Normalize ratings and counts (e.g., numeric rating, number of reviews) into numbers.
- Clean text fields (trim whitespace, remove line breaks) while preserving meaningful content.
- **Error handling**: Log and skip hotels/rooms that fail to parse cleanly, with enough logs to debug issues without aborting the full run.

### 4. CSV generation and storage

- **Row shaping**: Flatten hotel + room data into one row per room (or per hotel, if rooms can’t be reliably distinguished), with clearly named columns.
- **Type-safe CSV writing**: Use a simple CSV library or a custom implementation to write UTF-8 CSV with a header row and properly escaped fields.
- **Output location**: Ensure the final CSV is written to `shared/assets/data/booking-data.csv`, creating intermediate directories if needed and overwriting existing demo data deterministically.

### 5. Testing, validation, and reproducibility

- **Unit tests on parsers**: Add small Vitest tests under `tools/scrapers/booking/__tests__/` for parsing functions (`parseListing`, `parseHotel`) using saved HTML fixtures to avoid network dependence.
- **Smoke test CLI**: Add a script (e.g., `pnpm booking:scrape-den-bosch`) that runs the scraper for Den Bosch and confirm it completes and produces a non-empty CSV.
- **Data sanity checks**: After a run, add basic checks in tests or a small validation script (e.g., ensure numeric columns parse correctly, no obviously empty critical fields for most rows).

### 6. Documentation and repo integration

- **Update `project-structure.md`**: Document the new `tools/scrapers/booking/` folder and the new shared CSV asset so future work (e.g., a RAG project using hotel data) can discover it.
- **Describe scraper usage in main README**: Add a short subsection explaining what the Booking.com scraper does, how to run it, and where the resulting CSV lives.
- **Log decision**: Append a brief note to `logs/decision-log.md` summarizing the presence and purpose of the Booking.com scraper and the demo hotel CSV dataset.