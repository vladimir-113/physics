// Главный модуль — связывает физику, карту и визуализатор с UI.

import { CITIES } from '../data/cities.js';
import { MATERIALS, ASSEMBLY_TYPES, DELIVERY_SCENARIOS, PRESETS } from '../data/materials.js';
import {
  calculateYield, calculateEffects, estimateCasualties, getObservationEffects, ZONES,
  formatYield, formatRadius, formatNumber, sliderToYield, yieldToSlider,
} from './physics.js';
import * as MapModule from './map.js';
import * as Vis from './visualizer.js';

const $ = id => document.getElementById(id);

// Состояние приложения.
const state = {
  // Конфигурация бомбы.
  material: 'pu239',
  materialMass: 6.2,
  assembly: 'implosion',
  // Сценарий доставки.
  scenario: 'air_optimal',
  // Расчётная мощность.
  yieldKt: 21,
  yieldData: null,
  // Текущие эффекты.
  effects: null,
  // Активная вкладка.
  activeTab: 'config',
  // Идёт ли подрыв.
  detonating: false,
};

// ---------- Инициализация UI ----------

function init() {
  buildPresetList();
  buildMaterialSelector();
  buildAssemblySelector();
  buildScenarioSelector();
  buildCityList();
  setupTabs();
  setupControls();
  setupResponsive();

  // Стартовый пресет.
  applyPreset('nagasaki');

  // Карта.
  MapModule.initMap('map', onTargetChange, onObservationAdd);

  // Визуализатор.
  Vis.initVisualizer('canvas', {
    onTimerUpdate: (elapsed) => {
      $('vizTimer').textContent = `T+ ${elapsed.toFixed(2)} С`;
    },
    onComplete: () => {
      $('detonateBtn').disabled = false;
    },
  });

  // Полное обновление.
  recalculate();
}

// ---------- Сборка элементов UI ----------

function buildPresetList() {
  const container = $('presetList');
  container.innerHTML = '';
  PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'preset-card';
    btn.dataset.id = p.id;
    btn.innerHTML = `
      <div class="preset-card__top">
        <span class="preset-card__name">${p.name}</span>
        <span class="preset-card__yield">${formatYield(p.yieldKt)}</span>
      </div>
      <div class="preset-card__meta">${p.meta}</div>
      <div class="preset-card__desc">${p.description}</div>
    `;
    btn.addEventListener('click', () => applyPreset(p.id));
    container.appendChild(btn);
  });
}

function buildMaterialSelector() {
  const container = $('materialList');
  container.innerHTML = '';
  Object.values(MATERIALS).forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'mat-card';
    btn.dataset.id = m.id;
    btn.innerHTML = `
      <div class="mat-card__symbol" style="color:${m.color}">${m.symbol}</div>
      <div class="mat-card__info">
        <div class="mat-card__name">${m.name}</div>
        <div class="mat-card__desc">${m.description}</div>
        ${m.criticalMass ? `<div class="mat-card__crit">Крит. масса: ${m.criticalMass} кг</div>` : ''}
      </div>
    `;
    btn.addEventListener('click', () => {
      state.material = m.id;
      // Подбираем массу: чуть больше крит. массы.
      if (m.criticalMass) {
        state.materialMass = Math.max(m.criticalMass * 1.1, state.materialMass);
      }
      // Если текущая схема несовместима — переключаем.
      const asm = ASSEMBLY_TYPES[state.assembly];
      if (asm && !asm.compatible.includes(m.id)) {
        // Берём первую совместимую.
        state.assembly = Object.values(ASSEMBLY_TYPES).find(a => a.compatible.includes(m.id))?.id || 'implosion';
      }
      updateMaterialUI();
      updateAssemblyUI();
      recalculate();
    });
    container.appendChild(btn);
  });
}

function buildAssemblySelector() {
  const container = $('assemblyList');
  container.innerHTML = '';
  Object.values(ASSEMBLY_TYPES).forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'asm-card';
    btn.dataset.id = a.id;
    btn.innerHTML = `
      <div class="asm-card__name">${a.name}</div>
      <div class="asm-card__desc">${a.description}</div>
      <div class="asm-card__compat">Совместимо: ${a.compatible.map(id => MATERIALS[id]?.symbol || id).join(', ')}</div>
    `;
    btn.addEventListener('click', () => {
      if (!a.compatible.includes(state.material)) return;
      state.assembly = a.id;
      updateAssemblyUI();
      recalculate();
    });
    container.appendChild(btn);
  });
}

