import fs from 'node:fs';
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const recipes = read('../src/data/recipes.json');
const products = read('../src/data/products.json');
const machines = read('../src/data/machines.json');
const progression = read('../src/data/recipe-progression.json');
const blocked = new Set(['storage', 'storages', 'cargo_docks']);
const active = new Set();
for (const p of Object.values(products))
  for (const id of p.recipes?.output || []) {
    const r = recipes[id],
      m = r && machines[r.machine];
    if (
      r &&
      m &&
      !m.isStorage &&
      !blocked.has(m.category_id) &&
      r.outputs.some((o) => o.id === p.id)
    )
      active.add(id);
  }
const missing = [...active].filter(
  (id) => !progression[id] || progression[id].researchTier == null
);
if (missing.length)
  throw new Error(
    `Missing progression for ${missing.length} recipes: ${missing.slice(0, 10).join(', ')}`
  );
const hist = Array(6).fill(0);
for (const id of active) {
  const t = progression[id].researchTier;
  if (t < 0 || t > 5) throw new Error(`${id}: invalid T${t}`);
  hist[t]++;
}
if (hist.some((x) => x === 0)) throw new Error(`Not all T0-T5 are populated: ${hist.join(', ')}`);
const anchors = {
  cp_assembly_t1: 0,
  cp2_assembly_t1: 1,
  cp3_assembly_t1: 2,
  cp4_assembly_t1: 3,
  electronics_3_assembly_t2: 4,
  microchip_manufacturing_stage_1a: 5,
};
for (const [id, tier] of Object.entries(anchors))
  if (progression[id]?.researchTier !== tier)
    throw new Error(`${id}: expected T${tier}, got T${progression[id]?.researchTier}`);
const unresolved = [...active].filter((id) => progression[id].provenance === 'UNRESOLVED');
if (unresolved.length) throw new Error(`Unresolved active recipes: ${unresolved.join(', ')}`);
console.log(
  `Progression valid: ${active.size} recipes; ` + hist.map((n, i) => `T${i}=${n}`).join(', ')
);
