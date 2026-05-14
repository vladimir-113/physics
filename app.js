// ===================================================================
//   FISSION-CTRL · ядерный симулятор
//   physics + map + 3d
// ===================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===================================================================
//  CONSTANTS & DATA
// ===================================================================

// Голая критическая масса (кг) при нормальной плотности, 100% обогащение
const CRIT_BARE = {
  u235: 52,     // U-235
  pu239: 10,    // Pu-239 α-фаза
  u233: 16,     // U-233
};

// Плотность (г/см³)
const DENSITY = {
  u235: 19.1,
  pu239: 19.84,
  u233: 18.7,
};

// Сколько ν нейтронов на деление
const NU = {
  u235: 2.42,
  pu239: 2.88,
  u233: 2.49,
};

// Энергия деления (МэВ/деление) — у всех примерно одинаково
const E_FISSION_MEV = 200;
// 1 кт ТНТ = 4.184e12 Дж
const KT_J = 4.184e12;
// Энергия от 1 кг полностью разделившегося U-235 ≈ 17 кт
const E_PER_KG_KT = 17;

// Тамперы: множитель снижения крит. массы
const TAMPER = {
  none:       { mult: 1.0,  label: 'Нет' },
  be:         { mult: 0.55, label: 'Бериллий' },
  u238:       { mult: 0.45, label: 'U-238' },
  w:          { mult: 0.50, label: 'Вольфрам' },
  u238_thick: { mult: 0.35, label: 'U-238 толстый' },
};

// Города — координаты + население (для сводки)
const CITIES = [
  { name: 'Москва',       lat: 55.7558, lon: 37.6173 },
  { name: 'Нью-Йорк',     lat: 40.7128, lon: -74.0060 },
  { name: 'Токио',        lat: 35.6762, lon: 139.6503 },
  { name: 'Лондон',       lat: 51.5074, lon: -0.1278 },
  { name: 'Париж',        lat: 48.8566, lon: 2.3522 },
  { name: 'Пекин',        lat: 39.9042, lon: 116.4074 },
  { name: 'Дели',         lat: 28.6139, lon: 77.2090 },
  { name: 'Сан-Паулу',    lat: -23.5505, lon: -46.6333 },
  { name: 'Стамбул',      lat: 41.0082, lon: 28.9784 },
  { name: 'Хиросима',     lat: 34.3853, lon: 132.4553 },
];

// Исторические образцы
const PRESETS = [
  {
    code: 'MK-1',
    name: 'Little Boy',
    sub: 'Хиросима · 6 авг 1945',
    yield: 15, // кт
    type: 'fission', assembly: 'gun', fuel: 'u235',
    mass: 64, enrich: 80, tamper: 'w', init: 'pobe',
    eff: 1.4,
    desc: 'Гун-тип на U-235. Кусок урана выстреливается в кольцо. Простейшая схема — США не стали даже испытывать её перед боевым применением. КПД крайне низкий (~1.4%): из 64 кг урана разделилось менее 1 кг.',
    history: 'Сброшена с B-29 «Enola Gay». Подрыв на высоте 580 м. Около 80 000 погибли в момент взрыва, ещё столько же — в последующие месяцы от ожогов и лучевой болезни.',
    construction: 'Длина 3 м, масса 4400 кг. «Снаряд» массой 38 кг + «мишень» 26 кг. Сборка на скорости 300 м/с пороховой пушкой.'
  },
  {
    code: 'MK-3',
    name: 'Fat Man',
    sub: 'Нагасаки · 9 авг 1945',
    yield: 21,
    type: 'fission', assembly: 'implosion', fuel: 'pu239',
    mass: 6.2, enrich: 93, tamper: 'u238', init: 'pobe',
    eff: 17,
    desc: 'Имплозивная схема на плутонии. 32-сегментная взрывная линза сжимает плутониевый пит. КПД в 12 раз выше Little Boy на 10× меньшей массе топлива.',
    history: 'Сброшена с B-29 «Bockscar». Подрыв на высоте 503 м над Нагасаки. ~40 000 погибших в момент, ~30 000 — позже.',
    construction: 'Сферическая форма Ø 1.5 м. Внутри: 6.2 кг δ-фазы Pu-239 + U-238 тампер + 2.5 т взрывчатки (composition B + baratol).'
  },
  {
    code: 'RDS-220',
    name: 'Царь-Бомба',
    sub: 'Новая Земля · 30 окт 1961',
    yield: 50000,
    type: 'thermo', assembly: 'implosion', fuel: 'pu239',
    mass: 12, enrich: 93, tamper: 'u238', init: 'pobe',
    boost: 4, thermo: 350,
    eff: 40,
    desc: 'Трёхступенчатая термоядерная бомба. Самое мощное устройство, когда-либо взорванное человеком. Изначально проект на 100 Мт, но свинцовая оболочка (вместо U-238) снизила выход вдвое для уменьшения радиоактивных осадков.',
    history: 'Подрыв на высоте 4000 м над архипелагом Новая Земля. Огненный шар Ø 8 км. Гриб поднялся на 67 км. Ударная волна обошла Землю 3 раза. КПД одной только термоядерной ступени — 97%.',
    construction: 'Длина 8 м, масса 27 т. Первичка — урановая имплозия. Вторичка — литий-6 дейтерид + плутониевая «свеча зажигания». Третичка — ещё одна термоядерная ступень.'
  },
  {
    code: 'B-83',
    name: 'B83',
    sub: 'США · современная',
    yield: 1200,
    type: 'thermo', assembly: 'implosion', fuel: 'pu239',
    mass: 4, enrich: 94, tamper: 'u238', init: 'ent',
    boost: 2.5, thermo: 8,
    eff: 35,
    desc: 'Мощнейшее ядерное оружие современного арсенала США. Двухступенчатая термоядерная бомба переменной мощности (dial-a-yield: от низкой до 1.2 Мт).',
    history: 'На вооружении с 1983 г. ~650 единиц в активном запасе.',
    construction: 'Длина 3.7 м, масса 1100 кг. Первичная ступень — бустированный имплозивный заряд. Вторичная — Teller-Ulam с радиационной имплозией.'
  },
  {
    code: 'W-88',
    name: 'W88',
    sub: 'Боеголовка Trident II',
    yield: 475,
    type: 'thermo', assembly: 'implosion', fuel: 'pu239',
    mass: 3, enrich: 93, tamper: 'u238', init: 'ent',
    boost: 2, thermo: 3.5,
    eff: 30,
    desc: 'Боеголовка для БРПЛ Trident II D5. До 14 W88 на одной ракете. Считается наиболее технически продвинутой американской боеголовкой.',
    history: 'Разработка 1983–88. Конусная форма (RV). КВО ~90 м после полёта 11000 км.',
    construction: 'Конусная боеголовка длиной ~1.75 м. Первичка с уменьшенной массой Pu. Вторичка в верхней (носовой) части — нестандартное размещение.'
  },
  {
    code: 'RDS-1',
    name: 'РДС-1',
    sub: 'Семипалатинск · 29 авг 1949',
    yield: 22,
    type: 'fission', assembly: 'implosion', fuel: 'pu239',
    mass: 6.2, enrich: 93, tamper: 'u238', init: 'pobe',
    eff: 17,
    desc: 'Первая советская атомная бомба. Полная копия Fat Man по данным разведки (Клаус Фукс).',
    history: 'Подрыв на стальной башне высотой 30 м на Семипалатинском полигоне. Знаменовала конец американской монополии.',
    construction: 'Аналогично Fat Man — сферическая имплозия Pu-239 с U-238 тампером.'
  },
];

// Тестовый сетап — для дефолта
let state = {
  type: 'fission',
  assembly: 'implosion',
  fuel: 'pu239',
  mass: 6.2,
  enrich: 93,
  tamper: 'u238',
  init: 'pobe',
  boost: 0,
  thermo: 0,
  yieldKt: 0,
  eff: 0,
  city: null,
  lat: null,
  lon: null,
  burst: 'air',
  hob: 580,
  presetEffOverride: null,
};

// ===================================================================
//  PHYSICS COMPUTATION
// ===================================================================

