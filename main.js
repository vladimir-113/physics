// Делящиеся материалы и параметры для конфигуратора бомбы.
// Все числа — упрощённая физика, образовательные модели.

export const MATERIALS = {
  'u235': {
    id: 'u235',
    name: 'Уран-235',
    symbol: 'U-235',
    // Критическая масса (кг) — для голой сферы.
    // С отражателем и имплозией можно намного меньше.
    criticalMass: 52,
    // Энергия одного деления (МэВ).
    energyPerFission: 202.5,
    // Базовый КПД (доля прореагировавшего вещества) для пушечной схемы.
    // Хиросима — около 1.4%.
    typicalEfficiency: 0.014,
    // Можно ли использовать в пушечной схеме.
    gunTypeCompatible: true,
    description: 'Изотоп урана. В природной руде — 0.7%, требует обогащения.',
    color: '#7ec8a0',
  },
  'pu239': {
    id: 'pu239',
    name: 'Плутоний-239',
    symbol: 'Pu-239',
    criticalMass: 10,
    energyPerFission: 207.1,
    // Pu в голой сфере — гипотетически тот же базовый КПД, что U.
    // Имплозия даёт примерно тот же буст.
    typicalEfficiency: 0.014,
    gunTypeCompatible: false, // спонтанное деление слишком быстрое для пушки
    description: 'Получают из U-238 в реакторе. Меньше критическая масса, но требует имплозии.',
    color: '#ff9d6c',
  },
  'tnt': {
    id: 'tnt',
    name: 'Тротил',
    symbol: 'TNT',
    criticalMass: null,
    energyPerFission: null,
    typicalEfficiency: 1.0,
    gunTypeCompatible: false,
    // Условный «нулевой» вариант — обычная взрывчатка для сравнения.
    isConventional: true,
    description: 'Обычная химическая взрывчатка. Для сравнения масштабов.',
    color: '#a0a0a0',
  },
};

// Схема подрыва — определяет КПД и минимальную массу.
export const ASSEMBLY_TYPES = {
  'gun': {
    id: 'gun',
    name: 'Пушечная схема',
    description: 'Один кусок урана выстреливается в другой. Простая, но работает только для U-235.',
    efficiencyMultiplier: 1.0,
    // С урановым отражателем (как в "Малыше") крит. масса падает примерно вдвое.
    minMassFactor: 0.85,
    compatible: ['u235'],
  },
  'implosion': {
    id: 'implosion',
    name: 'Имплозия',
    description: 'Сферическое сжатие взрывчаткой. Сложно, но эффективно. Работает с Pu-239.',
    efficiencyMultiplier: 50.0, // имплозия даёт ~17% КПД при достаточной массе
    minMassFactor: 0.5,         // сжатие сильно уменьшает критическую массу
    compatible: ['u235', 'pu239'],
  },
  'thermonuclear': {
    id: 'thermonuclear',
    name: 'Термоядерная (двухступенчатая)',
    description: 'Деление поджигает синтез лития-дейтерида. Мощность практически без верхнего предела.',
    efficiencyMultiplier: 50.0,  // первичный заряд работает как имплозия
    fusionMultiplier: 200,       // вторичный синтез добавляет ×200 от первичного
    minMassFactor: 0.35,
    compatible: ['u235', 'pu239'],
    requiresFusion: true,
  },
};

// Сценарии доставки и подрыва.
// Высота подрыва (метры над целью) реально влияет на радиусы поражения.
export const DELIVERY_SCENARIOS = {
  'air_optimal': {
    id: 'air_optimal',
    name: 'Воздушный взрыв',
    icon: '✈',
    description: 'Подрыв на оптимальной высоте — максимум площади ударной волны. Так подорвали Хиросиму (580 м).',
    // Коэффициент к радиусу ударной волны (воздушный взрыв даёт больше площади).
    blastRadiusMultiplier: 1.0,
    // Радиоактивные осадки (наземный — много, воздушный — почти нет).
    falloutMultiplier: 0.1,
    // Высота как функция от мощности (м), формула из NUKEMAP/Glasstone.
    heightMeters: (yieldKt) => 200 * Math.pow(yieldKt, 1/3),
  },
  'aircraft_drop': {
    id: 'aircraft_drop',
    name: 'Сброс с самолёта',
    icon: '✈',
    description: 'Бомба сбрасывается на парашюте, подрывается датчиком высоты. Классика 1945.',
    blastRadiusMultiplier: 1.0,
    falloutMultiplier: 0.1,
    heightMeters: (yieldKt) => 200 * Math.pow(yieldKt, 1/3),
    animation: 'drop',
  },
  'icbm': {
    id: 'icbm',
    name: 'Боеголовка МБР',
    icon: '⇂',
    description: 'Боевой блок МБР входит в атмосферу и подрывается на расчётной высоте.',
    blastRadiusMultiplier: 1.0,
    falloutMultiplier: 0.15,
    heightMeters: (yieldKt) => 250 * Math.pow(yieldKt, 1/3),
    animation: 'reentry',
  },
  'surface': {
    id: 'surface',
    name: 'Наземный взрыв',
    icon: '⊙',
    description: 'Взрыв у поверхности. Меньше площадь, но образуется кратер и много радиоактивных осадков.',
    blastRadiusMultiplier: 0.7,
    falloutMultiplier: 1.0,
    heightMeters: () => 0,
    hasCrater: true,
    animation: 'surface',
  },
  'underground': {
    id: 'underground',
    name: 'Подземный взрыв',
    icon: '⊕',
    description: 'Шахтное испытание. Большая часть энергии остаётся под землёй.',
    blastRadiusMultiplier: 0.2,
    falloutMultiplier: 0.05,
    heightMeters: () => -100,
    hasCrater: true,
    animation: 'underground',
  },
};

// Готовые конфигурации (исторические бомбы) — теперь с полным описанием.
export const PRESETS = [
  {
    id: 'tactical',
    name: 'B61 mod-3 (тактическая)',
    yieldKt: 10,
    meta: 'Тактическая · США, в строю',
    material: 'pu239',
    materialMass: 5.5,
    assembly: 'implosion',
    description: 'Современная тактическая бомба переменной мощности (0.3–340 кт). Среднее значение для мини-варианта.',
  },
  {
    id: 'hiroshima',
    name: 'Малыш (Хиросима)',
    yieldKt: 15,
    meta: 'Урановая · США 1945',
    material: 'u235',
    materialMass: 64,
    assembly: 'gun',
    description: 'Первое применение в войне. КПД ~1.4%, прореагировало менее килограмма урана.',
  },
  {
    id: 'nagasaki',
    name: 'Толстяк (Нагасаки)',
    yieldKt: 21,
    meta: 'Плутониевая · США 1945',
    material: 'pu239',
    materialMass: 6.2,
    assembly: 'implosion',
    description: 'Имплозия плутониевого ядра. КПД ~17%.',
  },
  {
    id: 'modern',
    name: 'W88',
    yieldKt: 475,
    meta: 'Термоядерная · США',
    material: 'pu239',
    materialMass: 4,
    assembly: 'thermonuclear',
    description: 'Современная боеголовка для МБР Trident II. Двухступенчатая.',
  },
  {
    id: 'tsar',
    name: 'Царь-бомба',
    yieldKt: 50000,
    meta: 'Термоядерная · СССР 1961',
    material: 'pu239',
    materialMass: 12,
    assembly: 'thermonuclear',
    description: 'Самое мощное взорванное устройство. Изначально проектировалась на 100 Мт.',
  },
];
