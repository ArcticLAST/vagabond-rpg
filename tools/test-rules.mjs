/**
 * Unit tests for module/rules.mjs. Run with: node tools/test-rules.mjs
 */
import assert from "node:assert/strict";
import * as r from "../module/rules.mjs";

const tests = {
  "averageDamage matches printed statblock averages"() {
    assert.equal(r.averageDamage("d10"), 5);
    assert.equal(r.averageDamage("2d6"), 7);
    assert.equal(r.averageDamage("d6+1"), 4);
    assert.equal(r.averageDamage("2d12!"), 13);
    assert.equal(r.averageDamage("3d6"), 10);
    assert.equal(r.averageDamage("d4"), 2);
    assert.equal(r.averageDamage("1"), 1);
    assert.equal(r.averageDamage("by weapon"), null);
    assert.equal(r.averageDamage(""), null);
  },
  "threatLevel follows the p. 111 formula"() {
    // Commoner: Armor 0, 4 HP, 1 damage -> 0.3 as printed.
    assert.equal(r.threatLevel({ armor: 0, hp: 4, dpr: 1 }), 0.3);
    // Acolyte: Armor 0, 4 HP, Holy Flame 7 -> 1.3 as printed.
    assert.equal(r.threatLevel({ armor: 0, hp: 4, dpr: 7 }), 1.3);
    assert.equal(r.threatLevel({ armor: 2, hp: 40, dpr: 12 }), 4);
  },
  "hero creation: trainings from Reason and auto-assign (p. 20)": () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(r.reasonTrainings), [1, 1, 2, 2, 3, 3, 4]);
    const stats = ["mit", "dex", "awr", "rsn", "prs", "luk"];
    const arr = [7, 5, 4, 4, 3, 3];
    const a = r.autoAssign(arr, ["rsn"], stats);
    assert.equal(arr[a.rsn], 7);
    assert.equal(arr[a.mit], 5);
    assert.deepEqual(Object.values(a).sort(), [0, 1, 2, 3, 4, 5]);
  },
  "perk prerequisites (p. 64)": () => {
    const hero = { stats: { dex: 4, mit: 3, awr: 7 }, trained: ["Finesse", "Detect"], spells: ["Ward"] };
    assert.equal(r.checkPrerequisites("Stat: DEX 4+ | Trained: Finesse or Melee", hero).met, true);
    assert.equal(r.checkPrerequisites("Stat: MIT 4+ | Trained: Brawl", hero).unmet.length, 2);
    assert.equal(r.checkPrerequisites("Stat: AWR 7 | Trained: Detect & Ranged", hero).met, false);
    assert.equal(r.checkPrerequisites("Trained: Craft & either Arcana or Mysticism", { trained: ["Craft", "Mysticism"] }).met, true);
    assert.equal(r.checkPrerequisites("Spell: Ward", hero).met, true);
    assert.equal(r.checkPrerequisites("Spell: Charm or Fear", hero).met, false);
    assert.equal(r.checkPrerequisites("Spell: any Object-creating Spell", hero).met, true);
    assert.equal(r.checkPrerequisites("", hero).met, true);
  },
  "leveling rewards (p. 27)": () => {
    assert.deepEqual(r.levelRewards(2), { statIncrease: 1, perks: 0 });
    assert.deepEqual(r.levelRewards(3), { statIncrease: 0, perks: 1 });
    assert.deepEqual(r.levelRewards(1), { statIncrease: 0, perks: 0 });
    assert.deepEqual(r.levelRewards(10), { statIncrease: 1, perks: 0 });
  },
  "skill difficulty (p. 8)": () => {
    assert.equal(r.skillDifficulty(4, false), 16);
    assert.equal(r.skillDifficulty(4, true), 12);
    assert.equal(r.skillDifficulty(7, true), 6);
  },
  "save difficulties (p. 22)": () => {
    const stats = { mit: 5, dex: 4, awr: 3, rsn: 2, prs: 6 };
    assert.equal(r.saveDifficulty("endure", stats), 10);
    assert.equal(r.saveDifficulty("reflex", stats), 13);
    assert.equal(r.saveDifficulty("reflex", stats, 2), 15);
    assert.equal(r.saveDifficulty("will", stats), 12);
  },
  "speed by DEX (p. 21)": () => {
    assert.deepEqual([2, 3, 4, 5, 6, 7].map(r.baseSpeed), [25, 25, 30, 30, 35, 35]);
    assert.equal(r.crawlSpeed(30), 90);
    assert.equal(r.travelSpeed(30), 6);
  },
  "max HP (p. 21)": () => {
    assert.equal(r.maxHP({ might: 5, level: 3 }), 15);
    assert.equal(r.maxHP({ might: 5, level: 0 }), 5);
    assert.equal(r.maxHP({ might: 5, level: 3, perLevel: 1 }), 18);
    assert.equal(r.maxHP({ might: 5, level: 3, fatigue: 5 }), 0);
  },
  "slots (p. 21)": () => {
    assert.equal(r.maxSlots(4), 12);
    assert.equal(r.stackSlots(0, 25), 3);
    assert.equal(r.stackSlots(2, 3), 6);
  },
  "cast max and spells known (class pages)": () => {
    assert.equal(r.castMax("full", 1), 3);
    assert.equal(r.castMax("half", 1), 2);
    assert.equal(r.castMax("half", 4), 3);
    assert.equal(r.spellsKnown(4, 2, 1), 4);
    assert.equal(r.spellsKnown(4, 2, 3), 5);
    assert.equal(r.spellsKnown(2, 3, 4), 3);
  },
  "die steps (p. 7)": () => {
    assert.deepEqual(r.stepDie(6, 1), { faces: 8, flat: 0, bonus: 0 });
    assert.deepEqual(r.stepDie(12, 2), { faces: 12, flat: 0, bonus: 2 });
    assert.deepEqual(r.stepDie(4, -1), { faces: null, flat: 1, bonus: 0 });
    assert.deepEqual(r.stepDie(1, 1), { faces: 4, flat: 0, bonus: 0 });
  },
  "damage formulas": () => {
    assert.equal(r.damageFormula({ count: 1, faces: 8 }), "1d8");
    assert.equal(r.damageFormula({ count: 2, faces: 6, perDie: -2 }), "2d6 - 4");
    assert.equal(r.damageFormula({ count: 1, faces: 6, steps: 1, flat: 3 }), "1d8 + 3");
    assert.equal(r.damageFormula({ count: 1, faces: 1 }), "1");
  },
  "check resolution (p. 8)": () => {
    assert.equal(r.resolveCheck({ total: 15, natural: 15, difficulty: 12 }).outcome, "pass");
    assert.equal(r.resolveCheck({ total: 11, natural: 11, difficulty: 12 }).outcome, "fail");
    assert.equal(r.resolveCheck({ total: 20, natural: 20, difficulty: 25 }).outcome, "crit");
    assert.equal(r.resolveCheck({ total: 19, natural: 19, difficulty: 12, critOn: 19 }).outcome, "crit");
    assert.equal(r.resolveCheck({ total: 20, natural: 20, difficulty: 2, autoFail: true }).outcome, "fail");
  },
  "favor and hinder cancel (p. 8)": () => {
    assert.equal(r.netFavor(2, 1), 1);
    assert.equal(r.netFavor(1, 1), 0);
    assert.equal(r.netFavor(0, 3), -1);
  },
  "casting cost (p. 91)": () => {
    const cone = { cost: 2, upcast: 2 };
    assert.equal(r.castCost({ delivery: cone, damage: true, effect: false }), 2);
    assert.equal(r.castCost({ delivery: cone, deliverySteps: 1, damage: true, effect: true, extraDice: 2 }), 7);
    assert.equal(r.castCost({ delivery: { cost: 0, upcast: 1 }, damage: false, effect: true, discount: 1 }), 0);
  },
  "armor and coins": () => {
    assert.equal(r.applyArmor(7, 2), 5);
    assert.equal(r.applyArmor(1, 3), 0);
    assert.equal(r.applyArmor(7, 2, { ignoreArmor: true }), 7);
    assert.equal(r.parseCoins("1g 60s"), 160);
    assert.equal(r.parseCoins("5c"), 0.05);
    assert.equal(r.formatCoins(160), "1g 60s");
    assert.equal(r.hpFromHD(6), 27);
    assert.equal(r.hpFromHD(3, "small"), 3);
  }
};

