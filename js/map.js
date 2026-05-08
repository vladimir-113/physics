// Модуль карты на Leaflet. Рисует зоны поражения поверх реального города.

import { CITIES } from '../data/cities.js';
import { ZONES, formatRadius } from './physics.js';

let map = null;
let target = null;            // { lat, lon, name }
let targetMarker = null;
let zoneCircles = [];
let observationMarkers = [];
let onTargetChangeCallback = null;
let onObservationAddCallback = null;
let placingObservation = false;

/**
 * Инициализация карты.
 * @param {string} elementId - id контейнера карты
 * @param {function} onTargetChange - вызывается при выборе новой цели
 * @param {function} onObservationAdd - вызывается при добавлении точки наблюдения
 */
export function initMap(elementId, onTargetChange, onObservationAdd) {
  onTargetChangeCallback = onTargetChange;
  onObservationAddCallback = onObservationAdd;

  // Старт — Москва.
  map = L.map(elementId, {
    center: [55.7558, 37.6173],
    zoom: 11,
    zoomControl: true,
    attributionControl: true,
  });

  // Тёмная тема карты — подходит к интерфейсу.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // Клик по карте — устанавливаем цель или ставим точку наблюдения.
  map.on('click', (e) => {
    if (placingObservation) {
      addObservationMarker(e.latlng.lat, e.latlng.lng);
      placingObservation = false;
      document.body.style.cursor = '';
    } else {
      setTarget(e.latlng.lat, e.latlng.lng, 'Произвольная точка');
    }
  });

  // Стартовая цель.
  setTarget(55.7558, 37.6173, 'Москва');
}

/**
 * Установить цель (центр взрыва).
 */
export function setTarget(lat, lon, name) {
  target = { lat, lon, name: name || 'Цель' };

  if (targetMarker) {
    map.removeLayer(targetMarker);
  }

  // Кастомный маркер цели — перекрестие.
  const icon = L.divIcon({
    className: 'target-marker',
    html: `
      <div class="target-cross">
        <div class="target-ring"></div>
        <div class="target-h"></div>
        <div class="target-v"></div>
        <div class="target-dot"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  targetMarker = L.marker([lat, lon], { icon, interactive: false }).addTo(map);
  map.panTo([lat, lon]);

  if (onTargetChangeCallback) onTargetChangeCallback(target);
}

/**
 * Получить текущую цель.
 */
export function getTarget() {
  return target;
}

/**
 * Отрисовать зоны поражения как круги на карте.
 * @param {object} effects - результат calculateEffects(), радиусы в км
 */
export function drawZones(effects) {
  // Удаляем старые круги.
  zoneCircles.forEach(c => map.removeLayer(c));
  zoneCircles = [];

  if (!target) return;

  // Рисуем зоны от больших к маленьким (чтобы маленькие были сверху).
  const sortedZones = [...ZONES].sort((a, b) => effects[b.key] - effects[a.key]);

  sortedZones.forEach(zone => {
    const radiusM = effects[zone.key] * 1000; // км → м
    if (radiusM <= 0) return;

    const circle = L.circle([target.lat, target.lon], {
      radius: radiusM,
      color: zone.color,
      weight: 1.5,
      opacity: 0.8,
      fillColor: zone.color,
      fillOpacity: 0.12,
      interactive: true,
    }).addTo(map);

    circle.bindTooltip(
      `<strong style="color:${zone.color}">${zone.name}</strong><br>` +
      `Радиус: ${formatRadius(effects[zone.key])}<br>` +
      `<span style="opacity:0.7">${zone.desc}</span>`,
      { sticky: true, className: 'zone-tooltip' }
    );

    zoneCircles.push(circle);
  });

  // Подгоняем зум, чтобы видеть всю самую большую зону.
  if (zoneCircles.length) {
    const bounds = zoneCircles[0].getBounds();
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  }
}

/**
 * Очистить все зоны (после reset).
 */
export function clearZones() {
  zoneCircles.forEach(c => map.removeLayer(c));
  zoneCircles = [];
}

/**
 * Включить режим расстановки точек наблюдения.
 * Следующий клик по карте поставит маркер.
 */
export function enableObservationPlacement() {
  placingObservation = true;
  document.body.style.cursor = 'crosshair';
}

/**
 * Поставить маркер наблюдения по координатам.
 */
export function addObservationMarker(lat, lon) {
  if (!target) return;

  const icon = L.divIcon({
    className: 'obs-marker',
    html: `<div class="obs-dot"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  const marker = L.marker([lat, lon], { icon, draggable: true }).addTo(map);

  // Расстояние от цели в км.
  const distance = haversine(target.lat, target.lon, lat, lon);

  marker.distanceKm = distance;
  observationMarkers.push(marker);
  window._obsList = observationMarkers;

  if (onObservationAddCallback) onObservationAddCallback(marker, distance);
  window.dispatchEvent(new CustomEvent('observation-changed'));

  marker.on('dragend', (e) => {
    const ll = e.target.getLatLng();
    const newDist = haversine(target.lat, target.lon, ll.lat, ll.lng);
    e.target.distanceKm = newDist;
    if (onObservationAddCallback) onObservationAddCallback(e.target, newDist);
    window.dispatchEvent(new CustomEvent('observation-changed'));
  });

  return marker;
}

/**
 * Очистить все точки наблюдения.
 */
export function clearObservations() {
  observationMarkers.forEach(m => map.removeLayer(m));
  observationMarkers = [];
  window._obsList = observationMarkers;
  window.dispatchEvent(new CustomEvent('observation-changed'));
}

/**
 * Сбросить вид к городу.
 */
export function jumpToCity(cityId) {
  const city = CITIES.find(c => c.id === cityId);
  if (!city) return;
  setTarget(city.lat, city.lon, city.name);
  map.setView([city.lat, city.lon], 11);
}

/**
 * Получить плотность населения для текущей цели (грубо).
 */
export function getCurrentDensity() {
  if (!target) return 5000;
  // Проверяем, не попали ли мы в один из известных городов.
  const closest = CITIES
    .map(c => ({ city: c, d: haversine(c.lat, c.lon, target.lat, target.lon) }))
    .sort((a, b) => a.d - b.d)[0];
  if (closest && closest.d < 20) {
    // Очень грубо: население / условная площадь застройки.
    // Берём среднее ~5000-15000 чел/км² для крупных городов.
    return Math.min(15000, closest.city.pop / 200);
  }
  return 1000; // вне города — сельская местность
}

/**
 * Хаверсин: расстояние между двумя точками на сфере (км).
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Триггерит resize карты — нужно после изменения размера контейнера.
 */
export function invalidateSize() {
  if (map) map.invalidateSize();
}
