/**
 * Static configuration for the Vagabond system, exposed as CONFIG.VAGABOND.
 * Labels are localization keys unless noted.
 */
export const VAGABOND = {};

VAGABOND.ASCII = `
 _   _                  _                     _
| | | | __ _  __ _  __ _| |__   ___  _ __   __| |
| | | |/ _\` |/ _\` |/ _\` | '_ \\ / _ \\| '_ \\ / _\` |
 \\ V /| (_| | (_| | (_| | |_) | (_) | | | | (_| |
  \\_/  \\__,_|\\__, |\\__,_|_.__/ \\___/|_| |_|\\__,_|
             |___/`;

/** The six Stats. */
VAGABOND.stats = {
  mit: { label: "VAGABOND.Stat.mit", abbr: "VAGABOND.StatAbbr.mit", hint: "VAGABOND.StatHint.mit" },
  dex: { label: "VAGABOND.Stat.dex", abbr: "VAGABOND.StatAbbr.dex", hint: "VAGABOND.StatHint.dex" },
  awr: { label: "VAGABOND.Stat.awr", abbr: "VAGABOND.StatAbbr.awr", hint: "VAGABOND.StatHint.awr" },
  rsn: { label: "VAGABOND.Stat.rsn", abbr: "VAGABOND.StatAbbr.rsn", hint: "VAGABOND.StatHint.rsn" },
  prs: { label: "VAGABOND.Stat.prs", abbr: "VAGABOND.StatAbbr.prs", hint: "VAGABOND.StatHint.prs" },
  luk: { label: "VAGABOND.Stat.luk", abbr: "VAGABOND.StatAbbr.luk", hint: "VAGABOND.StatHint.luk" }
};

/** Skills and the Stat each one uses (Core Rulebook p. 20-22). */
VAGABOND.skills = {
  arcana: { label: "VAGABOND.Skill.arcana", stat: "rsn", hint: "VAGABOND.SkillHint.arcana" },
  brawl: { label: "VAGABOND.Skill.brawl", stat: "mit", hint: "VAGABOND.SkillHint.brawl", attack: true },
  craft: { label: "VAGABOND.Skill.craft", stat: "rsn", hint: "VAGABOND.SkillHint.craft" },
  detect: { label: "VAGABOND.Skill.detect", stat: "awr", hint: "VAGABOND.SkillHint.detect" },
  finesse: { label: "VAGABOND.Skill.finesse", stat: "dex", hint: "VAGABOND.SkillHint.finesse", attack: true },
  influence: { label: "VAGABOND.Skill.influence", stat: "prs", hint: "VAGABOND.SkillHint.influence" },
  leadership: { label: "VAGABOND.Skill.leadership", stat: "prs", hint: "VAGABOND.SkillHint.leadership" },
  medicine: { label: "VAGABOND.Skill.medicine", stat: "rsn", hint: "VAGABOND.SkillHint.medicine" },
  melee: { label: "VAGABOND.Skill.melee", stat: "mit", hint: "VAGABOND.SkillHint.melee", attack: true },
  mysticism: { label: "VAGABOND.Skill.mysticism", stat: "awr", hint: "VAGABOND.SkillHint.mysticism" },
  performance: { label: "VAGABOND.Skill.performance", stat: "prs", hint: "VAGABOND.SkillHint.performance" },
  ranged: { label: "VAGABOND.Skill.ranged", stat: "awr", hint: "VAGABOND.SkillHint.ranged", attack: true },
  sneak: { label: "VAGABOND.Skill.sneak", stat: "dex", hint: "VAGABOND.SkillHint.sneak" },
  survival: { label: "VAGABOND.Skill.survival", stat: "awr", hint: "VAGABOND.SkillHint.survival" }
};

/** Skills a Weapon can attack with. */
VAGABOND.attackSkills = ["melee", "brawl", "finesse", "ranged"];

