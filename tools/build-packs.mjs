/**
 * Compile compendium sources (src/packs/<pack>/*.json) into LevelDB packs (packs/<pack>).
 * Usage: npm install && npm run build:packs
 * To pull edits made in Foundry back to JSON: npm run unpack -- <pack>
 */
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";

const root = process.env.VAGABOND_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src", "packs");
const dest = process.env.VAGABOND_PACKS_DEST ?? path.join(root, "packs");
const [mode = "pack", only] = process.argv.slice(2);

const packs = fs.readdirSync(src).filter(p => fs.statSync(path.join(src, p)).isDirectory())
  .filter(p => !only || (p === only));

for ( const pack of packs ) {
  if ( mode === "unpack" ) {
    console.log(`Extracting ${pack}`);
    await extractPack(path.join(dest, pack), path.join(src, pack), { clean: true });
  } else {
    console.log(`Compiling ${pack}`);
    fs.rmSync(path.join(dest, pack), { recursive: true, force: true });
    await compilePack(path.join(src, pack), path.join(dest, pack), { log: false, recursive: false });
  }
}
