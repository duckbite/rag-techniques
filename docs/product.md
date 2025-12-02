# rag-techniques

Typescript port of https://github.com/NirDiamant/RAG_Techniques

- uses typescript instead of python
- each subproject has a README.md file explaining what it does and how to use it
- instead of one long notebook divide into various scripts / functions per project responsible for a single task or task group (e.g. db initialization, creating embeddings and inserting items in db, read from db, perform analysis, etc.). Make this a logical distribution per project.
- main project has universal functionality (e.g. adapters to datas sources, example data files, common types, etc)
- This is project for learning and understanding the code around RAG techniques. Describe the code extensively with JSdoc


## Roadmap & Tracking

- We are porting the 34 techniques documented in [`NirDiamant/RAG_Techniques`](https://github.com/NirDiamant/RAG_Techniques) into standalone TypeScript projects under `projects/`.
- `projects/basic-rag` is complete and acts as the baseline for the remaining work.
- **Phase 1 (Complete)**: `projects/csv-rag` adds structured CSV ingestion with automatic column inference. `projects/reliable-rag` validates retrieved chunks via similarity + lexical overlap. `projects/chunk-optimizer` benchmarks chunk sizes/overlaps. `projects/proposition-chunking` generates and grades LLM-derived propositions.
- **Phase 2 (Complete)**: `projects/query-transform` implements query rewriting, step-back prompting, and sub-query decomposition. `projects/hyde` uses runtime hypothetical document generation for retrieval. `projects/hype` pre-generates hypothetical questions during ingestion for question-question matching.
- Active planning, sequencing, and status for each upcoming project now lives in `docs/plan.md`; update that file whenever scope, ordering, or ownership changes.
- We will prioritize foundational techniques (CSV ingestion, reliable RAG, advanced chunking) before moving into query enhancement, context enrichment, advanced retrieval, evaluation, explainability, and graph/agent architectures to keep dependencies manageable.

## Documentation Requirements

Since these projects are for learning, comprehensive documentation is required for each project.

### Main README.md Requirements

The main `README.md` file contains the following:

- Project Description and rationale
- **Separate Mermaid diagrams** for document ingestion and query processing, with short explanations of the various elements in each process
- Project Structure
- Prerequisites
- Table with projects, including name, description, what the project demonstrates and link to project README.

### Project README.md Requirements

Each project in `projects/` must include a `README.md` file that contains:

1. **Overview Section**: 
   - What the project does and what RAG technique it demonstrates
   - How it differs from or builds upon other projects
   - Key concepts and learning objectives
   - **What makes this project unique**: A dedicated subsection explaining the unique concepts, algorithms, or techniques that distinguish this project from others (e.g., dual-criteria validation in reliable-rag, proposition extraction in proposition-chunking, column inference in csv-rag)
   - **How unique concepts work and can be adjusted**: Clear explanation of the unique mechanisms, what configuration parameters control them, and how to tune them for different use cases

2. **Configuration Section**:
   - Description of all configuration parameters
   - Explanation of what each parameter does and how it affects behavior
   - Example configuration files with comments
   - Guidance on choosing appropriate values

3. **Setup Instructions**:
   - Prerequisites (Node.js version, dependencies, API keys, etc.)
   - Step-by-step setup process
   - How to prepare sample data

4. **Usage Instructions**:
   - How to run each script/command
   - What happens during execution (step-by-step explanation)
   - Example commands with expected output
   - How to interpret results
   - At least one **validation scenario** under the Usage section that shows a concrete test (command + query) and the expected answer/behavior for the default sample data, so users can quickly verify that ingestion and querying work end-to-end

5. **Expected Outcomes**:
   - What should happen after running each script
   - What results to expect and how to verify correctness
   - Example queries and expected behaviors
   - Common success indicators

6. **Understanding the Code**:
   - Overview of key components and their roles
   - High-level explanation of the algorithm/pipeline
   - How the technique works conceptually
   - **Mermaid diagrams** for ingestion and query processes if they differ from the basic RAG process shown in the main README (required for projects with unique processing steps like CSV-RAG, proposition-chunking, HyDE, HyPE, query-transform, reliable-rag, etc.)

7. **Troubleshooting**:
   - Common errors and their solutions
   - How to debug issues
   - Tips for improving results

### Logging and Observability Requirements

All projects must include extensive logging during ingestion and query operations when `LOG_LEVEL=info` (or when no `LOG_LEVEL` is set, defaulting to `info`):

1. **Ingestion Logging**:
   - Progress indicators for each major step (reading documents, chunking, embedding, storing)
   - Per-item details for unique operations (e.g., propositions generated/graded per chunk, columns inferred per CSV)
   - Summary statistics at the end (total documents processed, chunks created, embeddings generated, storage location)
   - Error context with enough detail to diagnose issues

2. **Query Logging**:
   - Query received and processed
   - Retrieval results (number of chunks retrieved, similarity scores)
   - For projects with unique validation/processing steps, log those details (e.g., validation scores, overlap metrics, proposition matches)
   - Final answer generation status
   - Summary of the query operation (retrieval quality, answer confidence indicators if applicable)

3. **Summary Requirements**:
   - End-of-ingestion summary: total counts, success/failure rates, key metrics
   - Per-query summary: retrieval quality, validation results (if applicable), answer generation status
   - Use structured logging (JSON format via the logger) for easy parsing and analysis

4. **Log Level Behavior**:
   - `LOG_LEVEL=info`: Full detailed logging including summaries
   - `LOG_LEVEL=warn`: Only warnings and errors
   - `LOG_LEVEL=error`: Only errors
   - Default to `info` if not set

### Code Documentation Requirements

All code must include extensive JSDoc comments to help students understand:

1. **Function Documentation**:
   - `@param` tags for all parameters with descriptions
   - `@returns` tags describing return values
   - `@throws` tags for any errors that may be thrown
   - `@example` tags with code examples showing usage

2. **Class Documentation**:
   - Class-level JSDoc explaining the class's purpose and role
   - When to use this class vs alternatives
   - Example usage patterns

3. **Algorithm Explanations**:
   - Step-by-step explanations of complex algorithms
   - Why certain approaches are used
   - Trade-offs and considerations

4. **Conceptual Context**:
   - How functions fit into the larger RAG pipeline
   - What problem each function solves
   - Relationships between different components

5. **Educational Value**:
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