function computeYield() {
  // Эффективное обогащение
  const enrichFactor = state.enrich / 100;

  // Критическая масса с тампером
  const tamperMult = TAMPER[state.tamper].mult;
  const critBare = CRIT_BARE[state.fuel];
  const critWithTamper = critBare * tamperMult;
  // Поправка на обогащение: для меньшего обогащения крит. масса резко растёт
  const enrichPenalty = enrichFactor < 0.9 ? Math.pow(enrichFactor, -2.5) : 1 / enrichFactor;
  const critEff = critWithTamper * enrichPenalty;

  // Эффективная масса делящегося материала
  const fissileMass = state.mass * enrichFactor;
  const critCount = fissileMass / critEff;

  // k_eff (упрощ.): надкритичность зависит от того, насколько мы превышаем крит. массу
  // Также от плотности (для имплозии — выше эффективная плотность)
  const densityBoost = state.assembly === 'implosion' ? 1.8 : 1.0;
  const effectiveDensityFactor = densityBoost; // ρ²-эффект для сжатой сборки
  const keffOverflow = critCount * effectiveDensityFactor;
  let keff = 0;
  if (keffOverflow < 1) keff = keffOverflow * 0.95;
  else keff = 1 + Math.log(keffOverflow) * 0.4;
  keff = Math.min(keff, 2.2);

  // Скорость сборки
  // gun-type: ~300 м/с -> ~10⁻³ с до критичности (с U-235 нормально)
  // implosion: 8000 м/с -> ~10⁻⁶ с (микросекунды) — нужно для Pu-239 с высокой ν
  let assemblySpeed = state.assembly === 'gun' ? 300 : 8000; // м/с
  let assemblyTime = state.assembly === 'gun' ? 1e-3 : 1e-6; // с

  // Предетонация (физзл) — плутоний в gun-type из-за высокой спонтанной скорости делений
  let fizzle = false;
  if (state.fuel === 'pu239' && state.assembly === 'gun') {
    fizzle = true;
  }
  // Очень низкая надкритичность
  if (critCount < 1.1) fizzle = true;

  // КПД деления (упрощ. формула Бете)
  // η ≈ (Δk · α)^(3/2), нормируем чтобы Fat Man давал ~17%
  let efficiency = 0;
  if (keff > 1) {
    const dk = keff - 1;
    const alpha = state.assembly === 'implosion' ? 1.5 : 0.7;
    efficiency = Math.pow(dk * alpha, 1.5) * 0.20;
    efficiency = Math.min(efficiency, 0.40);
  }
  if (fizzle) efficiency = Math.min(efficiency, 0.003);

  // Бустинг (D-T газ): сильно увеличивает η до разлёта
  if (state.type === 'boosted' && state.boost > 0) {
    const boostFactor = 1 + (state.boost / 4) * 1.2; // x2-x3
    efficiency = Math.min(efficiency * boostFactor, 0.45);
  }

  // Базовый выход первичной ступени (кт)
  // Y = m_fissile × η × 17 (кт/кг)
  let primaryYield = fissileMass * efficiency * E_PER_KG_KT;

  // Термоядерная ступень
  let thermoYield = 0;
  if (state.type === 'thermo' && state.thermo > 0) {
    // LiD: ~50 кт/кг при 100% реакции, реально ~30%
    // Также секонд. рассчитывается через первичную (нужна Δ ~10+ кт для зажигания)
    if (primaryYield >= 5) {
      thermoYield = state.thermo * 15; // эмпир.
    } else {
      // не зажглась
      thermoYield = state.thermo * 0.2;
    }
  }

  const totalYield = primaryYield + thermoYield;

  // Если есть override от пресета — используем его (для исторических совпадений)
  let finalYield = totalYield;
  if (state.presetEffOverride !== null) {
    finalYield = state.presetEffOverride;
    efficiency = (finalYield / (fissileMass * E_PER_KG_KT));
  }

  // Длина поколения нейтронов (примерно)
  const genTime = state.assembly === 'implosion' ? 8e-9 : 1.5e-8; // с
  // Количество поколений
  const gens = keff > 1 ? Math.ceil(Math.log(1e24) / Math.log(keff)) : 0;

  return {
    yieldKt: finalYield,
    efficiency: efficiency * 100,
    keff,
    critBare,
    critWithTamper,
    critCount: critCount,
    fizzle,
    assemblySpeed,
    assemblyTime,
    genTime,
    gens,
    primaryYield,
    thermoYield,
  };
}

// ===================================================================
//  DAMAGE ZONES (Glasstone/Dolan approximations)
// ===================================================================
function damageZones(yieldKt) {
  // Все радиусы в км, Y в кт
  const Y = Math.max(yieldKt, 0.001);
  const Y3 = Math.pow(Y, 1/3);

  // Огненный шар (радиус, км) — Glasstone fb radius for airburst
  const fireball = 0.11 * Math.pow(Y, 0.4);

  // 20 psi overpressure — тотальное разрушение бетонных зданий
  const overpressure20 = 0.28 * Y3;
  // 5 psi — разрушение жилых домов
  const overpressure5 = 0.65 * Y3;
  // 1 psi — выбитые стёкла, лёгкие травмы
  const overpressure1 = 2.2 * Y3;

  // Тепловая радиация
  // 3-й степ. ожоги: 8 кал/см² для 1 кт → радиус ∝ Y^0.41
  const thermal3 = 1.27 * Math.pow(Y, 0.41);
  const thermal2 = 1.90 * Math.pow(Y, 0.41);
  const thermal1 = 2.85 * Math.pow(Y, 0.41);

  // Проникающая радиация — практически только для малых Y (< 100 кт)
  const radiation500rem = 0.65 * Math.pow(Y, 0.19);

  // Высота гриба
  const cloudHeight = 6.5 * Math.pow(Y, 0.35); // км
  const cloudCap = 4.0 * Math.pow(Y, 0.35);    // диаметр шляпки, км

  // Оптимальная высота подрыва для макс. зоны 5 psi
  const hobOpt = 220 * Math.pow(Y, 0.33); // м

  return {
    fireball,
    overpressure20, overpressure5, overpressure1,
    thermal3, thermal2, thermal1,
    radiation500rem,
    cloudHeight, cloudCap,
    hobOpt,
  };
}

// ===================================================================
//  UI BINDINGS
// ===================================================================

// Tabs
const navBtns = document.querySelectorAll('.nav-btn');
navBtns.forEach(b => {
  b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    navBtns.forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tabContent === tab);
    });
    if (tab === 'target') setTimeout(() => map.invalidateSize(), 100);
    if (tab === 'sim') setTimeout(() => onResize3D(), 100);
  });
});

// Segmented buttons helper
function segGroup(rootId, key) {
  const root = document.getElementById(rootId);
  root.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      state[key] = btn.dataset.v;
      state.presetEffOverride = null;
      updateUI();
    });
  });
}
segGroup('segReaction', 'type');
segGroup('segAssembly', 'assembly');
segGroup('segFuel', 'fuel');
segGroup('segBurst', 'burst');

// Range bindings
['mass','enrich','boost','thermo','hob'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    state[id] = parseFloat(el.value);
    state.presetEffOverride = null;
    updateUI();
  });
});

document.getElementById('tamper').addEventListener('change', e => {
  state.tamper = e.target.value;
  state.presetEffOverride = null;
  updateUI();
});
document.getElementById('init').addEventListener('change', e => {
  state.init = e.target.value;
  updateUI();
});

// Map-of-labels
const REACTION_LABELS = { fission: 'Деление', boosted: 'Бустированное деление', thermo: 'Термоядерное' };
const ASSEMBLY_LABELS = { gun: 'Пушечная', implosion: 'Имплозивная' };
const FUEL_LABELS = { u235: 'U-235', pu239: 'Pu-239', u233: 'U-233' };
const INIT_LABELS = { none: 'Спонтанное', pobe: 'Po-Be «Урчин»', ent: 'Внешний генератор' };
const BURST_LABELS = { air: 'Воздушный', surface: 'Наземный' };

// ===================================================================
//  ASCII DIAGRAM
// ===================================================================
function renderDiagram() {
  const t = state.type, a = state.assembly, f = state.fuel.toUpperCase();
  let d = '';

  if (a === 'gun') {
    d = `
       ╔═══════════════════════════╗
       ║  СХЕМА: GUN-TYPE          ║
       ╚═══════════════════════════╝

   ┌─────────────────────────────────┐
   │ ▓▓ │ порох │░░░░│  ████  │ TGT │
   │ ▓▓ │       │░░░░│  ████  │     │
   └─────────────────────────────────┘
          ↑              ↑
       снаряд         мишень
      (${f})          (${f})

       выстрел → сборка надкрит. массы`;
  } else {
    const hasBoost = state.type !== 'fission' && state.boost > 0;
    const hasThermo = state.type === 'thermo' && state.thermo > 0;
    d = `
       ╔═══════════════════════════╗
       ║  СХЕМА: IMPLOSION         ║
       ╚═══════════════════════════╝

           ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒
         ⌒  взрывчатка  ⌒    ← 32 линзы
        ⌒  ◇◇◇◇◇◇◇◇◇  ⌒
       ⌒  ◇  тампер  ◇  ⌒    ← ${TAMPER[state.tamper].label}
       ⌒  ◇  ┌───┐  ◇  ⌒
       ⌒  ◇  │${f.padEnd(5)}│  ◇  ⌒    ← пит
       ⌒  ◇  │${hasBoost ? ' D-T ' : '     '}│  ◇  ⌒
       ⌒  ◇  └───┘  ◇  ⌒
       ⌒  ◇◇◇◇◇◇◇◇◇  ⌒
         ⌒          ⌒
           ⌒⌒⌒⌒⌒⌒⌒
${hasThermo ? `
         ─────────────
        │ ВТОР. СТУП. │
        │  Li-6 D     │   ${state.thermo} кг
        │  + плутон.  │
        │  «свеча»    │
         ─────────────` : ''}`;
  }
  document.getElementById('diagram').textContent = d;
}