/** Saves (p. 22). Stats are summed; Endure doubles Might. */
VAGABOND.saves = {
  endure: { label: "VAGABOND.Save.endure", stats: ["mit", "mit"], hint: "VAGABOND.SaveHint.endure" },
  reflex: { label: "VAGABOND.Save.reflex", stats: ["dex", "awr"], hint: "VAGABOND.SaveHint.reflex" },
  will: { label: "VAGABOND.Save.will", stats: ["rsn", "prs"], hint: "VAGABOND.SaveHint.will" }
};

VAGABOND.sizes = {
  small: "VAGABOND.Size.small",
  medium: "VAGABOND.Size.medium",
  large: "VAGABOND.Size.large",
  huge: "VAGABOND.Size.huge",
  giant: "VAGABOND.Size.giant",
  colossal: "VAGABOND.Size.colossal"
};

/** Kinds of Vehicle. Water vessels are listed under Water Travel (p. 17). */
VAGABOND.vehicleKinds = {
  land: "VAGABOND.VehicleKind.land",
  water: "VAGABOND.VehicleKind.water",
  air: "VAGABOND.VehicleKind.air"
};

VAGABOND.beingTypes = {
  artificial: "VAGABOND.BeingType.artificial",
  beast: "VAGABOND.BeingType.beast",
  cryptid: "VAGABOND.BeingType.cryptid",
  fae: "VAGABOND.BeingType.fae",
  humanlike: "VAGABOND.BeingType.humanlike",
  outer: "VAGABOND.BeingType.outer",
  primordial: "VAGABOND.BeingType.primordial",
  undead: "VAGABOND.BeingType.undead"
};

VAGABOND.zones = {
  frontline: "VAGABOND.Zone.frontline",
  midline: "VAGABOND.Zone.midline",
  backline: "VAGABOND.Zone.backline"
};

VAGABOND.ranges = {
  close: "VAGABOND.Range.close",
  near: "VAGABOND.Range.near",
  far: "VAGABOND.Range.far"
};

VAGABOND.grips = {
  "1h": "VAGABOND.Grip.1h",
  "2h": "VAGABOND.Grip.2h",
  v: "VAGABOND.Grip.v"
};

VAGABOND.weaponProperties = {
  cleave: { label: "VAGABOND.WeaponProperty.cleave", hint: "VAGABOND.WeaponPropertyHint.cleave" },
  defense: { label: "VAGABOND.WeaponProperty.defense", hint: "VAGABOND.WeaponPropertyHint.defense" },
  grapple: { label: "VAGABOND.WeaponProperty.grapple", hint: "VAGABOND.WeaponPropertyHint.grapple" },
  keen: { label: "VAGABOND.WeaponProperty.keen", hint: "VAGABOND.WeaponPropertyHint.keen" },
  long: { label: "VAGABOND.WeaponProperty.long", hint: "VAGABOND.WeaponPropertyHint.long" },
  thrown: { label: "VAGABOND.WeaponProperty.thrown", hint: "VAGABOND.WeaponPropertyHint.thrown" },
  vicious: { label: "VAGABOND.WeaponProperty.vicious", hint: "VAGABOND.WeaponPropertyHint.vicious" }
};

/** Worn Armor (p. 76). */
VAGABOND.armorTypes = {
  light: { label: "VAGABOND.ArmorType.light", rating: 1, slots: 1, might: 2 },
  medium: { label: "VAGABOND.ArmorType.medium", rating: 2, slots: 2, might: 4 },
  heavy: { label: "VAGABOND.ArmorType.heavy", rating: 3, slots: 3, might: 6 },
  other: { label: "VAGABOND.ArmorType.other", rating: 0, slots: 0, might: 0 }
};

VAGABOND.gearCategories = {
  adventuring: "VAGABOND.GearCategory.adventuring",
  alchemical: "VAGABOND.GearCategory.alchemical",
  consumable: "VAGABOND.GearCategory.consumable",
  container: "VAGABOND.GearCategory.container",
  tool: "VAGABOND.GearCategory.tool",
  trinket: "VAGABOND.GearCategory.trinket",
  relic: "VAGABOND.GearCategory.relic",
  kit: "VAGABOND.GearCategory.kit",
  treasure: "VAGABOND.GearCategory.treasure",
  ammunition: "VAGABOND.GearCategory.ammunition",
  other: "VAGABOND.GearCategory.other"
};