const rules = r;
const eq = (actual, expected, message) => assert.equal(actual, expected, message);

// Damage types: Immune and Weak text (p. 115-180).
{
  const angel = { immune: "Poison; Physical from non-Relics and Relic Weapons weaker than (+2)" };
  eq(rules.damageResponse(angel, { type: "physical" }), "immune", "mundane weapon vs Angel");
  eq(rules.damageResponse(angel, { type: "slash", relic: true, bonus: 1 }), "immune", "+1 Relic vs Angel");
  eq(rules.damageResponse(angel, { type: "physical", relic: true, bonus: 2 }), null, "+2 Relic vs Angel");
  eq(rules.damageResponse(angel, { type: "poison" }), "immune", "poison vs Angel");
  eq(rules.damageResponse(angel, { type: "fire" }), null, "fire vs Angel");
  const ghost = { immune: "Cold, Poison, Shock; Physical from non-Relics" };
  eq(rules.damageResponse(ghost, { type: "blunt" }), "immune");
  eq(rules.damageResponse(ghost, { type: "blunt", relic: true }), null);
  const werewolf = { weak: "Blunt; Silvered Weapons" };
  eq(rules.damageResponse(werewolf, { type: "physical", metal: "silver" }), "weak");
  eq(rules.damageResponse(werewolf, { type: "blunt" }), "weak");
  eq(rules.damageResponse(werewolf, { type: "physical" }), null, "generic Physical isn't Blunt");
  eq(rules.damageResponse({ immune: "Fire, Poison Status Immune: Sickened" }, { type: "fire" }), "immune");
  eq(rules.damageResponse({ immune: "Blunt from non-Relics" }, { type: "blunt", relic: true }), null);
  eq(rules.damageResponse({ weak: "Fire, damage from axes" }, { type: "fire" }), "weak");
  eq(rules.parseDamageTraits("See table below").length, 0);
  {
    const t = rules.splitTraits("statusImmunities", "Sickened, Fatigue, Sufffocating; Charmed");
    assert.deepEqual(t, { keys: ["sickened", "fatigued", "suffocating", "charmed"], other: "" });
    eq(rules.joinTraits("statusImmunities", t.keys), "Charmed, Fatigued, Sickened, Suffocating");
    const i = rules.splitTraits("immune", "Poison, Physical from non-Relics and Relic weapons weaker than (+2), fire");
    assert.deepEqual(i, { keys: ["poison", "fire"], other: "Physical from non-Relics and Relic weapons weaker than (+2)" });
    eq(rules.joinTraits("immune", ["poison", "physicalNonRelic"], ""), "Physical from non-Relics, Poison");
    eq(rules.parseDamageTraits(rules.joinTraits("immune", ["physicalNonRelic"])).at(0).nonRelic, true);
    eq(rules.parseDamageTraits(rules.joinTraits("weak", ["coldIron"])).at(0).metal, "coldIron");
    eq(rules.joinTraits("weak", [], "Damage from axes"), "Damage from axes");
    eq(rules.parseDamageTraits("Physical from Silvered Weapons").at(0).metal, "silver", "Silvered only, not all Physical");
    assert.deepEqual(rules.splitTraits("weak", "Physical from Silvered Weapons").keys, ["silvered"]);
  }
}
console.log("damage types: ok");