// ===================================================================
//  MAIN UI UPDATE
// ===================================================================
function updateUI() {
  // Show/hide conditional fields
  document.getElementById('boostField').style.display = (state.type !== 'fission') ? '' : 'none';
  document.getElementById('thermoField').style.display = (state.type === 'thermo') ? '' : 'none';

  // Labels
  document.getElementById('reactionLabel').textContent = REACTION_LABELS[state.type];
  document.getElementById('assemblyLabel').textContent = ASSEMBLY_LABELS[state.assembly];
  document.getElementById('fuelLabel').textContent = FUEL_LABELS[state.fuel];
  document.getElementById('tamperLabel').textContent = TAMPER[state.tamper].label;
  document.getElementById('initLabel').textContent = INIT_LABELS[state.init];
  document.getElementById('burstLabel').textContent = BURST_LABELS[state.burst];

  // Values
  document.getElementById('massVal').textContent = state.mass.toFixed(1);
  document.getElementById('enrichVal').textContent = state.enrich.toFixed(1);
  document.getElementById('boostVal').textContent = state.boost.toFixed(1);
  document.getElementById('thermoVal').textContent = state.thermo.toFixed(0);
  document.getElementById('hobVal').textContent = state.hob.toFixed(0);

  // Compute
  const r = computeYield();
  state.yieldKt = r.yieldKt;
  state.eff = r.efficiency;

  // Yield display
  let displayY, unit;
  if (r.yieldKt < 0.001) { displayY = (r.yieldKt * 1e6).toFixed(1); unit = 'кг ТНТ'; }
  else if (r.yieldKt < 1) { displayY = (r.yieldKt * 1000).toFixed(1); unit = 'т ТНТ'; }
  else if (r.yieldKt < 1000) { displayY = r.yieldKt.toFixed(2); unit = 'кт ТНТ'; }
  else { displayY = (r.yieldKt / 1000).toFixed(2); unit = 'Мт ТНТ'; }

  document.getElementById('yieldVal').textContent = displayY;
  document.getElementById('yieldUnit').textContent = unit;
  document.getElementById('effVal').textContent = r.efficiency.toFixed(2);
  document.getElementById('keffVal').textContent = r.keff.toFixed(3);

  let keffStateText = 'ПОДКРИТИЧНО';
  let barClass = '';
  if (r.keff >= 2.0) { keffStateText = 'НАДКРИТИЧНО ++'; barClass = 'crit'; }
  else if (r.keff >= 1.3) { keffStateText = 'НАДКРИТИЧНО'; barClass = 'crit'; }
  else if (r.keff >= 1.0) { keffStateText = 'КРИТИЧНО'; }
  else if (r.keff >= 0.95) { keffStateText = 'ПОЧТИ КРИТИЧНО'; }
  document.getElementById('keffState').textContent = keffStateText;

  const bar = document.getElementById('keffBar');
  bar.classList.toggle('crit', !!barClass);
  bar.querySelector('.assembly-bar-fill').style.width = Math.min(100, r.keff / 2.0 * 100) + '%';

  document.getElementById('critBare').textContent = r.critBare.toFixed(1) + ' кг';
  document.getElementById('critTamper').textContent = r.critWithTamper.toFixed(1) + ' кг';
  document.getElementById('critCount').textContent = r.critCount.toFixed(2) + ' ×';
  document.getElementById('assSpeed').textContent = r.assemblySpeed + ' м/с (' + (r.assemblyTime * 1e6).toFixed(2) + ' мкс)';
  document.getElementById('genTime').textContent = (r.genTime * 1e9).toFixed(1) + ' нс';
  document.getElementById('gens').textContent = r.gens > 0 ? '~' + r.gens : '—';

  // Energy split (depends on type)
  let split = '35/35/5/50';
  if (state.type === 'thermo') split = '40/35/5/50';
  document.getElementById('enSplit').textContent = '35 / 35 / 5 / 50 %';

  // Warnings
  const warnBox = document.getElementById('warnBox');
  warnBox.innerHTML = '';
  if (r.fizzle && state.mass > 0.5) {
    if (state.fuel === 'pu239' && state.assembly === 'gun') {
      warnBox.innerHTML += `<div class="warning crit">⚠ ПРЕДЕТОНАЦИЯ (FIZZLE): Pu-239 имеет высокий уровень спонтанного деления. Пушечная схема не успевает собрать массу до начала реакции. РЕАЛЬНО НЕ РАБОТАЕТ. Используй имплозию.</div>`;
    } else if (r.critCount < 1.1) {
      warnBox.innerHTML += `<div class="warning crit">⚠ ПОДКРИТИЧЕСКАЯ СБОРКА: Масса топлива недостаточна. Реакция затухнет. Увеличь массу или используй лучший тампер.</div>`;
    }
  }
  if (state.type === 'thermo' && r.primaryYield < 5 && state.thermo > 0) {
    warnBox.innerHTML += `<div class="warning">⚠ ВТОРИЧКА НЕ ЗАЖГЛАСЬ: Для термоядерной реакции первичная ступень должна дать ≥ 5 кт. Сейчас: ${r.primaryYield.toFixed(2)} кт.</div>`;
  }
  if (r.keff > 1.8) {
    warnBox.innerHTML += `<div class="warning">⚡ ВЫСОКАЯ НАДКРИТИЧНОСТЬ: КПД близок к максимально возможному для данной схемы.</div>`;
  }
  if (r.critCount < 0.95) {
    warnBox.innerHTML += `<div class="warning">⚠ Сборка подкритична. Энергия фактически не выделяется.</div>`;
  }

  // Physics explanation panel
  renderPhysicsExplain(r);

  // Diagram
  renderDiagram();

  // Update HOB optimal display + zones
  const z = damageZones(state.yieldKt);
  document.getElementById('optHob').textContent = z.hobOpt.toFixed(0) + ' м';
  document.getElementById('curYield').textContent = displayY + ' ' + unit;
  renderZones(z);

  // Update map circles if marker set
  if (state.lat !== null) updateMapZones(z);
}

function renderPhysicsExplain(r) {
  const el = document.getElementById('physicsExplain');
  let html = '';

  // Step-by-step what happens
  html += `<span class="label">▸ Шаг 1 · Инициация</span>`;
  if (state.init === 'pobe') {
    html += `Инициатор Po-Be: α-частицы от полония-210 бомбардируют бериллий, выбивая ~10⁸ нейтронов/с. Запускают первое поколение делений в момент максимального сжатия.`;
  } else if (state.init === 'ent') {
    html += `Внешний нейтронный генератор: дейтерий-тритиевая трубка даёт строго таймированный импульс ~10⁹ n/мкс. Современный подход.`;
  } else {
    html += `Без инициатора: расчёт на спонтанное деление. Время старта непредсказуемо — велик риск преддетонации.`;
  }

  html += `<span class="label">▸ Шаг 2 · Сборка</span>`;
  if (state.assembly === 'gun') {
    html += `Пушечная схема: «снаряд» массой ~38 кг выстреливается пороховым зарядом со скоростью ~300 м/с в неподвижный «ствол» с надкритической массой. Время сборки ~1 мс — много для Pu (преддетонация), нормально для U-235.`;
  } else {
    html += `Имплозия: ${state.fuel === 'pu239' ? '32' : '60'} взрывных линз создают сходящуюся сферическую ударную волну со скоростью ~8 км/с. Сжатие в 2–2.5 раза увеличивает плотность, снижая крит. массу как 1/ρ². Время сборки ~1 мкс.`;
  }

  html += `<span class="label">▸ Шаг 3 · Цепная реакция</span>`;
  html += `Каждое поколение нейтронов длится ${(r.genTime * 1e9).toFixed(1)} нс. При k = ${r.keff.toFixed(2)} число делений за поколение растёт в ${r.keff.toFixed(2)}× раз. Через ${r.gens || '~80'} поколений выделится вся энергия — это занимает ${(r.gens * r.genTime * 1e6).toFixed(2)} мкс.`;

  html += `<span class="label">▸ Шаг 4 · Разлёт</span>`;
  html += `Когда давление в плазме достигает ~10¹⁵ Па, сборка разлетается. k<sub>eff</sub> падает ниже 1, реакция останавливается. Реально успевает разделиться <b>${r.efficiency.toFixed(2)}%</b> ядер — остальное распыляется в виде радиоактивных осколков.`;

  if (state.type !== 'fission' && state.boost > 0) {
    html += `<span class="label">▸ Бустинг D-T</span>`;
    html += `${state.boost.toFixed(1)} г газовой смеси D-T в полости пита. При нагреве плазмой первичной реакции: D + T → ⁴He + n (17.6 МэВ). Быстрые нейтроны утраивают КПД деления до разлёта.`;
  }

  if (state.type === 'thermo' && state.thermo > 0) {
    html += `<span class="label">▸ Термоядерная ступень (Teller-Ulam)</span>`;
    html += `Рентгеновское излучение первичной ступени за ~10 нс фокусируется в радиационном канале и сжимает вторичную капсулу с Li-6-D. Li-6 + n → ⁴He + T. Затем D + T → ⁴He + n (17.6 МэВ). Реакция продолжается, пока хватает топлива. КПД ~30–40% — выше любого деления.`;
  }

  el.innerHTML = html;
}

