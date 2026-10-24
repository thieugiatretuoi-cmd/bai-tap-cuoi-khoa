
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CACHE_TTL = 10 * 60 * 1000; // cache 10 phút

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Mã thời tiết WMO -> tiếng Việt
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

const cache = new Map(); // "lat,lng" -> { time, body }

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleWeather(url, res) {
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return sendJson(res, 400, { error: 'lat/lng không hợp lệ' });
  }

  const key = `${lat},${lng}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) {
    return sendJson(res, 200, hit.body);
  }

  try {
    const api = new URL('https://api.open-meteo.com/v1/forecast');
    api.search = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'dew_point_2m', 'precipitation', 'weather_code', 'pressure_msl',
        'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
      ].join(','),
      // Xác suất mưa chỉ có ở dữ liệu theo giờ -> lấy giờ hiện tại
      hourly: 'precipitation_probability',
      forecast_hours: '1',
      wind_speed_unit: 'ms',      // gió tính bằng m/s
      timezone: 'Asia/Bangkok',   // giờ Việt Nam
    }).toString();

    const r = await fetch(api, { signal: AbortSignal.timeout(10_000) });
    const raw = await r.json().catch(() => null);

    if (!r.ok || !raw || raw.error) {
      const reason = raw?.reason || `HTTP ${r.status}`;
      console.error('Open-Meteo lỗi:', reason);
      return sendJson(res, 502, { error: `Open-Meteo lỗi: ${reason}` });
    }

    const c = raw.current;
    if (!c) {
      return sendJson(res, 502, { error: 'Open-Meteo không trả về dữ liệu hiện tại' });
    }

    const body = {
      data: {
        time: c.time,                              // vd "2026-10-11T09:30"
        temperature: c.temperature_2m,             // °C
        apparentTemperature: c.apparent_temperature,
        humidity: c.relative_humidity_2m,          // %
        dewPoint: c.dew_point_2m,                  // °C
        pressure: c.pressure_msl,                  // hPa
        windSpeed: c.wind_speed_10m,               // m/s
        windGust: c.wind_gusts_10m,                // m/s
        windBearing: c.wind_direction_10m,         // độ
        precipitation: c.precipitation,            // mm
        precipProbability: raw.hourly?.precipitation_probability?.[0] ?? null, // %
        uvIndex: c.uv_index,                          // chỉ số UV
        uvRisk: c.uv_risk,                            // mức nguy cơ UV
        uvSafeTime: c.uv_safe_time,                   // thời gian an toàn (phút)
        weatherCode: c.weather_code,
        summary: WEATHER_CODES[c.weather_code] || '',
      },
    };

    cache.set(key, { time: Date.now(), body });
    sendJson(res, 200, body);
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? 'Hết thời gian chờ Open-Meteo' : err.message;
    console.error('Lỗi gọi Open-Meteo:', msg);
    sendJson(res, 502, { error: msg });
  }
}

function serveStatic(url, res) {
  const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.join(__dirname, rel);

  // Chặn truy cập ra ngoài thư mục dự án (../)
  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  // Không cho tải file server hay file ẩn
  const base = path.basename(filePath);
  if (base === 'server.js' || base.startsWith('.')) {
    res.writeHead(404);
    return res.end('Not found');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/weather') {
    return handleWeather(url, res);
  }
  if (req.method === 'GET') {
    return serveStatic(url, res);
  }
  res.writeHead(405);
  res.end('Method not allowed');
}).listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));