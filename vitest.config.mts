import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: "mongodb://127.0.0.1:27017/propflow-test", NEXTAUTH_SECRET: "test-secret" },
  },
});