// ===================================================================
//  ZONES PANEL
// ===================================================================
function renderZones(z) {
  const zones = [
    { name: 'Огненный шар',          color: '#fff5b8', r: z.fireball,         desc: 'Полная вапоризация' },
    { name: 'Тяжёлый удар (20 psi)', color: '#ff3a2a', r: z.overpressure20,   desc: 'Бетон разрушен · ~100% жертв' },
    { name: 'Терм. ожоги 3-й ст.',   color: '#ff8c1a', r: z.thermal3,         desc: 'Обугливание · возгорания' },
    { name: 'Средний удар (5 psi)',  color: '#ffb347', r: z.overpressure5,    desc: 'Здания разрушены · ~50% жертв' },
    { name: 'Терм. ожоги 2-й ст.',   color: '#ffd97a', r: z.thermal2,         desc: 'Тяжёлые ожоги' },
    { name: 'Лёгкий удар (1 psi)',   color: '#4ddbff', r: z.overpressure1,    desc: 'Стёкла · травмы осколками' },
    { name: 'Терм. ожоги 1-й ст.',   color: '#4dff8c', r: z.thermal1,         desc: 'Покраснение кожи' },
  ];

  const html = zones.map(zn => `
    <div class="zone-row">
      <div class="zone-swatch" style="background:${zn.color}"></div>
      <div>
        <div class="zone-name">${zn.name}</div>
        <div style="color:var(--ink-faint); font-size:9px; letter-spacing:0.05em;">${zn.desc}</div>
      </div>
      <div class="zone-r">${zn.r < 1 ? (zn.r*1000).toFixed(0) + ' м' : zn.r.toFixed(2) + ' км'}</div>
    </div>
  `).join('');

  document.getElementById('zonesLegend').innerHTML = html;
  document.getElementById('zonesLegend2').innerHTML = html;
}

// ===================================================================
//  PRESETS
// ===================================================================
function renderPresetGrid() {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = PRESETS.map((p, i) => {
    let yt = p.yield < 1000 ? `${p.yield}<span class="unit">кт</span>` : `${(p.yield/1000).toFixed(0)}<span class="unit">Мт</span>`;
    return `
      <div class="preset" data-i="${i}">
        <div class="preset-code">${p.code}</div>
        <div class="preset-name">${p.name}</div>
        <div class="preset-sub">${p.sub}</div>
        <div class="preset-yield">${yt}</div>
        <div class="preset-meta">
          <span>${p.type === 'thermo' ? 'ТЕРМО' : p.type === 'boosted' ? 'BOOSTED' : 'FISSION'}</span>
          <span>${p.assembly === 'gun' ? 'GUN' : 'IMPLOSION'}</span>
          <span>${p.fuel.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.preset').forEach(el => {
    el.addEventListener('click', () => {
      grid.querySelectorAll('.preset').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      const i = parseInt(el.dataset.i);
      loadPreset(PRESETS[i]);
      showPresetDetail(PRESETS[i]);
    });
  });
}

function loadPreset(p) {
  state.type = p.type;
  state.assembly = p.assembly;
  state.fuel = p.fuel;
  state.mass = p.mass;
  state.enrich = p.enrich;
  state.tamper = p.tamper;
  state.init = p.init;
  state.boost = p.boost || 0;
  state.thermo = p.thermo || 0;
  state.presetEffOverride = p.yield;

  // sync controls
  document.getElementById('mass').value = p.mass;
  document.getElementById('enrich').value = p.enrich;
  document.getElementById('boost').value = p.boost || 0;
  document.getElementById('thermo').value = p.thermo || 0;
  document.getElementById('tamper').value = p.tamper;
  document.getElementById('init').value = p.init;

  // sync segs
  function setSeg(id, val) {
    document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('active', b.dataset.v === val));
  }
  setSeg('segReaction', p.type);
  setSeg('segAssembly', p.assembly);
  setSeg('segFuel', p.fuel);

  updateUI();
}

function showPresetDetail(p) {
  document.getElementById('presetMetaCode').textContent = p.code + ' / ' + p.name.toUpperCase();
  const html = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div>
        <div class="kv"><span class="k">Полный выход</span><span class="v hot">${p.yield < 1000 ? p.yield + ' кт' : (p.yield/1000) + ' Мт'} ТНТ</span></div>
        <div class="kv"><span class="k">Тип реакции</span><span class="v">${REACTION_LABELS[p.type]}</span></div>
        <div class="kv"><span class="k">Схема</span><span class="v">${ASSEMBLY_LABELS[p.assembly]}</span></div>
        <div class="kv"><span class="k">Делящийся материал</span><span class="v">${FUEL_LABELS[p.fuel]}</span></div>
        <div class="kv"><span class="k">Масса топлива</span><span class="v">${p.mass} кг</span></div>
        <div class="kv"><span class="k">Обогащение</span><span class="v">${p.enrich} %</span></div>
        <div class="kv"><span class="k">КПД деления</span><span class="v hot">${p.eff} %</span></div>
        ${p.boost ? `<div class="kv"><span class="k">D-T бустер</span><span class="v">${p.boost} г</span></div>` : ''}
        ${p.thermo ? `<div class="kv"><span class="k">Втор. ступень LiD</span><span class="v">${p.thermo} кг</span></div>` : ''}
      </div>
      <div class="physics-detail">
        <span class="label">▸ Описание</span>${p.desc}
        <span class="label">▸ История</span>${p.history}
        <span class="label">▸ Конструкция</span>${p.construction}
      </div>
    </div>
    <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line); display:flex; gap:12px;">
      <button class="btn primary" onclick="document.querySelector('[data-tab=builder]').click()">→ ОТКРЫТЬ В КОНСТРУКТОРЕ</button>
      <button class="btn" onclick="document.querySelector('[data-tab=target]').click()">→ ПЕРЕЙТИ К ЦЕЛИ</button>
    </div>
  `;
  document.getElementById('presetDetail').innerHTML = html;
}

// ===================================================================
//  MAP (Leaflet)
// ===================================================================
let map, marker;
let circles = [];

function initMap() {
  map = L.map('map', { worldCopyJump: true }).setView([55.7558, 37.6173], 11);

  // Dark CartoDB tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  map.on('click', e => {
    setMarker(e.latlng.lat, e.latlng.lng);
  });

  // City buttons
  const cg = document.getElementById('cityGrid');
  cg.innerHTML = CITIES.map((c,i) => `<button class="city-btn" data-i="${i}">${c.name}</button>`).join('');
  cg.querySelectorAll('.city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cg.querySelectorAll('.city-btn').forEach(b => b.classList.toggle('active', b === btn));
      const c = CITIES[parseInt(btn.dataset.i)];
      state.city = c.name;
      map.setView([c.lat, c.lon], 12);
      setMarker(c.lat, c.lon);
    });
  });

  document.getElementById('cityGo').addEventListener('click', goSearchCity);
  document.getElementById('cityQuery').addEventListener('keydown', e => {
    if (e.key === 'Enter') goSearchCity();
  });
}

async function goSearchCity() {
  const q = document.getElementById('cityQuery').value.trim();
  if (!q) return;
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
    const data = await resp.json();
    if (data && data.length > 0) {
      const r = data[0];
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      map.setView([lat, lon], 12);
      state.city = r.display_name.split(',')[0];
      setMarker(lat, lon);
    }
  } catch(e) { console.error(e); }
}

