import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit tests only, and deliberately so.
 *
 * Everything under test here is pure: scoring, profile building, quartet
 * selection and the stability rule. The database layer is not mocked, it is
 * simply not reached — the fixtures below are candidate objects, which is what
 * lets a "harsh rater" or an "anime-heavy user" be described in ten lines
 * instead of seeded into Postgres.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
