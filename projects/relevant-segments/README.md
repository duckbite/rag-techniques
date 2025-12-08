# Relevant Segments (Relevant Segment Extraction)

Stitch adjacent retrieved chunks from the same document into longer segments so the model sees richer, contiguous context.

## Overview
- Implements relevant segment extraction from `relevant_segment_extraction.ipynb`.
- Post-retrieval step merges neighboring chunks to reduce fragmentation.
- Goal: improve answer grounding by providing a contiguous window rather than many tiny pieces.

### What makes this project unique
- Uses shared `stitchRetrievedChunks` helper to merge by `documentId` and contiguous `index`.
- Respects a `segmentMaxChars` budget to avoid oversized prompts.

### How to adjust
- `segmentMaxChars` in config controls max stitched segment length.
- `topK` and `chunkSize/Overlap` influence how many neighbors can merge.

## Configuration
`config/relevant-segments.config.json`
- Standard RAG fields plus optional `segmentMaxChars` (default 800).

## Setup
```bash
pnpm install
export OPENAI_API_KEY=sk-...
cd projects/relevant-segments
```

## Usage
```bash
pnpm run ingest   # builds .tmp/index/relevant-segments.index.json
pnpm run query    # interactive CLI with segment stitching
```

## Validation scenario
1. Ingest, then query: `Summarize the main point of the document`.
2. Expect the prompt to include merged segments (chunks combined with blank lines between them).
3. Logged retrieval should show fewer, longer segments than raw chunks.

## Expected outcomes
- Retrieval returns stitched segments; prompts and logs show merged content.
- Answers reference broader context instead of isolated sentences.

## Troubleshooting
- Too-long prompts: lower `segmentMaxChars` or `chunkSize`.
- Over-fragmented context: increase `segmentMaxChars` or `topK`.

## Understanding the code
- `src/ingest.ts`: baseline ingestion (fixed-size chunks, embeddings, persist).
- `src/query.ts`: retrieve → stitch segments → build prompt → generate answer.
- Shared helper: `stitchRetrievedChunks` in `shared/typescript/utils/evaluation.ts`.

## Runtime artifacts
- Vector index under `.tmp/index/relevant-segments.index.json` (ignored except for `.gitkeep`).


