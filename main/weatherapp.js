(() => {
'use strict';
console.log('weather-app.js đã được tải');

// weather-app.js — gắn dữ liệu thời tiết vào giao diện

const CITIES = {
  hoChiMinh: { name: 'Hồ Chí Minh', lat: 10.8231, lng: 106.6297 },
  dongNai:   { name: 'Đồng Nai',    lat: 10.9574, lng: 106.8426 },
  binhDuong: { name: 'Bình Dương',  lat: 10.9804, lng: 106.6519 },
};

const state = { city: 'hoChiMinh', view: 'today', data: null, error: null, loading: false };
const area = document.querySelector('.content-area');
let requestId = 0; // tránh việc phản hồi cũ ghi đè phản hồi mới khi bấm nhanh

// ---------- Helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function num(v, digits = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits).replace(/\.0+$/, '') : '—';
}

function pick(d, ...keys) {
  for (const k of keys) if (d[k] !== undefined && d[k] !== null) return d[k];
  return undefined;
}

// Thang UV của WHO
function uvLevel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n < 3) return 'Thấp';
  if (n < 6) return 'Trung bình';
  if (n < 8) return 'Cao';
  if (n < 11) return 'Rất cao';
  return 'Cực cao';
}

// ---------- Render ----------
function stat(label, value) {
  return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}

function render() {
  const city = CITIES[state.city];

  if (state.loading) {
    area.innerHTML = `<div class="weather-card"><p class="weather-msg">Đang tải dữ liệu ${esc(city.name)}…</p></div>`;
    return;
  }
  if (state.error) {
    area.innerHTML = `<div class="weather-card"><p class="weather-msg error">Không tải được dữ liệu: ${esc(state.error)}</p></div>`;
    return;
  }
  const d = state.data;
  if (!d) { area.innerHTML = ''; return; }

  const temp = pick(d, 'temperature');
  const humidity = pick(d, 'humidity');
  const wind = pick(d, 'windSpeed');
  const gust = pick(d, 'windGust');
  const bearing = pick(d, 'windBearing');
  const precipI = pick(d, 'precipitation');
  const precipP = pick(d, 'precipProbability');
  const feels = pick(d, 'apparentTemperature');
  const dew = pick(d, 'dewPoint');
  const pressure = pick(d, 'pressure');
  const summary = pick(d, 'summary');
  const uv = pick(d, 'uv');
  const uvMax = pick(d, 'uvMax');

  let title, big, stats;
  switch (state.view) {
    case 'humidity':
      title = 'Độ ẩm';
      big = `${num(humidity, 0)}%`;
      stats = stat('Điểm sương', `${num(dew)}°C`) + stat('Nhiệt độ', `${num(temp)}°C`);
      break;
    case 'windSpeed':
      title = 'Tốc độ gió';
      big = `${num(wind)} m/s`;
      stats = stat('Gió giật', `${num(gust)} m/s`) + stat('Hướng gió', `${num(bearing, 0)}°`);
      break;
    case 'precipitation':
      title = 'Mật độ mưa';
      big = `${num(precipI, 1)} mm`;
      stats = stat('Xác suất mưa', precipP == null ? '—' : `${num(precipP, 0)}%`) + stat('Độ ẩm', `${num(humidity, 0)}%`);
      break;
    case 'uv':
      title = 'Tia UV';
      big = num(uv, 1);
      stats = stat('Mức độ', uvLevel(uv)) + stat('UV cao nhất hôm nay', uvMax == null ? '—' : num(uvMax, 1));
      break;
    default:
      title = 'Thời tiết hôm nay';
      big = `${num(temp)}°C`;
      stats =
        stat('Cảm giác như', `${num(feels)}°C`) +
        stat('Độ ẩm', `${num(humidity, 0)}%`) +
        stat('Tốc độ gió', `${num(wind)} m/s`) +
        stat('Lượng mưa', `${num(precipI, 1)} mm`) +
        stat('Áp suất', `${num(pressure, 0)} hPa`) +
        stat('Tia UV', `${num(uv, 1)} (${uvLevel(uv)})`);
  }

  // d.time dạng "2026-10-11T09:30" (giờ Việt Nam) -> hiển thị "09:30 11/10/2026"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(d.time || '');
  const updated = m ? `${m[4]} ${m[3]}/${m[2]}/${m[1]}` : '';
  area.innerHTML = `
    <div class="weather-card">
      <h2 class="weather-city">${esc(city.name)} · ${title}</h2>
      <div class="weather-big">${big}</div>
      ${summary && state.view === 'today' ? `<p class="weather-summary">${esc(summary)}</p>` : ''}
      <div class="stat-grid">${stats}</div>
      ${updated ? `<p class="weather-updated">Cập nhật: ${esc(updated)}</p>` : ''}
    </div>`;
}

