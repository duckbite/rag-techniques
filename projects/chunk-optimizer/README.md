# Chunk Optimizer

This utility runs fast offline experiments to help you choose chunk sizes and overlaps before spending tokens on embeddings. It consumes a representative document and reports:

- Number of chunks generated
- Average chunk length
- Overlap percentage
- Estimated redundancy ratio (how much repeated text you’ll embed)

## What is chunking and why do we optimize it?

Most RAG systems can’t embed or feed entire documents into the model at once. Instead, they:

1. **Split documents into chunks** of text (e.g., 400–1,200 characters each)
2. **Embed** each chunk into a vector
3. **Retrieve** the most similar chunks for a query and pass them to the LLM

Choosing **how** to chunk matters:

- **Chunk size**:
  - Too small → you lose context (a single sentence may not be enough to answer a question).
  - Too large → chunks contain extra, irrelevant information, which can confuse retrieval and the LLM.
- **Overlap**:
  - Too little overlap → information that falls on a boundary may be split across chunks and missed.
  - Too much overlap → you embed nearly the same text many times, wasting cost and slowing everything down.

The chunk optimizer lets you explore different chunkSize / chunkOverlap combinations **offline**, on a representative document, before you lock in defaults for a project. You can quickly see how many chunks you’ll produce, how long they are, and how much redundancy you introduce.

## Configuration

`config/chunk-optimizer.config.json`:

```json
{
  "sampleDocPath": "../../shared/assets/data/manufacturing_update.txt",
  "chunkSizes": [400, 600, 800, 1200],
  "chunkOverlaps": [50, 150, 250],
  "reportPath": ".tmp/reports/chunk-results.json"
}
```

You can tune the size/overlap arrays to iterate through any combination you care about.

## Usage

```bash
pnpm install
cd projects/chunk-optimizer
pnpm run benchmark
```

The script prints a console table and saves JSON results:

```
┌─────────┬────────────┬──────────┬─────────┬────────────┬────────────┬────────────┐
│ (index) │ Chunk Size │ Overlap  │ Chunks  │ Avg Length │ Overlap %  │ Redundancy │
├─────────┼────────────┼──────────┼─────────┼────────────┼────────────┼────────────┤
│    0    │    400     │    50    │    3    │   293.3    │    0.12    │    0.05    │
│    1    │    400     │   150    │    4    │   308.0    │    0.38    │    0.15    │
└─────────┴────────────┴──────────┴─────────┴────────────┴────────────┴────────────┘
```

JSON reports live under `.tmp/reports/` so they can be checked into dashboards or notebooks later.

### Runtime Data Directory (`.tmp/`)

- Generated artifacts (benchmark reports) are written to the project-local `.tmp/reports/` directory
- The directory is committed (via `.gitkeep`) so contributors know where runtime files belong, but contents are ignored via `.gitignore`
- Deleting `.tmp/` is safe; running the benchmark will recreate the report files

## How to interpret the benchmark results

Each row in the table (and JSON report) represents **one configuration**:

- **Chunk Size** – Target number of characters per chunk.
- **Overlap** – Number of overlapping characters between adjacent chunks.
- **Chunks** – How many chunks the sample document was split into.
- **Avg Length** – Average length (in characters) of the resulting chunks.
- **Overlap %** – Overlap as a fraction of `chunkSize` (e.g., `0.25` = 25%).
- **Redundancy** – Rough measure of how much repeated text you embed:  
  \[ \text{redundancy} \approx \frac{\text{chunks} \times \text{overlap}}{\text{document length}} \]

In practice:

- Look for **chunk sizes** that:
  - Produce a **small, manageable number of chunks** (not hundreds for a single doc).
  - Have an average length close to your target (e.g., around 400–800 characters).
- Look for **overlap** values that:
  - Keep **overlap %** in a reasonable band (often 10–30%).
  - Keep **redundancy** low enough that you’re not paying for lots of repeated tokens.

You generally want a configuration where:

- Chunks are long enough to include full thoughts (paragraphs or steps), and
- Redundancy is not so high that you double or triple your embedding bill.

