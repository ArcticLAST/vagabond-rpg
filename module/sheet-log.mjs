/**
 * Sheet change notes: a short chat note whenever a Hero's tracked values change or Items are added or removed, so the
 * table can see every edit (a light guard against unfair sheet changes). Each note says who made the change.
 * Updates can opt out with the operation option `vagabondLog: false` (the Hero Builder, Casting, which shows Mana on
 * its own card) and add context with `vagabondVia` ("→ Backpack").
 */

const SYSTEM_ID = "vagabond-rpg";

/**
 * Tracked Actor fields: a path pattern and how to label it.
 * @type {{pattern: RegExp, label: function(RegExpMatchArray): string, kind?: string}[]}
 */
const TRACKED = [
  { pattern: /^system\.attributes\.mana\.value$/, label: () => "VAGABOND.Mana", icon: "fa-droplet" },
  { pattern: /^system\.attributes\.luck\.value$/, label: () => "VAGABOND.Luck.Label", icon: "fa-clover" },
  { pattern: /^system\.attributes\.studied$/, label: () => "VAGABOND.Studied.Label", icon: "fa-book-open" },
  { pattern: /^system\.stats\.(\w+)\.value$/, label: m => CONFIG.VAGABOND.stats[m[1]]?.label ?? m[1], icon: "fa-dumbbell" },
  { pattern: /^system\.skills\.(\w+)\.trained$/, label: m => CONFIG.VAGABOND.skills[m[1]]?.label ?? m[1], kind: "trained", icon: "fa-graduation-cap" },
  { pattern: /^system\.currency\.([gsc])$/, label: m => `VAGABOND.Coin.${m[1]}`, icon: "fa-coins" },
  { pattern: /^system\.details\.level$/, label: () => "VAGABOND.Level", icon: "fa-arrow-up" },
  { pattern: /^system\.details\.xp$/, label: () => "VAGABOND.XP", icon: "fa-star" }
];

/** Who sees the notes: "all", "gm", or "off". */
function mode() {
  try { return game.settings.get(SYSTEM_ID, "sheetLog") ?? "all"; }
  catch { return "all"; }
}

/** Whether this Actor's changes are noted. */
export function tracks(actor, options = {}) {
  return (actor?.type === "character") && (options.vagabondLog !== false) && (mode() !== "off");
}

/**
 * Record the current values of the tracked fields an update will change.
 * @param {Actor} actor
 * @param {object} changed   The update's changes.
 * @returns {object|null}    Path → value before, or null if nothing tracked changes.
 */
export function snapshot(actor, changed) {
  const flat = foundry.utils.flattenObject(changed);
  const before = {};
  for ( const path of Object.keys(flat) ) {
    if ( TRACKED.some(t => t.pattern.test(path)) ) before[path] = foundry.utils.getProperty(actor, path);
  }
  return foundry.utils.isEmpty(before) ? null : before;
}

/**
 * One line per tracked field that actually changed.
 * @param {Actor} actor
 * @param {object} before   From snapshot().
 * @returns {{icon: string, text: string}[]}
 */
export function fieldLines(actor, before) {
  const lines = [];
  for ( const [path, old] of Object.entries(before ?? {}) ) {
    const now = foundry.utils.getProperty(actor, path);
    if ( now === old ) continue;
    const t = TRACKED.find(x => x.pattern.test(path));
    const label = game.i18n.localize(t.label(path.match(t.pattern)));
    if ( t.kind === "trained" ) {
      lines.push({ icon: t.icon, text: game.i18n.format(now ? "VAGABOND.SheetLog.Trained" : "VAGABOND.SheetLog.Untrained", { skill: label }) });
      continue;
    }
    const diff = (Number(now) || 0) - (Number(old) || 0);
    lines.push({ icon: t.icon, text: game.i18n.format("VAGABOND.SheetLog.Value", {
      label, before: old ?? 0, after: now ?? 0, diff: diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`
    }) });
  }
  return lines;
}

/**
 * A line for Items added or removed.
 * @param {"Added"|"Removed"} verb
 * @param {Item[]} items
 */
export function itemLine(verb, items) {
  const names = items.map(i => {
    const qty = Number(i.system?.quantity);
    return (qty > 1) ? `${i.name} ×${qty}` : i.name;
  });
  return { icon: verb === "Added" ? "fa-plus" : "fa-minus", text: game.i18n.format(`VAGABOND.SheetLog.${verb}`, { items: names.join(", ") }) };
}

/**
 * Post the note.
 * @param {Actor} actor
 * @param {{icon: string, text: string}[]} lines
 * @param {object} [options]   The operation options (for vagabondVia).
 * @returns {Promise<ChatMessage|void>}
 */
export async function post(actor, lines, options = {}) {
  if ( !lines.length || (mode() === "off") ) return;
  const esc = s => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s)) : String(s);
  const via = options.vagabondVia ? ` <span class="via">(${esc(options.vagabondVia)})</span>` : "";
  const content = `<div class="vagabond chat-card sheet-log">
    <p class="sheet-log-head">${game.i18n.format("VAGABOND.SheetLog.Head", { name: esc(actor.name), user: esc(game.user.name) })}${via}</p>
    <ul>${lines.map(l => `<li><i class="fa-solid ${l.icon}"></i> ${esc(l.text)}</li>`).join("")}</ul></div>`;
  const data = { speaker: ChatMessage.getSpeaker({ actor }), content, flags: { [SYSTEM_ID]: { sheetLog: true } } };
  if ( mode() === "gm" ) data.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  return ChatMessage.create(data);
}
