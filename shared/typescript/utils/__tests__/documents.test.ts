import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readDocumentsFromDir } from "../documents";

describe("readDocumentsFromDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "documents-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load .txt files from directory", () => {
    fs.writeFileSync(path.join(tmpDir, "doc1.txt"), "Content 1");
    fs.writeFileSync(path.join(tmpDir, "doc2.txt"), "Content 2");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.title).sort()).toEqual(["doc1.txt", "doc2.txt"]);
    expect(docs[0].content).toBe("Content 1");
    expect(docs[1].content).toBe("Content 2");
  });

  it("should load .md files from directory", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.md"), "# Title\nContent");
    fs.writeFileSync(path.join(tmpDir, "notes.md"), "Some notes");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.title).sort()).toEqual(["notes.md", "readme.md"]);
  });

  it("should load both .txt and .md files", () => {
    fs.writeFileSync(path.join(tmpDir, "doc.txt"), "Text content");
    fs.writeFileSync(path.join(tmpDir, "readme.md"), "Markdown content");
    fs.writeFileSync(path.join(tmpDir, "ignore.pdf"), "PDF content");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.title).sort()).toEqual(["doc.txt", "readme.md"]);
  });

  it("should ignore non-text files", () => {
    fs.writeFileSync(path.join(tmpDir, "doc.txt"), "Content");
    fs.writeFileSync(path.join(tmpDir, "image.png"), "binary data");
    fs.writeFileSync(path.join(tmpDir, "data.pdf"), "pdf data");
    fs.writeFileSync(path.join(tmpDir, "script.js"), "js code");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe("doc.txt");
  });

  it("should generate sequential document IDs", () => {
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "A");
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "B");
    fs.writeFileSync(path.join(tmpDir, "c.txt"), "C");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs[0].id).toBe("doc-0");
    expect(docs[1].id).toBe("doc-1");
    expect(docs[2].id).toBe("doc-2");
  });

  it("should set title to filename", () => {
    fs.writeFileSync(path.join(tmpDir, "my-document.txt"), "Content");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs[0].title).toBe("my-document.txt");
  });

  it("should return empty array if no .txt or .md files", () => {
    fs.writeFileSync(path.join(tmpDir, "data.pdf"), "PDF");
    fs.writeFileSync(path.join(tmpDir, "image.png"), "Image");

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs).toEqual([]);
  });

  it("should throw error if directory does not exist", () => {
    const nonexistentDir = path.join(tmpDir, "nonexistent");
    expect(() => readDocumentsFromDir(nonexistentDir)).toThrow("Data directory not found");
  });

  it("should handle relative paths", () => {
    fs.writeFileSync(path.join(tmpDir, "doc.txt"), "Content");

    process.chdir(tmpDir);
    const docs = readDocumentsFromDir(".");
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe("doc.txt");
  });

  it("should preserve file content exactly", () => {
    const content = "Line 1\nLine 2\n  Line 3 with spaces  ";
    fs.writeFileSync(path.join(tmpDir, "doc.txt"), content);

    const docs = readDocumentsFromDir(tmpDir);
    expect(docs[0].content).toBe(content);
  });
});
