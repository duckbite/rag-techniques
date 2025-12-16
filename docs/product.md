# RAG Techniques - TypeScript Port

This project ports [Nir Diamant's RAG Techniques repo](https://github.com/NirDiamant/RAG_Techniques) to TypeScript to make the patterns and building blocks accessible and practical in a modern JavaScript/TypeScript stack, not just in Python-centric environments.

## Project Overview

### Rationale

This TypeScript port provides several key benefits:

1. **JavaScript/TypeScript Ecosystem Alignment**
   - Many production systems, especially web and serverless backends, run on Node.js / Deno
   - RAG techniques can be used directly without needing a separate Python service
   - Seamless integration with existing JS/TS infrastructure

2. **End-to-End Type Safety**
   - Compile-time validation of data structures across the entire RAG pipeline
   - Covers document loaders, chunking, embeddings, vector search, and LLM calls
   - Reduces subtle runtime errors and makes refactors safer

3. **Isomorphic Code Reuse**
   - Share core logic across multiple deployment targets:
     - Backend APIs (Node, serverless functions)
     - Frontend apps (React, Next.js, etc.)
     - Edge runtimes (Cloudflare Workers, Vercel Edge, etc.)
   - Enables experimentation with RAG logic placement without full rewrites

4. **Easier Integration**
   - Many codebases already use TypeScript for domain logic, APIs, and infrastructure
   - RAG techniques integrate as first-class modules rather than isolated services
   - Works seamlessly with existing TypeScript SDKs (databases, queues, storage)

5. **Broader Developer Reach**
   - JavaScript/TypeScript has a very large developer base
   - Lowers the barrier for:
     - Web developers who know JS/TS but not Python
     - Teams wanting to prototype and deploy quickly using existing skills
   - Amplifies the impact by opening to another large community

6. **Ecosystem and Tooling Benefits**
   - Works well with modern bundlers and build tools
   - Integrates with linting and formatting standards
   - Compatible with typed SDKs for vector databases, LLM providers, and cloud platforms
   - Fits naturally into current JS tooling and CI/CD workflows

## Core Requirements

- **Language**: TypeScript instead of Python
- **Documentation**: Each subproject has a `README.md` file explaining what it does and how to use it
- **Code Organization**: Instead of one long notebook, divide into various scripts/functions per project responsible for a single task or task group (e.g., database initialization, creating embeddings and inserting items in DB, reading from DB, performing analysis, etc.). Make this a logical distribution per project.
- **Shared Code**: Main project has universal functionality (e.g., adapters to data sources, example data files, common types, etc.)
- **Educational Focus**: This is a project for learning and understanding RAG techniques. Code must be extensively documented with JSDoc

## Roadmap & Tracking

We are porting the 34 techniques documented in [`NirDiamant/RAG_Techniques`](https://github.com/NirDiamant/RAG_Techniques) into standalone TypeScript projects under `projects/`.

For detailed information about project status, completed phases, and upcoming work, see [`docs/plan.md`](docs/plan.md).

## Documentation Requirements

Since these projects are for learning, comprehensive documentation is required for each project.

### Main README.md Requirements

The main `README.md` file contains the following:

- Project Description and rationale
- **Separate Mermaid diagrams** for document ingestion and query processing, with short explanations of the various elements in each process
- Project Structure
- Prerequisites
- Table with projects, including name, description, what the project demonstrates and link to project README

### Project README.md Requirements

Each project in `projects/` must include a `README.md` file that contains:

#### 1. Overview Section

- What the project does and what RAG technique it demonstrates
- How it differs from or builds upon other projects
- Key concepts and learning objectives
- **What makes this project unique**: A dedicated subsection explaining the unique concepts, algorithms, or techniques that distinguish this project from others (e.g., dual-criteria validation in reliable-rag, proposition extraction in proposition-chunking, column inference in csv-rag)
- **How unique concepts work and can be adjusted**: Clear explanation of the unique mechanisms, what configuration parameters control them, and how to tune them for different use cases

#### 2. Configuration Section

- Description of all configuration parameters
- Explanation of what each parameter does and how it affects behavior
- Example configuration files with comments
- Guidance on choosing appropriate values

#### 3. Setup Instructions

- Prerequisites (Node.js version, dependencies, API keys, etc.)
- Step-by-step setup process
- How to prepare sample data

#### 4. Usage Instructions

- How to run each script/command
- What happens during execution (step-by-step explanation)
- Example commands with expected output
- How to interpret results
- At least one **validation scenario** under the Usage section that shows a concrete test (command + query) and the expected answer/behavior for the default sample data, so users can quickly verify that ingestion and querying work end-to-end

#### 5. Expected Outcomes

- What should happen after running each script
- What results to expect and how to verify correctness
- Example queries and expected behaviors
- Common success indicators

#### 6. Understanding the Code

- Overview of key components and their roles
- High-level explanation of the algorithm/pipeline
- How the technique works conceptually
- **Mermaid diagrams** for ingestion and query processes if they differ from the basic RAG process shown in the main README (required for projects with unique processing steps like CSV-RAG, proposition-chunking, HyDE, HyPE, query-transform, reliable-rag, etc.)

#### 7. Troubleshooting

- Common errors and their solutions
- How to debug issues
- Tips for improving results

### Logging and Observability Requirements

All projects must include extensive logging during ingestion and query operations when `LOG_LEVEL=info` (or when no `LOG_LEVEL` is set, defaulting to `info`):

#### Ingestion Logging

- Progress indicators for each major step (reading documents, chunking, embedding, storing)
- Per-item details for unique operations (e.g., propositions generated/graded per chunk, columns inferred per CSV)
- Summary statistics at the end (total documents processed, chunks created, embeddings generated, storage location)
- Error context with enough detail to diagnose issues

#### Query Logging

- Query received and processed
- Retrieval results (number of chunks retrieved, similarity scores)
- For projects with unique validation/processing steps, log those details (e.g., validation scores, overlap metrics, proposition matches)
- Final answer generation status
- Summary of the query operation (retrieval quality, answer confidence indicators if applicable)

#### Summary Requirements

- End-of-ingestion summary: total counts, success/failure rates, key metrics
- Per-query summary: retrieval quality, validation results (if applicable), answer generation status
- Use the shared logger for **pretty, human-friendly CLI logging** (timestamp + colored levels) while still including structured `meta` details as JSON on a second line when needed

#### Log Level Behavior

- `LOG_LEVEL=info`: Full detailed logging including summaries
- `LOG_LEVEL=warn`: Only warnings and errors
- `LOG_LEVEL=error`: Only errors
- Default to `info` if not set

### Code Documentation Requirements

All code must include extensive JSDoc comments to help students understand:

#### Function Documentation

- `@param` tags for all parameters with descriptions
- `@returns` tags describing return values
- `@throws` tags for any errors that may be thrown
- `@example` tags with code examples showing usage

#### Class Documentation

- Class-level JSDoc explaining the class's purpose and role
- When to use this class vs alternatives
- Example usage patterns

#### Algorithm Explanations

- Step-by-step explanations of complex algorithms
- Why certain approaches are used
- Trade-offs and considerations

#### Conceptual Context

- How functions fit into the larger RAG pipeline
- What problem each function solves
- Relationships between different components

#### Educational Value

- Explanations that help students understand not just "what" but "why"
- References to relevant concepts (e.g., "cosine similarity", "semantic search")
- Notes about production considerations vs educational simplicity

### Documentation Standards

- Use clear, accessible language suitable for students learning RAG concepts
- Include diagrams or ASCII art where helpful (in README files)
- Provide both high-level overviews and detailed explanations
- Link to related projects and concepts
- Keep examples practical and relevant
- Update documentation when code changes

## Runtime Data Storage Requirements

- Each project must store generated artifacts (vector indexes, evaluation logs, temp files) inside a project-local `.tmp/` directory.
- The `.tmp/` directory should be committed (with `.gitkeep`) so contributors know where runtime files belong, but contents should be ignored via `.gitignore`.
- Configuration files should default to writing indexes under `.tmp/` (e.g., `.tmp/index/<project>.index.json`).
- README files must explain the purpose of `.tmp/` and how to regenerate its contents.