function setMarker(lat, lon) {
  state.lat = lat;
  state.lon = lon;
  document.getElementById('latVal').textContent = lat.toFixed(4) + '°';
  document.getElementById('lonVal').textContent = lon.toFixed(4) + '°';
  document.getElementById('mapStatus').textContent = `МЕТКА: ${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  if (marker) map.removeLayer(marker);
  const icon = L.divIcon({
    className: 'epicenter-marker-wrap',
    html: '<div class="epicenter-marker"><div class="epicenter-dot"></div></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  marker = L.marker([lat, lon], { icon }).addTo(map);

  const z = damageZones(state.yieldKt);
  updateMapZones(z);
}

function updateMapZones(z) {
  circles.forEach(c => map.removeLayer(c));
  circles = [];
  if (state.lat === null) return;

  const zonesForMap = [
    { color: '#fff5b8', r: z.fireball,       opacity: 0.5 },
    { color: '#ff3a2a', r: z.overpressure20, opacity: 0.4 },
    { color: '#ff8c1a', r: z.thermal3,       opacity: 0.25 },
    { color: '#ffb347', r: z.overpressure5,  opacity: 0.3 },
    { color: '#ffd97a', r: z.thermal2,       opacity: 0.15 },
    { color: '#4ddbff', r: z.overpressure1,  opacity: 0.2 },
  ];
  zonesForMap.forEach(zn => {
    const c = L.circle([state.lat, state.lon], {
      radius: zn.r * 1000,
      color: zn.color,
      weight: 1,
      fillColor: zn.color,
      fillOpacity: zn.opacity,
    }).addTo(map);
    circles.push(c);
  });
}

// "Go to sim" button
document.getElementById('goSim').addEventListener('click', () => {
  document.querySelector('[data-tab=sim]').click();
  // Reset sim state
  if (window.resetSim) window.resetSim();
});

document.getElementById('hob').addEventListener('input', e => {
  state.hob = parseFloat(e.target.value);
});

// Clock
function updateClock() {
  const d = new Date();
  const s = d.toISOString().slice(11, 19);
  document.getElementById('clock').textContent = s + ' UTC';
}
setInterval(updateClock, 1000);
updateClock();

// Init
initMap();
renderPresetGrid();
updateUI();

// 3D loaded in app3d.js (we keep this single file though)
// Export state for 3d module
window._state = state;
window._damageZones = damageZones;

// ===================================================================
//  3D SCENE (Three.js)
// ===================================================================

let scene, camera, renderer, controls;
let ground, sky;
let cityBlocks = [];
let fireball, fireballMat;
let mushroomStem, mushroomCap;
let shockRing;
let flashSphere;
let cloudParticles = [];
let condensationRing;
let craterMesh;

let simT = 0;
let simRunning = false;
let simSpeed = 1;
let simPhase = 'standby';
let camMode = 'orbit';

const PHASES = [
  { id: 'standby',  t0: 0,     t1: 0,     name: 'STANDBY' },
  { id: 'flash',    t0: 0,     t1: 0.01,  name: 'ВСПЫШКА' },
  { id: 'fireball', t0: 0.01,  t1: 1.0,   name: 'ОГНЕННЫЙ ШАР' },
  { id: 'shock',    t0: 1.0,   t1: 10.0,  name: 'УДАРНАЯ ВОЛНА' },
  { id: 'rise',     t0: 10.0,  t1: 60.0,  name: 'ПОДЪЁМ ГРИБА' },
  { id: 'mature',   t0: 60.0,  t1: 600.0, name: 'СТАБИЛИЗАЦИЯ' },
];

function init3D() {
  const canvas = document.getElementById('stage3d');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c0d);
  scene.fog = new THREE.Fog(0x0a0c0d, 8000, 25000);

  camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 1, 60000);
  camera.position.set(3500, 1800, 4500);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 200;
  controls.maxDistance = 30000;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 200, 0);

  // Lights
  const ambient = new THREE.AmbientLight(0x4a5a7a, 0.3);
  scene.add(ambient);

  const moonlight = new THREE.DirectionalLight(0x9aaacc, 0.4);
  moonlight.position.set(-1000, 2000, 1000);
  scene.add(moonlight);

  // Ground (city plate) — большой темный диск с сеткой
  buildGround();

  // City grid blocks
  buildCity();

  // Sky gradient backdrop
  buildSky();

  // Detonation objects (pre-created, hidden until fired)
  buildExplosionObjects();

  // Resize
  window.addEventListener('resize', onResize3D);
  onResize3D();

  // Loop
  animate3D();
}

function buildSky() {
  // Гигантская полусфера со звёздами (отдалённый фон)
  const skyGeo = new THREE.SphereGeometry(45000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFlash: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlash;
      varying vec3 vWorld;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec3 dir = normalize(vWorld);
        float h = dir.y;
        // Тёмное небо с лёгким градиентом
        vec3 col = mix(vec3(0.025, 0.03, 0.04), vec3(0.05, 0.06, 0.08), smoothstep(-0.2, 0.6, h));
        // Звёзды
        vec2 st = vec2(atan(dir.z, dir.x), asin(dir.y)) * 50.0;
        float n = hash(floor(st));
        if (n > 0.997 && h > 0) {
          col += vec3(0.7, 0.75, 0.85) * (n - 0.997) * 250.0;
        }
        // Flash overlay
        col += vec3(1.0, 0.9, 0.7) * uFlash * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}

function buildGround() {
  const size = 40000;
  const groundGeo = new THREE.PlaneGeometry(size, size, 200, 200);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor:   { value: new THREE.Color(0x1a1f24) },
      uGrid:    { value: new THREE.Color(0x2a3640) },
      uHot:     { value: new THREE.Color(0xff5520) },
      uFireR:   { value: 0 },
      uShockR:  { value: 0 },
      uTherm3R: { value: 0 },
      uOver5R:  { value: 0 },
      uOver1R:  { value: 0 },
      uTime:    { value: 0 },
      uFlash:   { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uGrid;
      uniform vec3 uHot;
      uniform float uFireR;
      uniform float uShockR;
      uniform float uTherm3R;
      uniform float uOver5R;
      uniform float uOver1R;
      uniform float uTime;
      uniform float uFlash;
      varying vec3 vWorld;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float ring(float r, float R, float w){
        return smoothstep(R - w, R, r) * (1.0 - smoothstep(R, R + w, r));
      }

      void main(){
        vec2 p = vWorld.xz;
        float r = length(p);

        // Сетка города
        vec2 g = abs(fract(p / 200.0) - 0.5);
        float grid = smoothstep(0.48, 0.5, max(g.x, g.y));

        vec3 col = mix(uColor, uGrid, grid * 0.5);

        // Случайные тёмные пятна — кварталы
        float n = hash(floor(p / 200.0));
        col *= 0.7 + n * 0.4;

        // Damage rings (на земле)
        // Огненный шар — выжженная зона
        if (uFireR > 0.0) {
          float burn = 1.0 - smoothstep(uFireR * 0.5, uFireR, r);
          col = mix(col, vec3(0.05, 0.03, 0.02), burn * 0.95);
          // тлеющий внутренний край
          col += uHot * 0.4 * smoothstep(uFireR * 0.8, uFireR, r) * (1.0 - smoothstep(uFireR, uFireR * 1.1, r));
        }

        // Damage zone tints (наземные радиусы)
        if (uOver1R > 0.0) {
          float z1 = 1.0 - smoothstep(uOver1R * 0.9, uOver1R, r);
          float z5 = 1.0 - smoothstep(uOver5R * 0.9, uOver5R, r);
          float zt = 1.0 - smoothstep(uTherm3R * 0.9, uTherm3R, r);
          col = mix(col, vec3(0.3, 0.4, 0.5), z1 * 0.06);
          col = mix(col, vec3(0.6, 0.4, 0.2), z5 * 0.1);
          col = mix(col, vec3(0.7, 0.25, 0.1), zt * 0.15);
        }

        // Расширяющееся ударное кольцо
        if (uShockR > 0.0 && uShockR < 18000.0) {
          float rr = ring(r, uShockR, 80.0 + uShockR * 0.02);
          col += vec3(1.0, 0.85, 0.6) * rr * 1.5;
        }

        // Flash overlay
        col += vec3(1.0, 0.95, 0.85) * uFlash * 0.5;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}

function buildCity() {
  // Сгенерируем сетку зданий вокруг эпицентра
  const blockGroup = new THREE.Group();
  scene.add(blockGroup);

  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x2a3038,
    roughness: 0.85,
    metalness: 0.1,
    emissive: 0x0a1218,
    emissiveIntensity: 0.4,
  });

  const N = 28;
  const spacing = 220;
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      // Пропустить близко к эпицентру — будет пустошь
      const dx = i * spacing, dz = j * spacing;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 80) continue;
      // Не везде ставим — пропуски (дороги/парки)
      if (Math.abs(i) % 4 === 0 || Math.abs(j) % 4 === 0) continue;
      if (Math.random() > 0.6) continue;

      const w = 50 + Math.random() * 90;
      const d = 50 + Math.random() * 90;
      // Высота: ближе к центру выше (даунтаун)
      const heightFactor = Math.max(0.2, 1 - dist / 4000);
      const h = (40 + Math.random() * 180) * (0.4 + heightFactor * 1.5);

      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, blockMat);
      mesh.position.set(dx + (Math.random()-0.5)*40, h/2, dz + (Math.random()-0.5)*40);
      mesh.userData.origY = mesh.position.y;
      mesh.userData.origH = h;
      mesh.userData.dist = dist;
      mesh.userData.destroyed = false;
      blockGroup.add(mesh);
      cityBlocks.push(mesh);
    }
  }
}

function buildExplosionObjects() {
  // Flash sphere (короткий ярчайший импульс)
  const flashGeo = new THREE.SphereGeometry(1, 32, 16);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfff5d8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  flashSphere = new THREE.Mesh(flashGeo, flashMat);
  scene.add(flashSphere);

  // Fireball (большая горячая сфера)
  const fbGeo = new THREE.SphereGeometry(1, 64, 32);
  fireballMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vNormal;
      void main(){
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vPos;
      varying vec3 vNormal;

      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p); vec3 f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                       mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                       mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p){
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }
      void main(){
        vec3 p = normalize(vPos);
        float n = fbm(p * 3.0 + uTime * 0.3);
        float n2 = fbm(p * 7.0 - uTime * 0.5);

        // Цветовая температура: белое ядро → оранжевый → красный
        vec3 white = vec3(1.0, 0.97, 0.85);
        vec3 yellow = vec3(1.0, 0.75, 0.25);
        vec3 orange = vec3(1.0, 0.45, 0.1);
        vec3 red = vec3(0.7, 0.15, 0.05);

        float core = smoothstep(0.4, 0.9, n + 0.5 * n2);
        vec3 col = mix(red, orange, smoothstep(0.0, 0.5, n));
        col = mix(col, yellow, smoothstep(0.4, 0.7, n));
        col = mix(col, white, core);

        // Прозрачность по краям (мягкость)
        float edge = 1.0 - dot(vNormal, normalize(vec3(0.0, 0.0, 1.0)));
        edge = smoothstep(0.1, 0.7, edge);
        float alpha = (1.0 - edge * 0.6) * uIntensity;
        alpha *= 0.85 + 0.25 * n;

        gl_FragColor = vec4(col * uIntensity * 1.5, alpha);
      }
    `,
  });
  fireball = new THREE.Mesh(fbGeo, fireballMat);
  fireball.visible = false;
  scene.add(fireball);

  // Shock ring (расширяющееся плоское кольцо)
  const ringGeo = new THREE.RingGeometry(0.99, 1.0, 96);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfff0c0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  shockRing = new THREE.Mesh(ringGeo, ringMat);
  shockRing.rotation.x = -Math.PI / 2;
  shockRing.position.y = 10;
  shockRing.visible = false;
  scene.add(shockRing);

  // Condensation ring (Wilson cloud) — больше, прозрачнее
  const condGeo = new THREE.RingGeometry(0.99, 1.0, 96);
  const condMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  condensationRing = new THREE.Mesh(condGeo, condMat);
  condensationRing.rotation.x = -Math.PI / 2;
  condensationRing.position.y = 5;
  condensationRing.visible = false;
  scene.add(condensationRing);

  // Mushroom: стебель — цилиндр + динамические частицы
  // Стебель — простой меш (вытянутый)
  const stemGeo = new THREE.CylinderGeometry(1, 1.3, 1, 32, 12, true);
  const stemMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uHotBottom: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      varying float vY;
      void main(){
        vPos = position;
        vY = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uHotBottom;
      varying vec3 vPos;
      varying float vY;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p); vec3 f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                       mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                       mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p){
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      void main(){
        float n = fbm(vPos * 0.7 + vec3(0.0, -uTime * 0.4, 0.0));
        float n2 = fbm(vPos * 2.2 - vec3(0.0, uTime * 0.2, 0.0));
        // Цвет: горячий низ → серо-белый верх
        vec3 hot = vec3(1.0, 0.5, 0.15);
        vec3 mid = vec3(0.5, 0.4, 0.35);
        vec3 cold = vec3(0.75, 0.72, 0.68);
        float t = vY + n * 0.2;
        vec3 col = mix(hot, mid, smoothstep(0.0, 0.3, t));
        col = mix(col, cold, smoothstep(0.25, 0.7, t));
        // Светящееся подножие
        col += vec3(1.0, 0.4, 0.1) * uHotBottom * (1.0 - smoothstep(0.0, 0.15, t)) * (0.8 + 0.4 * n);

        float a = 0.7 + 0.3 * n - 0.15 * n2;
        a *= uIntensity;
        // края прозрачнее
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  mushroomStem = new THREE.Mesh(stemGeo, stemMat);
  mushroomStem.visible = false;
  scene.add(mushroomStem);

  // Cap — сплюснутый сфероид + сверху "пуф"
  const capGeo = new THREE.SphereGeometry(1, 48, 24);
  const capMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uHot: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vN;
      void main(){
        vPos = position;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uHot;
      varying vec3 vPos;
      varying vec3 vN;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p); vec3 f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                       mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                       mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p){
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 6; i++){ v += a * noise(p); p *= 2.05; a *= 0.5; }
        return v;
      }
      void main(){
        float n = fbm(vPos * 1.8 + vec3(0.0, uTime * 0.15, uTime * 0.1));
        float n2 = fbm(vPos * 4.5 + vec3(uTime * 0.2, 0.0, -uTime * 0.1));

        // Тёплый низ шляпки (раскалённое ядро гриба), холодные края
        vec3 hot = vec3(1.0, 0.45, 0.1);
        vec3 warm = vec3(0.85, 0.55, 0.4);
        vec3 grey = vec3(0.75, 0.72, 0.68);
        vec3 dark = vec3(0.35, 0.32, 0.3);

        float fromCenter = length(vPos);
        float bottom = smoothstep(0.0, -0.5, vPos.y);
        vec3 col = mix(grey, dark, smoothstep(0.0, 0.4, n2));
        col = mix(col, warm, bottom * 0.5);
        col = mix(col, hot, bottom * uHot * (0.5 + 0.5 * n));
        col += vec3(0.1, 0.08, 0.06) * (n + n2 - 0.5);

        float edge = 1.0 - abs(dot(vN, normalize(cameraPosition - vPos)));
        float a = (0.75 + 0.25 * n) * uIntensity;
        a *= smoothstep(0.0, 0.6, 1.0 - edge * 0.4);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  mushroomCap = new THREE.Mesh(capGeo, capMat);
  mushroomCap.visible = false;
  scene.add(mushroomCap);

  // Кратер (только для наземного)
  const crGeo = new THREE.CircleGeometry(1, 64);
  const crMat = new THREE.MeshBasicMaterial({ color: 0x150a05, transparent: true, opacity: 0 });
  craterMesh = new THREE.Mesh(crGeo, crMat);
  craterMesh.rotation.x = -Math.PI / 2;
  craterMesh.position.y = 1;
  scene.add(craterMesh);
}

