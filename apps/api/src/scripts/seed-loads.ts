import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

interface SeedLoad {
  load_id: string;
  origin: string;
  destination: string;
  pickup_datetime: string;
  delivery_datetime: string;
  equipment_type: string;
  loadboard_rate: number;
  notes?: string;
  weight: number;
  commodity_type: string;
  num_of_pieces: number;
  miles: number;
  dimensions?: string;
}

// Wipe an entire collection in 400-doc batches (Firestore batch limit is 500).
async function wipeCollection(db: Firestore, name: string): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await db.collection(name).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

async function main() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? "happyrobot-fde-poc";
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const wipeCalls = process.env.RESET_CALLS === "true" || process.argv.includes("--reset-calls");
  const allowProduction =
    process.env.ALLOW_PRODUCTION_SEED === "true" ||
    process.argv.includes("--allow-production");

  // Guardrail: this script is destructive (it wipes the loads collection and,
  // with --reset-calls, the calls collection too). Refuse to run against a
  // real Firestore unless the operator explicitly opts in.
  if (!useEmulator && !allowProduction) {
    console.error(
      `Refusing to seed/reset against Firestore (project=${projectId}) without an emulator.\n` +
        `  - For local dev, export FIRESTORE_EMULATOR_HOST=localhost:8085 first.\n` +
        `  - To target a real GCP project on purpose, re-run with --allow-production` +
        ` (or ALLOW_PRODUCTION_SEED=true).`,
    );
    process.exit(2);
  }

  if (getApps().length === 0) {
    initializeApp(
      useEmulator
        ? { projectId }
        : { projectId, credential: applicationDefault() },
    );
  }

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath =
    process.env.SEED_FILE ??
    resolve(here, "..", "..", "..", "..", "infra", "sample-loads.json");

  const raw = await readFile(dataPath, "utf-8");
  const loads = JSON.parse(raw) as SeedLoad[];

  console.log(
    `Resetting Firestore (project=${projectId}, emulator=${useEmulator}, reset_calls=${wipeCalls})`,
  );

  const wipedLoads = await wipeCollection(db, "loads");
  console.log(`  ↳ wiped ${wipedLoads} existing load(s)`);

  if (wipeCalls) {
    const wipedCalls = await wipeCollection(db, "calls");
    console.log(`  ↳ wiped ${wipedCalls} existing call record(s)`);
  }

  console.log(`Seeding ${loads.length} loads…`);
  const batch = db.batch();
  for (const load of loads) {
    const ref = db.collection("loads").doc(load.load_id);
    // Use set() (no merge) so re-runs always produce a clean "available" doc
    // without leftover booked_by_mc / agreed_rate / booked_at fields.
    batch.set(ref, { ...load, status: "available" });
  }
  await batch.commit();

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
