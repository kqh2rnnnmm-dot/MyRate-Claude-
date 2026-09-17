window.MyRateCalculator = (() => {
  const cfg = window.MyRateConfig;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Допущения честной ставки. Это значения по умолчанию, а не вопросы:
  // профиль по-прежнему спрашивает только сумму, период, дни и часы.
  function assumptions() {
    return cfg.assumptions || { taxRate: 13, vacationDays: 28, commuteHours: 0 };
  }

  function normalizeProfile(source = {}) {
    source = source || {};
    const currencyMap = { '₽': 'RUB', '$': 'USD', '€': 'EUR', '₪': 'ILS', '£': 'GBP' };
    const defaults = assumptions();
    return {
      income: finite(source.income),
      currency: currencyMap[source.currency] || source.currency || 'RUB',
      period: source.period || source.incomePeriod || 'month',
      days: finite(source.days ?? source.daysPerWeek, 5),
      hours: finite(source.hours ?? source.hoursPerDay, 8),
      taxRate: clamp(finite(source.taxRate, defaults.taxRate), 0, 60),
      vacationDays: clamp(finite(source.vacationDays, defaults.vacationDays), 0, 200),
      commuteHours: clamp(finite(source.commuteHours, defaults.commuteHours), 0, 12)
    };
  }

  function monthlyIncome(profileSource) {
    const profile = normalizeProfile(profileSource);
    if (profile.period === 'day') return profile.income * profile.days * cfg.weeksPerYear / cfg.monthsPerYear;
    if (profile.period === 'week') return profile.income * cfg.weeksPerYear / cfg.monthsPerYear;
    if (profile.period === 'year') return profile.income / cfg.monthsPerYear;
    return profile.income;
  }

  function monthlyNetIncome(profileSource) {
    const profile = normalizeProfile(profileSource);
    return monthlyIncome(profile) * (1 - profile.taxRate / 100);
  }

  function workdaysPerMonth(profileSource) {
    const profile = normalizeProfile(profileSource);
    return Math.max(0, profile.days * cfg.weeksPerYear - profile.vacationDays) / cfg.monthsPerYear;
  }

  // Проданное время: часы за столом плюс часы дороги.
  function monthlyHours(profileSource) {
    const profile = normalizeProfile(profileSource);
    return workdaysPerMonth(profile) * (profile.hours + profile.commuteHours);
  }

  function hourlyRate(profileSource) {
    const hours = monthlyHours(profileSource);
    return hours > 0 ? monthlyNetIncome(profileSource) / hours : 0;
  }

  function rateDetails(profileSource) {
    const profile = normalizeProfile(profileSource);
    return {
      rate: hourlyRate(profile),
      taxRate: profile.taxRate,
      vacationDays: profile.vacationDays,
      commuteHours: profile.commuteHours,
      currency: profile.currency
    };
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

  function plural(number, forms) {
    if (!Number.isInteger(number)) return forms[1];
    const a = Math.abs(number) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  function smartParts(value, unit) {
    const number = Number(value);
    if (!Number.isFinite(number)) return { number: '—', label: 'нужен курс валют', text: 'Нужен курс валют' };
    const absolute = Math.abs(number);
    const digits = unit === 'minutes' || absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
    const formatted = formatNumber(number, digits);
    const label = cfg.unitShort[unit] || '';
    return { number: formatted, label, text: `${formatted} ${label}`.trim() };
  }

  function smart(value, unit) {
    return smartParts(value, unit).text;
  }

  // Второй ценник словами: «26 рабочих дней · 1,2 рабочих месяца».
  function equivalentsLine(hoursValue, profileSource, exclude = 'hours') {
    const hours = finite(hoursValue, NaN);
    if (!Number.isFinite(hours) || hours <= 0) return '';
    const days = unitValue(hours, 'days', profileSource);
    const months = unitValue(hours, 'months', profileSource);
    const parts = [];
    if (exclude !== 'days' && Number.isFinite(days) && days >= 1) {
      const shown = days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
      parts.push(formatNumber(shown, 1) + ' ' + plural(shown, ['рабочий день', 'рабочих дня', 'рабочих дней']));
    }
    if (exclude !== 'months' && Number.isFinite(months) && months >= 1) {
      const shown = months >= 10 ? Math.round(months) : Math.round(months * 10) / 10;
      parts.push(formatNumber(shown, 1) + ' ' + plural(shown, ['рабочий месяц', 'рабочих месяца', 'рабочих месяцев']));
    }
    if (!parts.length && exclude !== 'minutes') {
      const minutes = Math.round(hours * 60);
      parts.push(formatNumber(minutes, 0) + ' ' + plural(minutes, ['минута', 'минуты', 'минут']));
    }
    return parts.join(' · ');
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
    monthlyNetIncome,
    workdaysPerMonth,
    monthlyHours,
    hourlyRate,
    rateDetails,
    toBase,
    itemSummary,
    calculationSummary,
    projectSummary,
    unitValue,
    formatNumber,
    plural,
    smartParts,
    smart,
    equivalentsLine,
    money,
    isValidProfile
  };
})();