function onResize3D() {
  const canvas = document.getElementById('stage3d');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function resetSim() {
  simT = 0;
  simRunning = false;
  simPhase = 'standby';

  flashSphere.material.opacity = 0;
  flashSphere.scale.setScalar(1);

  fireball.visible = false;
  fireballMat.uniforms.uIntensity.value = 0;

  shockRing.visible = false;
  shockRing.material.opacity = 0;

  condensationRing.visible = false;
  condensationRing.material.opacity = 0;

  mushroomStem.visible = false;
  mushroomStem.material.uniforms.uIntensity.value = 0;
  mushroomCap.visible = false;
  mushroomCap.material.uniforms.uIntensity.value = 0;

  craterMesh.material.opacity = 0;

  cityBlocks.forEach(b => {
    b.position.y = b.userData.origY;
    b.scale.set(1, 1, 1);
    b.rotation.set(0, 0, 0);
    b.material.color.setHex(0x2a3038);
    b.userData.destroyed = false;
    b.userData.vel = null;
  });

  ground.material.uniforms.uFireR.value = 0;
  ground.material.uniforms.uShockR.value = 0;
  ground.material.uniforms.uTherm3R.value = 0;
  ground.material.uniforms.uOver5R.value = 0;
  ground.material.uniforms.uOver1R.value = 0;
  ground.material.uniforms.uFlash.value = 0;
  sky.material.uniforms.uFlash.value = 0;

  updateHUD();
  document.getElementById('hudCenter').classList.remove('show');
}
window.resetSim = resetSim;

function startSim() {
  if (state.yieldKt <= 0) {
    alert('Сначала собери рабочую бомбу в конструкторе!');
    return;
  }
  if (state.lat === null) {
    alert('Сначала выбери цель на карте!');
    return;
  }
  resetSim();
  simRunning = true;
  simT = 0;
  // Show DETONATION flash
  setTimeout(() => {
    document.getElementById('hudCenter').classList.add('show');
    setTimeout(() => document.getElementById('hudCenter').classList.remove('show'), 800);
  }, 100);
}

function getPhase(t) {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (t >= PHASES[i].t0) return PHASES[i];
  }
  return PHASES[0];
}

