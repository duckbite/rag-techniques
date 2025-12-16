import readline from "node:readline";
import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import {
  ChatClient,
  EmbeddingClient,
  OpenAIChatClient,
  OpenAIEmbeddingClient
} from "../../../shared/typescript/utils/llm";
import {
  loadInMemoryVectorStore,
  VectorStore
} from "../../../shared/typescript/utils/vectorStore";
import { RagConfig, RetrievedChunk } from "../../../shared/typescript/utils/types";
import { parsePrice } from "./ingest";

type VectorSearcher = Pick<VectorStore, "search">;

export interface BookingPreferences {
  query: string;
  maxBudget?: number;
  minRating?: number;
  requiredAmenities?: string[];
  minOccupancy?: number;
}

export interface RankedChunk extends RetrievedChunk {
  preferenceScore: number;
  reasons: string[];
}

export interface QueryDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

export interface AnswerResult {
  answer: string;
  retrieved: RankedChunk[];
  prompt: string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parsePrice(value);
    return parsed ?? undefined;
  }
  return undefined;
}

function buildPreferenceText(prefs: BookingPreferences): string {
  const lines = [
    `Location: Den Bosch (fixed)`,
    `User query: ${prefs.query.trim()}`,
    prefs.maxBudget ? `Budget per night: <= ${prefs.maxBudget}` : undefined,
    prefs.minRating ? `Min rating: ${prefs.minRating}/10` : undefined,
    prefs.minOccupancy ? `Min occupancy: ${prefs.minOccupancy}` : undefined,
    prefs.requiredAmenities?.length ? `Must-have amenities: ${prefs.requiredAmenities.join(", ")}` : undefined
  ].filter(Boolean);
  return lines.join("\n");
}

export function rerankResults(
  results: RetrievedChunk[],
  prefs: BookingPreferences
): RankedChunk[] {
  return results
    .map((result) => {
      const metadata = result.metadata ?? {};
      const rating = toNumber(metadata.rating);
      const price = toNumber(metadata.pricePerNight ?? metadata.price ?? metadata.priceCurrent ?? metadata.priceText);
      const occupancy = toNumber(metadata.occupancy);
      const amenities =
        Array.isArray(metadata.amenities) && metadata.amenities.every((a) => typeof a === "string")
          ? (metadata.amenities as string[])
          : [];

      const reasons: string[] = [];

      let preferenceScore = result.score;

      if (prefs.maxBudget) {
        if (price && price <= prefs.maxBudget) {
          preferenceScore += 0.2;
          reasons.push(`Fits budget per night (${price})`);
        } else if (price) {
          preferenceScore -= 0.2;
          reasons.push(`Above budget per night (${price})`);
        }
      }

      if (prefs.minRating) {
        if (rating && rating >= prefs.minRating) {
          preferenceScore += 0.1;
          reasons.push(`Meets rating ${rating}`);
        } else if (rating) {
          preferenceScore -= 0.1;
          reasons.push(`Below rating ${rating}`);
        }
      }

      if (prefs.minOccupancy) {
        if (occupancy && occupancy >= prefs.minOccupancy) {
          preferenceScore += 0.05;
          reasons.push(`Occupancy ${occupancy}`);
        } else if (occupancy) {
          preferenceScore -= 0.05;
          reasons.push(`Occupancy ${occupancy} < requested`);
        }
      }

      if (prefs.requiredAmenities?.length) {
        const matched = prefs.requiredAmenities.filter((amenity) =>
          amenities.some((item) => item.toLowerCase().includes(amenity.toLowerCase()))
        );
        const amenityScore = matched.length / prefs.requiredAmenities.length;
        preferenceScore += amenityScore * 0.1;
        reasons.push(
          matched.length
            ? `Amenities: ${matched.join(", ")}`
            : "Missing requested amenities"
        );
      }

      return {
        ...result,
        preferenceScore,
        reasons
      };
    })
    .sort((a, b) => b.preferenceScore - a.preferenceScore);
}

