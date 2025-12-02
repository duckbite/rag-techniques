import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { parseCsv, loadCsv, CsvRow } from "../csv";

describe("parseCsv", () => {
  it("should parse simple CSV with headers", () => {
    const content = "Name,Age,City\nJohn,30,New York\nJane,25,Boston";
    const result = parseCsv(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Age: "30", City: "New York" });
    expect(result[1]).toEqual({ Name: "Jane", Age: "25", City: "Boston" });
  });

  it("should handle quoted fields with commas", () => {
    const content = 'Name,Description\nJohn,"Smith, Jr."\nJane,"Doe, Sr."';
    const result = parseCsv(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Description: "Smith, Jr." });
    expect(result[1]).toEqual({ Name: "Jane", Description: "Doe, Sr." });
  });

  it("should handle escaped quotes", () => {
    const content = 'Name,Quote\nJohn,"He said ""Hello"""\nJane,"She said ""Hi"""';
    const result = parseCsv(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Quote: 'He said "Hello"' });
    expect(result[1]).toEqual({ Name: "Jane", Quote: 'She said "Hi"' });
  });

  it("should handle custom delimiter", () => {
    const content = "Name;Age;City\nJohn;30;New York\nJane;25;Boston";
    const result = parseCsv(content, { delimiter: ";" });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Age: "30", City: "New York" });
  });

  it("should skip empty lines by default", () => {
    const content = "Name,Age\nJohn,30\n\nJane,25\n\n";
    const result = parseCsv(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Age: "30" });
    expect(result[1]).toEqual({ Name: "Jane", Age: "25" });
  });

  it("should include empty lines when skipEmptyLines is false (but they must have correct column count)", () => {
    // Empty line must still have the correct number of columns (empty values)
    const content = "Name,Age\nJohn,30\n,\nJane,25";
    const result = parseCsv(content, { skipEmptyLines: false });

    // Should have 3 rows: John, empty row with commas, Jane
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ Name: "John", Age: "30" });
    expect(result[1]).toEqual({ Name: "", Age: "" });
    expect(result[2]).toEqual({ Name: "Jane", Age: "25" });
  });

  it("should throw error if row has wrong number of columns", () => {
    const content = "Name,Age,City\nJohn,30\nJane,25,Boston";
    expect(() => parseCsv(content)).toThrow("Row 1 has 2 values, expected 3");
  });

  it("should return empty array for empty content", () => {
    const result = parseCsv("");
    expect(result).toEqual([]);
  });

  it("should return empty array for only whitespace", () => {
    const result = parseCsv("   \n  \n  ");
    expect(result).toEqual([]);
  });

  it("should handle single row (header only)", () => {
    const content = "Name,Age,City";
    const result = parseCsv(content);
    expect(result).toEqual([]);
  });

  it("should trim whitespace from cell values", () => {
    const content = "Name, Age , City\n John , 30 , New York ";
    const result = parseCsv(content);

    expect(result).toHaveLength(1);
    // CSV parser trims both headers and values
    expect(result[0]).toEqual({ Name: "John", "Age": "30", "City": "New York" });
  });

  it("should handle Windows line endings", () => {
    const content = "Name,Age\r\nJohn,30\r\nJane,25";
    const result = parseCsv(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Age: "30" });
  });
});

describe("loadCsv", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "csv-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load and parse CSV file", () => {
    const filePath = path.join(tmpDir, "test.csv");
    const content = "Name,Age\nJohn,30\nJane,25";
    fs.writeFileSync(filePath, content);

    const result = loadCsv(filePath);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "John", Age: "30" });
  });

  it("should throw error if file does not exist", () => {
    const filePath = path.join(tmpDir, "nonexistent.csv");
    expect(() => loadCsv(filePath)).toThrow("CSV file not found");
  });

  it("should handle custom delimiter option", () => {
    const filePath = path.join(tmpDir, "test.csv");
    const content = "Name;Age\nJohn;30";
    fs.writeFileSync(filePath, content);

    const result = loadCsv(filePath, { delimiter: ";" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ Name: "John", Age: "30" });
  });

  it("should handle relative paths", () => {
    const filePath = path.join(tmpDir, "test.csv");
    const content = "Name,Age\nJohn,30";
    fs.writeFileSync(filePath, content);

    process.chdir(tmpDir);
    const result = loadCsv("./test.csv");
    expect(result).toHaveLength(1);
  });
});