function buildScenarioSelector() {
  const container = $('scenarioList');
  container.innerHTML = '';
  Object.values(DELIVERY_SCENARIOS).forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'scn-card';
    btn.dataset.id = s.id;
    btn.innerHTML = `
      <div class="scn-card__icon">${s.icon}</div>
      <div class="scn-card__info">
        <div class="scn-card__name">${s.name}</div>
        <div class="scn-card__desc">${s.description}</div>
      </div>
    `;
    btn.addEventListener('click', () => {
      state.scenario = s.id;
      updateScenarioUI();
      recalculate();
    });
    container.appendChild(btn);
  });
}

function buildCityList() {
  const container = $('cityList');
  container.innerHTML = '';
  CITIES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'city-card';
    btn.dataset.id = c.id;
    if (c.historic) btn.classList.add('city-card--historic');
    btn.innerHTML = `
      <span class="city-card__name">${c.name}</span>
      <span class="city-card__country">${c.country}</span>
      <span class="city-card__pop">${formatNumber(c.pop)}</span>
    `;
    btn.addEventListener('click', () => {
      MapModule.jumpToCity(c.id);
      // Переключаемся на вкладку карты на мобилке.
      if (window.innerWidth < 900) switchTab('map');
    });
    container.appendChild(btn);
  });
}

// ---------- Вкладки ----------

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('tab-btn--active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('tab-panel--active', p.dataset.tab === tabId);
  });
  // Карте нужно пересчитать размер при показе.
  if (tabId === 'map') {
    setTimeout(() => MapModule.invalidateSize(), 100);
  }
  // Канвасу тоже.
  if (tabId === 'sim') {
    setTimeout(() => Vis.resizeCanvas(), 100);
  }
}

// ---------- Контролы ----------

function setupControls() {
  // Слайдер массы.
  $('massSlider').addEventListener('input', (e) => {
    state.materialMass = parseFloat(e.target.value);
    recalculate();
  });

  // Кнопка подрыва.
  $('detonateBtn').addEventListener('click', detonateNow);
  $('detonateBtn2').addEventListener('click', detonateNow);

  // Reset.
  $('resetBtn').addEventListener('click', resetAll);

  // Поставить точку наблюдения.
  $('addObsBtn').addEventListener('click', () => {
    MapModule.enableObservationPlacement();
    showHint('Кликните на карте, чтобы поставить точку наблюдения');
  });

  // Очистить наблюдения.
  $('clearObsBtn').addEventListener('click', () => {
    MapModule.clearObservations();
    $('obsList').innerHTML = '<div class="empty-hint">Кликните «Добавить точку», затем по карте.</div>';
  });

  // FAB на мобилке (плавающая кнопка подрыва).
  const fab = $('fabDetonate');
  if (fab) fab.addEventListener('click', detonateNow);
}

function setupResponsive() {
  // Слежение за поворотом экрана и т.д.
  window.addEventListener('resize', () => {
    Vis.resizeCanvas();
    MapModule.invalidateSize();
  });
}

// ---------- Применение пресетов ----------

function applyPreset(presetId) {
  const p = PRESETS.find(x => x.id === presetId);
  if (!p) return;
  state.material = p.material;
  state.materialMass = p.materialMass;
  state.assembly = p.assembly;
  document.querySelectorAll('.preset-card').forEach(c => {
    c.classList.toggle('preset-card--active', c.dataset.id === presetId);
  });
  updateMaterialUI();
  updateAssemblyUI();
  recalculate();
}

// ---------- Обновление UI ----------

