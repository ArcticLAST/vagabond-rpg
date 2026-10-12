import * as rules from "../rules.mjs";
import { statusModifiers } from "./favor.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export const CHAT_TEMPLATES = {
  check: "systems/vagabond-rpg/templates/chat/check-card.hbs",
  damage: "systems/vagabond-rpg/templates/chat/damage-card.hbs",
  item: "systems/vagabond-rpg/templates/chat/item-card.hbs"
};

/**
 * Build the d20 formula for a Check.
 * @param {number} favor   Net Favor (-1, 0, 1).
 * @returns {string}
 */
export function checkFormula(favor = 0, twoDice = false) {
  const d20 = twoDice ? "2d20kh" : "1d20";
  if ( favor > 0 ) return `${d20} + 1d6`;
  if ( favor < 0 ) return `${d20} - 1d6`;
  return d20;
}

/**
 * Make a Check: Skill Checks, Saves, Attack Checks, and Cast Checks share this path.
 * There is no prompt: Favor or Hinder comes from the Hero's sheet setting and their Statuses,
 * and a Studied die is spent when the Hero has armed it on the sheet. A Crit offers its benefits as buttons on the card.
 * @param {object} config
 * @param {Actor} config.actor
 * @param {string} config.type            skill | save | attack | cast | stat
 * @param {string} [config.key]           Skill or Save key.
 * @param {string} config.title           Card title.
 * @param {string} [config.subtitle]
 * @param {number} config.difficulty
 * @param {number} [config.critOn=20]
 * @param {Item} [config.item]
 * @param {Actor} [config.target]
 * @param {Actor} [config.source]         Being whose Action forced this Save.
 * @param {boolean} [config.vsAttack]
 * @param {boolean} [config.twoDice]     Roll two d20s and keep the higher (Footloose).
 * @param {boolean} [config.melee]
 * @param {number} [config.favor]         Override the sheet's Favor setting (-1, 0, 1).
 * @param {boolean} [config.spendStudied] Override the sheet's armed Studied die.
 * @param {object} [config.extra]         Additional data stored on the message flags.
 * @param {boolean} [config.chatMessage=true]
 * @returns {Promise<{roll: Roll, outcome: string, margin: number, message: ChatMessage}|null>}
 */
export async function rollCheck(config) {
  const { actor, type, key, difficulty, item, target, source } = config;
  const mods = statusModifiers({ actor, type, key, vsAttack: config.vsAttack, melee: config.melee, target, source });
  const attrs = actor.system.attributes ?? {};

  // The sheet's Favor/Hinder setting is one more source; Favor and Hinder cancel and don't stack (p. 8).
  const setting = Math.sign(config.favor ?? attrs.favor ?? 0);
  if ( setting > 0 ) { mods.favor += 1; mods.reasons.unshift(`+${game.i18n.localize("VAGABOND.Roll.SheetSetting")}`); }
  else if ( setting < 0 ) { mods.hinder += 1; mods.reasons.unshift(`−${game.i18n.localize("VAGABOND.Roll.SheetSetting")}`); }
  let favor = rules.netFavor(mods.favor, mods.hinder);
  // Spending a Studied die grants Favor on a d20 roll (p. 19). Luck is spent and gained on the sheet instead.
  const studied = attrs.studied ?? 0;
  const spendStudied = (actor.type === "character") && !!(config.spendStudied ?? attrs.studiedArmed) && (studied > 0);
  const studiedUpdate = {};
  if ( attrs.studiedArmed ) studiedUpdate["system.attributes.studiedArmed"] = false;
  if ( spendStudied ) {
    studiedUpdate["system.attributes.studied"] = studied - 1;
    favor = (favor < 0) ? 0 : 1;
  }
  if ( !foundry.utils.isEmpty(studiedUpdate) ) await actor.update(studiedUpdate);

  const roll = await new Roll(checkFormula(favor, !!config.twoDice), actor.getRollData()).evaluate();
  const natural = roll.dice[0]?.total ?? roll.total;
  const critOn = config.critOn ?? 20;
  let { outcome, margin } = rules.resolveCheck({
    total: roll.total, natural, difficulty, critOn, autoFail: mods.autoFail
  });
  if ( mods.autoCrit && !mods.autoFail && (type === "attack") ) outcome = "crit";

  const result = { roll, outcome, margin, natural, favor };
  if ( config.chatMessage === false ) return result;

  const flags = {
    type, key, difficulty, critOn, favor, outcome, margin, natural,
    total: roll.total,
    actorUuid: actor.uuid,
    itemUuid: item?.uuid ?? null,
    targetUuid: target?.uuid ?? null,
    ...(config.extra ?? {})
  };
  result.message = await postCheckCard({ actor, item, config, roll, flags, spendStudied, mods });
  return result;
}

/**
 * Skills whose failed Checks a Hero can turn into a pass by spending a Studied die
 * (Heightened Intellect and Heightened Cognition Perks, p. 69).
 * @param {Actor} actor
 * @returns {string[]}
 */
export function studyPassSkills(actor) {
  if ( actor?.type !== "character" ) return [];
  const perks = new Set(actor.itemTypes.perk.map(p => p.name));
  return [
    ...(perks.has("Heightened Intellect") ? ["arcana", "craft", "medicine"] : []),
    ...(perks.has("Heightened Cognition") ? ["detect", "mysticism", "survival"] : [])
  ];
}

/**
 * Render and post a Check card.
 * @returns {Promise<ChatMessage>}
 */
