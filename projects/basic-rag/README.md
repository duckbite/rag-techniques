# Basic RAG (Retrieval-Augmented Generation)

## Overview

This project implements a foundational Retrieval-Augmented Generation (RAG) system. RAG combines information retrieval with generative language models to provide accurate, contextually rich responses by:

1. **Ingesting** documents and splitting them into manageable chunks
2. **Embedding** those chunks into vector representations
3. **Storing** the embeddings in a searchable vector index
4. **Retrieving** relevant chunks when answering questions
5. **Generating** answers using an LLM with the retrieved context

This is the simplest RAG implementation and serves as the baseline for understanding more advanced techniques in other projects.

## What This Project Demonstrates

- **Document Processing**: Reading text files and splitting them into chunks with configurable size and overlap
- **Embedding Generation**: Converting text chunks into dense vector representations using OpenAI's embedding models
- **Vector Storage**: Storing and searching embeddings using cosine similarity
- **Retrieval**: Finding the most relevant document chunks for a given query
- **Context-Augmented Generation**: Using retrieved chunks as context for LLM-based question answering

## Prerequisites

- Node.js 22+ and pnpm installed
- OpenAI API key (set in `.env` file at repository root)
- Sample documents in the `data/` directory

## Configuration

The project is configured via `config/basic-rag.config.json`:

```json
{
  "chunkSize": 800,           // Number of characters per chunk
  "chunkOverlap": 200,        // Characters of overlap between chunks
  "topK": 4,                  // Number of chunks to retrieve per query
  "embeddingModel": "text-embedding-3-small",  // OpenAI embedding model
  "chatModel": "gpt-4o-mini", // OpenAI chat model for generation
  "dataPath": "data",          // Relative path to documents directory
  "indexPath": ".tmp/index/basic-rag.index.json"  // Where to save/load the vector index (stored outside git-tracked code)
```

### Configuration Parameters Explained

- **chunkSize**: Larger chunks preserve more context but may include irrelevant information. Smaller chunks are more focused but may lose context.
- **chunkOverlap**: Overlap prevents important information from being split across chunk boundaries. 200 characters is a good default for 800-character chunks.
- **topK**: Number of chunks to retrieve. More chunks provide more context but may include less relevant information. Start with 4-5.
- **embeddingModel**: OpenAI embedding models. `text-embedding-3-small` is cost-effective; `text-embedding-3-large` may provide better quality.
- **chatModel**: The LLM used for generating answers. `gpt-4o-mini` balances cost and quality; `gpt-4o` provides better reasoning.

### Runtime Data Directory (`.tmp/`)

- Generated artifacts (vector indexes, evaluation outputs, temporary logs) are written to the project-local `.tmp/` directory.
- The directory itself is committed (via `.gitkeep`) so everyone knows where runtime files belong, but its contents are ignored to keep the repository clean.
- Deleting `.tmp/` is safe; `pnpm run ingest` will recreate the files.

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
   Place `.txt` or `.md` files in the `data/` directory. The project includes sample data from the original RAG_Techniques repository.

## Usage

### Step 1: Ingest Documents

This script reads documents from the `data/` directory, splits them into chunks, generates embeddings, and stores them in a vector index.

```bash
cd projects/basic-rag
pnpm run ingest
```

**What happens during ingestion:**
1. Loads configuration from `config/basic-rag.config.json`
2. Reads all `.txt` and `.md` files from the `data/` directory
3. Splits each document into chunks of `chunkSize` characters with `chunkOverlap` overlap
4. Generates embeddings for each chunk using the specified embedding model
5. Stores chunks and embeddings in an in-memory vector store
6. Persists the vector store to `.tmp/index/basic-rag.index.json`

**Expected output:**
```
{"level":"info","message":"Loading config",...}
{"level":"info","message":"Reading documents",...}
{"level":"info","message":"Loaded documents","meta":{"count":1}}
{"level":"info","message":"Created chunks","meta":{"count":625}}
{"level":"info","message":"Persisted vector store to .../.tmp/index/basic-rag.index.json"}
```

### Step 2: Query the RAG System

This script loads the vector index and provides an interactive CLI for asking questions.

```bash
cd projects/basic-rag
pnpm run query
```