function updateMaterialUI() {
  document.querySelectorAll('.mat-card').forEach(c => {
    c.classList.toggle('mat-card--active', c.dataset.id === state.material);
  });
  // Обновляем диапазон слайдера массы.
  const mat = MATERIALS[state.material];
  const slider = $('massSlider');
  if (mat.criticalMass) {
    slider.min = 0.1;
    slider.max = mat.criticalMass * 8;
    slider.step = 0.1;
  } else {
    slider.min = 1;
    slider.max = 1000000;
    slider.step = 1;
  }
  if (state.materialMass > slider.max) state.materialMass = parseFloat(slider.max);
  slider.value = state.materialMass;
  $('critMassRef').textContent = mat.criticalMass ? `Крит. масса: ${mat.criticalMass} кг` : '—';
}

function updateAssemblyUI() {
  document.querySelectorAll('.asm-card').forEach(c => {
    const asm = ASSEMBLY_TYPES[c.dataset.id];
    const compatible = asm.compatible.includes(state.material);
    c.classList.toggle('asm-card--active', c.dataset.id === state.assembly);
    c.classList.toggle('asm-card--disabled', !compatible);
  });
}

function updateScenarioUI() {
  document.querySelectorAll('.scn-card').forEach(c => {
    c.classList.toggle('scn-card--active', c.dataset.id === state.scenario);
  });
}

// ---------- Главный пересчёт ----------

function recalculate() {
  // Обновляем массу.
  $('massValue').textContent = state.materialMass.toFixed(1) + ' кг';

  // Расчёт мощности.
  const yieldData = calculateYield(state.material, state.materialMass, state.assembly);
  state.yieldData = yieldData;
  state.yieldKt = yieldData.yieldKt;

  // Сценарий.
  const scenario = DELIVERY_SCENARIOS[state.scenario];

  // Эффекты.
  state.effects = calculateEffects(state.yieldKt, scenario);

  // Обновляем числа.
  $('calcYield').textContent = formatYield(state.yieldKt);
  $('calcEfficiency').textContent = (yieldData.efficiency * 100).toFixed(1) + '%';
  $('calcAtoms').textContent = yieldData.atomsFissioned > 0
    ? yieldData.atomsFissioned.toExponential(2)
    : '—';
  $('calcHeight').textContent = scenario ? Math.round(scenario.heightMeters(state.yieldKt)) + ' м' : '—';

  // Предупреждения.
  const warnBox = $('warnings');
  if (yieldData.warnings.length) {
    warnBox.classList.add('warnings--active');
    warnBox.innerHTML = yieldData.warnings.map(w => `<div class="warn-item">⚠ ${w}</div>`).join('');
    $('detonateBtn').disabled = true;
    $('detonateBtn2').disabled = true;
  } else {
    warnBox.classList.remove('warnings--active');
    warnBox.innerHTML = '';
    $('detonateBtn').disabled = false;
    $('detonateBtn2').disabled = false;
  }

  // Обновляем основные числа.
  const energyTJ = state.yieldKt * 4.184;
  $('statEnergy').textContent = energyTJ < 1
    ? (energyTJ * 1000).toFixed(0) + ' ГДж'
    : energyTJ < 1000
      ? energyTJ.toFixed(0) + ' ТДж'
      : (energyTJ / 1000).toFixed(1) + ' ПДж';

  $('statHiroshima').textContent = state.yieldKt > 0
    ? (state.yieldKt / 15).toFixed(state.yieldKt < 15 ? 2 : 1) + '×'
    : '—';

  const maxR = Math.max(state.effects.lightBlast, state.effects.thermal);
  const area = Math.PI * maxR * maxR;
  $('statArea').textContent = area > 0
    ? area < 1 ? area.toFixed(2) + ' км²'
    : area < 100 ? area.toFixed(1) + ' км²'
    : Math.round(area) + ' км²'
    : '—';

  // Жертвы (если на карте есть город).
  const density = MapModule.getCurrentDensity();
  const casualties = estimateCasualties(state.effects, density);
  $('statDead').textContent = formatNumber(casualties.dead);
  $('statWounded').textContent = formatNumber(casualties.wounded);

  // Огненный шар отдельно.
  $('statFireball').textContent = state.effects.fireball > 0
    ? formatRadius(state.effects.fireball)
    : '—';

  // Список зон.
  renderZoneList();

  // Рисуем зоны на карте.
  MapModule.drawZones(state.effects);
}

