import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["booking/__tests__/**/*.test.ts"],
    environment: "node"
  }
});