export function formatContext(ranked: RankedChunk[]): string {
  if (ranked.length === 0) return "No candidates available.";
  return ranked
    .map((chunk, idx) => {
      const meta = chunk.metadata ?? {};
      const price = meta.pricePerNight ?? meta.price ?? meta.priceCurrent ?? meta.priceText ?? "N/A";
      const rating = meta.rating ? `${meta.rating}/10` : "Rating: n/a";
      const name = meta.hotelName ?? meta.title ?? chunk.documentId;
      const room = meta.roomName ? `Room: ${meta.roomName}` : "";
      const reasons = chunk.reasons.length ? `Reasons: ${chunk.reasons.join("; ")}` : "";
      return [
        `#${idx + 1}: ${name}`,
        room,
        rating,
        `Price per night: ${price}`,
        reasons,
        `Context: ${chunk.content}`
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function buildPrompt(prefs: BookingPreferences, ranked: RankedChunk[]): string {
  return [
    "You are a Booking.com assistant. Use only the provided hotel context for Den Bosch.",
    "Return the best up-to-5 options as concise bullets (name, price per night, rating, why it matches).",
    "All prices shown are per night. If fewer than 5 options exist, return what you have. Offer to provide more room details on follow-up.",
    "",
    "User preferences:",
    buildPreferenceText(prefs),
    "",
    "Candidates:",
    formatContext(ranked)
  ].join("\n");
}

export async function recommendHotels(
  prefs: BookingPreferences,
  cfg: RagConfig,
  deps: QueryDependencies = {}
): Promise<AnswerResult> {
  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  const trimmedQuery = prefs.query.trim();
  if (!trimmedQuery) {
    throw new Error("Query cannot be empty.");
  }

  logger.info("Processing booking query", {
    query: trimmedQuery,
    topK: cfg.topK,
    maxBudget: prefs.maxBudget,
    minRating: prefs.minRating,
    minOccupancy: prefs.minOccupancy,
    requiredAmenities: prefs.requiredAmenities
  });

  const [queryEmbedding] = await embeddingClient.embed([trimmedQuery]);
  const retrieved = store.search(queryEmbedding, cfg.topK);
  const ranked = rerankResults(retrieved, prefs).slice(0, 5);

  const prompt = buildPrompt(prefs, ranked);
  const answer = await chatClient.chat(
    [
      {
        role: "system",
        content:
          "You are a concise Booking.com concierge for Den Bosch. Recommend hotels using only provided context."
      },
      { role: "user", content: prompt }
    ],
    cfg.chatModel
  );

  return { answer, retrieved: ranked, prompt };
}

async function interactiveQuery(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/booking-demo.config.json");
  const cfg = loadRagConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (answer) => resolve(answer.trim())));

  logger.info("Booking-demo query CLI ready. Type 'exit' to quit.");

  while (true) {
    const question = await ask("What are you looking for? ");
    if (!question || question.toLowerCase() === "exit") break;
    const budgetInput = await ask("Budget per night (number, optional): ");
    const ratingInput = await ask("Minimum rating (0-10, optional): ");
    const amenitiesInput = await ask("Required amenities (comma separated, optional): ");
    const occupancyInput = await ask("Minimum occupancy (number, optional): ");

    const prefs: BookingPreferences = {
      query: question,
      maxBudget: budgetInput ? Number.parseFloat(budgetInput) : undefined,
      minRating: ratingInput ? Number.parseFloat(ratingInput) : undefined,
      minOccupancy: occupancyInput ? Number.parseInt(occupancyInput, 10) : undefined,
      requiredAmenities: amenitiesInput
        ? amenitiesInput
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : undefined
    };

    try {
      const { answer, retrieved } = await recommendHotels(prefs, cfg, {
        embeddingClient,
        chatClient,
        vectorStore: store
      });
      // eslint-disable-next-line no-console
      console.log("\nTop matches:\n", answer, "\n");
      logger.info("Booking query summary", {
        retrieved: retrieved.length,
        scores: retrieved.map((r) => r.preferenceScore.toFixed(3))
      });
    } catch (err) {
      logger.error("Query failed", { err });
      // eslint-disable-next-line no-console
      console.log("Query failed:", (err as Error).message);
    }
  }

  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("Booking query CLI failed", { err });
    process.exitCode = 1;
  });
}
