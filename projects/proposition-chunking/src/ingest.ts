import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadJsonConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import {
  ChatClient,
  EmbeddingClient,
  OpenAIChatClient,
  OpenAIEmbeddingClient
} from "../../../shared/typescript/utils/llm";
import { Chunk, Document, RagConfig } from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  VectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
import { readDocumentsFromDir } from "../../../shared/typescript/utils/documents";

/**
 * Configuration for proposition-based chunking.
 *
 * Extends the base RAG configuration with proposition-specific settings:
 * - `propositionModel`: LLM model to use for generating propositions from chunks
 * - `gradingModel`: LLM model to use for grading proposition quality
 * - `maxPropositions`: Maximum number of propositions to generate per chunk
 * - `gradingThreshold`: Minimum score (0-1) for a proposition to be included in the index
 *
 * **What is proposition chunking?** Instead of embedding document chunks directly,
 * this technique extracts concise, factual propositions (statements) from chunks
 * and embeds those instead. This improves retrieval precision because propositions
 * are more focused and verifiable than raw text chunks.
 */
export interface PropositionConfig extends RagConfig {
  propositionModel: string;
  gradingModel: string;
  maxPropositions: number;
  gradingThreshold: number;
}

/**
 * Loads and validates a proposition chunking configuration file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns A validated PropositionConfig object
 * @throws Error if the config file is missing or missing required keys
 */
