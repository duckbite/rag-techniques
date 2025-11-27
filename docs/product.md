# rag-techniques

Typescript port of https://github.com/NirDiamant/RAG_Techniques

* uses typescript instead of python
* each subproject has a README.md file explaining how to use it
* instead of one long notebook divide into various scripts / functions per project responsible for a single task or task group (e.g. db initialization, creating embeddings and inserting items in db, read from db, perform analysis, etc.). Make this a logical distribution per project.
* main project has universal functionality (e.g. adapters to datas sources, etc)

## Documentation Requirements

Since these projects are for learning, comprehensive documentation is required for each project:

### Project README.md Requirements

Each project in `projects/` must include a `README.md` file that contains:

1. **Overview Section**: 
   - What the project does and what RAG technique it demonstrates
   - How it differs from or builds upon other projects
   - Key concepts and learning objectives

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

5. **Expected Outcomes**:
   - What should happen after running each script
   - What results to expect and how to verify correctness
   - Example queries and expected behaviors
   - Common success indicators

6. **Understanding the Code**:
   - Overview of key components and their roles
   - High-level explanation of the algorithm/pipeline
   - How the technique works conceptually

7. **Troubleshooting**:
   - Common errors and their solutions
   - How to debug issues
   - Tips for improving results

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
