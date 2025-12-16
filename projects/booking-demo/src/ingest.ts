import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { CsvRow, loadCsv } from "../../../shared/typescript/utils/csv";
import { Chunk, Document, RagConfig } from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  VectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";
import { EmbeddingClient, OpenAIEmbeddingClient } from "../../../shared/typescript/utils/llm";

const DEFAULT_CITY_KEYWORDS = ["den bosch", "s-hertogenbosch", "'s-hertogenbosch"];

export interface BookingConfig extends RagConfig {
  cityKeywords?: string[];
}

export interface IngestDependencies {
  loadRows?: (filePath: string) => CsvRow[];
  buildDocument?: (row: CsvRow, rowIndex: number, cityKeywords: string[]) => Document | null;
  embeddingClient?: EmbeddingClient;
  vectorStore?: VectorStore;
}

export interface IngestionResult {
  documents: Document[];
  chunks: Chunk[];
}

export function parsePrice(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.,]/g, "");
  if (!cleaned) return undefined;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // If the comma appears before the dot, treat comma as thousands separator (1,047.41)
    normalized =
      cleaned.indexOf(",") < cleaned.indexOf(".")
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(/,/g, ".");
  } else if (hasDot && /^\d{1,3}\.\d{3}$/.test(cleaned)) {
    // Likely thousands separator, e.g. 1.582 -> 1582
    normalized = cleaned.replace(".", "");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitValues(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function rowToDocument(
  row: CsvRow,
  rowIndex: number,
  cityKeywords: string[]
): Document | null {
  const hotelAddress = row.hotelAddress ?? "";
  const cityMatch =
    cityKeywords.length === 0 ||
    cityKeywords.some((keyword) => hotelAddress.toLowerCase().includes(keyword));
  if (!cityMatch) {
    return null;
  }

  const rating = toNumber(row.hotelRating);
  const reviewCount = Number.isFinite(Number.parseInt(row.reviewCount ?? "", 10))
    ? Number.parseInt(row.reviewCount ?? "", 10)
    : undefined;
  const price = parsePrice(row.pricePerNight ?? row.priceCurrent);
  const priceOriginal = parsePrice(row.priceOriginal);
  const occupancy =
    Number.parseInt(row.maxOccupancy ?? "", 10) ||
    Number.parseInt(row.maxOccupancyText?.replace(/\D+/g, "") ?? "", 10) ||
    undefined;
  const amenities = splitValues(row.roomHighlights);
  const included = splitValues(row.includedFacilities);

  const titleParts = [row.hotelName, row.roomName].filter(Boolean);
  const title = titleParts.join(" - ") || "Hotel room";
  const documentId = row.hotelId
    ? `${row.hotelId}-${rowIndex}`
    : `hotel-${rowIndex.toString().padStart(3, "0")}`;

  const contentLines = [
    `${row.hotelName ?? "Hotel"} in Den Bosch`,
    row.roomName ? `Room: ${row.roomName}` : undefined,
    occupancy ? `Max occupancy: ${occupancy}` : row.maxOccupancyText,
    rating ? `Rating: ${rating}/10${reviewCount ? ` (${reviewCount} reviews)` : ""}` : undefined,
    price ? `Price per night: ${price} ${row.currency ?? ""}` : row.priceText,
    priceOriginal && price ? `Original price per night: ${priceOriginal} ${row.currency ?? ""}` : undefined,
    `Address: ${hotelAddress}`,
    amenities.length ? `Highlights: ${amenities.join(", ")}` : undefined,
    included.length ? `Included: ${included.join(", ")}` : undefined,
    row.description ? `Description: ${row.description}` : undefined,
    row.bedTypes ? `Beds: ${row.bedTypes}` : undefined
  ].filter(Boolean) as string[];

  const metadata = {
    hotelId: row.hotelId,
    hotelName: row.hotelName,
    roomName: row.roomName,
    address: hotelAddress,
    postalCode: row.postalCode,
    region: row.addressRegion,
    country: row.country,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    rating,
    reviewCount,
    price,
    pricePerNight: price,
    priceOriginal,
    currency: row.currency,
    priceText: row.priceText,
    amenities,
    included,
    occupancy,
    bedTypes: row.bedTypes
  };

  return {
    id: documentId,
    title,
    content: contentLines.join("\n"),
    metadata
  };
}

export async function runIngestion(
  cfg: BookingConfig,
  deps: IngestDependencies = {}
): Promise<IngestionResult> {
  const loadRowsFn = deps.loadRows ?? loadCsv;
  const buildDoc =
    deps.buildDocument ??
    ((row: CsvRow, rowIndex: number, cityKeywords: string[]) =>
      rowToDocument(row, rowIndex, cityKeywords));
  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const vectorStore = deps.vectorStore ?? new InMemoryVectorStore();
  const cityKeywords = cfg.cityKeywords ?? DEFAULT_CITY_KEYWORDS;

  logger.info("Loading booking data", { dataPath: cfg.dataPath });
  const rows = loadRowsFn(cfg.dataPath);
  const documents = rows
    .map((row, idx) => buildDoc(row, idx, cityKeywords))
    .filter((doc): doc is Document => Boolean(doc));

  const chunks: Chunk[] = documents.map((doc, idx) => ({
    id: `${doc.id}-chunk-${idx}`,
    documentId: doc.id,
    content: doc.content,
    index: 0,
    metadata: doc.metadata
  }));

  if (chunks.length === 0) {
    logger.warn("No booking documents ingested; persisting empty index", {
      indexPath: cfg.indexPath
    });
    vectorStore.persist(cfg.indexPath);
    return { documents, chunks };
  }

  logger.info("Generating embeddings for booking rows", {
    model: cfg.embeddingModel,
    chunkCount: chunks.length
  });
  const embeddings = await embedChunks(chunks, embeddingClient);

  logger.info("Persisting booking index", { indexPath: cfg.indexPath });
  vectorStore.addMany(chunks, embeddings);
  vectorStore.persist(cfg.indexPath);

  return { documents, chunks };
}

async function main(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/booking-demo.config.json");

  logger.info("Loading booking-demo config", { configPath });
  const cfg = loadRagConfig(configPath) as BookingConfig;

  const result = await runIngestion(cfg);
  logger.info("Booking ingestion complete", {
    documentsProcessed: result.documents.length,
    chunksCreated: result.chunks.length,
    indexPath: path.resolve(cfg.indexPath)
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Booking ingestion failed", { err });
    process.exitCode = 1;
  });
}
