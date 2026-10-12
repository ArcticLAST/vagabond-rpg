import * as rules from "../rules.mjs";
import { grantLevels, splitList } from "../data/item-simple.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Perks that ask for a choice when taken, and what they ask for. */
const PERK_CHOICES = {
  "magical secret": ["spell", "castSkill"],
  advancement: ["stat"],
  "new training": ["skill"],
  cryptozoologist: ["beingType"]
};

/**
 * Class Features that change which Perks a Hero can take. ignoreStats applies to every Perk (Bard). The others describe
 * the Perk that Feature grants: it needs one of these Trainings as a prerequisite, and ignoreOthers waives the rest.
 */
const PERK_FEATURE_RULES = {
  "well-versed": { ignoreStats: true },
  "fighting style": { trainings: ["brawl", "finesse", "melee", "ranged"], ignoreOthers: true },
  survivalist: { trainings: ["survival"], ignoreOthers: true },
  occultist: { trainings: ["mysticism"] }
};

/** A Perk's name without the choice added when it was taken: "Advancement (Might)" -> "advancement". */
const perkBase = name => String(name ?? "").toLowerCase().replace(/\s*\(.*\)\s*$/, "");

/** Highest a Stat can be raised by Advancement. */
const ADVANCEMENT_CAP = 7;

/**
 * Guided Hero creation (p. 20) and leveling (p. 27).
 *
 * Create mode walks through Ancestry, Class, Stats, Trainings, Perks, and Spells, then writes the Hero.
 * Level-up mode shows what the next Level brings and asks only for the choices it needs:
 * a Stat on even Levels, a Perk on odd Levels, a Training if Reason grew, and new Spells.
 *
 * Choices granted by Class Features and Ancestry Traits come from each row's `grants` data.
 */
