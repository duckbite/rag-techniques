---
name: booking-demo-plan
overview: Create a booking.com-focused RAG demo (DB-76) that ingests booking-data.csv and returns a top-5 hotel recommendation flow for Den Bosch.
todos:
  - id: scaffold
    content: Scaffold projects/booking-demo from existing template
    status: completed
  - id: ingest
    content: Implement ingest flow over booking-data.csv
    status: completed
  - id: query
    content: Implement preference-aware query top-5 flow
    status: completed
  - id: tests
    content: Add ingest/query tests
    status: completed
  - id: docs
    content: Update docs for new project and usage
    status: completed
---

# Booking.com Demo (DB-76)

## Scope

- New subproject `projects/booking-demo` mirroring existing RAG project structure (ingest + query + tests + config).
- Data source: `shared/assets/data/booking-data.csv` (hotel listings). City focus: Den Bosch.

## Plan

1) Baseline structure

- Copy minimal scaffold from a similar project (e.g., `projects/basic-rag`) into `projects/booking-demo` with adjusted package name/tsconfig/vitest config.
- Add project-specific config file `projects/booking-demo/config/booking-demo.config.json` (e.g., dataset path, chunking/embedding model, topK defaults).

2) Ingestion pipeline

- Implement `projects/booking-demo/src/ingest.ts` to load `booking-data.csv`, normalize fields (city, rating, price, amenities), and build vectors using shared utils (`shared/typescript/utils/*`).
- Pick sensible defaults: chunk per row (no splitting), embed with existing embedding helper, store in vector store used across repo (likely in-memory/FAISS equivalent already present in shared utils).
- Add tests in `projects/booking-demo/src/__tests__/ingest.test.ts` using small sample rows to verify parsing and vectorization.

3) Query pipeline

- Implement `projects/booking-demo/src/query.ts` to:
- Accept user prefs (budget range, rating min, amenities, date flexibility) and location fixed to Den Bosch.
- Retrieve top-K (e.g., 10) then re-rank to top-5 with explanation (price, match rationale, pros/cons).
- Allow follow-up detail requests (e.g., room details) from the same retrieved context.
- Add tests in `projects/booking-demo/src/__tests__/query.test.ts` covering preference filtering and deterministic top-5 formatting.

4) CLI/API wrapper (optional lightweight demo)

- Provide a simple CLI entry (e.g., `pnpm --filter booking-demo run query -- --budget 150`) or minimal script to showcase the flow.

5) Docs and wiring

- Update `docs/project-structure.md` to include `projects/booking-demo` purpose and key files.
- Ensure README or project README explains how to run ingest/query for this demo.

## Outputs

- New project folder `projects/booking-demo` with ingest/query/test and config files.
- Updated documentation for structure and usage.
- Passing unit tests for ingest and query flows.

## Notes

- Reuse shared utilities; avoid new dependencies unless required.
- Keep functional style within subproject per repo rules; shared code stays OOP if touched.