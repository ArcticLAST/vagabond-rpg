/**
 * Character History: a permanent record on each Hero of their starting Stats and Trainings and every later change to
 * Stats, Trainings, and Level, kept as the source of truth for how the Hero was built. The Hero Builder writes one
 * entry for creation and one per Level Up; any other edit to those values adds an entry naming who made it.
 * Stored in the Actor flag `vagabond-rpg.history`. Updates can opt out with the operation option
 * `vagabondHistory: false` (the Hero Builder, which writes its own entries).
 */

const SYSTEM_ID = "vagabond-rpg";

/** Whether this update's changes go in the history. */
export function tracks(actor, options = {}) {
  return (actor?.type === "character") && (options.vagabondHistory !== false);
}

/**
 * The Stats, Trainings, and Level an update will change, with their values before it.
 * @param {Actor} actor
 * @param {object} changed
 * @returns {object|null}   Path → value before.
 */
export function snapshot(actor, changed) {
  const before = {};
  for ( const path of Object.keys(foundry.utils.flattenObject(changed)) ) {
    if ( /^system\.(stats\.\w+\.value|skills\.\w+\.trained|details\.level)$/.test(path) ) {
      before[path] = foundry.utils.getProperty(actor, path);
    }
  }
  return foundry.utils.isEmpty(before) ? null : before;
}

/** "Might 5, Dexterity 4, ..." for the Hero's current Stats. */
export function statsLine(actor) {
  const cfg = CONFIG.VAGABOND;
  return Object.keys(cfg.stats).map(k => `${game.i18n.localize(cfg.stats[k].label)} ${actor.system.stats[k]?.value ?? 0}`).join(", ");
}

/** The Hero's Trained Skills, by name. */
export function trainedLine(actor) {
  const cfg = CONFIG.VAGABOND;
  return Object.entries(actor.system.skills).filter(([, v]) => v.trained)
    .map(([k]) => game.i18n.localize(cfg.skills[k]?.label ?? k)).join(", ");
}

/**
 * Lines describing what changed.
 * @param {Actor} actor
 * @param {object} before   From snapshot().
 * @returns {string[]}
 */
export function changeLines(actor, before) {
  const cfg = CONFIG.VAGABOND;
  const lines = [];
  for ( const [path, old] of Object.entries(before ?? {}) ) {
    const now = foundry.utils.getProperty(actor, path);
    if ( now === old ) continue;
    const stat = path.match(/^system\.stats\.(\w+)\.value$/);
    const skill = path.match(/^system\.skills\.(\w+)\.trained$/);
    if ( stat ) lines.push(`${game.i18n.localize(cfg.stats[stat[1]]?.label ?? stat[1])} ${old ?? 0} → ${now ?? 0}`);
    else if ( skill ) {
      const name = game.i18n.localize(cfg.skills[skill[1]]?.label ?? skill[1]);
      lines.push(game.i18n.format(now ? "VAGABOND.History.Trained" : "VAGABOND.History.Untrained", { skill: name }));
    }
    else lines.push(`${game.i18n.localize("VAGABOND.Level")} ${old ?? 0} → ${now ?? 0}`);
  }
  return lines;
}

/**
 * Add an entry to a Hero's history.
 * @param {Actor} actor
 * @param {"create"|"level"|"edit"} kind
 * @param {string[]} lines
 * @param {object} [baseline]   For a Hero with no history yet, the values before this change: recorded first so the
 *                              history starts from what the Hero had.
 * @returns {Promise<Actor|void>}
 */
export async function record(actor, kind, lines, baseline = null) {
  if ( !lines.length ) return;
  const history = [...(actor.getFlag(SYSTEM_ID, "history") ?? [])];
  const entry = (k, l, level) => ({ kind: k, level, user: game.user.name, time: Date.now(), lines: l });
  if ( !history.length && baseline && (kind === "edit") ) history.push(entry("start", baseline, actor.system.details.level));
  history.push(entry(kind, lines, actor.system.details.level));
  return actor.update({ [`flags.${SYSTEM_ID}.history`]: history }, { vagabondLog: false, vagabondHistory: false });
}

/**
 * What a Hero had before a change, for one with no history yet.
 * @param {Actor} actor
 * @param {object} before   From snapshot().
 * @returns {string[]}
 */
export function baselineLines(actor, before) {
  const cfg = CONFIG.VAGABOND;
  const stats = Object.keys(cfg.stats).map(k => {
    const path = `system.stats.${k}.value`;
    const v = (path in before) ? before[path] : actor.system.stats[k]?.value;
    return `${game.i18n.localize(cfg.stats[k].label)} ${v ?? 0}`;
  }).join(", ");
  const trained = Object.keys(cfg.skills).filter(k => {
    const path = `system.skills.${k}.trained`;
    return (path in before) ? before[path] : actor.system.skills[k]?.trained;
  }).map(k => game.i18n.localize(cfg.skills[k].label)).join(", ");
  return [
    `${game.i18n.localize("VAGABOND.Stats")}: ${stats}`,
    `${game.i18n.localize("VAGABOND.History.TrainedIn")}: ${trained || "—"}`
  ];
}

/**
 * History entries for display, newest last.
 * @param {Actor} actor
 * @returns {object[]}
 */
export function entries(actor) {
  return (actor.getFlag(SYSTEM_ID, "history") ?? []).map(e => ({
    ...e,
    label: game.i18n.localize(`VAGABOND.History.Kind.${e.kind}`),
    date: e.time ? new Date(e.time).toLocaleDateString(game.i18n.lang) : ""
  }));
}
