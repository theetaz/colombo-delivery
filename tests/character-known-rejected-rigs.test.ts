import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { measureUvPairedTriangleStrain } from "./character-rig-audit";

const ROOT = new URL("../", import.meta.url);
const SOURCE = new URL("public/models/teen_courier.glb", ROOT);

const rejected = [
  {
    name: "human-rejected direct-weight v1",
    posed: new URL("public/models/teen_courier_clean_rig_upper_body.glb", ROOT),
    manifest: new URL("public/models/teen_courier_clean_rig.manifest.json", ROOT),
    status: "rejected-by-human-review",
  },
  {
    name: "engineering-rejected harmonic v2",
    posed: new URL("art/characters/teen-courier/clean-rig/harmonic-v2/teen_courier_clean_rig_upper_body.glb", ROOT),
    manifest: new URL("art/characters/teen-courier/clean-rig/harmonic-v2/teen_courier_clean_rig.manifest.json", ROOT),
    status: "engineering-rejected",
  },
  {
    name: "engineering-rejected cage prototype",
    posed: new URL("art/characters/teen-courier/cage-rig/teen_courier_cage_rig_upper_body.glb", ROOT),
    manifest: new URL("art/characters/teen-courier/cage-rig/teen_courier_cage_rig.manifest.json", ROOT),
    status: "engineering-rejected",
  },
] as const;

for (const fixture of rejected) {
  test(`${fixture.name} remains a negative excessive-distortion fixture`, async () => {
    const manifest = JSON.parse(await readFile(fixture.manifest, "utf8"));
    assert.equal(manifest.reviewStatus, fixture.status);
    const strain = await measureUvPairedTriangleStrain(SOURCE, fixture.posed);
    assert.ok(strain.edgeCount > 50_000);
    assert.ok(strain.minRatio < 0.8 || strain.maxRatio > 1.25,
      `known rejected fixture unexpectedly stayed within 0.80x..1.25x: ${strain.minRatio}..${strain.maxRatio}`);
  });
}
