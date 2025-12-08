# Context Window (Context Window Enhancement)

Expand retrieval into configurable windows around top chunks to provide the model more surrounding context.

## Overview
- Based on `context_enrichment_window_around_chunk.ipynb`.
- Retrieves base chunks, then stitches neighbors into larger windows for prompting.
- Goal: improve completeness without inflating topK or changing chunking granularity.

### What makes this project unique
- Configurable `contextWindowSize` controls the stitched window size.
- Uses the shared stitched-segment helper to expand around hits efficiently.

### How to adjust
- Increase `contextWindowSize` for broader context; decrease to keep prompts short.
- Tune `topK` and `chunkSize/Overlap` to balance recall vs prompt length.

## Configuration
`config/context-window.config.json`
- Standard RAG fields plus optional `contextWindowSize` (characters).

## Setup
```bash
pnpm install
export OPENAI_API_KEY=sk-...
cd projects/context-window
```

## Usage
```bash
pnpm run ingest   # builds .tmp/index/context-window.index.json
pnpm run query    # interactive CLI with context window expansion
```

## Validation scenario
1. Ingest, then query: `What is this about?`
2. Expect prompt to include multiple adjacent chunks merged into one window.
3. Logs show stitched content count and scores.

## Expected outcomes
- Retrieved results are expanded windows (fewer, longer entries).
- Answers reference contiguous surrounding context, not isolated sentences.

## Troubleshooting
- Prompt too long: reduce `contextWindowSize` or `topK`.
- Missing context: increase `contextWindowSize` or `topK`.

## Understanding the code
- `src/ingest.ts`: baseline ingestion (fixed chunks, embeddings).
- `src/query.ts`: retrieve → stitch via `contextWindowSize` → build prompt → answer.
- Shared helper: `stitchRetrievedChunks` in `shared/typescript/utils/evaluation.ts`.

## Runtime artifacts
- Vector index under `.tmp/index/context-window.index.json` (ignored except for `.gitkeep`).


