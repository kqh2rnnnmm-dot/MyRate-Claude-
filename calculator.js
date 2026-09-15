window.MyRateCalculator = (() => {
  const cfg = window.MyRateConfig;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeProfile(source = {}) {
    source = source || {};
    const currencyMap = { '₽': 'RUB', '$': 'USD', '€': 'EUR', '₪': 'ILS', '£': 'GBP' };
    return {
      income: finite(source.income),
      currency: currencyMap[source.currency] || source.currency || 'RUB',
      period: source.period || source.incomePeriod || 'month',
      days: finite(source.days ?? source.daysPerWeek, 5),
      hours: finite(source.hours ?? source.hoursPerDay, 8)
    };
  }

  function monthlyIncome(profileSource) {
    const profile = normalizeProfile(profileSource);
    if (profile.period === 'day') return profile.income * profile.days * cfg.weeksPerYear / cfg.monthsPerYear;
    if (profile.period === 'week') return profile.income * cfg.weeksPerYear / cfg.monthsPerYear;
    if (profile.period === 'year') return profile.income / cfg.monthsPerYear;
    return profile.income;
  }

  function monthlyHours(profileSource) {
    const profile = normalizeProfile(profileSource);
    return profile.days * profile.hours * cfg.weeksPerYear / cfg.monthsPerYear;
  }

  function hourlyRate(profileSource) {
    const hours = monthlyHours(profileSource);
    return hours > 0 ? monthlyIncome(profileSource) / hours : 0;
  }

  function toBase(amount, currency, profileSource, fx) {
    const profile = normalizeProfile(profileSource);
    const value = finite(amount, NaN);
    if (!Number.isFinite(value)) return NaN;
    if (currency === profile.currency) return value;
    if (!fx || fx.base !== profile.currency || !Number.isFinite(Number(fx.rates?.[currency])) || Number(fx.rates[currency]) <= 0) return NaN;
    return value / Number(fx.rates[currency]);
  }

  function itemSummary(item, profileSource, fx) {
    const profile = normalizeProfile(profileSource);
    const amount = finite(item.price) * finite(item.qty, 1);
    const baseMoney = toBase(amount, item.currency || profile.currency, profile, fx);
    const rate = hourlyRate(profile);
    const hours = rate > 0 && Number.isFinite(baseMoney) ? baseMoney / rate : NaN;
    return { hours, money: baseMoney };
  }

  function calculationSummary(calculation, fallbackProfile = null, fallbackFx = null) {
    const profile = normalizeProfile(calculation?.profile || fallbackProfile || {});
    const fx = calculation?.fx || fallbackFx || null;
    let hours = 0;
    let money = 0;
    for (const item of calculation?.items || []) {
      const summary = itemSummary(item, profile, fx);
      if (!Number.isFinite(summary.hours)) hours = NaN;
      else if (Number.isFinite(hours)) hours += summary.hours;
      if (!Number.isFinite(summary.money)) money = NaN;
      else if (Number.isFinite(money)) money += summary.money;
    }
    return { hours, money, profile };
  }

  function projectSummary(project, fallbackProfile = null, fallbackFx = null) {
    let hours = 0;
    let money = 0;
    const calculations = project?.calculations || [];
    for (const calculation of calculations) {
      const summary = calculationSummary(calculation, fallbackProfile, fallbackFx);
      if (!Number.isFinite(summary.hours)) hours = NaN;
      else if (Number.isFinite(hours)) hours += summary.hours;
      if (!Number.isFinite(summary.money)) money = NaN;
      else if (Number.isFinite(money)) money += summary.money;
    }
    return { hours, money };
  }

  function unitValue(hoursValue, unit, profileSource) {
    const hours = finite(hoursValue, NaN);
    const profile = normalizeProfile(profileSource);
    if (!Number.isFinite(hours)) return NaN;
    if (unit === 'minutes') return hours * 60;
    if (unit === 'days') return profile.hours > 0 ? hours / profile.hours : NaN;
    if (unit === 'weeks') return profile.days > 0 && profile.hours > 0 ? hours / (profile.days * profile.hours) : NaN;
    if (unit === 'months') {
      const value = monthlyHours(profile);
      return value > 0 ? hours / value : NaN;
    }
    if (unit === 'years') {
      const value = profile.days * profile.hours * cfg.weeksPerYear;
      return value > 0 ? hours / value : NaN;
    }
    return hours;
  }

  function formatNumber(value, maxFraction = 2) {
    if (!Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: maxFraction }).format(Number(value));
  }

  function smart(value, unit) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Нужен курс валют';
    const absolute = Math.abs(number);
    const digits = unit === 'minutes' || absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
    return `${formatNumber(number, digits)} ${cfg.unitShort[unit] || ''}`.trim();
  }

  function money(value, currency) {
    return `${formatNumber(value, 2)} ${cfg.currencySymbols[currency] || currency || ''}`.trim();
  }

  function isValidProfile(profileSource) {
    const profile = normalizeProfile(profileSource);
    return profile.income > 0 && profile.days >= .5 && profile.days <= 7 && profile.hours >= .25 && profile.hours <= 24;
  }

  return {
    normalizeProfile,
    monthlyIncome,
    monthlyHours,
    hourlyRate,
    toBase,
    itemSummary,
    calculationSummary,
    projectSummary,
    unitValue,
    formatNumber,
    smart,
    money,
    isValidProfile
  };
})();
