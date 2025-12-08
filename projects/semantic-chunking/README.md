# Semantic Chunking

Use paragraph-based, semantically coherent chunks instead of fixed-size windows to better preserve meaning across boundaries.

## Overview
- Implements semantic/paragraph chunking from `semantic_chunking.ipynb`.
- Splits on blank lines to create variable-length chunks that align with paragraph structure.
- Goal: reduce mid-sentence breaks and improve retrieval quality on narrative text.

### What makes this project unique
- Uses shared `semanticChunkDocument` helper; toggled via config flag.
- Falls back to fixed-size chunking when `semanticChunking` is false.

### How to adjust
- Set `semanticChunking: true` in config to enable paragraph mode.
- If paragraphs are very long, you can still reduce `chunkSize`/increase `chunkOverlap` or pre-process text.

## Configuration
`config/semantic-chunking.config.json`
- Standard RAG fields plus `semanticChunking` boolean.

## Setup
```bash
pnpm install
export OPENAI_API_KEY=sk-...
cd projects/semantic-chunking
```

## Usage
```bash
pnpm run ingest   # builds .tmp/index/semantic-chunking.index.json with paragraph chunks
pnpm run query    # interactive CLI over semantic chunks
```

## Validation scenario
1. Ingest, then query: `Summarize the document`.
2. Expect retrieved context to be whole paragraphs (no mid-sentence truncation).
3. Logs show chunking strategy = semantic with paragraph counts.

## Expected outcomes
- Chunks are paragraph-aligned; retrieval surfaces coherent passages.
- Answers reference fuller context with fewer boundary artifacts.

## Troubleshooting
- Paragraphs too long: consider pre-splitting source docs or lowering `chunkSize`.
- Too many small chunks: ensure blank lines separate paragraphs; otherwise disable `semanticChunking`.

## Understanding the code
- `src/ingest.ts`: chooses semantic vs fixed chunking based on config; embeds and persists.
- `src/query.ts`: standard query flow over semantic chunks.
- Shared helper: `semanticChunkDocument` in `shared/typescript/utils/chunking.ts`.

## Runtime artifacts
- Vector index under `.tmp/index/semantic-chunking.index.json` (ignored except for `.gitkeep`).