export function loadPropositionConfig(configPath: string): PropositionConfig {
  const data = loadJsonConfig(configPath) as Partial<PropositionConfig>;
  const required: (keyof PropositionConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath",
    "propositionModel",
    "gradingModel",
    "maxPropositions",
    "gradingThreshold"
  ];
  for (const key of required) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing proposition config key: ${key.toString()}`);
    }
  }
  return data as PropositionConfig;
}

export interface PropositionIngestDependencies {
  readDocuments?: (dir: string) => Document[];
  chunkDocument?: (doc: Document, cfg: Pick<RagConfig, "chunkSize" | "chunkOverlap">) => Chunk[];
  chatClient?: ChatClient;
  embeddingClient?: EmbeddingClient;
  vectorStore?: VectorStore;
}

export interface PropositionRecord {
  text: string;
  score: number;
}

/**
 * Parses a list of propositions from LLM output.
 *
 * LLMs typically return propositions as bullet points (with `-`, `*`, or numbers).
 * This function extracts the actual proposition text by:
 * 1. Splitting on newlines
 * 2. Removing bullet markers (`-`, `*`, numbers with parentheses/brackets)
 * 3. Trimming whitespace
 * 4. Filtering out empty lines
 *
 * @param raw - Raw LLM response containing propositions
 * @returns Array of cleaned proposition strings
 *
 * @example
 * ```typescript
 * const props = parsePropositionList("- Revenue was $1M\n- Growth was 20%");
 * // Returns: ["Revenue was $1M", "Growth was 20%"]
 * ```
 */
export function parsePropositionList(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d).]+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Parses a grading response from the LLM into scored proposition records.
 *
 * The LLM is instructed to return lines in the format: `score - proposition text`.
 * This function extracts the score and text from each line using regex matching.
 *
 * **Grading format**: The LLM should return lines like:
 * - `0.9 - Revenue was $1M in 2023`
 * - `0.7 - The company grew significantly`
 *
 * Lines that don't match this format are skipped.
 *
 * @param raw - Raw LLM response containing scored propositions
 * @returns Array of PropositionRecord objects with scores and text
 *
 * @example
 * ```typescript
 * const graded = parseGradingResponse("0.9 - Revenue was $1M\n0.6 - Growth was high");
 * // Returns: [{ score: 0.9, text: "Revenue was $1M" }, { score: 0.6, text: "Growth was high" }]
 * ```
 */
export function parseGradingResponse(raw: string): PropositionRecord[] {
  const lines = raw.split(/\n+/).map((line) => line.trim());
  const records: PropositionRecord[] = [];
  for (const line of lines) {
    const match = line.match(/([01](?:\.\d+)?)\s*[-|:]\s*(.+)$/);
    if (!match) continue;
    records.push({ score: Number(match[1]), text: match[2].trim() });
  }
  return records;
}

/**
 * Generates factual propositions from a document chunk using an LLM.
 *
 * This function prompts an LLM to extract concise, verifiable statements from
 * a chunk of text. The LLM is instructed to create self-contained propositions
 * that can stand alone and be verified against the source chunk.
 *
 * **Why propositions?** Raw chunks often contain multiple ideas, context, and
 * filler text. Propositions distill chunks into focused facts that are easier
 * to match against queries and verify for accuracy.
 *
 * **Prompt strategy**: Uses a system message to set the task and a user message
 * with the chunk content and a limit on the number of propositions to generate.
 *
 * @param chunk - The document chunk to extract propositions from
 * @param cfg - Proposition configuration (model, maxPropositions)
 * @param chatClient - LLM client for generating propositions
 * @returns Array of proposition strings extracted from the chunk
 *
 * @example
 * ```typescript
 * const props = await generatePropositionsForChunk(chunk, config, chatClient);
 * // Returns: ["Revenue was $1M in 2023", "Growth rate was 20%"]
 * ```
 */
async function generatePropositionsForChunk(
  chunk: Chunk,
  cfg: PropositionConfig,
  chatClient: ChatClient
): Promise<string[]> {
  const prompt = [
    {
      role: "system" as const,
      content:
        "You convert text into short factual propositions. Each proposition must be self-contained and verifiable."
    },
    {
      role: "user" as const,
      content: [
        `Chunk:`,
        chunk.content,
        "",
        `Generate up to ${cfg.maxPropositions} concise propositions. Return them as bullet points.`
      ].join("\n")
    }
  ];
  const response = await chatClient.chat(prompt, cfg.propositionModel);
  return parsePropositionList(response);
}

/**
 * Grades propositions for quality and grounding in the source chunk.
 *
 * This function uses an LLM to evaluate whether each proposition is:
 * - **Accurate**: Correctly represents information from the chunk
 * - **Complete**: Contains enough information to be meaningful
 * - **Grounded**: Directly supported by the chunk content (not inferred)
 *
 * **Grading scale**: Scores range from 0 (not grounded) to 1 (fully grounded).
 * Only propositions above the `gradingThreshold` are included in the final index.
 *
 * **Why grade?** LLM-generated propositions can sometimes be:
 * - Hallucinated (not in the source)
 * - Incomplete (missing key details)
 * - Inferred (logical conclusion not explicitly stated)
 *
 * Grading filters out low-quality propositions to improve retrieval accuracy.
 *
 * @param chunk - The source chunk that propositions were extracted from
 * @param propositions - Array of proposition strings to grade
 * @param cfg - Proposition configuration (gradingModel, gradingThreshold)
 * @param chatClient - LLM client for grading propositions
 * @returns Array of PropositionRecord objects with scores
 *
 * @example
 * ```typescript
 * const graded = await gradePropositions(chunk, ["Revenue was $1M"], config, chatClient);
 * // Returns: [{ score: 0.9, text: "Revenue was $1M" }]
 * ```
 */
async function gradePropositions(
  chunk: Chunk,
  propositions: string[],
  cfg: PropositionConfig,
  chatClient: ChatClient
): Promise<PropositionRecord[]> {
  if (propositions.length === 0) return [];
  const prompt = [
    {
      role: "system" as const,
      content:
        "You are a strict grader. Score each proposition between 0 and 1 where 1 means fully grounded in the chunk."
    },
    {
      role: "user" as const,
      content: [
        "Chunk:",
        chunk.content,
        "",
        "Propositions:",
        propositions.map((prop, idx) => `${idx + 1}) ${prop}`).join("\n"),
        "",
        "Respond with lines formatted as `score - proposition`."
      ].join("\n")
    }
  ];
  const response = await chatClient.chat(prompt, cfg.gradingModel);
  return parseGradingResponse(response);
}

/**
 * Creates a Chunk object from a graded proposition.
 *
 * Each proposition becomes its own chunk in the vector store, with metadata
 * linking it back to the original chunk. This allows retrieval at the proposition
 * level while maintaining traceability to the source.
 *
 * **Metadata preservation**: Stores the original chunk ID, proposition score,
 * and a short excerpt from the source chunk for context.
 *
 * @param baseChunk - The original chunk the proposition came from
 * @param proposition - The graded proposition record
 * @param propIndex - Index of this proposition within the base chunk
 * @returns A Chunk object representing the proposition
 */
function createPropositionChunk(
  baseChunk: Chunk,
  proposition: PropositionRecord,
  propIndex: number
): Chunk {
  return {
    id: `${baseChunk.id}-prop-${propIndex}`,
    documentId: baseChunk.documentId,
    content: proposition.text,
    index: propIndex,
    metadata: {
      sourceChunkId: baseChunk.id,
      score: proposition.score,
      excerpt: baseChunk.content.slice(0, 200)
    }
  };
}

/**
 * Main proposition-based ingestion pipeline.
 *
 * This function orchestrates the complete process of converting documents into
 * proposition-based chunks:
 *
 * 1. **Read Documents**: Loads text files from the data directory
 * 2. **Chunk Documents**: Splits documents into overlapping chunks (standard RAG step)
 * 3. **Generate Propositions**: For each chunk, uses LLM to extract factual propositions
 * 4. **Grade Propositions**: Evaluates each proposition for quality and grounding
 * 5. **Filter by Threshold**: Keeps only propositions above the grading threshold
 * 6. **Embed & Store**: Generates embeddings for propositions and stores in vector index
 *
 * **Why proposition chunking?** Traditional chunking can split related information
 * across boundaries or include irrelevant context. Propositions are:
 * - **Focused**: Each proposition contains one clear fact
 * - **Verifiable**: Can be checked against the source chunk
 * - **Retrievable**: More precise matching against queries
 * - **Traceable**: Linked back to source chunks via metadata
 *
 * **Cost consideration**: This technique requires 2 LLM API calls per chunk
 * (generation + grading), so it's more expensive than basic RAG. However, the
 * improved retrieval precision often justifies the cost for critical applications.
 *
 * @param cfg - Proposition configuration (models, thresholds, paths)
 * @param deps - Optional dependency overrides for testing
 * @returns Array of proposition chunks that were stored in the index
 * @throws Error if documents can't be read, propositions fail to generate, or embedding fails
 *
 * @example
 * ```typescript
 * const config = loadPropositionConfig("./config/proposition-chunking.config.json");
 * const chunks = await runPropositionIngestion(config);
 * // Returns array of proposition chunks stored in the vector index
 * ```
 */
export async function runPropositionIngestion(
  cfg: PropositionConfig,
  deps: PropositionIngestDependencies = {}
): Promise<Chunk[]> {
  const readDocs = deps.readDocuments ?? readDocumentsFromDir;
  const chunker =
    deps.chunkDocument ??
    ((doc: Document) => simpleChunkDocument(doc, { chunkSize: cfg.chunkSize, chunkOverlap: cfg.chunkOverlap }));
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const vectorStore = deps.vectorStore ?? new InMemoryVectorStore();

  const documents = readDocs(cfg.dataPath);
  const chunks = documents.flatMap((doc) => chunker(doc, cfg));
  logger.info("Generated document chunks", { count: chunks.length });

  const propositionChunks: Chunk[] = [];
  for (const chunk of chunks) {
    const proposals = await generatePropositionsForChunk(chunk, cfg, chatClient);
    const graded = await gradePropositions(chunk, proposals, cfg, chatClient);
    graded
      .filter((prop) => prop.score >= cfg.gradingThreshold)
      .forEach((prop, idx) => propositionChunks.push(createPropositionChunk(chunk, prop, idx)));
  }

  if (propositionChunks.length === 0) {
    logger.warn("No propositions passed grading; persisting empty index");
    vectorStore.persist(cfg.indexPath);
    return [];
  }

  const embeddings = await embedChunks(propositionChunks, embeddingClient);
  vectorStore.addMany(propositionChunks, embeddings);
  vectorStore.persist(cfg.indexPath);
  logger.info("Stored graded propositions", { count: propositionChunks.length });
  return propositionChunks;
}

async function main(): Promise<void> {
  loadEnv();
  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/proposition-chunking.config.json");
  const cfg = loadPropositionConfig(configPath);
  await runPropositionIngestion(cfg);
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Proposition ingestion failed", { err });
    process.exitCode = 1;
  });
}

