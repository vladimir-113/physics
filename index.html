// Физика ядерного взрыва (упрощённые модели для образовательных целей).
// Источники формул: Glasstone & Dolan "The Effects of Nuclear Weapons" (1977),
// модель NUKEMAP, открытые материалы по cube-root scaling.

import { MATERIALS, ASSEMBLY_TYPES } from '../data/materials.js';

// Энергия 1 кт ТНТ в джоулях.
export const KT_TO_JOULES = 4.184e12;

// Энергия одного деления в джоулях (1 МэВ = 1.602e-13 Дж).
const MEV_TO_JOULES = 1.602e-13;

// Число Авогадро (для подсчёта числа атомов в массе материала).
const AVOGADRO = 6.022e23;

/**
 * Рассчитать мощность бомбы (кт) из конфигурации.
 * @param {string} materialId - id материала
 * @param {number} massKg - масса делящегося материала
 * @param {string} assemblyId - схема подрыва
 * @returns {object} { yieldKt, efficiency, atomsFissioned, fraction, warnings }
 */
export function calculateYield(materialId, massKg, assemblyId) {
  const mat = MATERIALS[materialId];
  const asm = ASSEMBLY_TYPES[assemblyId];
  const warnings = [];

  if (!mat || !asm) {
    return { yieldKt: 0, efficiency: 0, atomsFissioned: 0, fraction: 0, warnings: ['Неизвестный материал или схема'] };
  }

  // Тротил — отдельный случай, без ядерной физики.
  if (mat.isConventional) {
    return {
      yieldKt: massKg / 1e6,  // 1 кт = миллион кг тротила
      efficiency: 1.0,
      atomsFissioned: 0,
      fraction: 1.0,
      warnings: ['Обычная взрывчатка, без ядерной реакции'],
    };
  }

  // Проверка совместимости материала и схемы.
  if (!asm.compatible.includes(materialId)) {
    warnings.push(`${mat.name} несовместим со схемой "${asm.name}"`);
    return { yieldKt: 0, efficiency: 0, atomsFissioned: 0, fraction: 0, warnings };
  }

  // Минимальная масса для устойчивой реакции (с учётом схемы).
  const minMass = mat.criticalMass * asm.minMassFactor;
  if (massKg < minMass) {
    warnings.push(`Масса ниже минимальной для ${asm.name} (${minMass.toFixed(1)} кг)`);
    return { yieldKt: 0, efficiency: 0, atomsFissioned: 0, fraction: 0, warnings };
  }

  // КПД зависит от того, насколько масса превышает критическую.
  // Эмпирически: при m ≈ minMass КПД ~0, при m > 1.2·m_crit ≈ почти полный.
  // Возводим в степень, чтобы низкомассовые конфигурации давились сильнее
  // (без этого Davy Crockett на 5.5 кг Pu давал бы 14 кт вместо 0.02).
  const massRatio = massKg / mat.criticalMass;
  const rawBoost  = Math.max(0, 1 - Math.exp(-(massRatio - asm.minMassFactor) * 4));
  const massBoost = Math.pow(rawBoost, 1.5);

  const efficiency = Math.min(0.4,
    mat.typicalEfficiency * asm.efficiencyMultiplier * massBoost
  );

  // Молярная масса (приближённо равна массовому числу).
  const molarMass = parseInt(materialId.replace(/\D/g, ''), 10);

  // Сколько атомов в исходной массе и сколько прореагировало.
  const totalAtoms = (massKg * 1000 / molarMass) * AVOGADRO;
  const atomsFissioned = totalAtoms * efficiency;

  // Энергия деления.
  let totalEnergy = atomsFissioned * mat.energyPerFission * MEV_TO_JOULES;

  // Термоядерная ступень — синтез поджигается первичным зарядом и многократно
  // увеличивает суммарное энерговыделение. Множитель ×30 — типичный для
  // двухступенчатой бомбы (например, у W88 деление даёт ~10 кт, синтез ~465 кт).
  if (asm.requiresFusion && asm.fusionMultiplier) {
    totalEnergy *= asm.fusionMultiplier;
  }

  const yieldKt = totalEnergy / KT_TO_JOULES;

  return {
    yieldKt,
    efficiency,
    atomsFissioned,
    fraction: efficiency,
    warnings,
  };
}

/**
 * Рассчитать радиусы поражения по мощности и сценарию.
 * Все радиусы — в километрах.
 *
 * Формулы — упрощённый cube-root scaling:
 *   R = K · Y^(1/3),  где Y — мощность в кт.
 * Коэффициенты K подобраны под классические данные (Glasstone).
 */
export function calculateEffects(yieldKt, scenario) {
  if (yieldKt <= 0) {
    return { fireball: 0, severeBlast: 0, moderateBlast: 0, lightBlast: 0, thermal: 0, radiation: 0, fallout: 0 };
  }

  const Y13 = Math.pow(yieldKt, 1/3);
  const blastMul = scenario ? scenario.blastRadiusMultiplier : 1.0;
  const falloutMul = scenario ? scenario.falloutMultiplier : 0.5;

  return {
    // Огненный шар (полное испарение).
    fireball: 0.05 * Y13,
    // 20 psi — полное разрушение бетонных зданий.
    severeBlast: 0.27 * Y13 * blastMul,
    // 5 psi — кирпичные дома обрушены, лет. от обломков.
    moderateBlast: 0.55 * Y13 * blastMul,
    // 1 psi — выбиты окна, ранения от стекла.
    lightBlast: 1.10 * Y13 * blastMul,
    // Тепловое излучение — ожоги 3-й степени.
    thermal: 1.20 * Y13,
    // Проникающая радиация (только важна для малых зарядов).
    radiation: 0.40 * Y13,
    // Радиоактивные осадки (только при наземном/малой высоте).
    fallout: 4.0 * Y13 * falloutMul,
  };
}

