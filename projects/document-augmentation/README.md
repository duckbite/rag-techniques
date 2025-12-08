# Document Augmentation (Question Generation)

Generate synthetic Q/A pairs for each chunk during ingestion and retrieve over both base chunks and generated Q/A to improve coverage.

## Overview
- Implements document augmentation from `document_augmentation.ipynb`.
- Ingestion: for each chunk, generate `questionsPerChunk` Q/A pairs and store them with metadata.
- Query: retrieves over the combined set of base and augmented Q/A chunks.
- Goal: boost recall by matching queries to pre-generated questions.

### What makes this project unique
- Q/A generation at ingest time; augmented chunks carry `augmentation: "qa"` metadata.
- Uses shared LLM helpers; embeddings are generated for both base and QA chunks.

### How to adjust
- `questionsPerChunk` controls generation volume (cost/latency).
- Tune `chunkSize`, `chunkOverlap`, and `topK` to balance base vs augmented retrieval.

## Configuration
`config/document-augmentation.config.json`
- Standard RAG fields plus `questionsPerChunk`.

## Setup
```bash
pnpm install
export OPENAI_API_KEY=sk-...
cd projects/document-augmentation
```

## Usage
```bash
pnpm run ingest   # builds .tmp/index/document-augmentation.index.json with base + QA chunks
pnpm run query    # interactive CLI over combined chunks
```

## Validation scenario
1. Ingest, then query: `What questions are covered?`
2. Expect retrieved context to include `Q:` / `A:` pairs and base text.
3. Logs show QA generation, embeddings for QA chunks, and combined retrieval.

## Expected outcomes
- Index contains both base chunks and synthetic QA chunks.
- Queries can match augmented questions, improving recall.

## Troubleshooting
- If QA generation fails to parse: ensure the model returns valid JSON; consider stricter prompting.
- Too many QA chunks: lower `questionsPerChunk` or `topK`.

## Understanding the code
- `src/ingest.ts`: baseline ingestion + QA generation + embeddings + persist.
- `src/query.ts`: standard query over combined chunk set.
- Shared helpers: LLM clients in `shared/typescript/utils/llm.ts`.

## Runtime artifacts
- Vector index under `.tmp/index/document-augmentation.index.json` (ignored except for `.gitkeep`).


