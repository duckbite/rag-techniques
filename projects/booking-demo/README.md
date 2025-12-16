# Booking Demo (DB-76)

Booking.com-style RAG demo focused on Den Bosch hotels. Ingests `shared/assets/data/booking-data.csv` and returns a preference-aware top-5 recommendation with price per night and rationale.

## What it does
- Ingest each hotel/room row from the CSV (no chunk splitting) and stores embeddings in an in-memory vector index.
- Filters to Den Bosch addresses and keeps rich metadata (price per night, rating, amenities, occupancy).
- Query phase re-ranks retrievals by budget per night/rating/amenities before asking the LLM to summarize the top 5 and offer follow-up details.

## Quickstart
```bash
# from repo root
pnpm install

# ingest the booking dataset
cd projects/booking-demo
pnpm run ingest

# interactive query (prompts for preferences)
pnpm run query
```

## Configuration
`config/booking-demo.config.json`
- `dataPath`: CSV location (default shared dataset)
- `indexPath`: where to persist the in-memory index (`.tmp/index/booking-demo.index.json`)
- `chunkSize`/`chunkOverlap`: kept for compatibility; ingestion uses one chunk per row
- `topK`: retrieval fan-out before re-ranking (default 10)
- `embeddingModel` / `chatModel`: OpenAI models

## Notes
- Requires `OPENAI_API_KEY` in the repo root `.env`.
- Subproject code favors small, functional modules per repo style.
