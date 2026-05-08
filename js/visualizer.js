// Кинематографичная визуализация ядерного взрыва на canvas.
// Развитие исходного кода из v2.0 — добавлены ударная волна,
// тряска камеры, эффект перегрева сенсора, сценарии сброса.

let canvas = null;
let ctx = null;
let state = {
  detonating: false,
  startTime: 0,
  particles: [],
  debris: [],
  shockwaves: [],
  shake: 0,
  cameraFlash: 0,
  yieldKt: 15,
  scenario: 'air_optimal',
  effects: null,
};

let onTimerUpdate = null;
let onComplete = null;

export function initVisualizer(canvasId, callbacks = {}) {
  canvas = document.getElementById(canvasId);
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  onTimerUpdate = callbacks.onTimerUpdate || null;
  onComplete = callbacks.onComplete || null;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(draw);
}

export function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  // Если родитель скрыт или ещё не отрендерен — не сбрасываем размеры в ноль.
  if (rect.width < 10 || rect.height < 10) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Запуск анимации взрыва.
 */
export function detonate(yieldKt, effects, scenario) {
  // Не делаем early-return: если жмут "Подорвать" повторно — перезапускаем чисто.
  state.detonating = true;
  state.startTime = performance.now();
  state.yieldKt = yieldKt;
  state.effects = effects;
  state.scenario = scenario || 'air_optimal';
  state.particles = [];
  state.debris = [];
  state.shockwaves = [];
  state.shake = 1;
  state.cameraFlash = 1;
  state.completedFired = false;

  // Партиклы первичного огненного шара.
  for (let i = 0; i < 180; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 400;
    state.particles.push({
      x: 0, y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.7 - 50,
      size: 1.5 + Math.random() * 4,
      life: 0,
      maxLife: 1500 + Math.random() * 3000,
      hue: 15 + Math.random() * 40,
      brightness: 60 + Math.random() * 30,
    });
  }

  // Обломки (медленно падают).
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI - Math.PI;
    const speed = 50 + Math.random() * 250;
    state.debris.push({
      x: 0, y: 0,
      vx: Math.cos(angle) * speed * 0.6,
      vy: Math.sin(angle) * speed - 100,
      size: 1 + Math.random() * 2.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 4,
      life: 0,
      maxLife: 2000 + Math.random() * 3000,
    });
  }

  // Ударные волны — три кольца, расходящиеся с разной скоростью.
  for (let i = 0; i < 3; i++) {
    state.shockwaves.push({
      delay: i * 80,
      maxRadius: 0,  // подставится в draw из размера канваса
      life: 0,
      maxLife: 1200,
      width: 4 - i,
    });
  }
}

export function reset() {
  state.detonating = false;
  state.particles = [];
  state.debris = [];
  state.shockwaves = [];
  state.shake = 0;
  state.cameraFlash = 0;
}

let lastFrameTime = 0;
function draw(now) {
  if (!ctx) return;
  const dt = Math.min(50, now - lastFrameTime);
  lastFrameTime = now;

  // Если канвас ещё не получил размеры (вкладка была скрыта) — пробуем ресайз.
  if (canvas.width === 0 || canvas.height === 0) {
    resizeCanvas();
    if (canvas.width === 0 || canvas.height === 0) {
      requestAnimationFrame(draw);
      return;
    }
  }

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  // Фон — небо и земля с градиентом.
  drawBackground(w, h);

  // Сетка-горизонт (даёт глубину).
  drawHorizonGrid(w, h);

  if (state.detonating) {
    drawExplosion(w, h, dt, now);
  } else {
    drawIdle(w, h, now);
  }

  requestAnimationFrame(draw);
}

