import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Only load .env file if DATABASE_URL not already set (for local dev)
// On Railway, env vars are injected directly
if (!process.env.DATABASE_URL) {
  config({ path: "../../.env" });
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
