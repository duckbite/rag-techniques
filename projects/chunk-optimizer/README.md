# Chunk Optimizer

This utility runs fast offline experiments to help you choose chunk sizes and overlaps before spending tokens on embeddings. It consumes a representative document and reports:

- Number of chunks generated
- Average chunk length
- Overlap percentage
- Estimated redundancy ratio (how much repeated text you’ll embed)

## Configuration

`config/chunk-optimizer.config.json`:

```json
{
  "sampleDocPath": "data/manufacturing_update.txt",
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

### Quick validation (sanity check)

With the default `data/manufacturing_update.txt`, running:

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

## Next ideas

- Hook into actual retrieval metrics by embedding a few curated queries.
- Plot results over time to detect drift as documents change.
- Store multiple sample documents and aggregate stats per domain.