VAGABOND.alchemicalTypes = {
  acid: "VAGABOND.AlchemicalType.acid",
  concoction: "VAGABOND.AlchemicalType.concoction",
  explosive: "VAGABOND.AlchemicalType.explosive",
  oil: "VAGABOND.AlchemicalType.oil",
  poison: "VAGABOND.AlchemicalType.poison",
  potion: "VAGABOND.AlchemicalType.potion",
  torch: "VAGABOND.AlchemicalType.torch"
};

VAGABOND.rollTypes = {
  "": "VAGABOND.RollType.none",
  damage: "VAGABOND.RollType.damage",
  healing: "VAGABOND.RollType.healing",
  mana: "VAGABOND.RollType.mana",
  other: "VAGABOND.RollType.other"
};

/** Damage sources named by Spell damage bases. Free text is allowed too. */
VAGABOND.damageBases = {
  "": "VAGABOND.DamageBase.none",
  acid: "VAGABOND.DamageBase.acid",
  blunt: "VAGABOND.DamageBase.blunt",
  cold: "VAGABOND.DamageBase.cold",
  fire: "VAGABOND.DamageBase.fire",
  poison: "VAGABOND.DamageBase.poison",
  shock: "VAGABOND.DamageBase.shock"
};

/**
 * Damage types. The rulebook names no formal types; Immune and Weak entries use these words. Weapons deal Physical
 * damage unless set to Blunt, Pierce, or Slash (all of which count as Physical). Relic damage is Physical damage dealt
 * by a Relic, tracked separately with its (+N).
 */
VAGABOND.damageTypes = {
  physical: "VAGABOND.DamageType.physical",
  blunt: "VAGABOND.DamageType.blunt",
  pierce: "VAGABOND.DamageType.pierce",
  slash: "VAGABOND.DamageType.slash",
  acid: "VAGABOND.DamageType.acid",
  cold: "VAGABOND.DamageType.cold",
  fire: "VAGABOND.DamageType.fire",
  poison: "VAGABOND.DamageType.poison",
  shock: "VAGABOND.DamageType.shock",
  magic: "VAGABOND.DamageType.magic"
};

/**
 * Spell Deliveries (p. 91). cost is the base Mana cost, upcast is the Mana per extra step,
 * and step describes what one upcast step adds.
 */
VAGABOND.deliveries = {
  aura: { label: "VAGABOND.Delivery.aura", cost: 2, upcast: 1, area: "VAGABOND.DeliveryArea.aura", step: "VAGABOND.DeliveryStep.aura" },
  cone: { label: "VAGABOND.Delivery.cone", cost: 2, upcast: 2, area: "VAGABOND.DeliveryArea.cone", step: "VAGABOND.DeliveryStep.cone" },
  cube: { label: "VAGABOND.Delivery.cube", cost: 1, upcast: 1, area: "VAGABOND.DeliveryArea.cube", step: "VAGABOND.DeliveryStep.cube" },
  glyph: { label: "VAGABOND.Delivery.glyph", cost: 2, upcast: 0, area: "VAGABOND.DeliveryArea.glyph", step: "" },
  imbue: { label: "VAGABOND.Delivery.imbue", cost: 0, upcast: 0, area: "VAGABOND.DeliveryArea.imbue", step: "" },
  line: { label: "VAGABOND.Delivery.line", cost: 2, upcast: 1, area: "VAGABOND.DeliveryArea.line", step: "VAGABOND.DeliveryStep.line" },
  remote: { label: "VAGABOND.Delivery.remote", cost: 0, upcast: 1, area: "VAGABOND.DeliveryArea.remote", step: "VAGABOND.DeliveryStep.remote" },
  sphere: { label: "VAGABOND.Delivery.sphere", cost: 2, upcast: 1, area: "VAGABOND.DeliveryArea.sphere", step: "VAGABOND.DeliveryStep.sphere" },
  touch: { label: "VAGABOND.Delivery.touch", cost: 0, upcast: 0, area: "VAGABOND.DeliveryArea.touch", step: "" }
};

