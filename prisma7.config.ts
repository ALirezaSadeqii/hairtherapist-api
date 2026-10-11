import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { defineConfig } from "prisma/config";

// Load .env.local first if it exists, then fallback/supplement with .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