> **Important limitation:** This tool only measures **structural properties** of chunking (how many chunks you get, how redundant they are). It does **not** directly measure answer accuracy or retrieval reliability. To see how a given chunking strategy affects real answers, you still need to:
> - Plug the chosen `chunkSize` / `chunkOverlap` into a RAG project (e.g., `basic-rag`, `reliable-rag`), and
> - Run that project’s validation scenarios or evaluation projects (e.g., DeepEval / Grouse) on a small set of (question, expected answer) pairs.

## How to use the results

Once you find a configuration you like from the benchmark:

1. **Copy the chosen `chunkSize` and `chunkOverlap`** into the RAG project you’re configuring (e.g., `basic-rag`, `reliable-rag`, `proposition-chunking`) by editing that project’s `*.config.json`.
2. **Re-run ingestion** for that project so the new chunking strategy takes effect.
3. **Re-run the project’s validation scenarios** (from its README) to see how retrieval quality changes.

If validation improves (more relevant chunks, clearer answers), you’ve found a better default. If not, adjust the parameters again (or benchmark with a different `sampleDocPath` that better represents your real workload) and repeat.

### Quick validation (sanity check)

With the default `shared/assets/data/manufacturing_update.txt`, running:

```bash
pnpm run benchmark
```

should produce at least one row in the table (for example, a row with `Chunk Size = 400`) and a JSON report at:

- `.tmp/reports/chunk-results.json` containing a `benchmarks` array with several entries.

If the table is empty or the report file is missing, the sample document path or config is likely misconfigured.

## Testing

```
pnpm --filter chunk-optimizer test
```

Tests ensure invalid combinations are skipped and the benchmarking math behaves as expected.

## Troubleshooting

### "Sample document not found"
- Ensure `sampleDocPath` in config points to a valid file
- Path is relative to the config file location or can be absolute
- Check that the file exists and is readable

### "No results in table"
- Verify that `chunkSizes` and `chunkOverlaps` arrays in config are not empty
- Ensure at least one valid combination exists (chunkSize > chunkOverlap)
- Check that the sample document has content

### Invalid chunk size/overlap combinations
- The tool automatically skips invalid combinations (e.g., overlap >= chunkSize)
- Check logs for skipped combinations
- Ensure `chunkSize > chunkOverlap` for all combinations you want to test

### Results don't match expectations
- The tool measures structural properties, not retrieval quality
- To see how chunking affects actual retrieval, use the chosen parameters in a RAG project (e.g., basic-rag)
- Run validation scenarios in the RAG project to verify quality

### JSON report not generated
- Check that `.tmp/reports/` directory exists (created automatically)
- Verify write permissions for the report file
- Check logs for any errors during report generation

## Troubleshooting

### "Sample document not found"
- Ensure `sampleDocPath` in config points to a valid file
- Path is relative to the config file location or can be absolute
- Check that the file exists and is readable

### "No results in table"
- Verify that `chunkSizes` and `chunkOverlaps` arrays in config are not empty
- Ensure at least one valid combination exists (chunkSize > chunkOverlap)
- Check that the sample document has content

### Invalid chunk size/overlap combinations
- The tool automatically skips invalid combinations (e.g., overlap >= chunkSize)
- Check logs for skipped combinations
- Ensure `chunkSize > chunkOverlap` for all combinations you want to test

### Results don't match expectations
- The tool measures structural properties, not retrieval quality
- To see how chunking affects actual retrieval, use the chosen parameters in a RAG project (e.g., basic-rag)
- Run validation scenarios in the RAG project to verify quality

### JSON report not generated
- Check that `.tmp/reports/` directory exists (created automatically)
- Verify write permissions for the report file
- Check logs for any errors during report generation

### Runtime Data Directory (`.tmp/`)

- Generated artifacts (benchmark reports) are written to the project-local `.tmp/reports/` directory
- The directory is committed (via `.gitkeep`) so contributors know where runtime files belong, but contents are ignored via `.gitignore`
- Deleting `.tmp/` is safe; running the benchmark will recreate the report files

## Next ideas

- Hook into actual retrieval metrics by embedding a few curated queries.
- Plot results over time to detect drift as documents change.
- Store multiple sample documents and aggregate stats per domain.
