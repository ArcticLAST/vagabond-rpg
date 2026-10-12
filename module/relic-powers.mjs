/**
 * Relic Powers (p. 100-102), grouped as in the book. Values are in gold.
 *
 * A power is either a single option (checkbox) or a family of tiers (pick one). Optional fields:
 * - input: "target" (a Being Type or damage source), "rank" (a count, value per rank), or "value" (priced by hand).
 * - weaponBonus / armorBonus: applied to a Weapon's or Armor's magic bonus.
 * - slotsBonus: Item Slots granted per rank (gear).
 * - speed: bonus Speed, applied by an Active Effect while the Relic is equipped.
 * - curse: marks the Relic as Cursed.
 */
export const RELIC_POWER_GROUPS = [
  { id: "ace", label: "Ace", hint: "Enhances a Weapon Property.", powers: [
    { id: "aceCleave", name: "Cleave", value: 2000, text: "The damage die is one size larger when using the Cleave property." },
    { id: "aceGrapple", name: "Grapple", value: 1000, text: "Target is considered Vulnerable for ending the Restrained Status." },
    { id: "aceKeen", name: "Keen", value: 2000, text: "Crits 2 lower rather than 1 lower from Keen." },
    { id: "aceThrown", name: "Thrown", value: 2000, text: "Far Thrown attacks aren't Hindered with it." },
    { id: "aceVicious", name: "Vicious", value: 2000, text: "Deals an extra damage die from Vicious." }
  ] },
  { id: "bane", label: "Bane", hint: "Adds an extra damage die based on Being Type.", powers: [
    { id: "bane", name: "Bane", input: "target", tiers: [
      { id: "niche", name: "Niche", value: 500, text: "Applies to extremely specific Beings, such as Trolls (not all giants)." },
      { id: "specific", name: "Specific", value: 2000, text: "Applies to a Being subtype, such as giants (not all Cryptids)." },
      { id: "general", name: "General", value: 5000, text: "Applies to an entire Being Type, such as Cryptids (not just giants)." }
    ], text: "Deals an extra damage die to {target}." }
  ] },
  { id: "bonus", label: "Bonus", hint: "Grants an indicated bonus to the indicated attributes.", powers: [
    { id: "bonusArmor", name: "Armor", tiers: [
      { id: "1", name: "+1", value: 100, armorBonus: 1, text: "+1 bonus to Armor." },
      { id: "2", name: "+2", value: 5000, armorBonus: 2, text: "+2 bonus to Armor." },
      { id: "3", name: "+3", value: 50000, armorBonus: 3, text: "+3 bonus to Armor." }
    ] },
    { id: "bonusProtection", name: "Protection", tiers: [
      { id: "1", name: "+1", value: 10000, text: "+1 bonus to Saves." },
      { id: "2", name: "+2", value: 100000, text: "+2 bonus to Saves." },
      { id: "3", name: "+3", value: 1000000, text: "+3 bonus to Saves." }
    ] },
    { id: "bonusTrinket", name: "Trinket", tiers: [
      { id: "1", name: "+1", value: 200, text: "+1 bonus to Spell damage." },
      { id: "2", name: "+2", value: 2500, text: "+2 bonus to Spell damage." },
      { id: "3", name: "+3", value: 10000, text: "+3 bonus to Spell damage." }
    ] },
    { id: "bonusWeapon", name: "Weapon", tiers: [
      { id: "1", name: "+1", value: 100, weaponBonus: 1, text: "+1 bonus to Attack damage." },
      { id: "2", name: "+2", value: 1250, weaponBonus: 2, text: "+2 bonus to Attack damage." },
      { id: "3", name: "+3", value: 5000, weaponBonus: 3, text: "+3 bonus to Attack damage." }
    ] }
  ] },
  { id: "cursed", label: "Cursed", hint: "If Bound, the Being is permanently Bound until the Curse is removed.", powers: [
    { id: "curseAnger", name: "Anger", value: 0, curse: true, text: "Wearer always fails Saves against Berserk." },
    { id: "curseCowardice", name: "Cowardice", value: 0, curse: true, text: "Wearer always fails Saves against Frightened." },
    { id: "curseDoom", name: "Doom", value: 0, curse: true, text: "Wearer only regains 1 Hit Point per die used for healing rolls Targeting it." },
    { id: "curseGullibility", name: "Gullibility", value: 0, curse: true, text: "Wearer always fails Saves against Charmed." },
    { id: "curseVulnerability", name: "Vulnerability", curse: true, tiers: [
      { id: "1", name: "-1", value: 0, armorBonus: -1, text: "Grants no Armor, and Attack damage taken is increased by 1." },
      { id: "2", name: "-2", value: 0, armorBonus: -2, text: "Grants no Armor, and Attack damage taken is increased by 2." },
      { id: "3", name: "-3", value: 0, armorBonus: -3, text: "Grants no Armor, and Attack damage taken is increased by 3." }
    ] },
    { id: "curseWeakness", name: "Weakness", curse: true, tiers: [
      { id: "1", name: "-1", value: 0, weaponBonus: -1, text: "-1 penalty to Attack damage." },
      { id: "2", name: "-2", value: 0, weaponBonus: -2, text: "-2 penalty to Attack damage." },
      { id: "3", name: "-3", value: 0, weaponBonus: -3, text: "-3 penalty to Attack damage." }
    ] }
  ] },
  { id: "fabled", label: "Fabled", hint: "Unique properties of legend and myth. Always Fabled Lore.", fabled: true, powers: [
    { id: "fabledBenediction", name: "Benediction", value: 50000, text: "Immediately revived upon death by dropping to 0 HP, once per week." },
    { id: "fabledBlasting", name: "Blasting", value: 5000, text: "Can send a beam of magic energy to attack." },
    { id: "fabledPrecision", name: "Precision", value: 10000, text: "Once per day, gain Favor on attacks for 1 Minute, or until you miss." },
    { id: "fabledSoulEater", name: "Soul Eater", value: 50000, text: "Those killed by it can't be resurrected unless a wish is granted to do so." },
    { id: "fabledVisceral", name: "Visceral", value: 25000, text: "On a Crit, the Target takes extra damage equal to twice its HD." },
    { id: "fabledVorpal", name: "Vorpal", value: 50000, text: "Behead Target on Crit if the Target takes the damage." },
    { id: "fabledWish", name: "Wish-Granting", value: 1000000, input: "rank", rankLabel: "Wishes", text: "Grants a wish. Value is per wish." }
  ] },
  { id: "movement", label: "Movement", hint: "Enhances Move while equipped.", powers: [
    { id: "moveBlinking", name: "Blinking", value: 2000, text: "Wearer is under the effects of the Blink Spell." },
    { id: "moveClimbing", name: "Climbing", value: 500, text: "Wearer gains Climb." },
    { id: "moveClinging", name: "Clinging", value: 2500, text: "Wearer gains Cling." },
    { id: "moveDisplacement", name: "Displacement", value: 1000, text: "Sight-based attacks against the Wearer are made as if the attacker is Vulnerable." },
    { id: "moveFlying", name: "Flying", value: 5000, text: "Wearer gains Fly." },
    { id: "moveJumping", name: "Jumping", tiers: [
      { id: "1", name: "I", value: 500, text: "Wearer's horizontal jump distance is multiplied by 2." },
      { id: "2", name: "II", value: 2500, text: "Wearer's horizontal jump distance is multiplied by 3." },
      { id: "3", name: "III", value: 12500, text: "Wearer's horizontal jump distance is multiplied by 4." }
    ] },
    { id: "moveLevitation", name: "Levitation", value: 500, text: "Wearer is under the effects of the Levitate Spell." },
    { id: "moveSwiftness", name: "Swiftness", tiers: [
      { id: "1", name: "I", value: 250, speed: 5, text: "Wearer gains a bonus +5' to Speed." },
      { id: "2", name: "II", value: 1000, speed: 10, text: "Wearer gains a bonus +10' to Speed." },
      { id: "3", name: "III", value: 5000, speed: 15, text: "Wearer gains a bonus +15' to Speed." }
    ] },
    { id: "moveWaterwalk", name: "Waterwalk", value: 500, text: "Wearer can walk on liquids." },
    { id: "moveWebwalk", name: "Webwalk", value: 500, text: "Wearer ignores Difficult Terrain of webs, and can't be Restrained by them." }
  ] },
  { id: "protection", label: "Protection", hint: "Wearer can't be Hindered on Saves against the Being Type.", powers: [
    { id: "protection", name: "Protection", input: "target", tiers: [
      { id: "niche", name: "Niche", value: 500, text: "Applies to extremely specific Beings, such as Trolls (not all giants)." },
      { id: "specific", name: "Specific", value: 2000, text: "Applies to a Being subtype, such as giants (not all Cryptids)." },
      { id: "general", name: "General", value: 5000, text: "Applies to an entire Being Type, such as Cryptids (not just giants)." }
    ], text: "Wearer can't be Hindered on Saves against {target}." }
  ] },
  { id: "resistance", label: "Resistance", hint: "Grants Favor on situational Saves.", powers: [
    { id: "resBravery", name: "Bravery", value: 150, text: "Grants Favor on Saves against the Frightened Status." },
    { id: "resClarity", name: "Clarity", value: 150, text: "Grants Favor on Saves against the Confused Status." },
    { id: "resRepulsing", name: "Repulsing", value: 150, text: "Grants Favor on Saves against the Charmed Status." },
    { id: "resResistance", name: "Resistance", value: 2500, input: "target", targetLabel: "Damage source",
      text: "Favor on Saves and damage reduction against {target}." }
  ] },
  { id: "senses", label: "Senses", hint: "Grants a Sense while Equipped.", powers: [
    { id: "senseDetection", name: "Detection", value: 5000, input: "target", text: "Grants Allsight to see {target} (Bound)." },
    { id: "senseNightvision", name: "Nightvision", value: 100, text: "Grants Darksight." },
    { id: "senseEcholocation", name: "Echolocation", value: 250, text: "Grants Echolocation." },
    { id: "senseLife", name: "Sense Life", value: 10000, text: "Senses Small and larger Beings within Far who aren't Artificials or Undead." },
    { id: "senseValuables", name: "Sense Valuables", value: 10000, text: "Senses gold and gems within Near." },
    { id: "senseTremors", name: "Tremors", value: 1000, text: "Grants Seismicsense (Bound)." },
    { id: "senseTelepathy", name: "Telepathy", value: 10000, text: "Grants Telepathy (Bound)." },
    { id: "senseTrueSeeing", name: "True-Seeing", value: 20000, text: "Grants Allsight (Bound)." }
  ] },
  { id: "utility", label: "Utility", hint: "Magical quirks other than Combat and Mobility.", powers: [
    { id: "utilAfterImage", name: "After-Image", tiers: [
      { id: "1", name: "I", value: 500, text: "Wearer can project an illusory duplicate out to Near (Bound)." },
      { id: "2", name: "II", value: 2500, text: "Wearer can project an illusory duplicate out to Far (Bound)." }
    ] },
    { id: "utilAmbassador", name: "Ambassador", value: 1250, text: "Wielder can speak with certain Beings they normally couldn't otherwise." },
    { id: "utilAquaLung", name: "Aqua Lung", value: 5000, text: "Wearer can breathe water." },
    { id: "utilDarkness", name: "Darkness", tiers: [
      { id: "1", name: "I", value: 500, text: "Darkens non-magical light within Close while Equipped." },
      { id: "2", name: "II", value: 1250, text: "Darkens non-magical light within Near while Equipped." },
      { id: "3", name: "III", value: 5000, text: "Darkens non-magical light within Far while Equipped." }
    ] },
    { id: "utilBurning", name: "Burning", tiers: [
      { id: "1", name: "I", value: 4000, text: "Burning (Cd4) on a hit." },
      { id: "2", name: "II", value: 15000, text: "Burning (Cd6) on a hit." },
      { id: "3", name: "III", value: 64000, text: "Burning (Cd8) on a hit." }
    ] },
    { id: "utilHolding", name: "Holding", value: 200, input: "rank", rankLabel: "Slots", slotsBonus: 1,
      text: "Gives {rank} bonus Item Slots." },
    { id: "utilInfinite", name: "Infinite", value: 1000, input: "target", targetLabel: "Item",
      text: "Provides an endless amount of {target} that disappears in 1 Round." },
    { id: "utilInvisibility", name: "Invisibility", tiers: [
      { id: "1", name: "I", value: 5000, text: "Skip Move to become Invisible until after it takes an Action." },
      { id: "2", name: "II", value: 50000, text: "Wearer is Invisible." }
    ] },
    { id: "utilLifesteal", name: "Lifesteal", tiers: [
      { id: "1", name: "I", value: 1000, text: "Killing a foe with it heals the Wielder for d8 HP." },
      { id: "2", name: "II", value: 12500, text: "Killing a foe with it heals the Wielder for 2d8 HP." },
      { id: "3", name: "III", value: 50000, text: "Killing a foe with it heals the Wielder for 3d8 HP." }
    ] },
    { id: "utilLoyalty", name: "Loyalty", value: 1000, text: "Magically returns to the Being's hand if thrown to attack (Bound)." },
    { id: "utilManasteal", name: "Manasteal", tiers: [
      { id: "1", name: "I", value: 5000, text: "Killing a foe with it restores d4 Mana to the Bound Wielder." },
      { id: "2", name: "II", value: 20000, text: "Killing a foe with it restores 2d4 Mana to the Bound Wielder." },
      { id: "3", name: "III", value: 50000, text: "Killing a foe with it restores 3d4 Mana to the Bound Wielder." }
    ] },
    { id: "utilMoonlit", name: "Moonlit", tiers: [
      { id: "1", name: "I", value: 500, text: "Sheds Moonlight out to Close while Equipped." },
      { id: "2", name: "II", value: 1250, text: "Sheds Moonlight out to Near while Equipped." },
      { id: "3", name: "III", value: 5000, text: "Sheds Moonlight out to Far while Equipped." }
    ] },
    { id: "utilPiercing", name: "Piercing", tiers: [
      { id: "1", name: "I", value: 150, text: "Attacks with it ignore 1 Armor." },
      { id: "2", name: "II", value: 1875, text: "Attacks with it ignore 2 Armor." },
      { id: "3", name: "III", value: 7500, text: "Attacks with it ignore 3 Armor." }
    ] },
    { id: "utilStoreSpell", name: "Store Spell", input: "value", text: "Reduce Caster's Maximum Mana to store a Casting of a Spell." },
    { id: "utilRadiant", name: "Radiant", tiers: [
      { id: "1", name: "I", value: 2000, text: "Sheds Sunlight out to Close while Equipped." },
      { id: "2", name: "II", value: 5000, text: "Sheds Sunlight out to Near while Equipped." },
      { id: "3", name: "III", value: 20000, text: "Sheds Sunlight out to Far while Equipped." }
    ] },
    { id: "utilWarning", name: "Warning", value: 7500, text: "Bound Being can't be surprised, and is awoken if foes are Near." }
  ] }
];

