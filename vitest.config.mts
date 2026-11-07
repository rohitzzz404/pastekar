import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      APP_URL: "http://localhost:3000",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
    },
  },
});
