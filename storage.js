window.MyRateStorage = (() => {
  const KEY = 'myrate_state_v2';
  const BACKUP_KEY = 'myrate_backup_before_3';
  let warning = '', writable = true;
  const LEGACY = {
    profile: ['myrate_profile_v011', 'myRate.profile.v1'],
    fx: ['myrate_fx_v011'],
    calculations: ['myrate_calculations_v013'],
    projects: ['myrate_projects_v013'],
    saved: ['myrate_saved_v011']
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  function parse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }

  function readFirst(keys, fallback = null) {
    for (const key of keys) {
      const value = parse(localStorage.getItem(key), null);
      if (value !== null) return value;
    }
    return fallback;
  }

  // Field-level normalization (currency map, numeric fallbacks) lives once in MyRateCalculator;
  // storage only adds the "no source yet" case, which calculator.js intentionally does not have.
  function normalizeProfile(source) {
    if (!source) return null;
    return window.MyRateCalculator.normalizeProfile(source);
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      id: item.id || uid('item'),
      name: String(item.name || 'Без названия').slice(0, 80),
      price: Number(item.price) || 0,
      qty: Number(item.qty) || 1,
      currency: item.currency || 'RUB'
    }));
  }

  function normalizeCalculation(source, fallbackProfile, fallbackFx) {
    const createdAt = source?.createdAt || source?.date || new Date().toISOString();
    return {
      id: source?.id || uid('calc'),
      sourceId: source?.sourceId || null,
      createdAt,
      updatedAt: source?.updatedAt || createdAt,
      archivedAt: source?.archivedAt || null,
      status: source?.status === 'archived' ? 'archived' : 'favorite',
      type: 'calculation',
      title: String(source?.title || 'Без названия').slice(0, 80),
      items: normalizeItems(source?.items),
      profile: normalizeProfile(source?.profile || fallbackProfile),
      fx: source?.fx ? clone(source.fx) : fallbackFx ? clone(fallbackFx) : null,
      displayUnit: source?.displayUnit || 'hours'
    };
  }

  function normalizeProject(source, fallbackProfile, fallbackFx) {
    const createdAt = source?.createdAt || source?.date || new Date().toISOString();
    return {
      id: source?.id || uid('project'),
      createdAt,
      updatedAt: source?.updatedAt || createdAt,
      archivedAt: source?.archivedAt || null,
      status: source?.status === 'archived' ? 'archived' : 'active',
      type: 'project',
      title: String(source?.title || 'Большой план').slice(0, 80),
      displayUnit: source?.displayUnit || 'hours',
      calculations: (Array.isArray(source?.calculations) ? source.calculations : []).map((calculation) => {
        const normalized = normalizeCalculation(calculation, fallbackProfile, fallbackFx);
        if (!Object.hasOwn(calculation || {}, 'sourceId')) normalized.sourceId = calculation?.id || null;
        return normalized;
      })
    };
  }

  function blankState() {
    return {
      schema: 3,
      profile: null,
      fx: null,
      calculations: [],
      projects: [],
      settings: { magic: true, jokes: true },
      onboarding: {
        meaningVersionSeen: 0,
        wheelLearned: false
      },
      sort: { calculations: 'new', projects: 'new' },
      migratedAt: null
    };
  }

  function normalizeState(source) {
    const state = blankState();
    state.profile = normalizeProfile(source?.profile);
    state.fx = source?.fx ? clone(source.fx) : null;
    state.calculations = (Array.isArray(source?.calculations) ? source.calculations : []).map((item) => normalizeCalculation(item, state.profile, state.fx));
    state.projects = (Array.isArray(source?.projects) ? source.projects : []).map((item) => normalizeProject(item, state.profile, state.fx));
    state.settings.magic = source?.settings?.magic !== false;
    state.settings.jokes = source?.settings?.jokes !== false;
    state.onboarding.meaningVersionSeen = Math.max(0, Number(source?.onboarding?.meaningVersionSeen) || 0);
    state.onboarding.wheelLearned = source?.onboarding?.wheelLearned === true;
    for (const type of ['calculations', 'projects']) {
      const order = source?.sort?.[type];
      if (['new', 'old', 'name', 'timeAsc', 'timeDesc'].includes(order)) state.sort[type] = order;
    }
    state.migratedAt = source?.migratedAt || null;
    return state;
  }

  function migrateLegacy() {
    const state = blankState();
    state.profile = normalizeProfile(readFirst(LEGACY.profile));
    state.fx = readFirst(LEGACY.fx);
    const calculations = readFirst(LEGACY.calculations, []);
    const projects = readFirst(LEGACY.projects, []);
    state.calculations = (Array.isArray(calculations) ? calculations : []).map((item) => normalizeCalculation(item, state.profile, state.fx));
    state.projects = (Array.isArray(projects) ? projects : []).map((item) => normalizeProject(item, state.profile, state.fx));

    if (!state.calculations.length && !state.projects.length) {
      const legacySaved = readFirst(LEGACY.saved, []);
      for (const item of Array.isArray(legacySaved) ? legacySaved : []) {
        if (item?.type === 'project') {
          const calculation = normalizeCalculation(item, state.profile, state.fx);
          state.projects.push(normalizeProject({
            title: item.title || 'Большой план',
            date: item.date,
            calculations: [calculation]
          }, state.profile, state.fx));
        } else {
          state.calculations.push(normalizeCalculation(item, state.profile, state.fx));
        }
      }
    }
    state.migratedAt = new Date().toISOString();
    save(state);
    return state;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return migrateLegacy();
      const current = JSON.parse(raw);
      if (!current || !Array.isArray(current.calculations) || !Array.isArray(current.projects)) throw new Error('Invalid saved state');
      if ((current.schema || 2) < 3 && !localStorage.getItem(BACKUP_KEY)) {
        // Keep the exact pre-upgrade bytes before the first 3.0 write.
        localStorage.setItem(BACKUP_KEY, raw);
      }
      return normalizeState(current);
    } catch {
      writable = false;
      warning = 'Не удалось безопасно прочитать данные или сохранить резервную копию. Старые данные не перезаписаны. Освободи место на устройстве и открой MyRate снова.';
      // If just the backup failed, existing readable data remains available.
      try { return normalizeState(JSON.parse(localStorage.getItem(KEY))); }
      catch { return blankState(); }
    }
  }

  function save(state) {
    if (!writable) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(normalizeState(state)));
      return true;
    } catch {
      return false;
    }
  }

  function clearAll() {
    localStorage.removeItem(KEY);
  }

  return { KEY, BACKUP_KEY, get warning() { return warning; }, load, save, clearAll, normalizeProfile, normalizeCalculation, normalizeProject, clone, uid };
})();
