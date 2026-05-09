// Города для быстрого выбора цели на карте.
// Население — приблизительное, нужно для оценки потерь.
// Координаты — центр города.
export const CITIES = [
  { id: 'moscow',     name: 'Москва',          country: 'Россия',     lat: 55.7558, lon: 37.6173, pop: 12_600_000 },
  { id: 'spb',        name: 'Санкт-Петербург', country: 'Россия',     lat: 59.9343, lon: 30.3351, pop: 5_400_000 },
  { id: 'novosib',    name: 'Новосибирск',     country: 'Россия',     lat: 55.0084, lon: 82.9357, pop: 1_630_000 },
  { id: 'ekb',        name: 'Екатеринбург',    country: 'Россия',     lat: 56.8389, lon: 60.6057, pop: 1_540_000 },
  { id: 'kazan',      name: 'Казань',          country: 'Россия',     lat: 55.7963, lon: 49.1064, pop: 1_300_000 },
  { id: 'kyiv',       name: 'Киев',            country: 'Украина',    lat: 50.4501, lon: 30.5234, pop: 2_950_000 },
  { id: 'minsk',      name: 'Минск',           country: 'Беларусь',   lat: 53.9006, lon: 27.5590, pop: 2_000_000 },
  { id: 'london',     name: 'Лондон',          country: 'Великобритания', lat: 51.5074, lon: -0.1278, pop: 9_000_000 },
  { id: 'paris',      name: 'Париж',           country: 'Франция',    lat: 48.8566, lon: 2.3522,  pop: 2_160_000 },
  { id: 'berlin',     name: 'Берлин',          country: 'Германия',   lat: 52.5200, lon: 13.4050, pop: 3_770_000 },
  { id: 'frankfurt',  name: 'Франкфурт',       country: 'Германия',   lat: 50.1109, lon: 8.6821,  pop: 770_000 },
  { id: 'rome',       name: 'Рим',             country: 'Италия',     lat: 41.9028, lon: 12.4964, pop: 2_870_000 },
  { id: 'madrid',     name: 'Мадрид',          country: 'Испания',    lat: 40.4168, lon: -3.7038, pop: 3_300_000 },
  { id: 'nyc',        name: 'Нью-Йорк',        country: 'США',        lat: 40.7128, lon: -74.0060, pop: 8_400_000 },
  { id: 'la',         name: 'Лос-Анджелес',    country: 'США',        lat: 34.0522, lon: -118.2437, pop: 3_900_000 },
  { id: 'wash',       name: 'Вашингтон',       country: 'США',        lat: 38.9072, lon: -77.0369, pop: 700_000 },
  { id: 'beijing',    name: 'Пекин',           country: 'Китай',      lat: 39.9042, lon: 116.4074, pop: 21_500_000 },
  { id: 'tokyo',      name: 'Токио',           country: 'Япония',     lat: 35.6762, lon: 139.6503, pop: 13_960_000 },
  { id: 'hiroshima',  name: 'Хиросима',        country: 'Япония',     lat: 34.3853, lon: 132.4553, pop: 1_200_000, historic: true },
  { id: 'nagasaki',   name: 'Нагасаки',        country: 'Япония',     lat: 32.7503, lon: 129.8779, pop: 410_000, historic: true },
];
