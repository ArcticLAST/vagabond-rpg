/**
 * Record where each Bestiary creature's token art lives in a GM's own Foundry data, without shipping any art.
 * Usage: node tools/token-art.mjs <file-list.txt> [base]
 *   file-list.txt  One image path per line, relative to the art folder (e.g. "tokens/bestial/bat-giant.webp").
 *   base           Where that folder sits in Foundry's Data (default "assets/tokens-pf2e").
 * Each matched creature gets flags.vagabond-rpg.art; creatures with no image of the same name are left alone.
 * When an NPC is created from the Bestiary, the art is used if that file exists on the server (module/documents/actor.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { buildIndex, artFor } from "../module/token-art.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [list, base = "assets/tokens-pf2e"] = process.argv.slice(2);
if ( !list ) throw new Error("Usage: node tools/token-art.mjs <file-list.txt> [base]");
const paths = fs.readFileSync(list, "utf8").split(/\r?\n/).filter(Boolean).map(p => `${base}/${p.replace(/^\.\//, "")}`);
const index = buildIndex(paths);
const dir = path.join(root, "src", "packs", "bestiary");
let matched = 0;
for ( const file of fs.readdirSync(dir).filter(f => f.endsWith(".json")) ) {
  const full = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  const art = artFor(data.name, index);
  const flags = (data.flags ??= {});
  const own = (flags["vagabond-rpg"] ??= {});
  const before = JSON.stringify(own.art ?? null);
  if ( art ) { own.art = { portrait: art.portrait, token: art.token }; matched++; }
  else delete own.art;
  if ( !Object.keys(own).length ) delete flags["vagabond-rpg"];
  if ( JSON.stringify(own.art ?? null) !== before ) fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
}
console.log(`Token art recorded for ${matched} creatures.`);
