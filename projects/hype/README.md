# HyPE (Hypothetical Prompt Embedding) RAG

## Overview

This project implements **HyPE (Hypothetical Prompt Embedding)**, a technique that improves retrieval quality by pre-generating hypothetical questions for each chunk during ingestion, then matching user queries against these question embeddings at query time.

HyPE addresses the same semantic gap problem as HyDE, but takes a different approach: instead of generating hypothetical documents at runtime, HyPE pre-generates hypothetical questions during ingestion. This transforms retrieval into a **question-question matching problem** rather than a question-document matching problem.

## What Makes This Project Unique

**HyPE** introduces **offline question generation** and **multiple embeddings per chunk**:

- **Pre-computed Question Embeddings**: During ingestion, each chunk is analyzed to generate multiple hypothetical questions that the chunk can answer. These questions are embedded and stored with the chunk.

- **Question-Question Matching**: At query time, the user's query is matched against question embeddings (not chunk embeddings). This eliminates the query-document semantic gap because questions match questions.

- **Multiple Embeddings Per Chunk**: Each chunk has multiple question embeddings (typically 3-5), providing better coverage and increasing the likelihood of matching user queries.

- **No Runtime Generation Cost**: Unlike HyDE, which generates documents at query time, HyPE pre-computes everything during ingestion, making queries faster.

### How Unique Concepts Work

#### Hypothetical Question Generation (Offline)

**The Problem**: Traditional RAG embeds queries (questions) and documents (answers), creating a semantic mismatch. When we search, we're comparing question embeddings to document embeddings, which exist in different semantic spaces.

**The Solution**: HyPE generates hypothetical questions that chunks answer, then embeds those questions. At query time, we match the user's query (a question) against stored question embeddings (also questions), creating better semantic alignment.

**How it works during ingestion**:
1. For each document chunk:
   - Uses an LLM to generate multiple questions (e.g., 3-5) that the chunk answers
   - Embeds each question separately
   - Stores the chunk with all question embeddings
2. The vector store now contains question embeddings, not chunk embeddings

**Example**:
- Chunk: "Climate change is caused by greenhouse gases like CO2 and methane..."
- Generated Questions:
  1. "What causes climate change?"
  2. "What are greenhouse gases?"
  3. "How do CO2 and methane contribute to climate change?"
- Each question is embedded and stored with the chunk

**How it works during querying**:
1. User query: "What causes climate change?"
2. Query is embedded
3. Search matches query embedding against question embeddings
4. Finds chunks whose questions match the query
5. Returns those chunks (deduplicated if multiple questions from same chunk match)

**Why this works**: Questions match questions better than questions match documents. The semantic alignment in the embedding space is improved because we're comparing like with like.

**Configuration**: Controlled by `questionGenModel` (LLM for question generation) and `questionsPerChunk` (target number of questions per chunk) in the config.

#### Multiple Embeddings Per Chunk

**The Problem**: A single embedding per chunk may not capture all the ways a user might query for that information.

**The Solution**: HyPE generates multiple questions per chunk, creating multiple embeddings. This provides:
- **Better Coverage**: Different questions capture different aspects of the chunk
- **Higher Match Probability**: More embeddings = more chances to match user queries
- **Deduplication**: If multiple questions from the same chunk match, the chunk is returned once with its best match score

**Configuration**: `questionsPerChunk` controls how many questions to generate (default: 4, range: 3-6 recommended).

### How to Adjust for Different Use Cases

- **For better question quality**: Use `gpt-4o` for `questionGenModel` to generate more accurate and relevant questions
- **For cost efficiency**: Use `gpt-4o-mini` for `questionGenModel` (default)
- **For better coverage**: Increase `questionsPerChunk` to 5-6 (more questions = better match probability, but slower ingestion)
- **For faster ingestion**: Decrease `questionsPerChunk` to 2-3 (fewer questions = faster, but less coverage)
- **For specific domains**: Adjust the question generation prompt in `src/hype.ts` to generate domain-specific questions

## Configuration

The project is configured via `config/hype.config.json`:

