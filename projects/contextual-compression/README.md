# Contextual Compression

Summarize and/or filter retrieved chunks before answering to shrink prompt size while keeping answer-critical facts.

## Overview
- Implements contextual compression from `contextual_compression.ipynb`.
- Retrieves chunks, runs a compression pass, then prompts the LLM with compressed context.
- Goal: reduce token usage and noise while preserving grounding.

### What makes this project unique
- Uses shared `compressRetrievedContext` helper and `buildCompressionMessages` prompt.
- Keeps compression behavior reusable across projects.

### How to adjust
- Tweak `topK`, `chunkSize`, `chunkOverlap` to control input to compression.
- You can further cap prompt length by adjusting `compressionMaxChars` (if used) and model selection.

## Configuration
`config/contextual-compression.config.json`
- Standard RAG fields; optional `compressionMaxChars` (for downstream prompts if desired).

## Setup
```bash
pnpm install
export OPENAI_API_KEY=sk-...
cd projects/contextual-compression
```

## Usage
```bash
pnpm run ingest   # builds .tmp/index/contextual-compression.index.json
pnpm run query    # interactive CLI with compression step
```

## Validation scenario
1. Ingest, then query: `Summarize the key points`.
2. Observe logs: compression step runs before final answer; prompt shows `Compressed context:`.
3. Answer should be concise and grounded in compressed notes.

## Expected outcomes
- Prompts include a compressed context block instead of raw chunks.
- Reduced prompt length with maintained factual grounding.

## Troubleshooting
- If answers drop facts: increase `topK` or adjust compression prompt (shared helper).
- If prompts still too long: lower `topK` or chunk size before compression.

## Understanding the code
- `src/ingest.ts`: baseline ingestion, embeddings, persist.
- `src/query.ts`: retrieve → compress via shared helper → build final prompt → answer.
- Shared helper: `compressRetrievedContext` / `buildCompressionMessages` in `shared/typescript/utils/llm.ts`.

## Runtime artifacts
- Vector index under `.tmp/index/contextual-compression.index.json` (ignored except for `.gitkeep`).


