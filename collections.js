/* MyRate 3.0: pure collection operations. Originals and plan snapshots are never mutated here. */
window.MyRateCollections = (() => {
  'use strict';
  const S = MyRateStorage, Calc = MyRateCalculator;
  const now = () => new Date().toISOString();
  const titleOf = items => items.map(x => x.name).slice(0, 2).join(' + ').slice(0, 80);

  function card(items, profile, fx, unit = 'hours', title = titleOf(items)) {
    return { id: S.uid('calc'), sourceId: null, createdAt: now(), updatedAt: now(),
      archivedAt: null, status: 'favorite', type: 'calculation', title,
      items: S.clone(items), profile: S.clone(profile), fx: fx ? S.clone(fx) : null, displayUnit: unit };
  }

  function plan(cards, title, unit = 'hours', linkSources = true) {
    return { id: S.uid('project'), createdAt: now(), updatedAt: now(), archivedAt: null,
      status: 'active', type: 'project', title, displayUnit: unit,
      calculations: cards.map(c => ({ ...S.clone(c), id: S.uid('pc'),
        sourceId: linkSources ? c.id : null, status: 'favorite', archivedAt: null })) };
  }

  function split(source) {
    return source.items.map(item => card([{ ...S.clone(item), id: S.uid('item') }],
      source.profile, source.fx, source.displayUnit, item.name));
  }

  function sorted(list, order, project = false) {
    const hours = x => project ? Calc.projectSummary(x).hours : Calc.calculationSummary(x).hours;
    return [...list].sort((a, b) => {
      if (order === 'name') return a.title.localeCompare(b.title, 'ru', { numeric: true });
      if (order === 'timeAsc' || order === 'timeDesc') {
        const av = hours(a), bv = hours(b);
        if (!Number.isFinite(av)) return Number.isFinite(bv) ? 1 : 0;
        if (!Number.isFinite(bv)) return -1;
        return (av - bv) * (order === 'timeAsc' ? 1 : -1);
      }
      return ((Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)) * (order === 'old' ? 1 : -1);
    });
  }

  const normalizeText = s => String(s || '').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
  function search(state, query, scope = 'all') {
    const q = normalizeText(query);
    if ([...q].length < 2) return [];
    const terms = q.split(/\s+/);
    const result = [];
    for (const type of ['calculations', 'projects']) {
      for (const entry of state[type]) {
        const group = entry.status === 'archived' ? 'archive' : type === 'projects' ? 'projects' : 'favorites';
        if (scope !== 'all' && group !== scope) continue;
        const details = type === 'projects' ? entry.calculations.flatMap(c => [c.title, ...c.items.map(x => x.name)]) : entry.items.map(x => x.name);
        const text = normalizeText([entry.title, ...details].join(' '));
        if (terms.every(term => text.includes(term))) {
          const matching = details.filter(d => terms.some(term => normalizeText(d).includes(term)));
          result.push({ id: entry.id, type, group, title: entry.title,
            description: (matching.length ? matching : details).join(' · '),
            rank: normalizeText(entry.title).includes(q) ? 0 : 1 });
        }
      }
    }
    return result.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, 'ru'));
  }
  return { card, plan, split, sorted, search };
})();
