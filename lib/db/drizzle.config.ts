import { defineConfig } from "drizzle-kit";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../../../../data/acis.db");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${DB_PATH}`,
  },
});