// Perk limits and prerequisites (hero builder).
{
  eq(rules.perkLimit("You can take this Perk multiple times."), Infinity);
  eq(rules.perkLimit("You can take this Perk up to 4 times."), 4);
  eq(rules.perkLimit("You can take this Perk up to three times."), 3);
  eq(rules.perkLimit("You can take this Perk twice."), 2);
  eq(rules.perkLimit("<p>You gain Swim.</p>"), 1);
  const capped = { mit: 7, dex: 7, awr: 7, rsn: 7, prs: 7, luk: 7 };
  eq(rules.checkPrerequisites("Stat: Chosen Stat <7", { stats: capped }).met, false, "every Stat at 7");
  eq(rules.checkPrerequisites("Stat: Chosen Stat <7", { stats: { ...capped, luk: 3 } }).met, true);
  eq(rules.checkPrerequisites("Spell: any Object-creating Spell", { spells: [] }).met, false);
  eq(rules.checkPrerequisites("Spell: any Object-creating Spell", { spells: ["Conjure"] }).met, true);
}
console.log("perk limits: ok");

// NPC Action damage types read from names (matches tools/damage-types.py).
{
  const t = (n, k = "melee") => rules.inferActionDamage(n, k);
  assert.deepEqual(t("Dominator 1: (+3) Flaming Sword"), { type: "physical", relic: 3 });
  assert.deepEqual(t("Red Breath", "attack"), { type: "fire", relic: 0 });
  assert.deepEqual(t("White Breath", "attack"), { type: "cold", relic: 0 });
  eq(t("Lightning Bolt", "cast").type, "shock");
  eq(t("Ice Knife", "cast").type, "cold");
  eq(t("Caustic Venom", "ranged").type, "acid");
  eq(t("Noxious Gas", "attack").type, "poison");
  eq(t("Death Ray", "cast").type, "magic");
  eq(t("Bite").type, "physical");
  eq(t("Slice").type, "physical", "'ice' inside a word isn't Cold");
}
console.log("action damage types: ok");

