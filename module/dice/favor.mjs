/**
 * Work out automatic Favor, Hinder, and automatic failure from Statuses (p. 11).
 * @param {object} options
 * @param {Actor} options.actor            The Being making the roll.
 * @param {string} options.type            skill | save | attack | cast
 * @param {string} [options.key]           Skill or Save key.
 * @param {boolean} [options.vsAttack]     A Save made against an attack.
 * @param {boolean} [options.melee]        The attack is a Melee (Close) attack.
 * @param {Actor} [options.target]         The Target of an attack or Cast.
 * @param {Actor} [options.source]         The Being whose Action forced a Save.
 * @returns {{favor: number, hinder: number, autoFail: boolean, autoCrit: boolean, reasons: string[]}}
 */
export function statusModifiers({ actor, type, key, vsAttack = false, melee = false, target, source } = {}) {
  const result = { favor: 0, hinder: 0, autoFail: false, autoCrit: false, reasons: [] };
  if ( !actor ) return result;
  const has = (a, id) => !!a?.statuses?.has(id);
  const i18n = id => game.i18n.localize(`VAGABOND.Status.${id}`);
  // Name what makes a Being Vulnerable, e.g. "Restrained (Vulnerable)", so the card says which Status is at work.
  const vulnerable = a => {
    if ( !a?.system?.attributes?.isVulnerable ) return "";
    if ( has(a, "vulnerable") ) return i18n("vulnerable");
    const cause = CONFIG.VAGABOND.vulnerableStatuses.find(id => has(a, id));
    const label = cause ? i18n(cause) : game.i18n.localize("VAGABOND.Warning.ArmorTooHeavy");
    return `${label} (${i18n("vulnerable")})`;
  };
  const hinder = reason => { result.hinder += 1; result.reasons.push(`−${reason}`); };
  const favor = reason => { result.favor += 1; result.reasons.push(`+${reason}`); };

  // Confused: its Checks and Saves have Hinder.
  if ( has(actor, "confused") ) hinder(i18n("confused"));

  // Vulnerable: its attacks and its Saves against attacks have Hinder.
  const isAttack = (type === "attack") || ((type === "cast") && target);
  if ( (isAttack || ((type === "save") && vsAttack)) && vulnerable(actor) ) hinder(vulnerable(actor));
  // Prone: Vulnerable for Reflex Saves.
  else if ( (type === "save") && (key === "reflex") && has(actor, "prone") ) hinder(i18n("prone"));

  // Attacks targeting a Vulnerable Being have Favor; Prone counts for Melee attacks.
  if ( isAttack && target ) {
    if ( vulnerable(target) ) favor(`${game.i18n.localize("VAGABOND.Roll.Target")}: ${vulnerable(target)}`);
    else if ( melee && has(target, "prone") ) favor(`${game.i18n.localize("VAGABOND.Roll.Target")}: ${i18n("prone")}`);
    if ( has(target, "invisible") && !has(actor, "blinded") ) hinder(`${game.i18n.localize("VAGABOND.Roll.Target")}: ${i18n("invisible")}`);
    if ( melee && has(target, "unconscious") ) {
      result.autoCrit = true;
      result.reasons.push(`${game.i18n.localize("VAGABOND.Roll.Target")}: ${i18n("unconscious")} (${game.i18n.localize("VAGABOND.Roll.AutoCrit")})`);
    }
  }

  // Saves against a Vulnerable or Confused Being's Actions have Favor.
  if ( (type === "save") && source ) {
    if ( vsAttack && vulnerable(source) ) favor(`${source.name}: ${vulnerable(source)}`);
    else if ( has(source, "confused") ) favor(`${source.name}: ${i18n("confused")}`);
  }

  // Incapacitated: fails all Might and Dexterity Checks, and Reflex Saves.
  if ( actor.system.attributes?.isIncapacitated ) {
    const stat = (type === "skill" || type === "attack") ? CONFIG.VAGABOND.skills[key]?.stat : null;
    if ( ["mit", "dex"].includes(stat) || ((type === "save") && (key === "reflex")) ) {
      result.autoFail = true;
      result.autoFailReason = i18n(CONFIG.VAGABOND.incapacitatedStatuses.find(id => has(actor, id)) ?? "incapacitated");
    }
  }
  return result;
}

/**
 * The single-Being Target of the current user, if exactly one is targeted.
 * @returns {Actor|null}
 */
export function currentTarget() {
  const targets = Array.from(game.user.targets ?? []);
  return targets.length === 1 ? (targets[0].actor ?? null) : null;
}
