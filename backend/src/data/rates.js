// Справочник ставок: роль | партнерская | собственная
// Если собственная = 0, используется партнерская
const rates = [
  { role: 'Архитектор М', partner: 4000, own: 3500 },
  { role: 'Архитектор S', partner: 3200, own: 2800 },
  { role: 'Бизнес-аналитик S', partner: 2200, own: 1800 },
  { role: 'Бизнес-аналитик M', partner: 2600, own: 2200 },
  { role: 'Дизайнер M', partner: 2400, own: 2000 },
  { role: 'Дизайнер S', partner: 1900, own: 1600 },
  { role: 'Инженер по авто-тестированию M', partner: 2400, own: 2000 },
  { role: 'Инженер по авто-тестированию S', partner: 1900, own: 1600 },
  { role: 'Инженер по тестированию M', partner: 2200, own: 1800 },
  { role: 'Инженер по тестированию S', partner: 1700, own: 1400 },
  { role: 'Инженер техподдержки M', partner: 1800, own: 1500 },
  { role: 'Менеджер проекта M', partner: 3000, own: 2500 },
  { role: 'Менеджер проекта S', partner: 2400, own: 2000 },
  { role: 'Системный аналитик M', partner: 2800, own: 2400 },
  { role: 'Системный аналитик S', partner: 2300, own: 2000 },
  { role: 'Android-разработчик M', partner: 3300, own: 2800 },
  { role: 'Android-разработчик S', partner: 2600, own: 2200 },
  { role: 'DevOps-инженер S', partner: 2800, own: 2400 },
  { role: 'DevOps-инженер M', partner: 3500, own: 3000 },
  { role: 'Flutter-разработчик M', partner: 3300, own: 2800 },
  { role: 'Flutter-разработчик S', partner: 2600, own: 2200 },
  { role: 'Golang-разработчик M', partner: 3500, own: 3000 },
  { role: 'Golang-разработчик S', partner: 2800, own: 2400 },
  { role: 'iOS-разработчик M', partner: 3500, own: 3000 },
  { role: 'iOS-разработчик S', partner: 2800, own: 2400 },
  { role: 'Java-разработчик M', partner: 3300, own: 2800 },
  { role: 'Java-разработчик S', partner: 2600, own: 2200 },
  { role: '.NET-разработчик M (С#)', partner: 3300, own: 2800 },
  { role: '.NET-разработчик S (С#)', partner: 2600, own: 2200 },
  { role: 'Nuxt разработчик М', partner: 3000, own: 2500 },
  { role: 'PHP-разработчик M', partner: 2600, own: 2200 },
  { role: 'PHP-разработчик S', partner: 2100, own: 1800 },
  { role: 'React Native-разработчик М', partner: 3300, own: 2800 },
  { role: 'React Native-разработчик S', partner: 2600, own: 2200 },
  { role: 'Frontend-разработчик M (React / Angular / Vue / Javascript)', partner: 3300, own: 2800 },
  { role: 'Frontend-разработчик S (React / Angular / Vue / Javascript)', partner: 2600, own: 2200 },
  { role: 'Python-разработчик М', partner: 3300, own: 2800 },
  { role: 'Python-разработчик S', partner: 2600, own: 2200 },
];

function getRate(roleName) {
  const r = rates.find((x) => x.role === roleName);
  if (!r) return 0;
  return r.own || r.partner || 0;
}

module.exports = { rates, getRate };
