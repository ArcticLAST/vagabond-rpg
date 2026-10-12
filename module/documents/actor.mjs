import * as rules from "../rules.mjs";
import { rollCheck, rollDamage } from "../dice/rolls.mjs";
import * as sheetLog from "../sheet-log.mjs";

/**
 * Extend the base Actor with Vagabond rolls, rests, and damage handling.
 */
export default class VagabondActor extends Actor {

  /** @override */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    const prototypeToken = {};
    if ( this.type === "character" ) Object.assign(prototypeToken, {
      actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY, sight: { enabled: true }
    });
    // Shared storage is visible to every player so anyone can put Items in or take them out.
    const changes = {};
    if ( ["container", "vehicle"].includes(this.type) ) {
      if ( !data.img || (data.img === this.constructor.DEFAULT_ICON) ) {
        changes.img = (this.type === "vehicle") ? "icons/environment/settlement/ship.webp" : "icons/containers/chest/chest-reinforced-box-brown.webp";
        prototypeToken.texture = { src: changes.img };
      }
      Object.assign(prototypeToken, { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL });
      if ( !("default" in (data.ownership ?? {})) ) changes["ownership.default"] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    }
    changes.prototypeToken = foundry.utils.mergeObject(prototypeToken, data.prototypeToken ?? {});
    this.updateSource(changes);
  }

  /* -------------------------------------------- */
  /*  Checks                                      */
  /* -------------------------------------------- */

  /**
   * Roll a Skill Check.
   * @param {string} skill
   * @param {object} [options]  Passed to rollCheck.
   */
  async rollSkill(skill, options = {}) {
    const data = this.system.skills?.[skill];
    if ( !data ) return null;
    const label = game.i18n.localize(data.label);
    const trained = data.trained ? ` (${game.i18n.localize("VAGABOND.Trained")})` : "";
    return rollCheck({
      actor: this, type: "skill", key: skill,
      title: game.i18n.format("VAGABOND.Roll.SkillTitle", { skill: label }),
      subtitle: `${game.i18n.localize(CONFIG.VAGABOND.stats[data.stat].label)}${trained}`,
      difficulty: data.difficulty,
      critOn: 20 - this.#skillCritBonus(skill),
      ...options
    });
  }

  /**
   * Perks that lower the Crit roll for one Skill: Silver Tongued, -1 per copy on Influence, up to 4.
   * @param {string} skill
   * @returns {number}
   */
  #skillCritBonus(skill) {
    if ( skill !== "influence" ) return 0;
    return Math.min(4, this.itemTypes.perk?.filter(p => /^silver tongued\b/i.test(p.name)).length ?? 0);
  }

  /**
   * Roll a Save.
   * @param {string} save        endure | reflex | will
   * @param {object} [options]   Passed to rollCheck.
   */
  async rollSave(save, options = {}) {
    let difficulty;
    let critOn = this.system.attributes?.crit?.save ?? 20;
    let twoDice = false;
    if ( this.type === "character" ) {
      const data = this.system.saves[save];
      difficulty = data.difficulty;
      // Class Features: Valor (Saves against attacks), Spell-Slinger (Saves against Casts), Footloose (Reflex).
      const fx = this.system.featureMods;
      if ( options.vsAttack ) critOn -= fx?.critVsAttack ?? 0;
      if ( options.vsCast ) critOn -= fx?.critVsCast ?? 0;
      twoDice = (save === "reflex") && !!fx?.reflexTwoDice;
    } else {
      // NPCs rarely Save; use the Threat Level as a stand-in Stat (not covered by the rules).
      difficulty = 20 - Math.ceil(this.system.tl ?? 0);
    }
    return rollCheck({
      actor: this, type: "save", key: save,
      title: game.i18n.format("VAGABOND.Roll.SaveTitle", { save: game.i18n.localize(CONFIG.VAGABOND.saves[save].label) }),
      difficulty, critOn, twoDice,
      ...options
    });
  }

  /**
   * Roll a raw Stat Check (Difficulty 20 − Stat).
   * @param {string} stat
   * @param {object} [options]
   */
  async rollStat(stat, options = {}) {
    const value = this.system.stats?.[stat]?.value ?? 0;
    return rollCheck({
      actor: this, type: "stat", key: stat,
      title: game.i18n.format("VAGABOND.Roll.StatTitle", { stat: game.i18n.localize(CONFIG.VAGABOND.stats[stat].label) }),
      difficulty: rules.skillDifficulty(value, false),
      ...options
    });
  }

  /**
   * Roll a Morale Check: 2d6, failing if the result is higher than Morale (p. 14).
   */
  async rollMorale() {
    const morale = this.system.attributes?.morale;
    if ( morale === null || morale === undefined ) {
      ui.notifications.info(game.i18n.format("VAGABOND.Morale.None", { name: this.name }));
      return null;
    }
    const roll = await new Roll("2d6").evaluate();
    const passed = roll.total <= morale;
    const content = `<div class="vagabond chat-card morale-card">
      <div class="card-result ${passed ? "pass" : "fail"}">
        <span class="card-total">${roll.total}</span>
        <span class="card-vs">${game.i18n.localize("VAGABOND.Morale.Label")} ${morale}</span>
        <span class="outcome-badge ${passed ? "pass" : "fail"}">${game.i18n.localize(passed ? "VAGABOND.Morale.Holds" : "VAGABOND.Morale.Breaks")}</span>
      </div>
      ${await roll.getTooltip()}
    </div>`;
    return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor: game.i18n.localize("VAGABOND.Morale.Check"), content });
  }

  /**
   * Roll an NPC's Hit Dice to set its HP (d8 per HD; Small Beings have 1 HP per HD).
   */
  async rollHitPoints() {
    if ( this.type !== "npc" ) return null;
    const hd = this.system.hd;
    let hp;
    if ( this.system.details.size === "small" ) hp = hd;
    else {
      const roll = await new Roll(`${hd}d8`).evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: game.i18n.localize("VAGABOND.NPC.RollHP"),
        whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id)
      });
      hp = roll.total;
    }
    return this.update({ "system.attributes.hp.value": hp, "system.attributes.hp.max": hp });
  }

  /* -------------------------------------------- */
  /*  Resources                                   */
  /* -------------------------------------------- */

  /**
   * Rest: restore HP and Mana to max and reset Luck. If HP was already full, remove 1 Fatigue (p. 10).
   * @param {object} [options]
   * @param {boolean} [options.chat=true]
   */
  async rest({ chat = true } = {}) {
    if ( this.type !== "character" ) return null;
    const a = this.system.attributes;
    const lines = [game.i18n.localize("VAGABOND.Rest.Restored")];
    if ( (a.hp.value >= a.hp.max) && (a.fatigue > 0) ) {
      // Removing Fatigue changes Max HP and Slots, so apply it before restoring HP.
      await this.update({ "system.attributes.fatigue": a.fatigue - 1 });
      lines.push(game.i18n.localize("VAGABOND.Rest.FatigueRemoved"));
    }
    const restored = this.system.attributes;
    await this.update({
      "system.attributes.hp.value": restored.hp.max,
      "system.attributes.mana.value": restored.mana.max,
      "system.attributes.luck.value": restored.luck.max + (this.system.bonuses.luckOnRest ?? 0)
    }, { vagabondVia: game.i18n.localize("VAGABOND.SheetLog.Rest") });
    if ( chat ) await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="vagabond chat-card rest-card"><h3>${game.i18n.localize("VAGABOND.Rest.Title")}</h3><p>${lines.join("<br>")}</p></div>`
    });
    return this;
  }

  /**
   * Ride a Mount or board a Vehicle (p. 13), or dismount with null. A Being can be mounted by riders at least one Size
   * smaller than it; this is only a warning since the GM may allow exceptions.
   * @param {Actor|null} mount
   * @returns {Promise<Actor>}
   */
  async setMount(mount) {
    if ( this.type !== "character" ) return this;
    if ( !mount ) return this.update({ "system.attributes.mount": "" });
    if ( !["npc", "vehicle"].includes(mount.type) || (mount === this) ) {
      ui.notifications.warn(game.i18n.localize("VAGABOND.Mount.Invalid"));
      return this;
    }
    if ( mount.type === "npc" ) {
      const sizes = Object.keys(CONFIG.VAGABOND.sizes);
      if ( sizes.indexOf(this.system.details.size) >= sizes.indexOf(mount.system.details.size) ) {
        ui.notifications.warn(game.i18n.format("VAGABOND.Mount.TooSmall", { mount: mount.name, name: this.name }));
      }
    }
    return this.update({ "system.attributes.mount": mount.uuid });
  }

  /**
   * Study (a Downtime Activity, p. 19): gain a Studied die, plus one more for each Bookworm Perk (p. 67).
   * @returns {Promise<number>}  Studied dice gained.
   */
  async study() {
    if ( this.type !== "character" ) return 0;
    const gain = 1 + this.itemTypes.perk.filter(p => p.name === "Bookworm").length;
    const total = (this.system.attributes.studied ?? 0) + gain;
    await this.update({ "system.attributes.studied": total });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="vagabond chat-card rest-card"><h3>${game.i18n.localize("VAGABOND.Studied.Study")}</h3>
        <p>${game.i18n.format("VAGABOND.Studied.Gained", { n: gain, total })}</p></div>`
    });
    return gain;
  }

  /**
   * Breather: once per Shift, regain HP equal to Might (p. 10).
   */
  async breather() {
    if ( this.type !== "character" ) return null;
    const a = this.system.attributes;
    const gain = Math.max(0, this.system.stats.mit.value);
    const value = Math.min(a.hp.max, a.hp.value + gain);
    await this.update({ "system.attributes.hp.value": value });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="vagabond chat-card rest-card"><h3>${game.i18n.localize("VAGABOND.Breather.Title")}</h3>
        <p>${game.i18n.format("VAGABOND.Breather.Result", { hp: value - a.hp.value })}</p></div>`
    });
    return this;
  }

  /**
   * Apply damage or healing.
   * @param {number} amount
   * @param {object} [options]
   * @param {boolean} [options.ignoreArmor]   Weak, or damage from a Status.
   * @param {number} [options.multiplier=1]   0.5 for half damage, -1 for healing.
   * @param {object} [options.damage]         The damage's type, Relic (+N), and metal, checked against this Being's
   *                                          Immune (no damage) and Weak (ignores Armor) entries.
   * @returns {Promise<number>}  HP actually changed.
   */
  async applyDamage(amount, { ignoreArmor = false, multiplier = 1, damage } = {}) {
    const hp = this.system.attributes.hp;
    if ( (multiplier >= 0) && damage?.type ) {
      const details = this.system.details ?? {};
      const response = rules.damageResponse({ immune: details.immune ?? "", weak: details.weak ?? "" }, damage);
      if ( response ) {
        const type = game.i18n.localize(CONFIG.VAGABOND.damageTypes[damage.type] ?? damage.type);
        const why = damage.relic ? ` (${game.i18n.format("VAGABOND.Damage.Relic", { n: damage.bonus ?? 0 })})` : "";
        const key = response === "immune" ? "VAGABOND.Damage.Immune" : "VAGABOND.Damage.Weak";
        ui.notifications.info(game.i18n.format(key, { name: this.name, type, why }));
        if ( response === "immune" ) return 0;
        ignoreArmor = true;
      }
    }
    let delta;
    if ( multiplier < 0 ) {
      // Sickened: -2 per healing die is handled at the roll; here healing is flat.
      delta = -Math.min(Math.abs(Math.floor(amount * multiplier)), hp.max - hp.value);
    } else {
      const armor = this.system.attributes.armor ?? 0;
      const raw = Math.floor(amount * multiplier);
      delta = Math.min(hp.value, rules.applyArmor(raw, armor, { ignoreArmor }));
    }
    if ( !delta ) return 0;
    await this.update({ "system.attributes.hp.value": hp.value - delta }, { vagabondDamage: delta });
    if ( (delta > 0) && this.statuses.has("focusing") && (delta >= 5) ) {
      ui.notifications.info(game.i18n.format("VAGABOND.Focus.Check", { name: this.name }));
    }
    return delta;
  }

  /**
   * Spend 1 Luck if possible.
   * @returns {Promise<boolean>}
   */
  async spendLuck() {
    const luck = this.system.attributes?.luck?.value ?? 0;
    if ( luck <= 0 ) {
      ui.notifications.warn(game.i18n.format("VAGABOND.Luck.None", { name: this.name }));
      return false;
    }
    await this.update({ "system.attributes.luck.value": luck - 1 });
    return true;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(changed, options, user) {
    if ( (await super._preUpdate(changed, options, user)) === false ) return false;
    // Clamp HP and Mana to their maximums.
    const hp = foundry.utils.getProperty(changed, "system.attributes.hp.value");
    if ( (hp !== undefined) && (this.type === "character") ) {
      foundry.utils.setProperty(changed, "system.attributes.hp.value", Math.clamp(hp, 0, this.system.attributes.hp.max));
    }
    const mana = foundry.utils.getProperty(changed, "system.attributes.mana.value");
    if ( mana !== undefined ) {
      foundry.utils.setProperty(changed, "system.attributes.mana.value", Math.clamp(mana, 0, this.system.attributes.mana.max ?? mana));
    }
    const luck = foundry.utils.getProperty(changed, "system.attributes.luck.value");
    if ( (luck !== undefined) && (this.type === "character") ) {
      foundry.utils.setProperty(changed, "system.attributes.luck.value", Math.max(0, Number(luck) || 0));
    }
    // Remember tracked values before the change so a note can go to chat (see _onUpdate). Foundry copies these
    // options onto the operation, which comes back with the update; they're keyed by Actor for batch updates.
    if ( sheetLog.tracks(this, options) ) {
      const before = sheetLog.snapshot(this, changed);
      if ( before ) options.vagabondBefore = { ...(options.vagabondBefore ?? {}), [this.id]: before };
    }
  }

  /** @override */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    const before = options.vagabondBefore?.[this.id];
    if ( (userId === game.user.id) && before ) sheetLog.post(this, sheetLog.fieldLines(this, before), options);
    // Show floating HP changes on tokens, like dnd5e.
    const hp = foundry.utils.getProperty(changed, "system.attributes.hp.value");
    if ( (hp === undefined) || !options.vagabondDamage || (userId !== game.user.id) ) return;
    const delta = -options.vagabondDamage;
    for ( const token of this.getActiveTokens() ) {
      if ( !token.visible ) continue;
      canvas.interface?.createScrollingText?.(token.center, delta.signedString(), {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
        fontSize: 32,
        fill: delta < 0 ? "#c0392b" : "#27ae60",
        stroke: 0x000000,
        strokeThickness: 4,
        jitter: 0.25
      });
    }
  }

  /* -------------------------------------------- */
  /*  Sheet change notes for Items                */
  /* -------------------------------------------- */

  /** @override */
  _preUpdateDescendantDocuments(parent, collection, changes, options, userId) {
    super._preUpdateDescendantDocuments(parent, collection, changes, options, userId);
    if ( (parent !== this) || (collection !== "items") || !sheetLog.tracks(this, options) ) return;
    const qty = {};
    for ( const c of changes ) {
      const q = foundry.utils.getProperty(c, "system.quantity");
      const item = this.items.get(c._id);
      if ( (q !== undefined) && item ) qty[c._id] = item.system.quantity;
    }
    if ( !foundry.utils.isEmpty(qty) ) options.vagabondQuantity = qty;
  }

  /** @override */
  _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    if ( (userId !== game.user.id) || !options.vagabondQuantity ) return;
    const lines = [];
    for ( const item of documents ) {
      const before = options.vagabondQuantity[item.id];
      const after = item.system.quantity;
      if ( (before === undefined) || (before === after) ) continue;
      const diff = after - before;
      lines.push({ icon: "fa-box", text: game.i18n.format("VAGABOND.SheetLog.Value", {
        label: item.name, before, after, diff: diff > 0 ? `+${diff}` : `−${Math.abs(diff)}` }) });
    }
    sheetLog.post(this, lines, options);
  }

  /** @override */
  _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    if ( (userId !== game.user.id) || (parent !== this) || (collection !== "items") || !sheetLog.tracks(this, options) ) return;
    if ( documents.length ) sheetLog.post(this, [sheetLog.itemLine("Added", documents)], options);
  }

  /** @override */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
    if ( (userId !== game.user.id) || (parent !== this) || (collection !== "items") || !sheetLog.tracks(this, options) ) return;
    if ( documents.length ) sheetLog.post(this, [sheetLog.itemLine("Removed", documents)], options);
  }
}