/** How a Class determines its Cast Max. */
VAGABOND.castMaxTypes = {
  none: "VAGABOND.CastMaxType.none",
  half: "VAGABOND.CastMaxType.half",
  full: "VAGABOND.CastMaxType.full"
};

VAGABOND.npcActionTypes = {
  melee: "VAGABOND.ActionType.melee",
  ranged: "VAGABOND.ActionType.ranged",
  attack: "VAGABOND.ActionType.attack",
  cast: "VAGABOND.ActionType.cast",
  action: "VAGABOND.ActionType.action",
  combo: "VAGABOND.ActionType.combo",
  ability: "VAGABOND.ActionType.ability"
};

VAGABOND.saveOptions = {
  "": "VAGABOND.Save.none",
  reflex: "VAGABOND.Save.reflex",
  endure: "VAGABOND.Save.endure",
  will: "VAGABOND.Save.will",
  endureReflex: "VAGABOND.Save.endureReflex"
};

VAGABOND.featureSources = {
  class: "VAGABOND.FeatureSource.class",
  ancestry: "VAGABOND.FeatureSource.ancestry",
  other: "VAGABOND.FeatureSource.other"
};

/**
 * Specialized metals for Armor and Weapons (p. 82). valueMult multiplies the base value, slots
 * changes the Slots counted to Equip, bonus adds to Armor or Weapon damage, and dieStep changes a
 * Weapon's damage die size.
 */
VAGABOND.metals = {
  "": { label: "VAGABOND.Metal.mundane", valueMult: 1 },
  adamant: { label: "VAGABOND.Metal.adamant", valueMult: 50, slots: 1, bonus: 1 },
  bronze: { label: "VAGABOND.Metal.bronze", valueMult: 1 },
  coldIron: { label: "VAGABOND.Metal.coldIron", valueMult: 20 },
  gold: { label: "VAGABOND.Metal.gold", valueMult: 100, countdown: true },
  iron: { label: "VAGABOND.Metal.iron", valueMult: 1 },
  mythral: { label: "VAGABOND.Metal.mythral", valueMult: 50, slots: -1, dieStep: -1 },
  orichalcum: { label: "VAGABOND.Metal.orichalcum", valueMult: 50, slots: 1, dieStep: 1 },
  silver: { label: "VAGABOND.Metal.silver", valueMult: 10 },
  steel: { label: "VAGABOND.Metal.steel", valueMult: 1 }
};

/** Die sizes a damage die can step between (p. 7). */
VAGABOND.dieSizes = [4, 6, 8, 10, 12];

/** Speed by Dexterity (p. 21). */
VAGABOND.speedByDex = [
  { max: 3, speed: 25 },
  { max: 5, speed: 30 },
  { max: Infinity, speed: 35 }
];

/** XP pace per Level (p. 27). */
VAGABOND.xpPaces = {
  quick: "VAGABOND.XPPace.quick",
  normal: "VAGABOND.XPPace.normal",
  epic: "VAGABOND.XPPace.epic",
  saga: "VAGABOND.XPPace.saga"
};

/**
 * Status effects (p. 11). "vulnerable" means attacks against it are Favored and its attacks
 * and Saves against attacks are Hindered; several statuses imply Vulnerable.
 */
