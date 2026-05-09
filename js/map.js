// Модуль карты на Leaflet. Рисует зоны поражения поверх реального города,
// плюс отдельный режим "После взрыва" — выжженный город с пожарами и кратером.

import { CITIES } from '../data/cities.js';
import { ZONES, formatRadius } from './physics.js';

let map = null;
let target = null;
let targetMarker = null;
let zoneCircles = [];
let aftermathLayers = [];
let observationMarkers = [];
let onTargetChangeCallback = null;
let onObservationAddCallback = null;
let placingObservation = false;

let currentEffects = null;
let mode = 'before';
let mapContainer = null;

export function initMap(elementId, onTargetChange, onObservationAdd) {
  onTargetChangeCallback = onTargetChange;
  onObservationAddCallback = onObservationAdd;
  mapContainer = document.getElementById(elementId);

  map = L.map(elementId, {
    center: [38.9072, -77.0369],
    zoom: 11,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  map.on('click', (e) => {
    if (placingObservation) {
      addObservationMarker(e.latlng.lat, e.latlng.lng);
      placingObservation = false;
      document.body.style.cursor = '';
    } else {
      setTarget(e.latlng.lat, e.latlng.lng, 'Произвольная точка');
    }
  });

  setTarget(38.9072, -77.0369, 'Вашингтон');
}

export function setTarget(lat, lon, name) {
  target = { lat, lon, name: name || 'Цель' };

  if (targetMarker) map.removeLayer(targetMarker);

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

  if (currentEffects) {
    if (mode === 'before') drawZones(currentEffects);
    else drawAftermath(currentEffects);
  }
}

export function getTarget() { return target; }

/**
 * РЕЖИМ "ДО": тонкие кольца-зоны.
 */
export function drawZones(effects) {
  currentEffects = effects;
  mode = 'before';
  clearAftermath();
  clearZones();

  if (mapContainer) mapContainer.classList.remove('map-after');

  if (!target) return;

  const sortedZones = [...ZONES].sort((a, b) => effects[b.key] - effects[a.key]);

  sortedZones.forEach(zone => {
    const radiusM = effects[zone.key] * 1000;
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

  if (zoneCircles.length) {
    const bounds = zoneCircles[0].getBounds();
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  }
}

/**
 * РЕЖИМ "ПОСЛЕ": выжженный город — кратер, пожары, разрушения.
 */
export function drawAftermath(effects) {
  currentEffects = effects;
  mode = 'after';
  clearZones();
  clearAftermath();

  if (!target) return;
  if (mapContainer) mapContainer.classList.add('map-after');

  // Слой 1: внешняя зона лёгких повреждений (мутно-серый)
  if (effects.lightBlast > 0) {
    const layer = L.circle([target.lat, target.lon], {
      radius: effects.lightBlast * 1000,
      stroke: false,
      fillColor: '#3a3530',
      fillOpacity: 0.35,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(layer);
  }

  // Слой 2: тепловое излучение — оранжево-красные пожары
  if (effects.thermal > 0) {
    const layer = L.circle([target.lat, target.lon], {
      radius: effects.thermal * 1000,
      stroke: false,
      fillColor: '#7a2510',
      fillOpacity: 0.55,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(layer);
  }

  // Слой 3: средние разрушения — тёмно-серый
  if (effects.moderateBlast > 0) {
    const layer = L.circle([target.lat, target.lon], {
      radius: effects.moderateBlast * 1000,
      stroke: false,
      fillColor: '#1a1612',
      fillOpacity: 0.7,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(layer);
  }

  // Слой 4: тяжёлые разрушения — почти чёрный
  if (effects.severeBlast > 0) {
    const layer = L.circle([target.lat, target.lon], {
      radius: effects.severeBlast * 1000,
      stroke: false,
      fillColor: '#0a0805',
      fillOpacity: 0.9,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(layer);
  }

  // Слой 5: огненный шар = кратер (чёрный с обугленным кольцом)
  if (effects.fireball > 0) {
    const charredRing = L.circle([target.lat, target.lon], {
      radius: effects.fireball * 1500,
      stroke: false,
      fillColor: '#2a1505',
      fillOpacity: 0.6,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(charredRing);

    const crater = L.circle([target.lat, target.lon], {
      radius: effects.fireball * 1000,
      stroke: true,
      color: '#5a3010',
      weight: 2,
      fillColor: '#000000',
      fillOpacity: 1.0,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(crater);
  }

  // Слой 6: дымовые облака
  drawSmokeClouds(effects);

  // Слой 7: точки активных пожаров
  drawFirePoints(effects);

  if (effects.lightBlast > 0) {
    const big = L.circle([target.lat, target.lon], { radius: effects.lightBlast * 1000 });
    map.fitBounds(big.getBounds(), { padding: [60, 60], maxZoom: 13 });
  }
}

function drawSmokeClouds(effects) {
  const baseR = effects.severeBlast * 1000;
  if (baseR <= 0) return;

  const cloudCount = 7;
  for (let i = 0; i < cloudCount; i++) {
    const angle = (i / cloudCount) * Math.PI * 2 + ((target.lat * 31 + target.lon * 17) % 1);
    const dist = baseR * (0.3 + ((i * 0.37) % 0.6));
    const dLat = (dist / 111000) * Math.cos(angle);
    const dLon = (dist / (111000 * Math.cos(target.lat * Math.PI / 180))) * Math.sin(angle);

    const cloud = L.circle([target.lat + dLat, target.lon + dLon], {
      radius: baseR * 0.45,
      stroke: false,
      fillColor: '#0a0a0a',
      fillOpacity: 0.5,
      interactive: false,
    }).addTo(map);
    aftermathLayers.push(cloud);
  }
}

function drawFirePoints(effects) {
  const baseR = effects.thermal * 1000;
  if (baseR <= 0) return;

  const fireCount = Math.min(50, Math.floor(effects.thermal * 10));
  for (let i = 0; i < fireCount; i++) {
    const seed = i * 1.618 + target.lat * 7;
    const angle = (seed * Math.PI * 2) % (Math.PI * 2);
    const distFrac = ((seed * 0.31) % 1) * 0.85 + 0.15;
    const dist = baseR * distFrac;
    const dLat = (dist / 111000) * Math.cos(angle);
    const dLon = (dist / (111000 * Math.cos(target.lat * Math.PI / 180))) * Math.sin(angle);

    const icon = L.divIcon({
      className: 'fire-marker',
      html: '<div class="fire-dot"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const marker = L.marker([target.lat + dLat, target.lon + dLon], {
      icon,
      interactive: false,
      keyboard: false,
    }).addTo(map);
    aftermathLayers.push(marker);
  }
}

export function clearZones() {
  zoneCircles.forEach(c => map.removeLayer(c));
  zoneCircles = [];
}

function clearAftermath() {
  aftermathLayers.forEach(l => map.removeLayer(l));
  aftermathLayers = [];
}

export function setMode(newMode) {
  if (!currentEffects) return;
  if (newMode === 'after') drawAftermath(currentEffects);
  else drawZones(currentEffects);
}

export function getMode() { return mode; }

export function enableObservationPlacement() {
  placingObservation = true;
  document.body.style.cursor = 'crosshair';
}

export function addObservationMarker(lat, lon) {
  if (!target) return;
  const icon = L.divIcon({
    className: 'obs-marker',
    html: `<div class="obs-dot"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  const marker = L.marker([lat, lon], { icon, draggable: true }).addTo(map);
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

export function clearObservations() {
  observationMarkers.forEach(m => map.removeLayer(m));
  observationMarkers = [];
  window._obsList = observationMarkers;
  window.dispatchEvent(new CustomEvent('observation-changed'));
}

export function jumpToCity(cityId) {
  const city = CITIES.find(c => c.id === cityId);
  if (!city) return;
  setTarget(city.lat, city.lon, city.name);
  map.setView([city.lat, city.lon], 11);
}

export function getCurrentDensity() {
  if (!target) return 5000;
  const closest = CITIES
    .map(c => ({ city: c, d: haversine(c.lat, c.lon, target.lat, target.lon) }))
    .sort((a, b) => a.d - b.d)[0];
  if (closest && closest.d < 20) {
    return Math.min(15000, closest.city.pop / 200);
  }
  return 1000;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function invalidateSize() {
  if (map) map.invalidateSize();
}
