## Project Structure

This document describes the high-level folder layout for the TypeScript RAG Techniques monorepo.

- `docs/`
  - `product.md` – Product and roadmap description.
  - `project-structure.md` – This file; documents repository layout.
  - `plan.md` – Rolling implementation plan that tracks technique parity status.
- `projects/`
  - `basic-rag/` – Reference implementation of a simple RAG pipeline.
    - `.tmp/` – Project-local runtime artifacts (vector indexes, evaluation outputs). Folder tracked via `.gitkeep`, contents ignored.
    - `vitest.config.ts` – Vitest configuration and coverage output path definitions.
    - `src/`
      - `__tests__/` – Vitest unit tests (e.g., `ingest.test.ts`, `query.test.ts`) covering ingestion/query helpers.
      - `ingest.ts` – Document ingestion pipeline.
      - `query.ts` – Interactive CLI for querying the vector index.
  - `csv-rag/` – Structured RAG over CSV files.
    - `config/csv-rag.config.json` – Declares CSV-specific fields (path, text columns, delimiter).
    - `data/company_metrics.csv` – Sample dataset mixing sustainability, finance, and innovation notes.
    - `src/ingest.ts` – Converts rows into chunkable documents, embeds them, and persists a vector store.
    - `src/query.ts` – Interactive CLI that shows retrieved row metadata alongside answers.
  - `reliable-rag/` – Adds retrieval validation + highlighting.
    - `config/reliable-rag.config.json` – Includes `relevanceThreshold` and `highlightWindow`.
    - `src/ingest.ts` – Reuses the baseline ingestion pipeline.
    - `src/query.ts` – Validates chunks via similarity + lexical overlap before prompting the LLM.
  - `chunk-optimizer/` – CLI that benchmarks chunk sizes and overlaps.
    - `config/chunk-optimizer.config.json` – Lists sample document path and candidate chunk parameters.
    - `src/chunkOptimizer.ts` – Runs experiments, prints a console table, and saves JSON reports under `.tmp/reports/`.
  - `proposition-chunking/` – Generates, grades, and stores LLM-derived propositions.
    - `config/proposition-chunking.config.json` – Configures proposition/grading models and thresholds.
    - `src/ingest.ts` – Creates propositions per chunk and persists high-scoring statements.
    - `src/query.ts` – Answers questions using proposition-level retrieval while showing the original excerpt.
  - `rerank/` – RAG with reranking of retrieved documents.
  - `query-rewrite/` – RAG variants that rewrite or expand queries before retrieval.
- `logs/`
  - `decision-log.md` – Running record of cross-cutting decisions (runtime data location, documentation requirements, sample data usage, etc.).
- `shared/`
  - `typescript/`
    - `utils/` – Shared TypeScript utilities:
      - `logging.ts` – Minimal logger abstraction.
      - `config.ts` – Config loading and validation helpers.
      - `llm.ts` – LLM and embedding client interfaces + OpenAI implementation.
      - `types.ts` – Core domain types (`Document`, `Chunk`, etc.).
      - `vectorStore.ts` – Simple in-memory vector store and retrieval utilities.
  - `schemas/`
    - `jsonschema/`
      - `config.schema.json` – JSON Schema for per-project config files.
  - `assets/`
    - `sample/` – Example documents / datasets for demos (to be populated per project).

This file should be updated whenever new top-level folders or significant shared modules are added or removed.


