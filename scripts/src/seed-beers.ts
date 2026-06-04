import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, beersTable, pool } from "@workspace/db";

type BeerSeed = {
  name: string;
  kegSize: string;
  price: number;
  available?: boolean;
  notes?: string | null;
};

function parseBeerSeeds(value: unknown): BeerSeed[] {
  if (!Array.isArray(value)) {
    throw new Error("Beer seed data must be a JSON array.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Beer seed at index ${index} must be an object.`);
    }

    const candidate = item as Record<string, unknown>;
    const name = candidate.name;
    const kegSize = candidate.kegSize;
    const price = candidate.price;

    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`Beer seed at index ${index} is missing name.`);
    }

    if (typeof kegSize !== "string" || kegSize.trim() === "") {
      throw new Error(`Beer seed at index ${index} is missing kegSize.`);
    }

    if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
      throw new Error(`Beer seed at index ${index} has an invalid price.`);
    }

    return {
      name: name.trim(),
      kegSize: kegSize.trim(),
      price,
      available:
        typeof candidate.available === "boolean" ? candidate.available : true,
      notes:
        typeof candidate.notes === "string"
          ? candidate.notes
          : candidate.notes === null
            ? null
            : null,
    };
  });
}

async function loadSeedData(): Promise<BeerSeed[]> {
  const [, , filePath] = process.argv;
  let rawJson = process.env.BEER_SEED_JSON;

  if (filePath) {
    const candidates = [
      filePath,
      path.resolve(process.cwd(), filePath),
      path.resolve(process.cwd(), "..", filePath),
    ];

    const errors: unknown[] = [];
    for (const candidate of candidates) {
      try {
        rawJson = await readFile(candidate, "utf8");
        break;
      } catch (err) {
        errors.push(err);
      }
    }

    if (!rawJson) {
      throw errors.at(-1) ?? new Error(`Could not read ${filePath}`);
    }
  }

  if (!rawJson) {
    throw new Error(
      "Provide a JSON file path or BEER_SEED_JSON. Example: pnpm db:seed:beers ./scripts/data/beers.json",
    );
  }

  return parseBeerSeeds(JSON.parse(rawJson));
}

async function main() {
  const seeds = await loadSeedData();
  const existing = await db.select().from(beersTable);
  const existingKeys = new Set(
    existing.map((beer) => `${beer.name.toLowerCase()}|${beer.kegSize.toLowerCase()}`),
  );

  const newSeeds = seeds.filter(
    (beer) => !existingKeys.has(`${beer.name.toLowerCase()}|${beer.kegSize.toLowerCase()}`),
  );

  if (newSeeds.length === 0) {
    console.log("No new beer/keg options to seed.");
    return;
  }

  await db.insert(beersTable).values(
    newSeeds.map((beer) => ({
      name: beer.name,
      kegSize: beer.kegSize,
      price: String(beer.price),
      available: beer.available ?? true,
      notes: beer.notes ?? null,
    })),
  );

  console.log(`Seeded ${newSeeds.length} beer/keg option(s).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
