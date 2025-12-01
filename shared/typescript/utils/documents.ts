import fs from "node:fs";
import path from "node:path";
import { Document } from "./types";

/**
 * Loads all text and markdown files from a directory into Document objects.
 *
 * This function scans a directory for files with `.txt` or `.md` extensions,
 * reads their content, and creates Document objects suitable for RAG ingestion.
 * Each file becomes one Document with:
 * - A unique ID based on its index in the directory listing
 * - The filename as the title
 * - The file contents as the document content
 *
 * **File selection**: Only files ending in `.txt` or `.md` are processed.
 * Other files (PDFs, images, etc.) are ignored. This keeps the function simple
 * and focused on text-based RAG use cases.
 *
 * **Error handling**: If the directory doesn't exist, an error is thrown.
 * Individual file read errors are not caught (will propagate up).
 *
 * @param dir - Directory path containing document files (relative or absolute)
 * @returns Array of Document objects, one per `.txt` or `.md` file found
 * @throws Error if the directory doesn't exist or cannot be read
 *
 * @example
 * ```typescript
 * const docs = readDocumentsFromDir("./data");
 * // Returns: [
 * //   { id: "doc-0", title: "report.txt", content: "..." },
 * //   { id: "doc-1", title: "notes.md", content: "..." }
 * // ]
 * ```
 */
export function readDocumentsFromDir(dir: string): Document[] {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Data directory not found at ${resolved}`);
  }
  const files = fs.readdirSync(resolved).filter((file) => file.endsWith(".txt") || file.endsWith(".md"));
  return files.map((file, index) => {
    const content = fs.readFileSync(path.join(resolved, file), "utf-8");
    return {
      id: `doc-${index}`,
      title: file,
      content
    };
  });
}

