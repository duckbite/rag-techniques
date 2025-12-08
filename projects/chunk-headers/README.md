# Chunk Headers (Contextual Chunk Headers)

Add document- and section-level metadata to every chunk before embedding so retrieval keeps high-level context (e.g., title, heading, category) alongside the text body.

## Overview
- Demonstrates contextual chunk headers from `contextual_chunk_headers.ipynb`.
- Builds on the baseline ingestion pipeline but prepends `Title:` and `Section:` lines to each chunk.
- Goal: improve retrieval precision by retaining hierarchy/context without extra vector dimensions.

### What makes this project unique
- Header construction combines `title` plus optional `section`/`category` metadata.
- Headers are physically prepended to chunk text so similarity search “sees” the context.
- Configurable and reusable via shared `createDocumentHeader` / `prependHeaderToChunks`.

### How to adjust
- Add/alter metadata in source docs (e.g., `metadata.section`, `metadata.category`).
- Tune `chunkSize` / `chunkOverlap` if headers increase chunk length.

## Configuration
`config/chunk-headers.config.json`
- `chunkSize`, `chunkOverlap`, `topK`, `embeddingModel`, `chatModel`, `dataPath`, `indexPath`.
- No extra fields required; header behavior is automatic when metadata exists.

## Setup
```bash
pnpm install
export OPENAI_API_KEY=sk-...
cd projects/chunk-headers
```

## Usage
```bash
pnpm run ingest   # builds .tmp/index/chunk-headers.index.json with header-enriched chunks
pnpm run query    # interactive CLI
```

## Validation scenario
1. Run `pnpm run ingest && pnpm run query`.
2. Ask: `What is this about?`
3. Expect retrieved context to include `Title:` and `Section:` lines in the prompt.

## Expected outcomes
- Chunks stored with headers visible in prompts and logs.
- Retrieval surfaces both header and body text; prompts include header lines.

## Troubleshooting
- Missing headers: ensure source docs have `title` and optional `metadata.section/category`.
- Large chunks: reduce `chunkSize` if prompts become too long after header prepends.

## Understanding the code
- `src/ingest.ts`: loads config/env, reads docs, builds headers, prepends to chunks, embeds, persists.
- `src/query.ts`: standard query flow; retrieved chunks keep header text in the prompt.
- Shared helpers: `createDocumentHeader`, `prependHeaderToChunks` in `shared/typescript/utils/chunking.ts`.

## Runtime artifacts
- Vector index under `.tmp/index/chunk-headers.index.json` (ignored except for placeholder `.gitkeep`).


