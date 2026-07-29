import fs from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required");
}

const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = (await fs.readdir(migrationsDirectory))
  .filter(fileName => fileName.endsWith(".sql"))
  .sort();

const sql = postgres(databaseUrl, { max: 1, ssl: "require" });

try {
  for (const migrationFile of migrationFiles) {
    const sqlText = await fs.readFile(new URL(migrationFile, migrationsDirectory), "utf8");
    await sql.unsafe(sqlText);
    console.log(`Applied ${migrationFile}.`);
  }
  console.log("Supabase migrations applied successfully.");
} finally {
  await sql.end();
}