// ---------- Data ----------
// Gọi thẳng Open-Meteo từ trình duyệt (miễn phí, không cần API key, hỗ trợ CORS)
const WEATHER_CODES = {
  0: 'Trời quang', 1: 'Gần như quang đãng', 2: 'Có mây rải rác', 3: 'Nhiều mây',
  45: 'Sương mù', 48: 'Sương mù đóng băng',
  51: 'Mưa phùn nhẹ', 53: 'Mưa phùn vừa', 55: 'Mưa phùn dày',
  56: 'Mưa phùn lạnh nhẹ', 57: 'Mưa phùn lạnh dày',
  61: 'Mưa nhẹ', 63: 'Mưa vừa', 65: 'Mưa to',
  66: 'Mưa lạnh nhẹ', 67: 'Mưa lạnh to',
  71: 'Tuyết nhẹ', 73: 'Tuyết vừa', 75: 'Tuyết dày', 77: 'Hạt tuyết',
  80: 'Mưa rào nhẹ', 81: 'Mưa rào vừa', 82: 'Mưa rào rất to',
  85: 'Mưa tuyết nhẹ', 86: 'Mưa tuyết to',
  95: 'Dông', 96: 'Dông kèm mưa đá nhẹ', 97: 'Dông mạnh', 99: 'Dông kèm mưa đá lớn',
};

function buildUrl(lat, lng) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'dew_point_2m', 'precipitation', 'weather_code', 'pressure_msl',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index',
    ].join(','),
    daily: 'uv_index_max',   // UV cao nhất trong ngày
    forecast_days: '1',
    hourly: 'precipitation_probability',
    forecast_hours: '1',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Bangkok',
  }).toString();
  return u;
}

async function loadWeather() {
  const id = ++requestId;
  const { lat, lng } = CITIES[state.city];
  state.loading = true;
  state.error = null;
  render();

  try {
    const res = await fetch(buildUrl(lat, lng));
    const raw = await res.json().catch(() => null);
    if (id !== requestId) return; // đã có yêu cầu mới hơn
    if (!res.ok || !raw || raw.error) {
      throw new Error(raw?.reason || `HTTP ${res.status}`);
    }
    const c = raw.current;
    if (!c) throw new Error('API không trả về dữ liệu hiện tại');

    state.data = {
      time: c.time,
      temperature: c.temperature_2m,
      apparentTemperature: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      dewPoint: c.dew_point_2m,
      pressure: c.pressure_msl,
      windSpeed: c.wind_speed_10m,
      windGust: c.wind_gusts_10m,
      windBearing: c.wind_direction_10m,
      precipitation: c.precipitation,
      precipProbability: raw.hourly?.precipitation_probability?.[0] ?? null,
      uv: c.uv_index,
      uvMax: raw.daily?.uv_index_max?.[0] ?? null,
      summary: WEATHER_CODES[c.weather_code] || '',
    };
  } catch (err) {
    if (id !== requestId) return;
    state.data = null;
    state.error = err.message === 'Failed to fetch'
      ? 'Không kết nối được tới Open-Meteo (kiểm tra mạng)'
      : err.message;
  } finally {
    if (id === requestId) {
      state.loading = false;
      render();
    }
  }
}

// ---------- Events ----------
function setActive(buttons, activeEl) {
  buttons.forEach((b) => b.classList.toggle('active', b === activeEl));
}

// Nút thành phố (thanh trên)
const cityButtons = Object.keys(CITIES)
  .map((id) => document.getElementById(id))
  .filter(Boolean);

cityButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.city = btn.id;
    setActive(cityButtons, btn);
    loadWeather();
  });
});

// Nút chế độ xem (thanh bên) — chỉ các nút có id: today, humidity, windSpeed, precipitation
const viewButtons = [...document.querySelectorAll('.sidebar-btn[id]')];
viewButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.view = btn.id;
    setActive(viewButtons, btn);
    render(); // đã có dữ liệu rồi, chỉ cần vẽ lại
  });
});

// Khởi tạo
setActive(cityButtons, document.getElementById(state.city));
loadWeather();
})();