function renderZoneList() {
  const list = $('zoneList');
  list.innerHTML = '';
  ZONES.forEach(z => {
    const r = state.effects[z.key];
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `
      <div class="zone-row__color" style="background:${z.color};box-shadow:0 0 8px ${z.color}"></div>
      <div class="zone-row__info">
        <div class="zone-row__name">${z.name}</div>
        <div class="zone-row__desc">${z.desc}</div>
      </div>
      <div class="zone-row__radius">${formatRadius(r)}</div>
    `;
    list.appendChild(row);
  });
}

// ---------- Подрыв ----------

function detonateNow() {
  if (state.detonating) return;
  if (state.yieldData?.warnings?.length) return;

  state.detonating = true;
  $('detonateBtn').disabled = true;
  $('detonateBtn2').disabled = true;

  // Переключаем на симуляцию.
  switchTab('sim');

  // Ждём пока вкладка отрендерится, потом ресайзим канвас и стартуем.
  setTimeout(() => {
    Vis.resizeCanvas();
    Vis.detonate(state.yieldKt, state.effects, state.scenario);
  }, 350);

  // Через 7 секунд — разрешаем повторить.
  setTimeout(() => {
    state.detonating = false;
    $('detonateBtn').disabled = false;
    $('detonateBtn2').disabled = false;
  }, 7000);
}

function resetAll() {
  Vis.reset();
  MapModule.clearObservations();
  $('obsList').innerHTML = '<div class="empty-hint">Кликните «Добавить точку», затем по карте.</div>';
  $('vizTimer').textContent = 'T+ 0.00 С';
}

// ---------- Колбеки от карты ----------

function onTargetChange(target) {
  $('targetName').textContent = target.name;
  $('targetCoords').textContent = `${target.lat.toFixed(4)}°, ${target.lon.toFixed(4)}°`;
  if (state.effects) {
    MapModule.drawZones(state.effects);
    // Пересчитываем жертвы под новую плотность.
    const density = MapModule.getCurrentDensity();
    const casualties = estimateCasualties(state.effects, density);
    $('statDead').textContent = formatNumber(casualties.dead);
    $('statWounded').textContent = formatNumber(casualties.wounded);
  }
}

function onObservationAdd(marker, distanceKm) {
  // Перерисовываем список наблюдений.
  renderObservations();
}

function renderObservations() {
  const list = $('obsList');
  list.innerHTML = '';

  // Получаем все маркеры с карты.
  // Простой способ: маркеры держим прямо в model карты. Здесь обходим DOM. Но лучше через API:
  // у нас есть доступ только через колбек, поэтому мы отрисовываем по последнему маркеру.
  // Проще: пройдёмся по всем маркерам наблюдений.
  // Для упрощения здесь считаем что MapModule.observationMarkers пока недоступен —
  // делаем отдельную перерисовку через делегирование событий.
  // Простой fallback — пересоздаём DOM каждый раз.

  // Для надёжности — используем глобальный список через события.
  // (см. реализацию в map.js — observationMarkers держится там)

  // Получим все .obs-marker и отсортируем.
  // Нам нужен публичный API из map.js — возьмём его через временный hack.
  if (window._obsList) {
    list.innerHTML = '';
    if (!window._obsList.length) {
      list.innerHTML = '<div class="empty-hint">Кликните «Добавить точку», затем по карте.</div>';
      return;
    }
    window._obsList.forEach((m, idx) => {
      const dist = m.distanceKm;
      const events = getObservationEffects(dist, state.effects);
      const card = document.createElement('div');
      card.className = 'obs-item';
      card.innerHTML = `
        <div class="obs-item__head">
          <span class="obs-item__num">#${idx + 1}</span>
          <span class="obs-item__dist">${formatRadius(dist)}</span>
        </div>
        <div class="obs-item__body">
          ${events.map(e => `<div class="obs-event obs-event--${e.severity}">${e.text}</div>`).join('')}
        </div>
      `;
      list.appendChild(card);
    });
  }
}

// Слушаем события от карты — простой способ синхронизации.
window.addEventListener('observation-changed', () => {
  renderObservations();
});

function showHint(text) {
  const hint = $('hintBar');
  hint.textContent = text;
  hint.classList.add('hint-bar--show');
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => hint.classList.remove('hint-bar--show'), 3000);
}

// ---------- Старт ----------
init();
