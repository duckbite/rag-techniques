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