VAGABOND.statusEffects = [
  { id: "dead", name: "VAGABOND.Status.dead", img: "icons/svg/skull.svg" },
  { id: "berserk", name: "VAGABOND.Status.berserk", img: "icons/svg/blood.svg" },
  { id: "blinded", name: "VAGABOND.Status.blinded", img: "icons/svg/blind.svg" },
  { id: "burning", name: "VAGABOND.Status.burning", img: "icons/svg/fire.svg" },
  { id: "charmed", name: "VAGABOND.Status.charmed", img: "icons/svg/sun.svg" },
  { id: "confused", name: "VAGABOND.Status.confused", img: "icons/svg/daze.svg" },
  { id: "dazed", name: "VAGABOND.Status.dazed", img: "icons/svg/stoned.svg" },
  { id: "frightened", name: "VAGABOND.Status.frightened", img: "icons/svg/terror.svg" },
  { id: "incapacitated", name: "VAGABOND.Status.incapacitated", img: "icons/svg/downgrade.svg" },
  { id: "invisible", name: "VAGABOND.Status.invisible", img: "icons/svg/invisible.svg" },
  { id: "paralyzed", name: "VAGABOND.Status.paralyzed", img: "icons/svg/paralysis.svg" },
  { id: "prone", name: "VAGABOND.Status.prone", img: "icons/svg/falling.svg" },
  { id: "restrained", name: "VAGABOND.Status.restrained", img: "icons/svg/net.svg" },
  { id: "sickened", name: "VAGABOND.Status.sickened", img: "icons/svg/poison.svg" },
  { id: "suffocating", name: "VAGABOND.Status.suffocating", img: "icons/svg/silenced.svg" },
  { id: "unconscious", name: "VAGABOND.Status.unconscious", img: "icons/svg/unconscious.svg" },
  { id: "vulnerable", name: "VAGABOND.Status.vulnerable", img: "icons/svg/target.svg" },
  { id: "focusing", name: "VAGABOND.Status.focusing", img: "icons/svg/aura.svg" }
];

/** Statuses that make a Being Vulnerable (p. 11). */
VAGABOND.vulnerableStatuses = ["vulnerable", "blinded", "restrained", "incapacitated", "paralyzed", "unconscious"];

/** Statuses that make a Being Incapacitated. */
VAGABOND.incapacitatedStatuses = ["incapacitated", "paralyzed", "unconscious"];

/** Default icons by document type (game-icons.net, CC BY 3.0; see tools/make-icons.py). */
const ICONS = "systems/vagabond-rpg/assets/icons";
VAGABOND.defaultIcons = {
  weapon: `${ICONS}/broadsword.svg`,
  armor: `${ICONS}/breastplate.svg`,
  gear: `${ICONS}/knapsack.svg`,
  spell: `${ICONS}/spell-book.svg`,
  perk: `${ICONS}/upgrade.svg`,
  feature: `${ICONS}/sparkles.svg`,
  class: `${ICONS}/scroll-quill.svg`,
  ancestry: `${ICONS}/person.svg`,
  action: `${ICONS}/sword-clash.svg`,
  character: `${ICONS}/hood.svg`,
  npc: `${ICONS}/dragon-head.svg`,
  container: `${ICONS}/chest.svg`,
  vehicle: `${ICONS}/sailboat.svg`,
  relic: `${ICONS}/crystal-ball.svg`
};

/** Stat Arrays for Hero creation (p. 20). Assign the six values to the six Stats in any order. */
VAGABOND.statArrays = [
  [5, 5, 5, 5, 3, 3],
  [6, 5, 5, 4, 3, 3],
  [6, 6, 4, 4, 3, 3],
  [6, 6, 5, 3, 3, 2],
  [7, 5, 4, 4, 3, 3],
  [7, 5, 5, 3, 3, 2],
  [7, 6, 4, 3, 3, 2],
  [7, 7, 3, 3, 2, 2]
];

/** Highest a Stat can be raised by leveling or Strong Potential (p. 27). */
VAGABOND.statLevelCap = 7;

/** Starting coin for a new Hero (p. 20), in gold. */
VAGABOND.startingGold = 3;

/** Compendiums the Hero builder draws from, plus any world Items of the same types. */
VAGABOND.builderPacks = {
  ancestry: "vagabond-rpg.ancestries",
  class: "vagabond-rpg.classes",
  perk: "vagabond-rpg.perks",
  spell: "vagabond-rpg.spells",
  kit: "vagabond-rpg.starting-packs",
  alchemical: "vagabond-rpg.alchemical-items"
};