export default class HeroBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options
   * @param {Actor} options.actor
   * @param {"create"|"levelup"} [options.mode="create"]
   */
  constructor({ actor, mode = "create", ...options } = {}) {
    super(options);
    this.actor = actor;
    this.mode = mode;
    this.build = mode === "levelup" ? this.#initLevelUp() : this.#initCreate();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["vagabond", "hero-builder", "themed", "theme-light"],
    window: { icon: "fa-solid fa-hat-wizard", resizable: true },
    position: { width: 860, height: 780 },
    actions: {
      goto: HeroBuilder.#onGoto,
      next: HeroBuilder.#onNext,
      back: HeroBuilder.#onBack,
      pick: HeroBuilder.#onPick,
      pickArray: HeroBuilder.#onPickArray,
      autoAssign: HeroBuilder.#onAutoAssign,
      toggle: HeroBuilder.#onToggle,
      finish: HeroBuilder.#onFinish
    }
  };

  /** @override */
  static PARTS = {
    main: { template: "systems/vagabond-rpg/templates/apps/hero-builder.hbs", scrollable: [".builder-body"] }
  };

  /** Steps of Hero creation, in order. */
  static CREATE_STEPS = ["ancestry", "class", "stats", "skills", "spells", "perks", "review"];

  /** @override */
  get title() {
    if ( this.mode === "levelup" ) {
      return game.i18n.format("VAGABOND.Builder.LevelUpTitle", { name: this.actor.name, level: this.build.to });
    }
    return game.i18n.format("VAGABOND.Builder.TitleFor", { name: this.actor.name });
  }

  /** Candidate Items by type, loaded once per builder. */
  #options = null;

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  #initCreate() {
    const sys = this.actor.system;
    return {
      step: "ancestry",
      ancestry: null,
      cls: null,
      array: null,
      assign: Object.fromEntries(Object.keys(CONFIG.VAGABOND.stats).map(k => [k, null])),
      boost: "",
      skills: new Set(),
      perks: new Set(),
      perkChoices: {},
      spells: new Set(),
      name: this.actor.name,
      kit: "gold",
      search: { perks: "", spells: "" },
      level: sys.details.level || 1
    };
  }

  #initLevelUp() {
    const level = this.actor.system.details.level;
    return {
      from: level,
      to: level + 1,
      statUp: "",
      skills: new Set(),
      perks: new Set(),
      perkChoices: {},
      spells: new Set(),
      search: { perks: "", spells: "" }
    };
  }

  /**
   * Load the Ancestries, Classes, Perks, and Spells offered, from the system compendiums and the world.
   * @returns {Promise<Record<string, Item[]>>}
   */
  async #loadOptions() {
    if ( this.#options ) return this.#options;
    const out = {};
    for ( const [type, packId] of Object.entries(CONFIG.VAGABOND.builderPacks) ) {
      const pack = game.packs.get(packId);
      const docs = pack ? await pack.getDocuments() : [];
      const world = game.items.filter(i => (type === "kit") ? i.system.isKit : (i.type === type));
      out[type] = [...docs, ...world].sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    }
    return this.#options = out;
  }

  /**
   * Find a candidate Item by UUID.
   * @param {string} type
   * @param {string} uuid
   * @returns {Item|undefined}
   */
  #find(type, uuid) {
    return this.#options?.[type]?.find(i => i.uuid === uuid);
  }

  /**
   * Find a candidate Item by name, case-insensitively.
   * @param {string} type
   * @param {string} name
   * @returns {Item|undefined}
   */
  #findByName(type, name) {
    const n = name.toLowerCase();
    return this.#options?.[type]?.find(i => i.name.toLowerCase() === n);
  }

  /* -------------------------------------------- */
  /*  Derived plan                                */
  /* -------------------------------------------- */

  /**
   * Sum what Ancestry Traits and Class Features hand out at a Level.
   * @param {object[]} rows
   * @param {number|null} level   Only rows granting at this Level; null for every row.
   */
  static #sumGrants(rows, level) {
    const g = { perks: [], perkChoices: 0, trainingChoices: 0, spells: [], spellChoices: 0, statIncrease: 0, sources: [] };
    for ( const row of rows ) {
      if ( !row.grants ) continue;
      if ( (level !== null) && !grantLevels(row).includes(level) ) continue;
      const r = row.grants;
      const any = r.perks || r.spells || r.perkChoices || r.trainingChoices || r.spellChoices || r.statIncrease;
      if ( !any ) continue;
      g.perks.push(...splitList(r.perks));
      g.spells.push(...splitList(r.spells));
      g.perkChoices += r.perkChoices;
      g.trainingChoices += r.trainingChoices;
      g.spellChoices += r.spellChoices;
      g.statIncrease += r.statIncrease;
      g.sources.push(row.name);
    }
    return g;
  }

  /**
   * Work out everything the current choices imply for Hero creation.
   * @returns {object}
   */
  #planCreate() {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const anc = this.#find("ancestry", s.ancestry);
    const cls = this.#find("class", s.cls);
    // Class Features at 1st Level, and every Ancestry Trait (Ancestries have no Levels).
    const grants = HeroBuilder.#mergeGrants(
      HeroBuilder.#sumGrants(cls?.system.features ?? [], 1),
      HeroBuilder.#sumGrants(anc?.system.traits ?? [], null)
    );

    // Stats
    const array = s.array === null ? null : cfg.statArrays[s.array];
    const stats = {};
    for ( const key of Object.keys(cfg.stats) ) {
      const idx = s.assign[key];
      stats[key] = (array && (idx !== null) && (idx !== undefined)) ? array[idx] : null;
    }
    const used = Object.values(s.assign).filter(v => v !== null);
    const statsComplete = !!array && Object.values(stats).every(v => v !== null) && (new Set(used).size === used.length);
    if ( statsComplete && s.boost && grants.statIncrease ) stats[s.boost] = Math.min(cfg.statLevelCap, stats[s.boost] + 1);
    const boostNeeded = grants.statIncrease > 0;
    const statsDone = statsComplete && (!boostNeeded || !!s.boost);

    // Trainings
    const fixedSkills = new Set([...(cls?.system.trainings ?? []), ...(anc?.system.trainings ?? [])]);
    const classChoice = cls?.system.trainingChoices ?? { count: 0, options: [] };
    const reason = rules.reasonTrainings(stats.rsn ?? 0);
    const skillPicks = classChoice.count + reason + grants.trainingChoices;
    const chosenSkills = [...s.skills].filter(k => !fixedSkills.has(k));
    const fromOptions = classChoice.options.length ? chosenSkills.filter(k => classChoice.options.includes(k)).length : chosenSkills.length;
    const skillsDone = statsDone && (chosenSkills.length === skillPicks) && (fromOptions >= classChoice.count);

    // Spells (before Perks, since Perk prerequisites can name Spells)
    const fixedSpellNames = grants.spells;
    const known = cls ? rules.spellsKnown(cls.system.spells.base, cls.system.spells.every, 1) : 0;
    const spellPicks = Math.max(0, known - fixedSpellNames.length) + grants.spellChoices;
    const spellsDone = !!cls && (s.spells.size === spellPicks);

    // Perks: one at creation (p. 20), plus any granted choices.
    const fixedPerkNames = grants.perks;
    const perkPicks = 1 + grants.perkChoices;
    const trained = [...fixedSkills, ...chosenSkills];
    const perkCtx = {
      stats, trainedKeys: trained, owned: false, picks: perkPicks,
      spells: [...fixedSpellNames, ...[...s.spells].map(u => this.#find("spell", u)?.name).filter(Boolean)],
      rules: HeroBuilder.#perkRules(cls?.system.features ?? [], 1)
    };
    const perksDone = (s.perks.size === perkPicks) && this.#perksFit([...s.perks], perkCtx) && this.#perkChoicesDone();

    return {
      anc, cls, grants, array, stats, statsComplete, statsDone, boostNeeded,
      fixedSkills, classChoice, reason, skillPicks, chosenSkills, skillsDone,
      fixedPerkNames, perkPicks, perksDone, perkCtx,
      fixedSpellNames, known, spellPicks, spellsDone,
      trained,
      done: {
        ancestry: !!anc, class: !!cls, stats: statsDone, skills: skillsDone,
        perks: perksDone, spells: spellsDone, review: !!anc && !!cls && statsDone && skillsDone && perksDone && spellsDone
      }
    };
  }

  /** Combine two grant summaries. */
  static #mergeGrants(a, b) {
    return {
      perks: [...a.perks, ...b.perks], spells: [...a.spells, ...b.spells],
      perkChoices: a.perkChoices + b.perkChoices, trainingChoices: a.trainingChoices + b.trainingChoices,
      spellChoices: a.spellChoices + b.spellChoices, statIncrease: a.statIncrease + b.statIncrease,
      sources: [...a.sources, ...b.sources]
    };
  }

  /**
   * Work out what reaching the next Level brings.
   * @returns {object}
   */
  #planLevelUp() {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const sys = this.actor.system;
    const cls = sys.classItem;
    const { from, to } = s;
    const rewards = rules.levelRewards(to);
    const grants = HeroBuilder.#sumGrants(cls?.system.features ?? [], to);
    const statIncrease = rewards.statIncrease + grants.statIncrease;

    const before = Object.fromEntries(Object.entries(sys.stats).map(([k, v]) => [k, v.value]));
    const after = { ...before };
    if ( statIncrease && s.statUp ) after[s.statUp] = Math.min(cfg.statLevelCap, after[s.statUp] + 1);

    const perLevel = sys.bonuses.hpPerLevel ?? 0;
    const hpGain = ((after.mit + perLevel) * to) - ((before.mit + perLevel) * from);
    const manaGain = cls?.system.mana.perLevel ?? 0;
    const castMaxBefore = rules.castMax(cls?.system.castMax ?? "none", from);
    const castMaxAfter = rules.castMax(cls?.system.castMax ?? "none", to);

    const trainingPicks = Math.max(0, rules.reasonTrainings(after.rsn) - rules.reasonTrainings(before.rsn)) + grants.trainingChoices;
    const knownBefore = cls ? rules.spellsKnown(cls.system.spells.base, cls.system.spells.every, from) : 0;
    const knownAfter = cls ? rules.spellsKnown(cls.system.spells.base, cls.system.spells.every, to) : 0;
    const spellPicks = Math.max(0, knownAfter - knownBefore) + grants.spellChoices;
    const perkPicks = rewards.perks + grants.perkChoices;

    const features = (cls?.system.features ?? [])
      .filter(f => (f.level === to) || ((f.level < to) && grantLevels(f).includes(to)))
      .map(f => ({ ...f, again: f.level < to }));

    const trained = Object.entries(sys.skills).filter(([, v]) => v.trained).map(([k]) => k);
    const perkCtx = {
      stats: after, trainedKeys: [...trained, ...s.skills], owned: true, picks: perkPicks,
      spells: this.actor.itemTypes.spell.map(i => i.name),
      rules: HeroBuilder.#perkRules(cls?.system.features ?? [], to)
    };
    const done = (!statIncrease || !!s.statUp) && (s.skills.size === trainingPicks)
      && (s.perks.size === perkPicks) && this.#perksFit([...s.perks], perkCtx) && this.#perkChoicesDone()
      && (s.spells.size === spellPicks);
    return {
      cls, rewards, grants, statIncrease, before, after, hpGain, manaGain, castMaxBefore, castMaxAfter,
      trainingPicks, spellPicks, perkPicks, features, fixedPerkNames: grants.perks, fixedSpellNames: grants.spells,
      trained, perkCtx, done
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    await this.#loadOptions();
    this.#dropBadPerks();
    const context = { mode: this.mode, isCreate: this.mode === "create", config: CONFIG.VAGABOND, state: this.build };
    if ( this.mode === "create" ) await this.#prepareCreate(context);
    else await this.#prepareLevelUp(context);
    return context;
  }

  async #prepareCreate(context) {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const plan = this.#planCreate();
    context.plan = plan;
    const steps = HeroBuilder.CREATE_STEPS.filter(id => (id !== "spells") || plan.spellPicks || plan.fixedSpellNames.length || !plan.cls);
    if ( !steps.includes(s.step) ) s.step = "review";
    const index = steps.indexOf(s.step);
    context.steps = steps.map((id, i) => ({
      id, n: i + 1, label: `VAGABOND.Builder.Step.${id}`, active: id === s.step, done: plan.done[id],
      locked: (id !== s.step) && steps.slice(0, i).some(prev => !plan.done[prev] && (prev !== "review"))
    }));
    context.step = s.step;
    context.isFirst = index === 0;
    context.isLast = s.step === "review";
    context.canNext = plan.done[s.step];

    switch ( s.step ) {
      case "ancestry":
        context.cards = await Promise.all(this.#options.ancestry.map(async a => ({
          uuid: a.uuid, name: a.name, img: a.img, selected: a.uuid === s.ancestry,
          tags: a.system.chatTags,
          traits: await Promise.all(a.system.traits.map(async t => ({ name: t.name, html: await this.#enrich(t.description) })))
        })));
        break;
      case "class":
        context.cards = await Promise.all(this.#options.class.map(async c => ({
          uuid: c.uuid, name: c.name, img: c.img, selected: c.uuid === s.cls,
          keyStats: c.system.keyStats.map(k => game.i18n.localize(cfg.stats[k]?.abbr ?? k)).join(", "),
          trainings: c.system.trainings.map(k => game.i18n.localize(cfg.skills[k]?.label ?? k)).join(", "),
          playstyle: c.system.playstyle,
          caster: c.system.mana.perLevel > 0,
          features: await Promise.all(c.system.features.filter(f => f.level === 1).map(async f => ({ name: f.name, html: await this.#enrich(f.description) })))
        })));
        break;
      case "stats":
        this.#prepareStats(context, plan);
        break;
      case "skills":
        context.skillRows = this.#skillRows(plan.fixedSkills, s.skills, plan.classChoice.options);
        context.skillsLeft = plan.skillPicks - plan.chosenSkills.length;
        break;
      case "perks":
        context.perkCards = await this.#perkCards(plan.fixedPerkNames, plan.perkCtx);
        context.perksLeft = plan.perkPicks - s.perks.size;
        break;
      case "spells":
        context.spellCards = await this.#spellCards(plan.fixedSpellNames, []);
        context.spellsLeft = plan.spellPicks - s.spells.size;
        break;
      case "review":
        context.review = this.#review(plan);
        break;
    }
  }

  async #prepareLevelUp(context) {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const plan = this.#planLevelUp();
    context.plan = plan;
    context.features = await Promise.all(plan.features.map(async f => ({ ...f, html: await this.#enrich(f.description) })));
    context.statChoices = Object.entries(plan.before).map(([key, value]) => ({
      key, value, label: cfg.stats[key].label, abbr: cfg.stats[key].abbr,
      selected: s.statUp === key, capped: value >= cfg.statLevelCap
    }));
    const trained = new Set(plan.trained);
    context.skillRows = this.#skillRows(trained, s.skills, []).filter(r => !r.fixed);
    context.skillsLeft = plan.trainingPicks - s.skills.size;
    const knownSpells = this.actor.itemTypes.spell.map(i => i.name);
    if ( plan.perkPicks || plan.fixedPerkNames.length ) {
      context.perkCards = await this.#perkCards(plan.fixedPerkNames, plan.perkCtx);
    }
    context.perksLeft = plan.perkPicks - s.perks.size;
    if ( plan.spellPicks || plan.fixedSpellNames.length ) context.spellCards = await this.#spellCards(plan.fixedSpellNames, knownSpells);
    context.spellsLeft = plan.spellPicks - s.spells.size;
    context.canFinish = plan.done;
  }

  #prepareStats(context, plan) {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    context.arrays = cfg.statArrays.map((values, i) => ({ i, n: i + 1, values: values.join(", "), selected: s.array === i }));
    if ( !plan.array ) return;
    const usedBy = {};
    for ( const [k, idx] of Object.entries(s.assign) ) if ( idx !== null ) usedBy[idx] = k;
    context.statRows = Object.entries(cfg.stats).map(([key, def]) => ({
      key, label: def.label, abbr: def.abbr, hint: def.hint,
      key_stat: plan.cls?.system.keyStats.includes(key),
      value: plan.stats[key],
      options: plan.array.map((v, idx) => ({
        idx, v, selected: s.assign[key] === idx, taken: (usedBy[idx] !== undefined) && (usedBy[idx] !== key)
      }))
    }));
    context.boostOptions = Object.entries(cfg.stats).map(([key, def]) => ({
      key, label: def.label, selected: s.boost === key,
      disabled: plan.statsComplete && ((plan.array[s.assign[key]] ?? 0) >= cfg.statLevelCap)
    }));
    if ( plan.statsComplete ) context.preview = this.#preview(plan.stats);
  }

  /**
   * Derived numbers for a set of Stats at Level 1.
   * @param {Record<string, number>} stats
   */
  #preview(stats) {
    return {
      hp: rules.maxHP({ might: stats.mit, level: 1 }),
      slots: rules.maxSlots(stats.mit),
      speed: rules.baseSpeed(stats.dex),
      luck: stats.luk,
      endure: rules.saveDifficulty("endure", stats),
      reflex: rules.saveDifficulty("reflex", stats),
      will: rules.saveDifficulty("will", stats),
      trainings: rules.reasonTrainings(stats.rsn)
    };
  }

  /**
   * Rows for the Skill picker.
   * @param {Set<string>} fixed     Skills already Trained.
   * @param {Set<string>} chosen
   * @param {string[]} classOptions Skills the Class lets you choose from, if limited.
   */
  #skillRows(fixed, chosen, classOptions) {
    const cfg = CONFIG.VAGABOND;
    return Object.entries(cfg.skills).map(([key, def]) => ({
      key, label: def.label, stat: cfg.stats[def.stat]?.abbr,
      fixed: fixed.has(key), selected: fixed.has(key) || chosen.has(key),
      classOption: classOptions.includes(key)
    }));
  }

  /** Names of the Spells chosen or granted in Hero creation. */
  #chosenSpellNames(plan) {
    return [...plan.fixedSpellNames, ...[...this.build.spells].map(u => this.#find("spell", u)?.name).filter(Boolean)];
  }

  /* -------------------------------------------- */
  /*  Perks                                       */
  /* -------------------------------------------- */

  /**
   * What Class Features at a Level do to Perk eligibility.
   * @param {object[]} features   Class Feature rows.
   * @param {number} level
   * @returns {{ignoreStats: boolean, slots: object[]}}  slots: Perk picks a Feature grants this Level, with its rule.
   */
  static #perkRules(features, level) {
    const out = { ignoreStats: false, slots: [] };
    for ( const f of features ) {
      const rule = PERK_FEATURE_RULES[f.name.toLowerCase()];
      if ( !rule ) continue;
      if ( rule.ignoreStats && (f.level <= level) ) out.ignoreStats = true;
      if ( rule.trainings && f.grants?.perkChoices && grantLevels(f).includes(level) ) {
        for ( let i = 0; i < f.grants.perkChoices; i++ ) out.slots.push({ ...rule, source: f.name });
      }
    }
    return out;
  }

  /**
   * Whether a Hero can take a Perk.
   * @param {Item} perk
   * @param {object} ctx    A plan's perkCtx.
   * @returns {{met: boolean, unmet: string[], slots: number[], limit: number, taken: number, atLimit: boolean}}
   *   met: prerequisites met for an ordinary pick; slots: Feature-granted picks it fits instead.
   */
  #perkCheck(perk, ctx) {
    const cfg = CONFIG.VAGABOND;
    const text = perk.system.prerequisites ?? "";
    const parts = text.split("|");
    const trained = ctx.trainedKeys.map(k => game.i18n.localize(cfg.skills[k]?.label ?? k));
    const checkText = ctx.rules.ignoreStats ? parts.filter(t => !/^\s*stat\s*:/i.test(t)).join("|") : text;
    const check = rules.checkPrerequisites(checkText, { stats: ctx.stats, trained, spells: ctx.spells });
    const trainedClause = (parts.find(t => /^\s*trained\s*:/i.test(t)) ?? "").toLowerCase();
    const slots = [];
    ctx.rules.slots.forEach((rule, i) => {
      const names = rule.trainings.map(k => game.i18n.localize(cfg.skills[k]?.label ?? k).toLowerCase());
      const fits = names.some(n => new RegExp(`\\b${n}\\b`).test(trainedClause));
      if ( fits && (rule.ignoreOthers || check.met) ) slots.push(i);
    });
    const limit = rules.perkLimit(perk.system.description);
    const base = perkBase(perk.name);
    const taken = ctx.owned ? this.actor.itemTypes.perk.filter(i => perkBase(i.name) === base).length : 0;
    return { met: check.met, unmet: check.unmet, slots, limit, taken, atLimit: taken >= limit };
  }

  /**
   * Whether chosen Perks fill the Perk picks: each needs a pick it qualifies for, ordinary or Feature-granted.
   * @param {string[]} uuids
   * @param {object} ctx
   * @returns {boolean}
   */
  #perksFit(uuids, ctx) {
    const regular = Math.max(0, ctx.picks - ctx.rules.slots.length);
    const checks = uuids.map(u => {
      const p = this.#find("perk", u);
      return p ? this.#perkCheck(p, ctx) : null;
    });
    if ( checks.some(c => !c || c.atLimit) ) return false;
    const used = new Set();
    const assign = (i, reg) => {
      if ( i === checks.length ) return true;
      const c = checks[i];
      if ( c.met && (reg < regular) && assign(i + 1, reg + 1) ) return true;
      for ( const slot of c.slots ) {
        if ( used.has(slot) ) continue;
        used.add(slot);
        if ( assign(i + 1, reg) ) return true;
        used.delete(slot);
      }
      return false;
    };
    return assign(0, 0);
  }

  /** Whether every chosen Perk that needs a choice (Magical Secret, Advancement, ...) has one. */
  #perkChoicesDone() {
    const s = this.build;
    return [...s.perks].every(u => {
      const fields = PERK_CHOICES[perkBase(this.#find("perk", u)?.name)] ?? [];
      return fields.every(f => !!s.perkChoices[u]?.[f]);
    });
  }

  /**
   * Options for one of a Perk's choices.
   * @param {string} field    spell | castSkill | stat | skill | beingType
   * @param {string} uuid     The Perk being chosen for.
   * @param {object} ctx
   * @returns {Record<string, string>}
   */
  #choiceOptions(field, uuid, ctx) {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const others = f => Object.entries(s.perkChoices).filter(([u]) => (u !== uuid) && s.perks.has(u)).map(([, c]) => c[f]).filter(Boolean);
    const pick = entries => Object.fromEntries(entries);
    switch ( field ) {
      case "spell": {
        const known = new Set(ctx.spells.map(n => n.toLowerCase()));
        const taken = new Set([...s.spells, ...others("spell")]);
        return pick(this.#options.spell.filter(sp => !known.has(sp.name.toLowerCase()) && !taken.has(sp.uuid)).map(sp => [sp.uuid, sp.name]));
      }
      case "castSkill":
        return pick(["arcana", "influence", "mysticism"].filter(k => ctx.trainedKeys.includes(k)).map(k => [k, cfg.skills[k].label]));
      case "stat": {
        const raised = others("stat");
        return pick(Object.entries(cfg.stats).filter(([k]) => ((ctx.stats[k] ?? 0) + raised.filter(r => r === k).length) < ADVANCEMENT_CAP)
          .map(([k, v]) => [k, v.label]));
      }
      case "skill": {
        const taken = new Set([...ctx.trainedKeys, ...others("skill")]);
        return pick(Object.entries(cfg.skills).filter(([k]) => !taken.has(k)).map(([k, v]) => [k, v.label]));
      }
      case "beingType": return { ...cfg.beingTypes };
    }
    return {};
  }

  /** Drop chosen Perks the Hero no longer qualifies for, and choices that no longer fit, after other choices change. */
  #dropBadPerks() {
    const s = this.build;
    if ( !s.perks.size ) return;
    const plan = this.mode === "create" ? this.#planCreate() : this.#planLevelUp();
    for ( const u of [...s.perks] ) {
      const p = this.#find("perk", u);
      const c = p ? this.#perkCheck(p, plan.perkCtx) : null;
      if ( !c || c.atLimit || (!c.met && !c.slots.length) ) {
        s.perks.delete(u);
        delete s.perkChoices[u];
        continue;
      }
      const choice = s.perkChoices[u] ?? {};
      for ( const f of PERK_CHOICES[perkBase(p.name)] ?? [] ) {
        if ( choice[f] && !(choice[f] in this.#choiceOptions(f, u, plan.perkCtx)) ) delete choice[f];
      }
    }
  }

  /**
   * Cards for the Perk picker.
   * @param {string[]} fixedNames     Perks granted outright.
   * @param {object} ctx              The plan's perkCtx.
   */
  async #perkCards(fixedNames, ctx) {
    const s = this.build;
    const fixed = new Set(fixedNames.map(n => n.toLowerCase()));
    return Promise.all(this.#options.perk.map(async p => {
      const c = this.#perkCheck(p, ctx);
      const isFixed = fixed.has(p.name.toLowerCase());
      const selected = isFixed || s.perks.has(p.uuid);
      const eligible = c.met || (c.slots.length > 0);
      const fields = PERK_CHOICES[perkBase(p.name)] ?? [];
      const choice = (selected && !isFixed && fields.length) ? fields.map(f => ({
        field: f, label: `VAGABOND.Builder.Choice.${f}`, options: this.#choiceOptions(f, p.uuid, ctx),
        value: s.perkChoices[p.uuid]?.[f] ?? ""
      })) : null;
      return {
        uuid: p.uuid, name: p.name, img: p.img,
        prerequisites: p.system.prerequisites,
        unmet: eligible ? "" : c.unmet.join("; "),
        via: (!c.met && c.slots.length) ? ctx.rules.slots[c.slots[0]].source : "",
        blocked: !isFixed && !selected && (!eligible || c.atLimit),
        fixed: isFixed,
        owned: !isFixed && c.atLimit,
        taken: (c.taken && !c.atLimit) ? c.taken : 0,
        selected, choice,
        html: await this.#enrich(p.system.description)
      };
    }));
  }

  /**
   * A chosen Perk's name with its choice, e.g. "Magical Secret (Fireball)".
   * @param {string} uuid
   * @returns {string}
   */
  #perkLabel(uuid) {
    const cfg = CONFIG.VAGABOND;
    const p = this.#find("perk", uuid);
    if ( !p ) return "";
    const c = this.build.perkChoices[uuid] ?? {};
    const extra = [];
    if ( c.spell ) extra.push(this.#find("spell", c.spell)?.name);
    if ( c.stat ) extra.push(game.i18n.localize(cfg.stats[c.stat]?.label ?? c.stat));
    if ( c.skill ) extra.push(game.i18n.localize(cfg.skills[c.skill]?.label ?? c.skill));
    if ( c.beingType ) extra.push(game.i18n.localize(cfg.beingTypes[c.beingType] ?? c.beingType));
    const list = extra.filter(Boolean);
    return list.length ? `${p.name} (${list.join(", ")})` : p.name;
  }

  /**
   * Items and changes from the chosen Perks: each Perk (named with its choice), Magical Secret Spells, Advancement
   * Stats, and New Training Skills.
   * @returns {{items: object[], spells: object[], stats: Record<string, number>, skills: string[]}}
   */
  #perkGains() {
    const s = this.build;
    const out = { items: [], spells: [], stats: {}, skills: [] };
    for ( const u of s.perks ) {
      const p = this.#find("perk", u);
      if ( !p ) continue;
      const data = HeroBuilder.#itemData(p);
      data.name = this.#perkLabel(u);
      out.items.push(data);
      const c = s.perkChoices[u] ?? {};
      const spell = c.spell ? this.#find("spell", c.spell) : null;
      if ( spell ) {
        const sp = HeroBuilder.#itemData(spell);
        foundry.utils.setProperty(sp, "system.castSkill", c.castSkill || "");
        out.spells.push(sp);
      }
      if ( c.stat ) out.stats[c.stat] = (out.stats[c.stat] ?? 0) + 1;
      if ( c.skill ) out.skills.push(c.skill);
    }
    return out;
  }

  /**
   * Cards for the Spell picker.
   * @param {string[]} fixedNames   Spells granted outright.
   * @param {string[]} known        Spells the Hero already knows.
   */
  async #spellCards(fixedNames, known) {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const fixed = new Set(fixedNames.map(n => n.toLowerCase()));
    const have = new Set(known.map(n => n.toLowerCase()));
    return Promise.all(this.#options.spell.map(async sp => ({
      uuid: sp.uuid, name: sp.name, img: sp.img,
      damage: sp.system.damageBase ? game.i18n.localize(cfg.damageBases[sp.system.damageBase] ?? sp.system.damageBase) : "",
      focus: sp.system.focus,
      fixed: fixed.has(sp.name.toLowerCase()),
      owned: have.has(sp.name.toLowerCase()),
      selected: fixed.has(sp.name.toLowerCase()) || s.spells.has(sp.uuid),
      html: await this.#enrich(sp.system.description)
    })));
  }

  /** Summary for the last creation step. */
  #review(plan) {
    const cfg = CONFIG.VAGABOND;
    const s = this.build;
    const label = (map, k) => game.i18n.localize(map[k]?.label ?? k);
    return {
      ancestry: plan.anc?.name, cls: plan.cls?.name,
      stats: Object.entries(plan.stats).map(([k, v]) => ({ abbr: cfg.stats[k].abbr, value: v })),
      preview: plan.statsDone ? this.#preview(plan.stats) : null,
      skills: plan.trained.map(k => label(cfg.skills, k)).join(", "),
      perks: [...plan.fixedPerkNames, ...[...s.perks].map(u => this.#perkLabel(u))].filter(Boolean).join(", "),
      spells: this.#chosenSpellNames(plan).join(", "),
      mana: plan.cls ? plan.cls.system.mana.perLevel : 0,
      missing: Object.entries(plan.done).filter(([k, v]) => !v && (k !== "review")).map(([k]) => `VAGABOND.Builder.Step.${k}`),
      ...this.#kitOptions(plan)
    };
  }

  /**
   * A Starting Pack's contents grouped into Weapons, Armor, and Gear, with icons and quantities.
   * @param {Item} kit
   * @returns {{label: string, items: object[]}[]}
   */
  #kitGroups(kit) {
    const order = ["weapon", "armor", "gear"];
    const groups = new Map(order.map(t => [t, []]));
    for ( const c of kit.system.contents ) {
      let entry = null;
      try { entry = c.uuid ? fromUuidSync(c.uuid, { strict: false }) : null; } catch { entry = null; }
      const type = order.includes(entry?.type) ? entry.type : "gear";
      groups.get(type).push({
        name: entry?.name ?? c.name, img: entry?.img ?? "icons/svg/item-bag.svg", quantity: c.quantity ?? 1,
        worth: c.value ? HeroBuilder.coins(c.value) : ""
      });
    }
    return order.filter(t => groups.get(t).length).map(t => ({
      label: game.i18n.localize(`TYPES.Item.${t}Pl`), items: groups.get(t)
    }));
  }

  /**
   * Starting Pack choices for the review step, with the Class's recommended packs first (p. 74).
   * @param {object} plan
   */
  #kitOptions(plan) {
    const s = this.build;
    const short = name => name.replace(/^Starting Pack:\s*/i, "");
    const rec = new Set((CONFIG.VAGABOND.recommendedPacks[plan.cls?.name.toLowerCase()] ?? []).map(n => n.toLowerCase()));
    const opt = k => ({ value: k.uuid, label: short(k.name), selected: s.kit === k.uuid });
    const kits = this.#options?.kit ?? [];
    const isRec = k => rec.has(short(k.name).toLowerCase());
    const chosen = (s.kit && (s.kit !== "gold")) ? this.#find("kit", s.kit) : null;
    const fmt = v => foundry.utils.isEmpty(v) ? "" : v;
    return {
      kitsRecommended: kits.filter(isRec).map(opt),
      kitsOther: kits.filter(k => !isRec(k)).map(opt),
      kitChoice: s.kit,
      kitGroups: chosen ? this.#kitGroups(chosen) : [],
      kitWealth: chosen ? (fmt(this.constructor.coins(chosen.system.wealth)) || "0s") : ""
    };
  }

  /** Format silver as "1g 46s". */
  static coins(silver) {
    const g = Math.floor(silver / 100);
    const s = silver % 100;
    return [g ? `${g}g` : "", (s || !g) ? `${s}s` : ""].filter(Boolean).join(" ");
  }

  async #enrich(html) {
    return foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { secrets: false });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-field]") ) {
      el.addEventListener("change", this.#onFieldChange.bind(this));
    }
    for ( const el of this.element.querySelectorAll("input[data-search]") ) {
      el.addEventListener("input", event => {
        this.build.search[event.currentTarget.dataset.search] = event.currentTarget.value;
        this.#applySearch();
      });
    }
    for ( const el of this.element.querySelectorAll("select[data-perk-choice]") ) {
      el.addEventListener("change", event => {
        const { perkChoice, choiceField } = event.currentTarget.dataset;
        const choices = this.build.perkChoices[perkChoice] ??= {};
        choices[choiceField] = event.currentTarget.value;
        this.render();
      });
    }
    for ( const el of this.element.querySelectorAll("input[data-filter-unmet]") ) {
      el.addEventListener("change", event => {
        this.build.hideUnmet = event.currentTarget.checked;
        this.#applySearch();
      });
    }
    this.#applySearch();
  }

  /** Hide picker cards that don't match the search text. */
  #applySearch() {
    for ( const list of this.element.querySelectorAll("[data-search-list]") ) {
      const q = (this.build.search[list.dataset.searchList] ?? "").trim().toLowerCase();
      for ( const card of list.querySelectorAll("[data-name]") ) {
        const miss = (!!q && !card.dataset.name.toLowerCase().includes(q)) || (this.build.hideUnmet && ("unmet" in card.dataset));
        card.hidden = miss && !card.classList.contains("selected");
      }
    }
  }

  /* -------------------------------------------- */
  /*  Event handlers                              */
  /* -------------------------------------------- */

  #onFieldChange(event) {
    const el = event.currentTarget;
    const s = this.build;
    switch ( el.dataset.field ) {
      case "assign": {
        const key = el.dataset.stat;
        const idx = el.value === "" ? null : Number(el.value);
        // Swap if another Stat already holds this value slot.
        const other = Object.keys(s.assign).find(k => (k !== key) && (s.assign[k] === idx) && (idx !== null));
        if ( other ) s.assign[other] = s.assign[key];
        s.assign[key] = idx;
        break;
      }
      case "boost": s.boost = el.value; break;
      case "statUp": s.statUp = el.value; break;
      case "name": s.name = el.value; return;
      case "kit": s.kit = el.value; return;
    }
    // Choices that depend on Stats may no longer fit.
    this.#trimChoices();
    this.render();
  }

  /** Drop extra Training choices if a Stat change lowered how many are allowed. */
  #trimChoices() {
    const plan = this.mode === "create" ? this.#planCreate() : this.#planLevelUp();
    const allowed = this.mode === "create" ? plan.skillPicks : plan.trainingPicks;
    const chosen = [...this.build.skills];
    while ( chosen.length > allowed ) this.build.skills.delete(chosen.pop());
  }

  static #onGoto(event, target) {
    if ( target.closest(".locked") ) return;
    this.build.step = target.dataset.step;
    this.render();
  }

  static #onNext() {
    const steps = [...this.element.querySelectorAll("[data-step]")].map(e => e.dataset.step);
    const i = steps.indexOf(this.build.step);
    if ( i < steps.length - 1 ) this.build.step = steps[i + 1];
    this.render();
  }

  static #onBack() {
    const steps = [...this.element.querySelectorAll("[data-step]")].map(e => e.dataset.step);
    const i = steps.indexOf(this.build.step);
    if ( i > 0 ) this.build.step = steps[i - 1];
    this.render();
  }

  /** Choose an Ancestry or Class. */
  static #onPick(event, target) {
    const { kind, uuid } = target.closest("[data-uuid]").dataset;
    const s = this.build;
    if ( kind === "ancestry" ) {
      if ( s.ancestry !== uuid ) s.boost = "";
      s.ancestry = uuid;
    } else if ( kind === "class" ) {
      if ( s.cls !== uuid ) { s.spells.clear(); s.skills.clear(); }
      s.cls = uuid;
    }
    this.#trimChoices();
    this.render();
  }

  static #onPickArray(event, target) {
    const s = this.build;
    s.array = Number(target.dataset.index);
    const cls = this.#find("class", s.cls);
    s.assign = rules.autoAssign(CONFIG.VAGABOND.statArrays[s.array], cls?.system.keyStats ?? [], Object.keys(CONFIG.VAGABOND.stats));
    this.#trimChoices();
    this.render();
  }

  static #onAutoAssign() {
    const s = this.build;
    if ( s.array === null ) return;
    const cls = this.#find("class", s.cls);
    s.assign = rules.autoAssign(CONFIG.VAGABOND.statArrays[s.array], cls?.system.keyStats ?? [], Object.keys(CONFIG.VAGABOND.stats));
    this.#trimChoices();
    this.render();
  }

  /** Toggle a Skill, Perk, or Spell choice, within the number allowed. */
  static #onToggle(event, target) {
    const el = target.closest("[data-kind]");
    const { kind } = el.dataset;
    const id = el.dataset.uuid ?? el.dataset.key;
    if ( el.classList.contains("fixed") || el.classList.contains("owned") ) return;
    const s = this.build;
    const set = s[kind];
    if ( set.has(id) ) {
      set.delete(id);
      if ( kind === "perks" ) delete s.perkChoices[id];
    }
    else {
      const plan = this.mode === "create" ? this.#planCreate() : this.#planLevelUp();
      const perk = (kind === "perks") ? this.#find("perk", id) : null;
      if ( perk ) {
        const c = this.#perkCheck(perk, plan.perkCtx);
        if ( c.atLimit || (!c.met && !c.slots.length) ) {
          return ui.notifications.warn(game.i18n.format("VAGABOND.Builder.NotQualified", { name: perk.name }));
        }
      }
      const limit = {
        skills: this.mode === "create" ? plan.skillPicks : plan.trainingPicks,
        perks: plan.perkPicks,
        spells: plan.spellPicks
      }[kind];
      let replace = false;
      if ( (kind === "skills") && (this.mode === "create") ) {
        // Count only chosen Skills, not those the Class or Ancestry already grant.
        if ( plan.chosenSkills.length >= limit ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Builder.LimitReached"));
      } else if ( set.size >= limit ) {
        if ( limit === 1 ) replace = true;
        else return ui.notifications.warn(game.i18n.localize("VAGABOND.Builder.LimitReached"));
      }
      if ( kind === "perks" ) {
        // Feature-granted picks (Fighting Style, Survivalist) only take Perks with certain prerequisites.
        if ( !this.#perksFit(replace ? [id] : [...set, id], plan.perkCtx) ) {
          return ui.notifications.warn(game.i18n.format("VAGABOND.Builder.NoPickFor", { name: perk?.name ?? "" }));
        }
        if ( replace ) s.perkChoices = {};
      }
      if ( replace ) set.clear();
      set.add(id);
      if ( kind === "perks" ) {
        // Fill in choices that have only one option.
        const choices = s.perkChoices[id] = {};
        for ( const f of PERK_CHOICES[perkBase(perk?.name)] ?? [] ) {
          const opts = Object.keys(this.#choiceOptions(f, id, plan.perkCtx));
          if ( opts.length === 1 ) choices[f] = opts[0];
        }
      }
    }
    this.render();
  }

  static async #onFinish() {
    if ( this.mode === "create" ) await this.#applyCreate();
    else await this.#applyLevelUp();
  }

  /* -------------------------------------------- */
  /*  Applying                                    */
  /* -------------------------------------------- */

  /**
   * Item data to embed from a candidate document.
   * @param {Item} doc
   */
  static #itemData(doc) {
    const data = doc.toObject();
    delete data._id;
    foundry.utils.setProperty(data, "_stats.compendiumSource", doc.uuid);
    return data;
  }

  async #applyCreate() {
    const plan = this.#planCreate();
    if ( !plan.done.review ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Builder.Incomplete"));
    const actor = this.actor;
    const cfg = CONFIG.VAGABOND;
    const s = this.build;

    // Replace any existing Class and Ancestry.
    const replace = actor.items.filter(i => ["class", "ancestry"].includes(i.type)).map(i => i.id);
    if ( replace.length ) await actor.deleteEmbeddedDocuments("Item", replace, { vagabondLog: false });

    const updates = {
      name: s.name?.trim() || actor.name,
      "system.details.level": 1,
      "system.details.size": plan.anc.system.size,
      "system.details.beingType": plan.anc.system.beingType,
      "system.attributes.castingSkill": plan.cls.system.castingSkill || "",
      "system.attributes.fatigue": 0,
      "system.attributes.luck.value": plan.stats.luk
    };
    const gains = this.#perkGains();
    for ( const [k, v] of Object.entries(plan.stats) ) {
      updates[`system.stats.${k}.value`] = gains.stats[k] ? Math.min(ADVANCEMENT_CAP, v + gains.stats[k]) : v;
    }
    const trained = new Set([...plan.trained, ...gains.skills]);
    for ( const k of Object.keys(cfg.skills) ) updates[`system.skills.${k}.trained`] = trained.has(k);
    if ( s.kit === "gold" ) Object.assign(updates, { "system.currency.g": cfg.startingGold, "system.currency.s": 0, "system.currency.c": 0 });
    await actor.update(updates, { vagabondLog: false });

    const owned = new Set(actor.items.map(i => `${i.type}:${i.name.toLowerCase()}`));
    const items = [plan.anc, plan.cls];
    const missing = [];
    for ( const name of plan.fixedPerkNames ) {
      const p = this.#findByName("perk", name);
      if ( p ) items.push(p); else missing.push(name);
    }
    for ( const name of plan.fixedSpellNames ) {
      const sp = this.#findByName("spell", name);
      if ( sp ) items.push(sp); else missing.push(name);
    }
    for ( const u of s.spells ) items.push(this.#find("spell", u));
    const toCreate = items.filter(Boolean).filter(i => ["class", "ancestry"].includes(i.type) || (i.type === "perk")
      || !owned.has(`${i.type}:${i.name.toLowerCase()}`));
    await actor.createEmbeddedDocuments("Item", [...toCreate.map(HeroBuilder.#itemData), ...gains.items, ...gains.spells], { vagabondLog: false });
    if ( missing.length ) ui.notifications.warn(game.i18n.format("VAGABOND.Builder.Missing", { names: missing.join(", ") }));
    const kit = (s.kit && (s.kit !== "gold")) ? this.#find("kit", s.kit) : null;
    if ( kit ) await kit.unpackKit(actor, { replaceWealth: true, log: false });

    // Fill HP and Mana now that the Class and Stats are in place.
    await actor.update({
      "system.attributes.hp.value": actor.system.attributes.hp.max,
      "system.attributes.mana.value": actor.system.attributes.mana.max
    }, { vagabondLog: false });
    ui.notifications.info(game.i18n.format("VAGABOND.Builder.Created", { name: actor.name }));
    return this.close();
  }

  async #applyLevelUp() {
    const plan = this.#planLevelUp();
    if ( !plan.done ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Builder.Incomplete"));
    const actor = this.actor;
    const s = this.build;
    const attrs = actor.system.attributes;
    const updates = {
      "system.details.level": s.to,
      "system.attributes.hp.value": attrs.hp.value + Math.max(0, plan.hpGain),
      "system.attributes.mana.value": attrs.mana.value + plan.manaGain
    };
    const gains = this.#perkGains();
    if ( s.statUp ) updates[`system.stats.${s.statUp}.value`] = plan.after[s.statUp];
    for ( const [k, n] of Object.entries(gains.stats) ) {
      updates[`system.stats.${k}.value`] = Math.min(ADVANCEMENT_CAP, plan.after[k] + n);
    }
    for ( const k of [...s.skills, ...gains.skills] ) updates[`system.skills.${k}.trained`] = true;
    await actor.update(updates, { vagabondLog: false });

    const items = [];
    const missing = [];
    const ownedPerks = new Set(actor.itemTypes.perk.map(p => p.name.toLowerCase()));
    for ( const name of plan.fixedPerkNames ) {
      if ( ownedPerks.has(name.toLowerCase()) ) continue;
      const p = this.#findByName("perk", name);
      if ( p ) items.push(p); else missing.push(name);
    }
    const ownedSpells = new Set(actor.itemTypes.spell.map(p => p.name.toLowerCase()));
    for ( const name of plan.fixedSpellNames ) {
      if ( ownedSpells.has(name.toLowerCase()) ) continue;
      const sp = this.#findByName("spell", name);
      if ( sp ) items.push(sp); else missing.push(name);
    }
    for ( const u of s.spells ) items.push(this.#find("spell", u));
    const created = [...items.filter(Boolean).map(HeroBuilder.#itemData), ...gains.items, ...gains.spells];
    if ( created.length ) await actor.createEmbeddedDocuments("Item", created, { vagabondLog: false });
    if ( missing.length ) ui.notifications.warn(game.i18n.format("VAGABOND.Builder.Missing", { names: missing.join(", ") }));

    // Announce the new Level.
    const cfg = CONFIG.VAGABOND;
    const lines = [
      game.i18n.format("VAGABOND.Builder.GainHP", { hp: plan.hpGain }),
      s.statUp ? `${game.i18n.localize(cfg.stats[s.statUp].label)} ${plan.before[s.statUp]} → ${plan.after[s.statUp]}` : null,
      ...plan.features.map(f => f.name),
      ...created.map(i => i.name),
      ...gains.stats ? Object.entries(gains.stats).map(([k]) => `${game.i18n.localize(cfg.stats[k].label)} ${plan.after[k]} → ${Math.min(ADVANCEMENT_CAP, plan.after[k] + gains.stats[k])}`) : [],
      ...[...s.skills, ...gains.skills].map(k => `${game.i18n.localize("VAGABOND.Trained")}: ${game.i18n.localize(cfg.skills[k].label)}`)
    ].filter(Boolean);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="vagabond chat-card level-card"><header class="card-header"><img src="${actor.img}" width="36" height="36" alt="">
        <div class="card-titles"><h3>${game.i18n.format("VAGABOND.Builder.Reached", { name: actor.name, level: s.to })}</h3></div></header>
        <ul class="card-body">${lines.map(l => `<li>${l}</li>`).join("")}</ul></div>`
    });
    return this.close();
  }
}