```json
{
  "chunkSize": 800,
  "chunkOverlap": 200,
  "topK": 4,
  "embeddingModel": "text-embedding-3-small",
  "chatModel": "gpt-4o-mini",
  "dataPath": "data",
  "indexPath": ".tmp/index/hype.index.json",
  "questionGenModel": "gpt-4o-mini",
  "questionsPerChunk": 4
}
```

### Configuration Parameters Explained

**Standard RAG Parameters** (same as basic-rag):
- `chunkSize`: Characters per chunk (default: 800)
- `chunkOverlap`: Overlap between chunks (default: 200)
- `topK`: Number of chunks to retrieve (default: 4)
- `embeddingModel`: OpenAI embedding model (default: "text-embedding-3-small")
- `chatModel`: LLM for answer generation (default: "gpt-4o-mini")
- `dataPath`: Path to documents directory (default: "data")
- `indexPath`: Path to vector index file (default: ".tmp/index/hype.index.json")

**HyPE Specific Parameters**:
- `questionGenModel`: LLM model for generating hypothetical questions (default: "gpt-4o-mini")
  - Use `gpt-4o-mini` for cost efficiency
  - Use `gpt-4o` for better question quality
- `questionsPerChunk`: Target number of questions to generate per chunk (default: 4)
  - Range: 3-6 recommended
  - More questions = better coverage but slower ingestion and more storage
  - Fewer questions = faster ingestion but less coverage

### Runtime Data Directory (`.tmp/`)

- Generated artifacts (vector indexes) are written to `.tmp/`
- The directory is committed (via `.gitkeep`) but contents are ignored
- Deleting `.tmp/` is safe; `pnpm run ingest` will recreate files

## Setup

1. **Install dependencies** (from repository root):
   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   Create a `.env` file at the repository root with:
   ```bash
   OPENAI_API_KEY=your-api-key-here
   ```

3. **Prepare sample data**:
   Place `.txt` or `.md` files in the `data/` directory. You can copy sample data from `projects/basic-rag/data/`.

## Usage

### Step 1: Ingest Documents with Question Generation

This script reads documents, chunks them, generates hypothetical questions for each chunk, embeds the questions, and stores them in a vector index.

```bash
cd projects/hype
pnpm run ingest
```

**What happens during ingestion:**
1. Loads configuration from `config/hype.config.json`
2. Reads all `.txt` and `.md` files from the `data/` directory
3. Splits documents into chunks with configurable size and overlap
4. **For each chunk**:
   - Generates multiple hypothetical questions (using `questionGenModel`)
   - Embeds each question separately
   - Stores chunk with all question embeddings
5. Persists the enhanced vector store to `.tmp/index/hype.index.json`

**Expected output:**
```
{"level":"info","message":"Loading config",...}
{"level":"info","message":"Reading documents",...}
{"level":"info","message":"Loaded documents","meta":{"count":1}}
{"level":"info","message":"Created chunks","meta":{"count":625}}
{"level":"info","message":"Generating hypothetical questions and embeddings",...}
{"level":"info","message":"Generated questions for chunk",...}
{"level":"info","message":"Generated all questions and embeddings",...}
{"level":"info","message":"Persisted HyPE vector index",...}
```

**Note**: Ingestion takes longer than basic-rag because it generates questions and creates multiple embeddings per chunk. Expect 3-5x longer ingestion time.

### Step 2: Query with HyPE

This script loads the vector index and provides an interactive CLI for asking questions using HyPE.

```bash
cd projects/hype
pnpm run query
```

**What happens during querying:**
1. Loads the HyPE vector index from the persisted file
2. Initializes embedding and chat clients
3. Enters an interactive loop:
   - Prompts for a question
   - **Embeds the user's query**
   - **Searches against question embeddings** (not chunk embeddings)
   - Retrieves chunks whose questions matched the query
   - Constructs a prompt with retrieved context
   - Generates answer using the LLM
   - Displays answer and retrieval scores

**Example interaction:**
```
> What causes climate change?
```

The system will:
1. Embed the query: "What causes climate change?"
2. Search against question embeddings (e.g., finds chunks with questions like "What causes climate change?" or "What are the causes of climate change?")
3. Retrieve matching chunks
4. Generate answer based on retrieved context
5. Display:
   - The answer
   - Retrieval scores

## Validation Scenario