export async function postCheckCard({ actor, item, config, roll, flags, spendStudied = false, mods, fluke = false }) {
  const outcomeLabel = game.i18n.localize(`VAGABOND.Outcome.${flags.outcome}`);
  const showDamage = ["attack", "cast"].includes(flags.type) && (flags.outcome !== "fail") && !!flags.hasDamage;
  const content = await renderTemplate(CHAT_TEMPLATES.check, {
    actor, item,
    img: item?.img ?? actor.img,
    title: config.title,
    subtitle: config.subtitle ?? "",
    flags,
    outcomeLabel,
    favorLabel: flags.favor > 0 ? "VAGABOND.Roll.Favor" : (flags.favor < 0 ? "VAGABOND.Roll.Hinder" : null),
    reasons: mods?.reasons ?? [],
    autoFail: mods?.autoFail,
    autoFailReason: mods?.autoFailReason ?? "",
    spendStudied, fluke,
    critChoice: (flags.outcome === "crit") && (actor.type === "character"),
    canStudyPass: (flags.outcome === "fail") && studyPassSkills(actor).includes(flags.key) && (flags.type === "skill")
      && ((actor.system.attributes?.studied ?? 0) > 0),
    tooltip: await roll.getTooltip(),
    total: roll.total,
    showDamage,
    canFluke: (actor.type === "character") && (flags.outcome !== "crit"),
    critText: config.critText ?? "",
    body: config.body ?? ""
  });
  return roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: config.title,
    content,
    flags: { "vagabond-rpg": { check: flags } }
  });
}

/**
 * Roll damage or healing and post a damage card with apply buttons.
 * @param {object} config
 * @param {Actor} [config.actor]
 * @param {Item} [config.item]
 * @param {string} config.formula
 * @param {string} config.title
 * @param {string} [config.subtitle]
 * @param {boolean} [config.healing]
 * @param {boolean} [config.crit]
 * @param {string} [config.save]       A Save the targets can make (NPC actions).
 * @param {{save: string, effect?: boolean}[]} [config.saves]  Saves the targets can make: avoiding the Action, and
 *                                     those made after a hit (effect).
 * @param {string} [config.sourceUuid]
 * @param {boolean} [config.ignoreArmor]
 * @returns {Promise<ChatMessage>}
 */
export async function rollDamage(config) {
  const { actor, item } = config;
  const cfg = CONFIG.VAGABOND;
  const roll = await new Roll(config.formula, actor?.getRollData() ?? {}).evaluate();
  const total = Math.max(0, roll.total);
  const healing = !!config.healing;
  const dmg = healing ? {} : (config.damage ?? {});
  const damage = { type: dmg.type || "", relic: !!dmg.relic, bonus: Number(dmg.bonus) || 0, metal: dmg.metal || "" };
  const typeLabel = damage.type ? game.i18n.localize(cfg.damageTypes[damage.type] ?? damage.type) : "";
  const tags = [];
  if ( damage.relic ) tags.push({ label: game.i18n.format("VAGABOND.Damage.Relic", { n: damage.bonus }), cls: "relic" });
  if ( ["silver", "adamant", "coldIron"].includes(damage.metal) ) {
    tags.push({ label: game.i18n.localize(cfg.metals[damage.metal].label), cls: "metal" });
  }
  for ( const note of config.notes ?? [] ) tags.push({ label: note, cls: "reason" });
  const content = await renderTemplate(CHAT_TEMPLATES.damage, {
    img: item?.img ?? actor?.img ?? "icons/svg/explosion.svg",
    title: config.title,
    subtitle: config.subtitle ?? "",
    total,
    formula: roll.formula,
    healing,
    vsLabel: healing ? game.i18n.localize("VAGABOND.Damage.Healing")
      : typeLabel ? game.i18n.format("VAGABOND.Damage.Typed", { type: typeLabel }) : game.i18n.localize("VAGABOND.Damage.Damage"),
    damageType: damage.type,
    tags,
    crit: !!config.crit,
    tooltip: await roll.getTooltip(),
    ignoreArmor: !!config.ignoreArmor,
    saves: (config.saves ?? (config.save ? [{ save: config.save }] : [])).filter(s => cfg.saves[s.save]).map(s => ({
      save: s.save, effect: !!s.effect,
      label: game.i18n.format(s.effect ? "VAGABOND.Action.EffectSaveButton" : "VAGABOND.Action.SaveButton", {
        save: game.i18n.localize(cfg.saves[s.save].label)
      })
    })),
    sourceUuid: config.sourceUuid ?? actor?.uuid ?? ""
  });
  return roll.toMessage({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
    flavor: config.title,
    content,
    flags: { "vagabond-rpg": { damage: { total, healing, sourceUuid: config.sourceUuid ?? actor?.uuid, ...damage } } }
  });
}

/**
 * Post a plain Item card (description, tags, and action buttons) without rolling.
 * @param {Item} item
 * @param {object} [extra]  Extra template data such as buttons.
 * @returns {Promise<ChatMessage>}
 */
export async function postItemCard(item, extra = {}) {
  const actor = item.actor;
  let text = item.system.description ?? "";
  if ( item.type === "action" ) text = rules.inlineDice(text);
  const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(text, {
    rollData: item.getRollData?.() ?? {}, relativeTo: item, secrets: false
  });
  const content = await renderTemplate(CHAT_TEMPLATES.item, {
    item, actor, description,
    tags: item.system.chatTags ?? [],
    ...extra
  });
  return ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
    content,
    flags: { "vagabond-rpg": { item: { uuid: item.uuid, ...(extra.flags ?? {}) } } }
  });
}
