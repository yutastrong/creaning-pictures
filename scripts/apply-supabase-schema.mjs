import fs from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required");
}

const sqlText = await fs.readFile(
  new URL("../supabase/migrations/001_initial.sql", import.meta.url),
  "utf8",
);

const sql = postgres(databaseUrl, { max: 1, ssl: "require" });

try {
  await sql.unsafe(sqlText);
  console.log("Supabase schema applied successfully.");
} finally {
  await sql.end();
}
