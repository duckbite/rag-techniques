# CSV RAG (Structured Retrieval)

CSV RAG ports the “simple CSV RAG” notebook from the original NirDiamant repository into a fully typed Node.js project. Instead of splitting free-form documents, it:

1. Loads structured rows from a CSV file
2. Infers which columns contain descriptive text vs. metadata
3. Converts every row into a chunk-friendly document
4. Embeds those chunks and stores them in a vector index
5. Answers questions with an interactive CLI that surfaces both the text column content and the original row metadata

It is ideal whenever you have lightweight tabular exports (finance summaries, experiment trackers, product roadmaps) and you want transparent answers that show which row was used.

## What Makes This Project Unique

**CSV RAG** extends basic RAG to handle structured tabular data. Its uniqueness lies in:

- **Automatic column inference**: Automatically detects which CSV columns contain searchable text vs. structured metadata, eliminating the need to manually specify column types for most CSVs.
- **Dual-purpose columns**: Text columns are embedded and searched semantically, while metadata columns are preserved for filtering, display, and structured queries without being embedded.
- **Row-to-document mapping**: Each CSV row becomes a document, making it easy to trace answers back to specific rows and their metadata.

### How the Unique Concepts Work

1. **Column type inference**: The system analyzes CSV rows to determine which columns contain alphabetic characters (text) vs. purely numeric/categorical data (metadata). This is controlled by the `inferTextColumns()` function, which can be overridden via `textColumns` in the config.

2. **Content + metadata separation**: Text columns are formatted as "ColumnName: value" and embedded, while metadata columns are stored separately in chunk metadata. This allows semantic search over text while preserving structured data for programmatic use.

3. **Metadata preservation**: During retrieval, both the embedded text content and the original row metadata are available, allowing the LLM to reference specific values (e.g., "Company X had revenue of $1M in 2023") and enabling post-retrieval filtering.

### How to Adjust for Different Use Cases

- **For CSVs with mixed text/numeric columns**: Let auto-inference work, or manually specify `textColumns` if the heuristic misclassifies (e.g., if a numeric column like "Year" should be searchable text).

- **For CSVs with many metadata columns**: Explicitly set `metadataColumns` to control which columns are shown during querying, reducing noise in the prompt.

- **For very wide CSVs**: Consider specifying only the most important text columns in `textColumns` to focus embedding on the most relevant content and reduce token usage.

- **For CSVs with long text fields**: Adjust `chunkSize` and `chunkOverlap` to handle multi-paragraph notes or descriptions within single rows.

## Configuration

All settings live in `config/csv-rag.config.json`:

| Field | Description |
| --- | --- |
| `chunkSize` / `chunkOverlap` | Controls how each synthesized row document is chunked. Larger chunks preserve more context; higher overlap reduces boundary loss. |
| `topK` | Number of chunks to retrieve per query. |
| `embeddingModel` / `chatModel` | OpenAI models used for embeddings and generation. |
| `dataPath` | Kept for parity with other projects. CSVs may also live elsewhere. |
| `indexPath` | Where the serialized vector store is written (always under `.tmp/`). |
| `csvPath` | Absolute or relative path to the CSV file that should be ingested. |
| `textColumns` | Optional list of columns that should become the chunk body. When omitted, the ingest pipeline auto-selects columns that contain alphabetic characters. |
| `metadataColumns` | Optional list of columns to keep as metadata (displayed during querying). Defaults to “all other columns.” |
| `delimiter` | Override when your CSV uses `;` or `\t`. Defaults to `,`. |

Example (shipped in this repo):

```json
{
  "chunkSize": 800,
  "chunkOverlap": 200,
  "topK": 4,
  "embeddingModel": "text-embedding-3-small",
  "chatModel": "gpt-4o-mini",
  "dataPath": "data",
  "indexPath": ".tmp/index/csv-rag.index.json",
  "csvPath": "data/company_metrics.csv",
  "textColumns": ["Notes"],
  "metadataColumns": ["Year", "Category", "Metric"],
  "delimiter": ","
}
```

## Sample Data

`data/company_metrics.csv` tracks sustainability, finance, and innovation updates. Feel free to replace it with your own CSV as long as it contains a header row.

## Setup

From the repository root:

```bash
pnpm install
export OPENAI_API_KEY=sk-your-key
```

Inside this project:

```bash
cd projects/csv-rag
pnpm run ingest
pnpm run query
```

## What happens during ingestion?

1. `.env` / environment variables are loaded to access the OpenAI API key.
2. The CSV config is validated (`csvPath`, `textColumns`, etc.).
3. Rows are read via the shared CSV helper (handles quoted commas and escaped quotes).
4. Text vs. metadata columns are inferred when not specified.
5. Each row becomes a `Document` whose `content` is the joined text columns and whose metadata keeps contextual fields (year, metric, etc.).
6. Documents are chunked using the shared `simpleChunkDocument` helper.
7. Embeddings + chunks are written to `.tmp/index/csv-rag.index.json`.

Console output resembles:

```
{"level":"info","message":"CSV stats","meta":{"csvPath":"data/company_metrics.csv","rowCount":3,"textColumns":["Notes"],"metadataColumns":["Year","Category","Metric","Value"]}}
{"level":"info","message":"CSV ingestion complete","meta":{"indexPath":"/.../.tmp/index/csv-rag.index.json"}}
```

## Query CLI

Run `pnpm run query`, ask questions, and type `exit` to quit. The CLI:

1. Loads the serialized vector index.
2. Embeds the incoming question.
3. Retrieves the top `k` chunks (rows) and prints their similarity scores plus metadata.
4. Builds a prompt instructing the LLM to answer strictly with CSV evidence.
5. Prints the grounded answer.

Example interaction:

```
> Where did revenue grow?

Answer:
Revenue grew to $51B according to the finance category row for 2023, which attributes growth to North America and digital channels.
```

## Testing

Unit tests cover ingestion utilities (column inference, document construction, dependency orchestration) and query helpers. Run them with:

```bash
pnpm --filter csv-rag test
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Unable to determine text columns” | Set `textColumns` explicitly in the config. |
| “CSV file not found” | Ensure `csvPath` is relative to `projects/csv-rag` or provide an absolute path. |
| CLI answers “I don't know based on the CSV” | The retrieved rows did not contain the answer; verify your CSV content or increase `topK`. |

## Extending

- Add additional metadata columns to show more context during querying.
- Generate multiple per-row documents by splitting long notes into sections before chunking.
- Swap in a different delimiter (e.g., `;`) via the config to ingest European exports.
