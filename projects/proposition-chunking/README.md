# Proposition Chunking

Proposition chunking converts raw text into short, verifiable statements so retrieval can match questions against discrete facts rather than long passages. The flow mirrors the reference notebook:

1. Chunk documents using the standard fixed-size algorithm.
2. Ask an LLM to propose concise factual statements for each chunk.
3. Grade every proposition for grounding.
4. Embed and store only the high-scoring propositions.
5. Query against proposition vectors and display the original chunk excerpt for context.

## Configuration

`config/proposition-chunking.config.json` introduces new fields:

| Field | Description |
| --- | --- |
| `propositionModel` | Model used to generate propositions. |
| `gradingModel` | Model used to score propositions (can match the generation model). |
| `maxPropositions` | Upper bound per chunk to control token usage. |
| `gradingThreshold` | Minimum score required for a proposition to be stored. |

Other core fields (`chunkSize`, `embeddingModel`, `indexPath`, etc.) behave just like the baseline project.

## Usage

```bash
pnpm install
export OPENAI_API_KEY=sk-your-key

cd projects/proposition-chunking
pnpm run ingest   # generates propositions and builds the index
pnpm run query    # answers questions using proposition-level retrieval
```

During ingestion, logs summarize how many propositions were generated and how many survived grading. Querying prints each proposition plus the original chunk excerpt so you can audit answers quickly.

### Quick validation (sanity check)

With the default `data/product_strategy.txt`, you can validate the pipeline with:

```bash
> What must the model do when it cannot find a grounded answer?
```

You should see at least one retrieved proposition stating that the model **must say it does not know**, **log the query**, and **trigger an annotation task**. The answer should echo these obligations in natural language.

If you ask something unrelated to the charter (for example, “What fabrics are used in winter jackets?”), the system should either surface no relevant propositions or respond that it doesn’t know based on the available context.

## Testing

```
pnpm --filter proposition-chunking test
```

Tests mock the LLM to verify proposition parsing, grading, and retrieval formatting without calling external APIs.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “No propositions passed grading” | Lower `gradingThreshold` or increase `maxPropositions`. |
| CLI answers “I don't know” frequently | Increase `topK` or ensure documents contain propositions relevant to your questions. |
| Rate limits during ingestion | Decrease `maxPropositions` and chunk size, or run with batching/lower model. |

## Ideas

- Persist raw proposition + grade pairs for curriculum learning.
- Swap the grading model for a deterministic heuristic when budgets are tight.
- Combine with Reliable RAG validation to double-check proposition usage during inference.
