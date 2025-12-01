# Reliable RAG

Reliable RAG demonstrates how to harden retrieval before handing context to an LLM. It mirrors the “Reliable RAG” notebook by:

1. Building the standard text-document index during ingestion.
2. Retrieving candidate chunks for each query.
3. Validating those chunks with two signals: vector similarity and lexical overlap with the user’s question.
4. Highlighting the matching excerpt so reviewers can quickly inspect evidence.
5. Falling back gracefully when no chunk clears the threshold.

## Configuration (`config/reliable-rag.config.json`)

| Field | Description |
| --- | --- |
| `chunkSize`, `chunkOverlap`, `topK`, `embeddingModel`, `chatModel`, `dataPath`, `indexPath` | Same as the baseline project. |
| `relevanceThreshold` | Minimum cosine similarity required for a chunk to be considered validated. |
| `highlightWindow` | Number of characters to capture around the first matching keyword for display. Larger values show more context. |

Example:

```json
{
  "chunkSize": 800,
  "chunkOverlap": 200,
  "topK": 4,
  "embeddingModel": "text-embedding-3-small",
  "chatModel": "gpt-4o-mini",
  "dataPath": "data",
  "indexPath": ".tmp/index/reliable-rag.index.json",
  "relevanceThreshold": 0.35,
  "highlightWindow": 120
}
```

## Setup & Usage

```bash
pnpm install
export OPENAI_API_KEY=sk-your-key

cd projects/reliable-rag
pnpm run ingest   # builds the vector index from data/*.txt|md
pnpm run query    # launches the validation-aware CLI
```

During querying the CLI prints validated chunks, their overlap score, and the highlighted excerpt before generating an answer. If the validator rejects every chunk it instructs the LLM to return “I don’t know.”

### Quick validation (sanity check)

After running `pnpm run ingest` and `pnpm run query`, try:

```bash
> How did water usage change at the Portland campus?
```

Given the default `data/operations_update.txt`, you should see:

- A validated chunk mentioning an **18%** drop in water usage at the Portland campus
- An answer that clearly states something like:  
  “Water usage at the Portland campus decreased by 18% year over year through recycling and rainwater harvesting.”

If you ask something unrelated to the ingested document, for example:

```bash
> What is the stock price today?
```

The system should either return low-confidence chunks or explicitly answer that it doesn’t know based on the available context.

## Validation Logic

- **Cosine similarity gate**: chunks must meet `relevanceThreshold`.
- **Keyword overlap**: even if similarity is low, a chunk can pass if ≥40% of the significant query tokens appear inside it.
- **Highlighting**: the first matching keyword is wrapped by `highlightWindow` characters to provide immediate transparency.

These heuristics run locally, so you can mock them in tests without additional API calls.

## Testing

```bash
pnpm --filter reliable-rag test
```

Tests cover ingestion orchestration, validation heuristics, prompt construction, and fallback behavior when no chunk validates.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| “Missing config key: relevanceThreshold” | Ensure your config file includes the new fields or set `RAG_CONFIG_PATH`. |
| CLI always says “I don’t know” | Lower `relevanceThreshold` or reduce question complexity so overlap improves. |
| Highlight text looks truncated | Increase `highlightWindow` for longer excerpts. |

## Extending

- Replace lexical overlap with a small local cross-encoder or reranker.
- Persist validation summaries for offline auditing.
- Combine with the CSV RAG project to validate structured answers.