/**
 * Ancestry Traits that ask for a choice: the actor flag that stores it, and the damage types offered.
 * Draconic Resilience (p. 22): "half damage from a source of your choice from either Acid, Cold, Fire, or Shock".
 */
VAGABOND.traitChoices = {
  "draconic resilience": { flag: "resilience", options: ["acid", "cold", "fire", "shock"] }
};

/**
 * Starting Packs each Class recommends in its "Playing" section (p. 29-63). Names match the Starting Pack Items.
 */
VAGABOND.recommendedPacks = {
  alchemist: ["Alchemist", "Assassin"],
  barbarian: ["Gladiator", "Warrior"],
  bard: ["Musician"],
  dancer: ["Courtesan", "Musician"],
  druid: ["Hermit"],
  fighter: ["Gladiator", "Knight", "Warrior"],
  gunslinger: ["Bounty Hunter", "Tinker"],
  hunter: ["Scout", "Warrior"],
  luminary: ["Devout"],
  magus: ["Knight", "Gladiator", "Warrior"],
  merchant: ["Blacksmith", "Cook", "Tinker"],
  pugilist: ["Brawler", "Monk"],
  revelator: ["Knight", "Warrior"],
  rogue: ["Assassin", "Conman", "Investigator", "Scout"],
  sorcerer: ["Mage", "Occultist"],
  vanguard: ["Sentinel"],
  witch: ["Fortune Teller", "Mage"],
  wizard: ["Astronomer", "Mage"]
};

/**
 * Armor tags for statblocks and their Armor value (p. 110).
 */
VAGABOND.armorTags = [
  ["None", 0], ["as Unarmored", 0], ["as Unarmored plus Shield", 1], ["as Leather", 1], ["as Leather plus Shield", 2],
  ["as Hide", 1], ["as Hide plus Shield", 2], ["as Chain", 2], ["as Chain plus Shield", 3], ["as Scale", 2],
  ["as Scale plus Shield", 3], ["as Plate", 3], ["as Plate plus Shield", 4], ["as Splint", 3], ["as Splint plus Shield", 4],
  ["as (+1) Plate", 4], ["as (+1) Plate plus Shield", 5], ["as (+2) Plate", 5], ["as (+2) Plate plus Shield", 6],
  ["as (+3) Plate", 6], ["as (+3) Plate plus Shield", 7]
].map(([tag, armor]) => ({ tag, armor }));

/**
 * What a Threat Level roughly looks like (p. 111): HD, HP, and DPR ranges, and Armor.
 */
VAGABOND.threatTable = [
  [0, "1-2", "1-9", 0, "0-2"], [1, "3-4", "10-19", 0, "3-5"], [2, "5-6", "20-29", 1, "6-8"], [3, "7-8", "30-39", 1, "9-11"],
  [4, "9-11", "40-49", 2, "12-14"], [5, "12-13", "50-59", 2, "15-17"], [6, "14-15", "60-69", 3, "18-20"],
  [7, "16-17", "70-79", 3, "21-23"], [8, "18-19", "80-89", 4, "24-26"], [9, "20-22", "90-99", 4, "27-29"],
  [10, "23-24", "100-109", 5, "30-32"], [11, "25-26", "110-119", 5, "33-35"], [12, "27-28", "120-129", 6, "36-38"],
  [13, "29-31", "130-139", 6, "39-41"], [14, "32-33", "140-149", 7, "42-44"], [15, "34-35", "150-159", 7, "45-47"],
  [16, "36-37", "160-169", 8, "48-50"], [17, "38-39", "170-179", 8, "51-53"], [18, "40-41", "180-189", 9, "54-56"],
  [19, "42-43", "190-199", 9, "57-59"], [20, "44-45", "200-209", 10, "60-62"]
].map(([tl, hd, hp, armor, dpr]) => ({ tl, hd, hp, armor, dpr }));
