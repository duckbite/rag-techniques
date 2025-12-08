# RAG Techniques Implementation Plan

This document tracks parity work as we port the 34 techniques from [`NirDiamant/RAG_Techniques`](https://github.com/NirDiamant/RAG_Techniques) into standalone TypeScript projects. Update this plan whenever scope, sequencing, or owners change.

## Status Legend

- ✅ – Complete (code, docs, tests, data)
- 🛠️ – In progress
- ⏳ – Not started
- 🔁 – Needs follow-up (open questions or evaluation gaps)

## Completed Baseline

| Status | Project Folder | Technique | Source Notebook | Notes |
| --- | --- | --- | --- | --- |
| ✅ | `projects/basic-rag` | Basic RAG baseline | `all_rag_techniques/simple_rag.ipynb` | Provides ingestion/query scripts, Vitest coverage, and detailed README. Acts as reference architecture for remaining work. |

## Phase 1 — Foundational Parity (Nov–Dec 2025)

| Status | Project Folder | Technique | Source Notebook | Notes / Dependencies |
| --- | --- | --- | --- | --- |
| ✅ | `projects/csv-rag` | RAG over CSV files | `all_rag_techniques/simple_csv_rag.ipynb` | Reuse ingestion pipeline with CSV loader + schema inference. Ensure README covers CSV preparation. |
| ✅ | `projects/reliable-rag` | Reliable RAG | `all_rag_techniques/reliable_rag.ipynb` | Adds retrieval validation & answer highlighting. Depends on shared evaluation utilities. |
| ✅ | `projects/chunk-optimizer` | Choose chunk size | `all_rag_techniques/choose_chunk_size.ipynb` | Provide CLI to benchmark chunk sizes; needs plotting or tabular output. |
| ✅ | `projects/proposition-chunking` | Proposition chunking | `all_rag_techniques/proposition_chunking.ipynb` | Requires LLM-assisted proposition generation, quality grading, and persistence of graded propositions. |

## Phase 2 — Query Enhancement (Dec 2025)

| Status | Project Folder | Technique | Source Notebook | Notes / Dependencies |
| --- | --- | --- | --- | --- |
| ✅ | `projects/query-transform` | Query transformations | `all_rag_techniques/query_transformations.ipynb` | Implements query rewriting, step-back prompting, and sub-query decomposition. Supports all transformation types individually or combined. |
| ✅ | `projects/hyde` | HyDE (Hypothetical Document Embedding) | `all_rag_techniques/HyDe_Hypothetical_Document_Embedding.ipynb` | Uses runtime synthetic document generation per query. Embeds hypothetical documents instead of queries for improved retrieval. |
| ✅ | `projects/hype` | HyPE (Hypothetical Prompt Embedding) | `all_rag_techniques/HyPE_Hypothetical_Prompt_Embeddings.ipynb` | Pre-generates hypothetical questions during ingestion. Enhanced vector store supports multiple embeddings per chunk. Question-question matching at query time. |

## Phase 3 — Context Enrichment (Dec 2025 – Jan 2026)

| Status | Project Folder | Technique | Source Notebook | Notes / Dependencies |
| --- | --- | --- | --- | --- |
| ✅ | `projects/chunk-headers` | Contextual chunk headers | `all_rag_techniques/contextual_chunk_headers.ipynb` | Prepends document + section metadata to each chunk before embedding using shared header helpers. |
| ✅ | `projects/relevant-segments` | Relevant segment extraction | `all_rag_techniques/relevant_segment_extraction.ipynb` | Uses shared stitched-segment helper to merge adjacent chunks into longer segments. |
| ✅ | `projects/context-window` | Context window enhancement | `all_rag_techniques/context_enrichment_window_around_chunk.ipynb` | Expands retrieval into configurable context windows around top chunks. |
| ✅ | `projects/semantic-chunking` | Semantic chunking | `all_rag_techniques/semantic_chunking.ipynb` | Uses paragraph-based semantic chunking via shared utilities. |
| ✅ | `projects/contextual-compression` | Contextual compression | `all_rag_techniques/contextual_compression.ipynb` | Runs shared compression helper to summarize/filter retrieved chunks before answering. |
| ✅ | `projects/document-augmentation` | Document augmentation via question generation | `all_rag_techniques/document_augmentation.ipynb` | Generates synthetic Q/A pairs per chunk during ingestion and stores them alongside base chunks. |

## Phase 4 — Advanced Retrieval (Jan–Feb 2026)

| Status | Project Folder | Technique | Source Notebook | Notes / Dependencies |
| --- | --- | --- | --- | --- |
| ⏳ | `projects/fusion-retrieval` | Fusion retrieval | `all_rag_techniques/fusion_retrieval.ipynb` | Combine lexical + vector stores; requires shared search abstraction. |
| ⏳ | `projects/rerank` | Intelligent reranking | `all_rag_techniques/reranking.ipynb` | Adds cross-encoder or LLM scoring; relies on retrieval output from upstream pipeline. |
| ⏳ | `projects/multi-filter` | Multi-faceted filtering | `all_rag_techniques/multi_faceted_filtering.ipynb` | Metadata/dynamic filters; share dataset tagging utilities. |
| ⏳ | `projects/hierarchical-index` | Hierarchical indices | `all_rag_techniques/hierarchical_indices.ipynb` | Build coarse summaries + fine chunks referencing same source. |
| ⏳ | `projects/ensemble-retrieval` | Ensemble retrieval | `all_rag_techniques/ensemble_retrieval.ipynb` | Weighted fusion of multiple retrievers; needs config-driven weighting. |
| ⏳ | `projects/dartboard` | Dartboard retrieval | `all_rag_techniques/dartboard.ipynb` | Implements dartboard-style multi-stage retrieval windows. |
| ⏳ | `projects/multimodal-captioning` | Multi-modal RAG with captioning | `all_rag_techniques/multi_model_rag_with_captioning.ipynb` | Introduce image loader + captioning pipeline; dependency on vision models. |

## Phase 5 — Iterative Retrieval & Evaluation (Feb 2026)

| Status | Project Folder | Technique | Source Notebook | Notes / Dependencies |
| --- | --- | --- | --- | --- |
| ⏳ | `projects/feedback-loop` | Retrieval with feedback loop | `all_rag_techniques/retrieval_with_feedback_loop.ipynb` | Adds answer grading + follow-up retrieval iterations. |
| ⏳ | `projects/adaptive-retrieval` | Adaptive retrieval | `all_rag_techniques/adaptive_retrieval.ipynb` | Dynamic top-k selection & stopping criteria. |
| ⏳ | `projects/iterative-retrieval` | Iterative retrieval | `all_rag_techniques/iterative_retrieval.ipynb` | Multi-hop retrieval orchestrator; relies on shared conversation state utilities. |
| ⏳ | `projects/deepeval` | DeepEval | `evaluation/evaluation_deep_eval.ipynb` | Provide CLI that runs DeepEval metrics against QA pairs. |
| ⏳ | `projects/grouse` | GroUSE evaluation | `evaluation/evaluation_grouse.ipynb` | Integrate GroUSE scoring; needs dataset format doc. |
| ⏳ | `projects/explainable-retrieval` | Explainable retrieval | `all_rag_techniques/explainable_retrieval.ipynb` | Surfaces rationale + trace for each retrieved chunk. |

## Phase 6 — Advanced Architectures & Agents (Mar 2026)

| Status | Project Folder | Technique | Source Notebook | Notes / Dependencies |
| --- | --- | --- | --- | --- |
| ⏳ | `projects/agentic-rag` | Agentic RAG with Contextual AI | `all_rag_techniques/Agentic_RAG.ipynb` | Requires multi-tool orchestration and contextual.ai integration notes. |
| ⏳ | `projects/graph-rag` | Graph RAG with LangChain | `all_rag_techniques/graph_rag.ipynb` | Build graph extraction and retrieval pipeline. |
| ⏳ | `projects/ms-graphrag` | Microsoft GraphRAG | `all_rag_techniques/Microsoft_GraphRag.ipynb` | Document dependencies on Azure Search + GraphRAG toolkit. |
| ⏳ | `projects/raptor` | RAPTOR | `all_rag_techniques/raptor.ipynb` | Recursive summarization tree; heavy on ingestion + caching. |
| ⏳ | `projects/self-rag` | Self-RAG | `all_rag_techniques/self_rag.ipynb` | Implement self-reflection scoring loops. |
| ⏳ | `projects/crag` | Corrective RAG (CRAG) | `all_rag_techniques/crag.ipynb` | Auto-correct retrieval mistakes with verification loop. |
| ⏳ | `projects/controllable-agent` | Controllable RAG agent | `https://github.com/NirDiamant/Controllable-RAG-Agent` | Wraps external repo; document how to run agent flows inside monorepo. |

## Cross-Cutting Tasks

- Document every new project in `docs/product.md` (overview) and update `docs/project-structure.md`.
- Ensure each project stores runtime artifacts under `projects/<name>/.tmp/`.
- Add Vitest coverage per project; extend shared utilities (`shared/typescript`) only when logic is reusable.
- Keep `docs/plan.md` as the single source of truth for sequencing, responsible owner, and blockers.

