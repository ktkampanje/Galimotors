/**
 * Seed road distances between Malawian districts for the viewing-cost
 * calculator. Run once: `node prisma/seedDistances.js` (idempotent).
 *
 * Two datasets:
 *  - Base legs: Lilongwe <-> every district (the team's base).
 *  - Direct corridor pairs (Blantyre/Zomba southern cluster, Mzuzu northern
 *    cluster, lake routes) so a car located OUTSIDE Lilongwe is priced on
 *    the road it actually travels — the calculator prefers a direct pair
 *    and only falls back to summing via Lilongwe when none exists.
 *
 * All figures are road estimates (+/- 10-15 km), editable any time in
 * Admin -> Districts & Logistics. Rules:
 *  - never overwrite an existing non-zero value (admin data wins)
 *  - an existing 0 km row between two DIFFERENT districts is junk -> fixed
 *  - Likoma is deliberately NOT seeded: it is an island (ferry via Nkhata
 *    Bay); bookings there resolve to 0 km and the admin quotes manually.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// [from, to, km]
const BASE_LEGS = [
  ["Lilongwe", "Dowa", 55],
  ["Lilongwe", "Dedza", 85],
  ["Lilongwe", "Ntchisi", 95],
  ["Lilongwe", "Salima", 100],
  ["Lilongwe", "Mchinji", 110],
  ["Lilongwe", "Kasungu", 130],
  ["Lilongwe", "Ntcheu", 160],
  ["Lilongwe", "Nkhotakota", 205],
  ["Lilongwe", "Balaka", 230],
  ["Lilongwe", "Mangochi", 260],
  ["Lilongwe", "Machinga", 290],
  ["Lilongwe", "Zomba", 300],
  ["Lilongwe", "Blantyre", 311],
  ["Lilongwe", "Chiradzulu", 325],
  ["Lilongwe", "Thyolo", 350],
  ["Lilongwe", "Chikwawa", 360],
  ["Lilongwe", "Mzuzu", 365],
  ["Lilongwe", "Mwanza", 370],
  ["Lilongwe", "Mulanje", 375],
  ["Lilongwe", "Neno", 380],
  ["Lilongwe", "Phalombe", 380],
  ["Lilongwe", "Nkhata Bay", 410],
  ["Lilongwe", "Rumphi", 430],
  ["Lilongwe", "Nsanje", 510],
  ["Lilongwe", "Karonga", 590],
  ["Lilongwe", "Chitipa", 690],
];

const CORRIDOR_PAIRS = [
  // Southern cluster — Blantyre hub
  ["Blantyre", "Chiradzulu", 15],
  ["Blantyre", "Thyolo", 40],
  ["Blantyre", "Chikwawa", 50],
  ["Blantyre", "Mwanza", 60],
  ["Blantyre", "Zomba", 65],
  ["Blantyre", "Mulanje", 65],
  ["Blantyre", "Neno", 75],
  ["Blantyre", "Phalombe", 85],
  ["Blantyre", "Balaka", 100],
  ["Blantyre", "Machinga", 115],
  ["Blantyre", "Mangochi", 190],
  ["Blantyre", "Nsanje", 200],
  // Zomba spokes
  ["Zomba", "Machinga", 55],
  ["Zomba", "Phalombe", 70],
  ["Zomba", "Balaka", 75],
  ["Zomba", "Mangochi", 130],
  ["Mulanje", "Phalombe", 35],
  // Lake / eastern corridor
  ["Balaka", "Machinga", 35],
  ["Balaka", "Ntcheu", 55],
  ["Balaka", "Mangochi", 70],
  ["Salima", "Nkhotakota", 105],
  ["Salima", "Dedza", 105],
  // Northern cluster — Mzuzu hub
  ["Mzuzu", "Nkhata Bay", 47],
  ["Mzuzu", "Rumphi", 70],
  ["Mzuzu", "Nkhotakota", 195],
  ["Mzuzu", "Karonga", 220],
  ["Mzuzu", "Kasungu", 240],
  ["Rumphi", "Karonga", 150],
  ["Karonga", "Chitipa", 100],
];

async function main() {
  const districts = await prisma.district.findMany({ select: { id: true, name: true } });
  const idByName = new Map(districts.map((d) => [d.name.toLowerCase(), d.id]));

  const existing = await prisma.distance.findMany();
  const findPair = (aId, bId) =>
    existing.find(
      (r) =>
        (r.fromDistrictId === aId && r.toDistrictId === bId) ||
        (r.fromDistrictId === bId && r.toDistrictId === aId)
    );

  let created = 0;
  let fixedZero = 0;
  let keptExisting = 0;
  const skippedDistricts = new Set();

  for (const [fromName, toName, km] of [...BASE_LEGS, ...CORRIDOR_PAIRS]) {
    const fromId = idByName.get(fromName.toLowerCase());
    const toId = idByName.get(toName.toLowerCase());
    if (!fromId) { skippedDistricts.add(fromName); continue; }
    if (!toId) { skippedDistricts.add(toName); continue; }

    const pair = findPair(fromId, toId);
    if (pair) {
      if (pair.distanceKm === 0) {
        // 0 km between two different districts is junk data — repair it.
        await prisma.distance.update({ where: { id: pair.id }, data: { distanceKm: km } });
        pair.distanceKm = km;
        fixedZero++;
      } else {
        keptExisting++; // admin-entered value wins
      }
      continue;
    }

    const row = await prisma.distance.create({
      data: { fromDistrictId: fromId, toDistrictId: toId, distanceKm: km },
    });
    existing.push(row);
    created++;
  }

  console.log(`created: ${created}, repaired 0km rows: ${fixedZero}, kept existing: ${keptExisting}`);
  if (skippedDistricts.size) {
    console.log("skipped (district not in DB):", [...skippedDistricts].join(", "));
  }
  console.log(
    "note: Likoma is not seeded (island — ferry via Nkhata Bay); bookings there fall back to a manual quote."
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Seed failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