**What happens during querying:**
1. Loads the vector index from the persisted file
2. Initializes embedding and chat clients
3. Enters an interactive loop:
   - Prompts for a question
   - Embeds the question into a vector
   - Searches the vector store for the top-K most similar chunks
   - Constructs a prompt with the retrieved context
   - Sends the prompt to the LLM for answer generation
   - Displays the answer with source chunk information

**Example interaction:**
```
> What is Nike's revenue strategy?
```

The system will:
- Find the 4 most relevant chunks from the ingested documents
- Show similarity scores for each chunk
- Generate an answer based on those chunks
- Display the answer

Type `exit` to quit the interactive session.

### Testing

Unit tests cover the ingestion and query pipelines (document parsing, chunking, dependency wiring, and prompt construction). Run them from the repository root or inside this package:

```bash
# From repo root
pnpm --filter basic-rag test

# Or inside projects/basic-rag
pnpm test
```

## Expected Outcomes

### After Ingestion

- A vector index file is created at `.tmp/index/basic-rag.index.json`
- The file contains all document chunks with their embeddings
- You can see how many chunks were created from your documents

### During Querying

- **Relevant Retrieval**: The system should retrieve chunks that are semantically similar to your question
- **Contextual Answers**: Answers should be grounded in the retrieved document content
- **Transparency**: You can see which chunks were used (with similarity scores) to understand the retrieval process
- **Fallback Behavior**: If the answer isn't in the context, the LLM should say it doesn't know

### Example Queries and Expected Behavior

**Query**: "What is the main topic of the document?"
- **Expected**: Retrieves chunks containing overview or introduction content
- **Answer**: Should summarize the document's main themes

**Query**: "What are the key financial metrics?"
- **Expected**: Retrieves chunks with numbers, statistics, or financial data
- **Answer**: Should list specific metrics mentioned in the documents

**Query**: "What is the weather today?"
- **Expected**: Retrieves chunks (if any) but they won't be relevant
- **Answer**: Should indicate that the information is not available in the provided context

## Understanding the Code

### Key Components

1. **`ingest.ts`**: Document ingestion pipeline
   - `readDocumentsFromDir()`: Reads and parses text files
   - `simpleChunkDocument()`: Splits documents into overlapping chunks
   - `main()`: Orchestrates the ingestion process

2. **`query.ts`**: Interactive query interface
   - `interactiveQuery()`: Main query loop that handles user input and generates answers

3. **Shared Utilities** (in `shared/typescript/utils/`):
   - `vectorStore.ts`: Vector storage and similarity search
   - `llm.ts`: OpenAI client wrappers for embeddings and chat
   - `config.ts`: Configuration loading and validation
   - `types.ts`: TypeScript type definitions

### How It Works: The RAG Pipeline

```
Documents → Chunking → Embedding → Vector Store
                                    ↓
Query → Embedding → Similarity Search → Top-K Chunks → LLM Prompt → Answer
```

1. **Chunking**: Documents are split into smaller pieces to fit embedding model limits and improve retrieval precision
2. **Embedding**: Text chunks are converted to dense vectors that capture semantic meaning
3. **Storage**: Vectors are stored with their original text for later retrieval
4. **Retrieval**: Query is embedded and compared to stored vectors using cosine similarity
5. **Generation**: Retrieved chunks are used as context for the LLM to generate an answer

## Troubleshooting

### "OPENAI_API_KEY is not set"
- Ensure you have a `.env` file at the repository root with your API key
- The `loadEnv()` function should automatically find and load it

### "Config file not found"
- Ensure `config/basic-rag.config.json` exists in the project directory
- Or set `RAG_CONFIG_PATH` environment variable to point to your config

### "Vector index file not found"
- Run `pnpm run ingest` first to create the index
- Check that `indexPath` in config points to the correct location

### Poor retrieval quality
- Try adjusting `chunkSize` and `chunkOverlap` in the config
- Increase `topK` to retrieve more chunks
- Consider using a larger embedding model

### Answers not grounded in context
- Check the similarity scores of retrieved chunks (lower scores = less relevant)
- Verify your documents contain information relevant to the query
- The LLM prompt instructs it to say "I don't know" if context is insufficient

## Next Steps

After understanding this basic RAG implementation, explore other projects:

- **`projects/rerank/`**: Adds a reranking step to improve retrieval quality
- **`projects/query-rewrite/`**: Implements query transformation techniques like HyDE

Each project builds upon the concepts demonstrated here while introducing new techniques.

