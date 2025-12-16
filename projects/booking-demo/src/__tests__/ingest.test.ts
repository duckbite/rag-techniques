import { describe, expect, it, vi } from "vitest";
import { CsvRow } from "../../../../shared/typescript/utils/csv";
import { InMemoryVectorStore } from "../../../../shared/typescript/utils/vectorStore";
import { BookingConfig, parsePrice, rowToDocument, runIngestion } from "../ingest";

const baseConfig: BookingConfig = {
  chunkSize: 1600,
  chunkOverlap: 0,
  topK: 5,
  embeddingModel: "test-embed",
  chatModel: "test-chat",
  dataPath: "./shared/assets/data/booking-data.csv",
  indexPath: ".tmp/index/test.index.json"
};

describe("parsePrice", () => {
  it("parses euro-style and dot-separated numbers", () => {
    expect(parsePrice("€ 1,047.41")).toBeCloseTo(1047.41);
    expect(parsePrice("1.582")).toBeCloseTo(1582);
    expect(parsePrice(undefined)).toBeUndefined();
  });
});

describe("rowToDocument", () => {
  const sampleRow: CsvRow = {
    hotelId: "abc",
    hotelName: "Hotel Den Bosch",
    hotelAddress: "123 Street, Den Bosch, Netherlands",
    city: "Den Bosch",
    postalCode: "1234 AB",
    addressRegion: "NB",
    country: "Netherlands",
    hotelRating: "9.1",
    reviewCount: "120",
    latitude: "0",
    longitude: "0",
    hotelUrl: "https://example.com",
    description: "Nice stay",
    roomName: "Deluxe",
    maxOccupancyText: "Max. people: 2",
    maxOccupancy: "2",
    bedTypes: "1 queen",
    roomHighlights: "sauna; wifi",
    includedFacilities: "breakfast; parking",
    priceCurrent: "533",
    priceOriginal: "618",
    currency: "EUR",
    priceText: "€ 533",
    cancellationPolicy: "",
    mealPlan: "",
    scrapedAt: "2025-12-16T09:44:08.271Z"
  };

  it("creates a document when address matches city keywords", () => {
    const doc = rowToDocument(sampleRow, 0, ["den bosch"]);
    expect(doc).not.toBeNull();
    expect(doc?.metadata?.rating).toBeCloseTo(9.1);
    expect(doc?.metadata?.price).toBe(533);
    expect(doc?.content).toContain("Hotel Den Bosch");
  });

  it("filters out rows outside the target city", () => {
    const doc = rowToDocument({ ...sampleRow, hotelAddress: "Amsterdam" }, 1, ["den bosch"]);
    expect(doc).toBeNull();
  });
});

describe("runIngestion", () => {
  const rows: CsvRow[] = [
    {
      hotelId: "abc",
      hotelName: "Stay A",
      hotelAddress: "Den Bosch",
      city: "Den Bosch",
      postalCode: "",
      addressRegion: "",
      country: "",
      hotelRating: "8.5",
      reviewCount: "10",
      latitude: "",
      longitude: "",
      hotelUrl: "",
      description: "Great",
      roomName: "Room",
      maxOccupancyText: "Max. people: 2",
      maxOccupancy: "2",
      bedTypes: "",
      roomHighlights: "wifi",
      includedFacilities: "",
      priceCurrent: "120",
      priceOriginal: "",
      currency: "EUR",
      priceText: "€ 120",
      cancellationPolicy: "",
      mealPlan: "",
      scrapedAt: ""
    },
    {
      hotelId: "def",
      hotelName: "Stay B",
      hotelAddress: "Eindhoven",
      city: "Eindhoven",
      postalCode: "",
      addressRegion: "",
      country: "",
      hotelRating: "7.0",
      reviewCount: "5",
      latitude: "",
      longitude: "",
      hotelUrl: "",
      description: "Far away",
      roomName: "Room",
      maxOccupancyText: "Max. people: 2",
      maxOccupancy: "2",
      bedTypes: "",
      roomHighlights: "wifi",
      includedFacilities: "",
      priceCurrent: "90",
      priceOriginal: "",
      currency: "EUR",
      priceText: "€ 90",
      cancellationPolicy: "",
      mealPlan: "",
      scrapedAt: ""
    }
  ];

  it("embeds and persists only matching city rows", async () => {
    const loadRows = vi.fn().mockReturnValue(rows);
    const embeddingClient = { embed: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])) };
    const vectorStore = {
      addMany: vi.fn(),
      search: vi.fn(),
      persist: vi.fn()
    } as unknown as InMemoryVectorStore;

    const result = await runIngestion(baseConfig, { loadRows, embeddingClient, vectorStore });

    expect(loadRows).toHaveBeenCalled();
    expect(result.documents).toHaveLength(1);
    expect(vectorStore.addMany).toHaveBeenCalledTimes(1);
    expect(vectorStore.persist).toHaveBeenCalledTimes(1);
  });
});
