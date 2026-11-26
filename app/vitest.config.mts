import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two projects (ADR-001 Step 8): `unit` in jsdom, `integration` in node.
// Inline projects inherit this root config (Vitest 5); arrays such as setupFiles are merged.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    setupFiles: ["./tests/setup/no-network.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup/jest-dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