To verify that ingestion and querying work correctly, use this validation scenario:

**Setup**: Ensure you have ingested documents (run `pnpm run ingest`).

**Test Query**: "What is Nike's revenue strategy?"

**Expected Behavior**:
1. The system should retrieve chunks whose hypothetical questions match "revenue strategy"
2. The answer should mention revenue-related strategies from the document
3. Similarity scores should be logged (typically 0.7-0.9 for relevant matches)
4. The logs should show:
   - Query embedding generation
   - Search against question embeddings
   - Retrieval results with scores
   - Answer generation status

**Verification**: Check the logs for:
- Question generation during ingestion (questions per chunk, total questions)
- Query embedding generation
- Question embedding search results
- Retrieval scores and chunk counts
- Answer generation status

## Expected Outcomes

After running ingestion:
- Vector index file created at `.tmp/index/hype.index.json`
- Logs showing:
  - Document count and chunk count
  - Total questions generated
  - Total embeddings created (should be chunks × questionsPerChunk)
  - Average questions per chunk
- Ingestion takes longer than basic-rag (due to question generation)

After running queries:
- Answers generated based on retrieved context
- Retrieval scores displayed for transparency
- Answers should be more relevant than basic-rag for question-like queries
- Query time is similar to basic-rag (no runtime LLM calls for generation)

**Key Differences from Other Techniques**:
- **vs Basic RAG**: Better retrieval for question-like queries (question-question matching)
- **vs HyDE**: Faster queries (no runtime document generation), but slower ingestion (pre-generates questions)
- **vs Query Transform**: Pre-computes questions during ingestion rather than transforming queries at runtime

## Understanding the Code

### Key Components

1. **`src/hype.ts`**: Core HyPE functionality
   - `generateHypotheticalQuestions()`: Generates multiple questions for a chunk

2. **`src/vectorStore.ts`**: Enhanced vector store for HyPE
   - `HyPEVectorStore`: Stores chunks with multiple question embeddings
   - `search()`: Matches query against question embeddings, deduplicates chunks

3. **`src/ingest.ts`**: Enhanced ingestion pipeline
   - Generates questions for each chunk
   - Embeds all questions
   - Stores chunks with multiple embeddings

4. **`src/query.ts`**: Query pipeline with HyPE
   - `answerQuestionWithHyPE()`: Embeds query and searches against question embeddings
   - Interactive CLI for querying

### Algorithm Overview

**HyPE Ingestion Pipeline**:
1. **Input**: Documents
2. **Chunk**: Split documents into chunks
3. **Generate Questions**: For each chunk, generate multiple hypothetical questions
4. **Embed Questions**: Embed each question separately
5. **Store**: Store chunk with all question embeddings

**HyPE Query Pipeline**:
1. **Input**: User query
2. **Embed Query**: Convert query to vector
3. **Search Questions**: Match query embedding against question embeddings
4. **Retrieve Chunks**: Return chunks whose questions matched (deduplicated)
5. **Generate**: Use retrieved context to generate answer

**Key Insight**: By matching questions to questions instead of questions to documents, we improve semantic alignment and retrieval relevance.

## Troubleshooting

**Problem**: Ingestion is very slow
- **Solution**: Reduce `questionsPerChunk` to 2-3, or use `gpt-4o-mini` for `questionGenModel`.

**Problem**: Questions generated are not relevant
- **Solution**: Use `gpt-4o` for `questionGenModel` to get better quality questions.

**Problem**: Not enough questions per chunk
- **Solution**: Increase `questionsPerChunk` to 5-6, but expect slower ingestion.

**Problem**: HyPE doesn't improve results compared to basic-rag
- **Solution**: This is expected for some queries. HyPE works best for question-like queries. For statement-like queries, basic-rag may perform similarly.

**Problem**: Index file not found
- **Solution**: Run `pnpm run ingest` first to create the vector index.

**Problem**: Out of memory during ingestion
- **Solution**: Process documents in smaller batches, or reduce `questionsPerChunk`.

## Related Projects

- **`basic-rag`**: Baseline RAG without question generation (compare results)
- **`hyde`**: Uses runtime hypothetical document generation (compare approach)
- **`query-transform`**: Transforms queries at runtime (compare approach)