function drawBackground(w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (state.detonating && (performance.now() - state.startTime) < 1500) {
    // При взрыве небо краснеет.
    const t = Math.min(1, (performance.now() - state.startTime) / 1000);
    grad.addColorStop(0, `rgba(${20 + t * 80}, ${10 + t * 20}, ${20 - t * 20}, 1)`);
    grad.addColorStop(0.6, `rgba(${30 + t * 100}, ${10 + t * 30}, 30, 1)`);
    grad.addColorStop(1, `rgba(${50 + t * 120}, 20, 20, 1)`);
  } else {
    grad.addColorStop(0, '#050510');
    grad.addColorStop(0.6, '#0a0a1a');
    grad.addColorStop(0.8, '#1a0808');
    grad.addColorStop(1, '#2a0808');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawHorizonGrid(w, h) {
  const horizon = h * 0.7;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 87, 34, 0.08)';
  ctx.lineWidth = 1;

  // Горизонтальная линия.
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();

  // Перспективные линии (сходятся к центру).
  const cx = w / 2;
  for (let i = -8; i <= 8; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx + i * (w / 8), h);
    ctx.lineTo(cx, horizon);
    ctx.stroke();
  }
  // Перспективные горизонтали.
  for (let i = 1; i <= 6; i++) {
    const y = horizon + (h - horizon) * (i / 6) ** 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawIdle(w, h, now) {
  const cx = w / 2;
  const cy = h * 0.7;
  // Маленькая пульсирующая точка-цель.
  const pulse = 0.5 + 0.5 * Math.sin(now / 500);
  ctx.fillStyle = `rgba(255, 87, 34, ${0.3 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 87, 34, ${0.2 + pulse * 0.3})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 12 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawExplosion(w, h, dt, now) {
  const elapsed = (now - state.startTime) / 1000;
  const cx = w / 2;
  const cy = h * 0.7;

  // Тряска камеры (затухает экспоненциально).
  state.shake *= Math.pow(0.85, dt / 16);
  const shakeX = (Math.random() - 0.5) * state.shake * 30;
  const shakeY = (Math.random() - 0.5) * state.shake * 30;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Размер огненного шара в пикселях (масштабируем под канвас).
  const eff = state.effects;
  const maxRadius = Math.max(eff.lightBlast, eff.thermal);
  const scale = (Math.min(w, h) * 0.42) / Math.max(0.01, maxRadius);

  // Ударная волна (расходящееся кольцо).
  const elapsedMs = elapsed * 1000;
  state.shockwaves.forEach(sw => {
    if (elapsedMs < sw.delay) return;
    sw.life = elapsedMs - sw.delay;
    if (sw.life > sw.maxLife) return;
    const t = sw.life / sw.maxLife;
    const r = t * Math.min(w, h) * 0.6;
    const alpha = (1 - t) * 0.6;

    ctx.strokeStyle = `rgba(255, 200, 100, ${alpha})`;
    ctx.lineWidth = sw.width * (1 - t * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Внутреннее свечение.
    ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.5})`;
    ctx.lineWidth = sw.width * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Зоны (рисуем как полукруги на земле).
  drawZones(cx, cy, scale, elapsed);

  // Вспышка камеры (очень яркая в первые миллисекунды).
  if (elapsed < 0.4) {
    const flashAlpha = Math.pow(1 - elapsed / 0.4, 2);
    ctx.fillStyle = `rgba(255, 255, 240, ${flashAlpha * 0.95})`;
    ctx.fillRect(-shakeX, -shakeY, w, h);
  }

  // Огненный шар (растущая сфера).
  drawFireball(cx, cy, eff.fireball * scale, elapsed);

  // Гриб (после ~0.6 секунд).
  if (elapsed > 0.6) {
    drawMushroomCloud(cx, cy, eff.fireball * scale, Math.min(1, (elapsed - 0.6) / 5), elapsed);
  }

  // Партиклы и обломки.
  updateParticles(cx, cy, dt);
  updateDebris(cx, cy, dt);

  ctx.restore();

  // Перегрев сенсора (царапины и шум) — короткий эффект.
  if (elapsed < 0.6) {
    drawSensorOverload(w, h, 1 - elapsed / 0.6);
  }

  // Завершение анимации — один раз, гриб остаётся на экране.
  if (elapsed > 6 && !state.completedFired && onComplete) {
    state.completedFired = true;
    onComplete();
  }

  // Обновление таймера.
  if (onTimerUpdate) {
    onTimerUpdate(elapsed);
  }
}

function drawZones(cx, cy, scale, elapsed) {
  const eff = state.effects;
  const zones = [
    { key: 'lightBlast',    color: '#90a4ae', delay: 0.4 },
    { key: 'thermal',       color: '#ff7e36', delay: 0.3 },
    { key: 'moderateBlast', color: '#ffd54f', delay: 0.25 },
    { key: 'radiation',     color: '#ffb800', delay: 0.2 },
    { key: 'severeBlast',   color: '#ff5722', delay: 0.15 },
  ].sort((a, b) => eff[b.key] - eff[a.key]);

  zones.forEach(z => {
    const r = eff[z.key] * scale;
    const t = Math.max(0, Math.min(1, (elapsed - z.delay) / 1.2));
    if (t <= 0) return;

    const alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) * 0.5;
    const currentR = r * easeOutCubic(t);

    ctx.fillStyle = z.color + Math.floor(alpha * 40).toString(16).padStart(2, '0');
    ctx.strokeStyle = z.color + Math.floor(alpha * 200).toString(16).padStart(2, '0');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, currentR, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  });
}

function drawFireball(cx, cy, fbR, elapsed) {
  // Огненный шар: рост -> стабилизация -> остывание -> подъём.
  let r = 0;
  let cyAdj = cy;
  let opacity = 1;

  if (elapsed < 0.3) {
    // Быстрый рост.
    r = fbR * easeOutExpo(elapsed / 0.3);
  } else if (elapsed < 1.2) {
    // Стабилизация.
    r = fbR;
  } else if (elapsed < 4) {
    // Подъём и расширение в виде гриба.
    r = fbR * (1 + (elapsed - 1.2) * 0.05);
    cyAdj = cy - (elapsed - 1.2) * fbR * 0.3;
    opacity = 1 - (elapsed - 1.2) / 3;
  } else {
    return;
  }

  if (opacity <= 0) return;

  const grad = ctx.createRadialGradient(cx, cyAdj, 0, cx, cyAdj, r);
  grad.addColorStop(0, `rgba(255, 255, 200, ${opacity})`);
  grad.addColorStop(0.2, `rgba(255, 230, 140, ${opacity})`);
  grad.addColorStop(0.5, `rgba(255, 150, 60, ${opacity * 0.9})`);
  grad.addColorStop(0.8, `rgba(220, 80, 30, ${opacity * 0.7})`);
  grad.addColorStop(1, `rgba(120, 30, 10, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cyAdj, r, 0, Math.PI * 2);
  ctx.fill();

  // Внутреннее ядро (белое).
  if (elapsed < 1) {
    const coreR = r * 0.4;
    const coreGrad = ctx.createRadialGradient(cx, cyAdj, 0, cx, cyAdj, coreR);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    coreGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cyAdj, coreR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMushroomCloud(cx, cy, fbR, progress, elapsed) {
  const eased = easeOutQuad(progress);

  // Стебель.
  const stemHeight = fbR * 5 * eased;
  const stemTopY = cy - stemHeight;

  ctx.save();

  ctx.beginPath();
  const stemBaseW = fbR * 0.7;
  const stemTopW = fbR * 0.5;
  const wobble = Math.sin(elapsed * 1.2) * fbR * 0.05;

  ctx.moveTo(cx - stemBaseW, cy);
  ctx.bezierCurveTo(
    cx - stemBaseW * 0.8 + wobble, cy - stemHeight * 0.4,
    cx - stemTopW * 1.2 - wobble, cy - stemHeight * 0.7,
    cx - stemTopW, stemTopY
  );
  ctx.lineTo(cx + stemTopW, stemTopY);
  ctx.bezierCurveTo(
    cx + stemTopW * 1.2 + wobble, cy - stemHeight * 0.7,
    cx + stemBaseW * 0.8 - wobble, cy - stemHeight * 0.4,
    cx + stemBaseW, cy
  );
  ctx.closePath();

  const stemGrad = ctx.createLinearGradient(cx, cy, cx, stemTopY);
  stemGrad.addColorStop(0, 'rgba(60, 40, 25, 0.9)');
  stemGrad.addColorStop(0.3, 'rgba(110, 70, 45, 0.85)');
  stemGrad.addColorStop(0.7, 'rgba(150, 95, 60, 0.75)');
  stemGrad.addColorStop(1, 'rgba(180, 120, 80, 0.65)');
  ctx.fillStyle = stemGrad;
  ctx.fill();

  // Шляпка гриба.
  const capR = fbR * 2.2 * eased;
  const capY = stemTopY;

  // Завихрения.
  for (let i = 0; i < 14; i++) {
    const baseAngle = (Math.PI * 2 * i) / 14;
    const swirl = elapsed * 0.3 + i * 0.5;
    const angle = baseAngle + Math.sin(swirl) * 0.15;
    const offsetR = capR * (0.45 + Math.sin(swirl * 1.3) * 0.1);
    const px = cx + Math.cos(angle) * offsetR;
    const py = capY + Math.sin(angle) * offsetR * 0.55 - capR * 0.1;
    const pr = capR * (0.55 + Math.sin(swirl * 0.7) * 0.1);

    const puffGrad = ctx.createRadialGradient(px, py - pr * 0.3, 0, px, py, pr);
    puffGrad.addColorStop(0, 'rgba(230, 170, 90, 0.85)');
    puffGrad.addColorStop(0.4, 'rgba(180, 110, 60, 0.75)');
    puffGrad.addColorStop(0.8, 'rgba(90, 55, 35, 0.5)');
    puffGrad.addColorStop(1, 'rgba(50, 30, 20, 0)');
    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Раскалённое ядро в шляпке.
  if (progress < 0.6) {
    const glowFade = 1 - progress / 0.6;
    const glowGrad = ctx.createRadialGradient(cx, capY, 0, cx, capY, capR * 0.7);
    glowGrad.addColorStop(0, `rgba(255, 220, 120, ${glowFade * 0.7})`);
    glowGrad.addColorStop(0.5, `rgba(255, 130, 40, ${glowFade * 0.4})`);
    glowGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, capY, capR * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function updateParticles(cx, cy, dt) {
  const dtSec = dt / 1000;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += dt;
    if (p.life > p.maxLife) { state.particles.splice(i, 1); continue; }

    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.vy += 60 * dtSec;
    p.vx *= 0.985;
    p.vy *= 0.985;

    const t = p.life / p.maxLife;
    const alpha = 1 - t;
    const px = cx + p.x;
    const py = cy + p.y;
    if (py > cy + 3) continue;

    const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
    grad.addColorStop(0, `hsla(${p.hue}, 100%, ${p.brightness}%, ${alpha})`);
    grad.addColorStop(0.5, `hsla(${p.hue - 10}, 100%, ${p.brightness - 20}%, ${alpha * 0.5})`);
    grad.addColorStop(1, `hsla(${p.hue}, 80%, 30%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, p.size * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function updateDebris(cx, cy, dt) {
  const dtSec = dt / 1000;
  ctx.save();
  for (let i = state.debris.length - 1; i >= 0; i--) {
    const d = state.debris[i];
    d.life += dt;
    if (d.life > d.maxLife) { state.debris.splice(i, 1); continue; }

    d.x += d.vx * dtSec;
    d.y += d.vy * dtSec;
    d.vy += 200 * dtSec;
    d.rot += d.vrot * dtSec;

    const t = d.life / d.maxLife;
    const alpha = 1 - t * 0.7;
    const px = cx + d.x;
    const py = cy + d.y;
    if (py > cy + 3) continue;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(d.rot);
    ctx.fillStyle = `rgba(40, 25, 15, ${alpha})`;
    ctx.fillRect(-d.size, -d.size, d.size * 2, d.size * 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawSensorOverload(w, h, intensity) {
  // Имитация сгоревшего сенсора камеры — белые царапины.
  ctx.save();
  ctx.globalAlpha = intensity * 0.4;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 8; i++) {
    if (Math.random() > 0.7) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutQuad(t)  { return 1 - (1 - t) * (1 - t); }
function easeOutExpo(t)  { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