function updateHUD() {
  document.getElementById('hud_tgt').textContent = state.city || 'BLIND-COORD';
  let yt = state.yieldKt < 1
    ? (state.yieldKt * 1000).toFixed(1) + ' т'
    : state.yieldKt < 1000 ? state.yieldKt.toFixed(1) + ' кт' : (state.yieldKt/1000).toFixed(2) + ' Мт';
  document.getElementById('hud_yield').textContent = yt;
  document.getElementById('hud_hob').textContent = state.burst === 'surface' ? '0 м' : state.hob.toFixed(0) + ' м';
  document.getElementById('hud_t').textContent = simT.toFixed(2);

  const p = getPhase(simT);
  document.getElementById('hud_phase').textContent = p.name;

  // Phase explain text
  const phaseExplains = {
    'standby': 'Нажми ДЕТОНАЦИЯ для запуска. Ниже — сцена с панорамой города. Эпицентр в центре сцены.',
    'flash': `<b style="color:var(--amber)">T+0 мс · ВСПЫШКА</b><br>Электромагнитный импульс и тепловое излучение. Поверхность бомбы достигает T ≈ 10⁷ К — горячее центра Солнца. Видимая вспышка ярче 1000 Солнц на расстоянии нескольких км. Длится миллисекунды.`,
    'fireball': `<b style="color:var(--amber)">T+0.01–1 с · ОГНЕННЫЙ ШАР</b><br>Раскалённый плазменный пузырь расширяется радиально. Воздух внутри ионизирован. Температура падает с 10⁷ К до ~5000 К. Тепловой импульс воспламеняет всё горючее в радиусе ${(damageZones(state.yieldKt).thermal3).toFixed(1)} км. Эта фаза даёт ~35% всей энергии.`,
    'shock': `<b style="color:var(--amber)">T+1–10 с · УДАРНАЯ ВОЛНА</b><br>Фронт сжатого воздуха движется со сверхзвуковой скоростью (M=2–8 у эпицентра). Описывается формулой Сэдова: R ∝ (E·t²/ρ)^0.2. На границе фронта избыточное давление и обратный «всасывающий» поток. Разрушает здания, выбивает стёкла на десятки км.`,
    'rise': `<b style="color:var(--amber)">T+10–60 с · ПОДЪЁМ ГРИБА</b><br>Огненный шар легче окружающего воздуха в ~1000 раз. Поднимается с начальной скоростью ~100 м/с. Внутри — тороидальный вихрь: горячий газ выходит сверху, охладившийся — спускается по бокам. Стебель — поток засосанного снизу воздуха и пыли.`,
    'mature': `<b style="color:var(--amber)">T+60+ с · СТАБИЛИЗАЦИЯ</b><br>Гриб достиг тропопаузы (10–18 км для мегатонн). Шляпка расплющивается о тёплый слой. Если бомба наземная — в облаке тысячи тонн засосанной радиоактивной пыли. Через 30 мин начнётся выпадение осадков по ветру.`
  };
  document.getElementById('phaseExplain').innerHTML = phaseExplains[p.id];
  document.getElementById('phaseDetail').textContent = p.name;

  // Timeline
  const timeline = document.getElementById('timeline');
  if (!timeline.children.length) {
    timeline.innerHTML = PHASES.slice(1).map(p => `
      <div class="timeline-stage" data-id="${p.id}">
        <span class="t">T+${p.t0 < 1 ? (p.t0*1000)+'мс' : p.t0+'с'}</span>
        ${p.name}
      </div>
    `).join('');
  }
  timeline.querySelectorAll('.timeline-stage').forEach(el => {
    const id = el.dataset.id;
    const ph = PHASES.find(x => x.id === id);
    el.classList.toggle('active', ph.id === p.id);
    el.classList.toggle('passed', simT >= ph.t1 && ph.id !== p.id);
  });
}