/**
 * Оценить число жертв на круге заданного радиуса при средней плотности.
 * Очень грубо: число зданий/людей × коэффициент летальности.
 */
export function estimateCasualties(effects, populationDensity) {
  // populationDensity: чел/км²
  const dens = populationDensity || 5000; // средняя плотность городской застройки
  const piR2 = (r) => Math.PI * r * r;

  // Доля летальных в разных зонах.
  const deadInFireball  = piR2(effects.fireball)     * dens * 1.0;
  const deadInSevere    = (piR2(effects.severeBlast)    - piR2(effects.fireball))     * dens * 0.9;
  const deadInModerate  = (piR2(effects.moderateBlast)  - piR2(effects.severeBlast))  * dens * 0.5;
  const woundedInLight  = (piR2(effects.lightBlast)     - piR2(effects.moderateBlast)) * dens * 0.4;
  const burnedThermal   = (piR2(effects.thermal)        - piR2(effects.severeBlast))   * dens * 0.3;

  return {
    dead: Math.round(deadInFireball + deadInSevere + deadInModerate),
    wounded: Math.round(woundedInLight + burnedThermal),
    affected: Math.round(piR2(effects.lightBlast) * dens),
  };
}

/**
 * Зоны для отрисовки на карте и в боковой панели.
 * Порядок важен: рисуются от больших к маленьким, чтобы маленькие были сверху.
 */
export const ZONES = [
  { key: 'lightBlast',    name: 'Лёгкие разрушения',     color: '#90a4ae', desc: 'Выбиты стёкла, ранения от осколков. ~1 psi.' },
  { key: 'thermal',       name: 'Тепловые ожоги',        color: '#ff7e36', desc: 'Ожоги 3-й степени, массовые пожары.' },
  { key: 'moderateBlast', name: 'Серьёзные разрушения', color: '#ffd54f', desc: 'Кирпичные дома повреждены. ~5 psi.' },
  { key: 'radiation',     name: 'Смертельная радиация', color: '#ffb800', desc: 'Острая лучевая болезнь. >500 рад.' },
  { key: 'severeBlast',   name: 'Полное разрушение',    color: '#ff5722', desc: 'Бетонные здания обрушены. ~20 psi.' },
  { key: 'fireball',      name: 'Огненный шар',         color: '#ff2d2d', desc: 'Температура свыше миллиона °C.' },
];

/**
 * Точки наблюдения — что увидит человек на разных расстояниях.
 */
export function getObservationEffects(distanceKm, effects) {
  const events = [];
  if (distanceKm <= effects.fireball) {
    events.push({ severity: 'fatal', text: 'Полное испарение. Не остаётся ничего.' });
  } else if (distanceKm <= effects.severeBlast) {
    events.push({ severity: 'fatal', text: 'Здание обрушено. Выживание — 0%.' });
    events.push({ severity: 'fatal', text: 'Тепловое излучение поджигает всё горючее.' });
  } else if (distanceKm <= effects.moderateBlast) {
    events.push({ severity: 'severe', text: 'Стены трескаются и обрушиваются. Тяжёлые травмы.' });
    events.push({ severity: 'severe', text: 'Ожоги 3-й степени на открытой коже.' });
  } else if (distanceKm <= effects.thermal) {
    events.push({ severity: 'moderate', text: 'Сильные ожоги, пожары от теплового импульса.' });
    events.push({ severity: 'moderate', text: 'Окна вылетают, лёгкие травмы от обломков.' });
  } else if (distanceKm <= effects.lightBlast) {
    events.push({ severity: 'light', text: 'Стёкла вылетают через несколько секунд после вспышки.' });
    events.push({ severity: 'light', text: 'Возможны порезы от осколков.' });
  } else {
    events.push({ severity: 'safe', text: 'Видна вспышка и грибовидное облако.' });
    events.push({ severity: 'safe', text: 'Ударная волна доходит как далёкий гром.' });
  }
  // Время прихода ударной волны (скорость звука ~340 м/с).
  const blastDelaySec = (distanceKm * 1000) / 340;
  events.push({ severity: 'info', text: `Ударная волна доходит через ${blastDelaySec.toFixed(1)} секунд.` });
  return events;
}

// Утилиты форматирования.
export function formatYield(kt) {
  if (kt < 0.001) return (kt * 1e6).toFixed(0) + ' кг ТНТ';
  if (kt < 1)     return (kt * 1000).toFixed(0) + ' т';
  if (kt < 1000)  return kt.toFixed(kt < 10 ? 1 : 0) + ' кт';
  return (kt / 1000).toFixed(kt < 10000 ? 1 : 0) + ' Мт';
}

export function formatRadius(km) {
  if (km < 1) return (km * 1000).toFixed(0) + ' м';
  return km.toFixed(km < 10 ? 2 : 1) + ' км';
}

export function formatNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' млн';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' тыс';
  return n.toString();
}

// Перевод слайдера (логарифмическая шкала) в кт.
export function sliderToYield(s, min = 0.1, max = 100000) {
  const minLog = Math.log10(min);
  const maxLog = Math.log10(max);
  return Math.pow(10, minLog + (s / 100) * (maxLog - minLog));
}

export function yieldToSlider(kt, min = 0.1, max = 100000) {
  const minLog = Math.log10(min);
  const maxLog = Math.log10(max);
  return ((Math.log10(kt) - minLog) / (maxLog - minLog)) * 100;
}