/**
 * Find a power by id.
 * @param {string} id
 */
export function findRelicPower(id) {
  for ( const g of RELIC_POWER_GROUPS ) {
    const p = g.powers.find(x => x.id === id);
    if ( p ) return { group: g, power: p };
  }
  return null;
}

/**
 * Resolve chosen powers into lines, value, and mechanical changes.
 * @param {Record<string, {tier?: string, target?: string, rank?: number, value?: number}>} picks  Keyed by power id.
 * @param {{name: string, text: string, value: number}[]} [custom]  Unique or homebrew powers.
 * @returns {{lines: {name: string, text: string}[], value: number, weaponBonus: number, armorBonus: number,
 *   slotsBonus: number, speed: number, cursed: boolean, fabled: boolean, special: boolean}}
 */
export function resolveRelicPowers(picks = {}, custom = []) {
  const out = { lines: [], value: 0, weaponBonus: 0, armorBonus: 0, slotsBonus: 0, speed: 0, cursed: false, fabled: false, special: false };
  for ( const g of RELIC_POWER_GROUPS ) {
    for ( const p of g.powers ) {
      const pick = picks[p.id];
      if ( !pick ) continue;
      const tier = p.tiers ? p.tiers.find(t => t.id === pick.tier) : null;
      if ( p.tiers && !tier ) continue;
      const src = tier ?? p;
      const rank = Math.max(1, Math.floor(Number(pick.rank) || 1));
      const target = (pick.target ?? "").trim();
      let value = src.value ?? 0;
      if ( p.input === "rank" ) value *= rank;
      if ( p.input === "value" ) { value = Math.max(0, Number(pick.value) || 0); out.special = true; }
      out.value += value;
      const name = [tier && p.tiers && /^[+-]?\d|^I/.test(tier.name) ? `${p.name} ${tier.name}` : p.name,
        (tier && !/^[+-]?\d|^I/.test(tier.name)) ? `(${tier.name}${target ? `: ${target}` : ""})` : "",
        (p.input === "rank") ? `(${rank})` : ""].filter(Boolean).join(" ");
      let text = (p.text && (p.input === "target" || p.input === "rank")) ? p.text : src.text;
      text = text.replace("{target}", target || "the chosen Beings").replace("{rank}", String(rank));
      if ( tier && p.text && p.input === "target" ) text = p.text.replace("{target}", target || "the chosen Beings");
      out.lines.push({ name, text });
      out.weaponBonus += src.weaponBonus ?? 0;
      out.armorBonus += src.armorBonus ?? 0;
      out.slotsBonus += (p.slotsBonus ?? 0) * (p.input === "rank" ? rank : 1);
      out.speed += src.speed ?? 0;
      if ( p.curse || src.curse ) out.cursed = true;
      if ( g.fabled ) out.fabled = true;
    }
  }
  for ( const c of custom ) {
    if ( !c?.name?.trim() ) continue;
    out.lines.push({ name: c.name.trim(), text: (c.text ?? "").trim() });
    out.value += Math.max(0, Number(c.value) || 0);
  }
  return out;
}