function step3D(dt) {
  const z = damageZones(state.yieldKt);
  const burstY = state.burst === 'surface' ? 0 : state.hob;
  // Преобразуем км → м
  const fireballMaxRadiusM = z.fireball * 1000;
  const cloudHeightM = z.cloudHeight * 1000;
  const cloudCapDiaM = z.cloudCap * 1000;

  // Time in physics seconds (scale: 1 sim sec = 0.1 real for clarity? we keep 1:1 for first 10s, then speed up)
  if (simRunning) {
    let dtSim = dt * simSpeed;
    // Auto-accelerate after rise phase
    if (simT > 12) dtSim *= 3;
    if (simT > 60) dtSim *= 6;
    simT += dtSim;
  }
  const t = simT;

  // ----- FLASH (0..0.15 s) -----
  if (t < 0.15) {
    const k = 1 - Math.min(1, t / 0.15);
    flashSphere.material.opacity = k * 1.0;
    flashSphere.scale.setScalar(50 + (1 - k) * 200);
    flashSphere.position.set(0, burstY, 0);
    ground.material.uniforms.uFlash.value = k * 1.2;
    sky.material.uniforms.uFlash.value = k * 1.0;
  } else {
    flashSphere.material.opacity = 0;
    ground.material.uniforms.uFlash.value = 0;
    sky.material.uniforms.uFlash.value = 0;
  }

  // ----- FIREBALL (0.01..1.5 s, then absorbed into mushroom) -----
  if (t >= 0.01 && t < 8) {
    fireball.visible = true;
    fireball.position.set(0, burstY, 0);
    // Грубо: R(t) = R_max * (t/t_max)^0.4 (Сэдов)
    const tMax = 1.0; // s when fireball reaches max
    let R;
    if (t < tMax) {
      R = fireballMaxRadiusM * Math.pow(t / tMax, 0.4);
    } else {
      // After max — slowly fades and rises into mushroom
      R = fireballMaxRadiusM * (1 - (t - tMax) / 8 * 0.3);
    }
    R = Math.max(R, 5);
    fireball.scale.setScalar(R);
    fireballMat.uniforms.uTime.value = t;
    // Fade & rise
    if (t < 1.5) {
      fireballMat.uniforms.uIntensity.value = 1.0;
    } else {
      fireballMat.uniforms.uIntensity.value = Math.max(0, 1 - (t - 1.5) / 6.5);
      // Поднимается
      fireball.position.y = burstY + (t - 1.5) * 60;
    }
    // Ground burn (только для воздушного — наземный кратер)
    ground.material.uniforms.uFireR.value = Math.min(R, fireballMaxRadiusM);
  } else if (t >= 8) {
    fireball.visible = false;
  }

  // ----- SHOCK WAVE (1 .. 20 s, expanding ring) -----
  // R(t) = ξ (E/ρ)^(1/5) t^(2/5), Е в Дж, ρ воздух ≈ 1.225
  const E = state.yieldKt * KT_J;
  const rho = 1.225;
  if (t >= 0.05 && t < 30) {
    const Rshock = 1.03 * Math.pow(E / rho, 0.2) * Math.pow(t, 0.4);
    if (Rshock < 25000) {
      shockRing.visible = true;
      shockRing.scale.setScalar(Rshock);
      shockRing.material.opacity = Math.max(0, 0.9 - t / 30);
      ground.material.uniforms.uShockR.value = Rshock;
    } else {
      shockRing.visible = false;
    }
  } else {
    shockRing.visible = false;
  }

  // ----- DAMAGE BUILDINGS as shock front passes -----
  if (t > 0.5 && t < 30) {
    const E = state.yieldKt * KT_J;
    const Rshock = 1.03 * Math.pow(E / rho, 0.2) * Math.pow(t, 0.4);
    const r20 = z.overpressure20 * 1000;
    const r5  = z.overpressure5 * 1000;
    const r1  = z.overpressure1 * 1000;
    cityBlocks.forEach(b => {
      const d = b.userData.dist;
      if (b.userData.destroyed) {
        // Падают вниз и наклоняются
        if (b.userData.vel) {
          b.userData.vel.y -= 200 * dt;
          b.position.x += b.userData.vel.x * dt;
          b.position.y += b.userData.vel.y * dt;
          b.position.z += b.userData.vel.z * dt;
          b.rotation.x += b.userData.rotVel.x * dt;
          b.rotation.z += b.userData.rotVel.z * dt;
          if (b.position.y < 0) {
            b.position.y = 0;
            b.userData.vel = null;
          }
        }
        return;
      }
      if (d < Rshock) {
        // Здание попало под фронт — разрушаем
        b.userData.destroyed = true;
        let force;
        if (d < r20) {
          // Полностью испаряется в огненном шаре
          if (d < fireballMaxRadiusM) {
            b.scale.set(0.01, 0.01, 0.01);
            return;
          }
          // 20 psi — сметает
          force = 800;
          b.material = b.material.clone();
          b.material.color.setHex(0x1a0e08);
        } else if (d < r5) {
          force = 400;
          b.material = b.material.clone();
          b.material.color.setHex(0x251f1a);
        } else if (d < r1) {
          force = 150;
        } else {
          force = 60;
        }
        // Направление: от эпицентра наружу
        const ang = Math.atan2(b.position.z, b.position.x);
        b.userData.vel = new THREE.Vector3(
          Math.cos(ang) * force * (0.5 + Math.random()*0.5) * 0.1,
          force * 0.3,
          Math.sin(ang) * force * (0.5 + Math.random()*0.5) * 0.1
        );
        b.userData.rotVel = new THREE.Vector3(
          (Math.random()-0.5) * 2,
          0,
          (Math.random()-0.5) * 2
        );
        if (d > r5) {
          // Не уничтожаем — только сильно повреждаем (уменьшаем высоту)
          b.scale.y = 0.4 + Math.random() * 0.3;
          b.position.y = b.userData.origH * b.scale.y / 2;
          b.userData.vel = null; // не летит, просто ломается
        }
      }
    });
  }

  // ----- CONDENSATION RING (Wilson cloud, around 1.5 s) -----
  if (t >= 1.0 && t < 5) {
    condensationRing.visible = true;
    const R = fireballMaxRadiusM * (1 + (t - 1) * 0.5);
    condensationRing.scale.setScalar(R);
    condensationRing.material.opacity = Math.max(0, 0.4 - (t - 1) / 4);
    condensationRing.position.y = burstY + (t - 1) * 30;
  } else {
    condensationRing.visible = false;
  }

  // ----- MUSHROOM STEM (rises from ~5 s) -----
  if (t >= 4) {
    mushroomStem.visible = true;
    mushroomCap.visible = true;
    // Rise speed: ~100 m/s, decelerates
    const tRise = t - 4;
    // Время достижения макс. высоты
    const tMaxRise = Math.max(30, cloudHeightM / 200); // s
    const riseFrac = Math.min(1, Math.pow(tRise / tMaxRise, 0.7));

    const currentTopY = burstY + cloudHeightM * riseFrac;
    const currentBottomY = Math.max(0, burstY - fireballMaxRadiusM * 0.5);

    // Стебель: от земли (или почти) до основания шляпки
    const stemBaseY = 0;
    const capY = currentTopY;
    const stemH = capY - stemBaseY - cloudCapDiaM * 0.2; // высота стебля
    // Радиус стебля растёт с подъёмом
    const stemR = Math.max(50, cloudCapDiaM * 0.10 * (0.4 + riseFrac * 0.6));

    mushroomStem.position.set(0, stemBaseY + stemH / 2, 0);
    mushroomStem.scale.set(stemR, stemH, stemR);
    mushroomStem.material.uniforms.uTime.value = t;
    mushroomStem.material.uniforms.uIntensity.value = Math.min(1, riseFrac * 2);
    mushroomStem.material.uniforms.uHotBottom.value = Math.max(0, 1 - tRise / 30);

    // Шляпка: тороидальный вихрь
    const capR = cloudCapDiaM * 0.5 * (0.3 + riseFrac * 0.8);
    mushroomCap.position.set(0, capY, 0);
    // Сплющенный сфероид
    mushroomCap.scale.set(capR, capR * 0.55, capR);
    mushroomCap.material.uniforms.uTime.value = t;
    mushroomCap.material.uniforms.uIntensity.value = Math.min(1, riseFrac * 1.5);
    mushroomCap.material.uniforms.uHot.value = Math.max(0, 1 - tRise / 25);
  }

  // ----- Crater (only surface burst) -----
  if (state.burst === 'surface' && t > 0.5) {
    craterMesh.material.opacity = Math.min(0.9, (t - 0.5) / 2);
    const crR = fireballMaxRadiusM * 0.6;
    craterMesh.scale.setScalar(crR);
  }

  // ----- Update ground damage tints -----
  if (t > 0.3) {
    const r20 = z.overpressure20 * 1000;
    const r5 = z.overpressure5 * 1000;
    const r1 = z.overpressure1 * 1000;
    const rt3 = z.thermal3 * 1000;
    ground.material.uniforms.uTherm3R.value = Math.min(rt3, rt3 * Math.min(1, (t - 0.3) / 1.5));
    ground.material.uniforms.uOver5R.value = Math.min(r5, r5 * Math.min(1, (t - 0.5) / 3));
    ground.material.uniforms.uOver1R.value = Math.min(r1, r1 * Math.min(1, (t - 1) / 8));
  }

  // ----- Camera modes -----
  if (camMode === 'follow') {
    // Камера следит за грибом
    if (t > 5) {
      const dist = 12000 - Math.min(8000, t * 100);
      const h = Math.max(500, (burstY + cloudHeightM * Math.min(1, (t-4)/30) * 0.6));
      const ang = t * 0.03;
      camera.position.set(Math.cos(ang) * dist, h, Math.sin(ang) * dist);
      controls.target.set(0, h * 0.6, 0);
    }
  } else if (camMode === 'top') {
    camera.position.set(0, 18000, 100);
    controls.target.set(0, 0, 0);
  } else if (camMode === 'ground') {
    // С земли, далеко
    const ang = t * 0.01;
    camera.position.set(Math.cos(ang) * 8000, 50, Math.sin(ang) * 8000);
    controls.target.set(0, Math.min(5000, burstY + (t > 4 ? cloudHeightM * 0.3 : 0)), 0);
  }

  // ----- HUD updates -----
  if (simRunning) {
    document.getElementById('hud_t').textContent = simT.toFixed(2);
    const fbR = fireball.visible ? fireball.scale.x : 0;
    document.getElementById('hud_fb').textContent = fbR.toFixed(0) + ' м';
    const Rs = ground.material.uniforms.uShockR.value;
    document.getElementById('hud_shock').textContent = Rs > 0 ? (Rs/1000).toFixed(2) + ' км' : '0 м';
    const cloudY = mushroomCap.visible ? mushroomCap.position.y : 0;
    document.getElementById('hud_cloud').textContent = cloudY > 0 ? (cloudY/1000).toFixed(2) + ' км' : '0 м';
  }
}

function updateSimPanel() {
  const z = damageZones(state.yieldKt);
  document.getElementById('fbMax').textContent = z.fireball < 1 ? (z.fireball*1000).toFixed(0) + ' м' : z.fireball.toFixed(2) + ' км';
  document.getElementById('tempCore').textContent = '~10⁷ К';
  // Скорость shock на 1km
  const E = state.yieldKt * KT_J;
  const dRdt = 0.4 * 1.03 * Math.pow(E / 1.225, 0.2) * Math.pow(0.5, -0.6);
  document.getElementById('shockSpd').textContent = Math.round(dRdt) + ' м/с (фронт 0.5 с)';
  document.getElementById('cloudMax').textContent = z.cloudHeight.toFixed(1) + ' км';
  document.getElementById('capDia').textContent = z.cloudCap.toFixed(1) + ' км';
  // Время подъёма (грубо)
  const tRise = Math.max(30, z.cloudHeight * 1000 / 200);
  document.getElementById('cloudT').textContent = (tRise / 60).toFixed(1) + ' мин';
}

let lastT = performance.now();
function animate3D() {
  requestAnimationFrame(animate3D);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  step3D(dt);
  if (simRunning) {
    updateHUD();
    updateSimPanel();
  }

  controls.update();
  renderer.render(scene, camera);
}

// Sim controls
document.getElementById('btnDet').addEventListener('click', startSim);
document.getElementById('btnReset').addEventListener('click', resetSim);
document.getElementById('btnCam').addEventListener('click', () => {
  const modes = ['orbit', 'follow', 'top', 'ground'];
  const cur = modes.indexOf(camMode);
  camMode = modes[(cur + 1) % modes.length];
  document.getElementById('hud_cam').textContent = camMode.toUpperCase();
  document.getElementById('btnCam').textContent = '↻ CAM: ' + camMode.toUpperCase();
  if (camMode === 'orbit') {
    camera.position.set(3500, 1800, 4500);
    controls.target.set(0, 200, 0);
  }
});
document.getElementById('btnSpeed').addEventListener('click', () => {
  const speeds = [1, 2, 4, 0.5];
  const cur = speeds.indexOf(simSpeed);
  simSpeed = speeds[(cur + 1) % speeds.length];
  document.getElementById('btnSpeed').textContent = '► ' + simSpeed + '×';
});

// Init 3D
init3D();
updateSimPanel();
updateHUD();