// NPC Action Saves (matches tools/bestiary-corrections.py), Combo parts, and clickable dice in text.
{
  const s = a => rules.actionSaves(a);
  assert.deepEqual(s({ actionType: "melee", text: "5 (d10) and pass an [Endure] Save or be Cursed", save: "endure" }),
    { save: "reflex", effect: ["endure"] }, "an attack is avoided with Reflex, then Endure after a hit");
  assert.deepEqual(s({ actionType: "melee", text: "4 (d8) and pass [Endure] or ... must pass [Will] or also be Charmed" }),
    { save: "reflex", effect: ["endure", "will"] });
  assert.deepEqual(s({ actionType: "action", tags: "Rush, when Fleeing", text: "Others must pass [Endure] or take 7 (2d6)." }),
    { save: "endure", effect: [] }, "Smoky Escape: Endure avoids it");
  assert.deepEqual(s({ actionType: "ability", text: "must pass a [Will] Save or be Frightened" }), { save: "will", effect: [] });
  assert.deepEqual(s({ actionType: "action", tags: "Action, Aura Near | Reflex", text: "7 (2d6) and pass [Endure] or Sickened" }),
    { save: "reflex", effect: ["endure"] }, "the tags' Save wins");
  assert.deepEqual(s({ actionType: "attack", tags: "Attack | Endure or Reflex", text: "7 (2d6)" }), { save: "endureReflex", effect: [] });
  assert.deepEqual(s({ actionType: "cast", tags: "Cast, Aura Far | Will", text: "a -2 to [Reflex] Saves" }),
    { save: "will", effect: [] }, "a Save named without 'pass' isn't forced");
  assert.deepEqual(s({ actionType: "combo", text: "8×Claw" }), { save: "", effect: [] }, "a Combo forces nothing itself");
  assert.deepEqual(s({ actionType: "cast", tags: "Cast, Far Aura", text: "4 (d6+1) or obey the command issued by this Being." }),
    { save: "", effect: [] }, "no printed Save means no Save");
  assert.deepEqual(s({ actionType: "action", tags: "Grapple", text: "9 (2d8) and Restrained" }), { save: "", effect: [] });
  assert.deepEqual(s({ actionType: "cast", tags: "Cast, Bolt", text: "7 (2d6) and pass [Endure] or become Sickened" }),
    { save: "", effect: ["endure"] }, "a Cast's damage lands, then the Endure Save");
  assert.deepEqual(rules.saveKeys("endureReflex"), ["endure", "reflex"]);
  assert.deepEqual(rules.saveKeys(""), []);

  const c = (text, names) => rules.comboParts(text, names).map(p => `${p.count}×${p.name}`).join(", ");
  eq(c("8×Claw", ["Claw", "Jaw Lock"]), "8×Claw", "a Combo of eight Claw attacks");
  eq(c("2×Claws and 1×Bite. If both Claws hit", ["Claw", "Bite"]), "2×Claw, 1×Bite");
  eq(c("3 (d6)×Tail Spike", ["Tail Spike"]), "3 (d6)×Tail Spike");
  eq(c("2×Claw, 1×Lion's Bite, and 1×Breath or 1×Dragon's Bite", ["Claw", "Lion's Bite", "Breath", "Dragon's Bite"]),
    "2×Claw, 1×Lion's Bite, 1×Breath, 1×Dragon's Bite");
  eq(c("1×Fish and 1×Claw, or 2×Claw", ["Claw", "Fish"]), "1×Fish, ×Claw", "no single count across options");
  eq(c("1×Pit Mace and 1×Bite", ["(+2) Mace", "Bite"]), "1×(+2) Mace, 1×Bite", "matched by last word");

  eq(rules.inlineDice("takes 18 (4d8) damage"), "takes 18 ([[/r 4d8]]{4d8}) damage");
  eq(rules.inlineDice("55 (d10×10)"), "55 ([[/r 1d10*10]]{d10×10})");
  eq(rules.inlineDice("10 (3d6, half on pass)"), "10 ([[/r 3d6]]{3d6}, half on pass)");
  eq(rules.inlineDice("Sickened (Cd6) and 1/2 (1/d4)"), "Sickened (Cd6) and 1/2 (1/d4)", "Countdown dice stay text");
}
console.log("action saves and combos: ok");

// Negative Armor from a Vulnerability curse adds to damage taken.
eq(rules.applyArmor(7, -1), 8);
eq(rules.applyArmor(7, -3), 10);
eq(rules.applyArmor(0, -2), 0, "no damage stays no damage");
eq(rules.applyArmor(7, -1, { ignoreArmor: true }), 7);
eq(rules.applyArmor(2, 3), 0);

let failed = 0;
for ( const [name, fn] of Object.entries(tests) ) {
  try { fn(); console.log(`ok   ${name}`); }
  catch ( err ) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
