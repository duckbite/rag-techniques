## RAG Techniques (TypeScript Monorepo)

This repository is a TypeScript / Node.js port of the advanced RAG techniques collection from [`NirDiamant/RAG_Techniques`](https://github.com/NirDiamant/RAG_Techniques), organized as a monorepo with one project per technique.

### Structure

- `projects/` – Individual RAG technique implementations (Node.js CLI scripts).
- `shared/typescript/utils/` – Reusable TypeScript utilities (logging, config, LLM clients, vector stores, domain types).
- `shared/schemas/jsonschema/` – JSON Schemas for config validation.
- `shared/assets/` – Sample datasets and example documents.
- `docs/` – Product and architecture documentation.

### Prerequisites

- Node.js 22.x
- `pnpm` package manager
- An OpenAI API key available as `OPENAI_API_KEY` in your environment.

### Install dependencies

```bash
pnpm install
```

### Example commands

```bash
# Basic text documents
pnpm basic-rag:ingest
pnpm basic-rag:query

# Structured CSV retrieval
pnpm csv-rag:ingest
pnpm csv-rag:query

# Reliability-focused pipeline
pnpm reliable-rag:ingest
pnpm reliable-rag:query

# Chunk benchmarking utility
pnpm chunk-optimizer:benchmark

# Proposition-based retrieval
pnpm proposition-chunking:ingest
pnpm proposition-chunking:query
```

See each project’s `README.md` for detailed configuration, data prep, and troubleshooting guidance.


