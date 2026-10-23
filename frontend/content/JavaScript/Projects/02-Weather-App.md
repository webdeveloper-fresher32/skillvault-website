# Project 2: Weather App (Fetch API + Async/Await)

**Level:** Beginner
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 4, 5 (DOM Manipulation, Asynchronous JavaScript)

---

## Overview

You will build a small app that looks up the current weather for any city by calling a free public weather API with the **Fetch API** and `async/await`. You will handle three UI states — loading, success, and error — and render the result into the DOM. No API key is required: the project uses [Open-Meteo](https://open-meteo.com/), a free weather API that needs no authentication, combined with its free geocoding endpoint to turn a city name into coordinates.

```
User types "Melbourne" → submits form
        │
        ▼
geocode(cityName)  ──▶  GET https://geocoding-api.open-meteo.com/v1/search?name=Melbourne
        │                       returns { latitude, longitude, country, ... }
        ▼
getWeather(lat, lon) ──▶ GET https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current_weather=true
        │                       returns { current_weather: { temperature, windspeed, weathercode } }
        ▼
render(data) ──▶ updates #result div
```

---

## Prerequisites

- A modern browser with internet access (the app calls a live public API)
- Comfortable with `querySelector`, event listeners, updating `textContent`/`innerHTML` (Phase 4)
- Understand Promises, `async`/`await`, and `try/catch` for error handling (Phase 5)
- Familiar with `fetch()`, reading a JSON body with `response.json()`, and checking `response.ok` (Phase 5)

---

## What You'll Learn

- Calling a real, external HTTP API from the browser with `fetch`
- Chaining two dependent network calls (geocode → forecast) with `async/await`
- Correctly checking `response.ok` / `response.status` — `fetch` does **not** reject on HTTP error status codes
- Modeling three UI states (loading / success / error) and keeping the DOM in sync with each
- Debouncing user input so you don't fire a network request on every keystroke
- Basic defensive coding around missing/ambiguous geocoding results (city not found, multiple matches)

---

## Project Structure

```
02-weather-app/
├── index.html
├── style.css
└── app.js
```

---

## Step-by-Step Guide

### Step 1 — Scaffold the HTML

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weather App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="app">
    <h1>Weather Lookup</h1>

    <form id="search-form">
      <input type="text" id="city-input" placeholder="Enter a city name..." required />
      <button type="submit">Search</button>
    </form>

    <div id="status" class="status" hidden></div>

    <section id="result" class="result" hidden>
      <h2 id="result-city"></h2>
      <p id="result-temp" class="temp"></p>
      <p id="result-wind"></p>
      <p id="result-condition"></p>
    </section>
  </main>

  <script src="app.js"></script>
</body>
</html>
```

### Step 2 — Styling

Create `style.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: linear-gradient(135deg, #0ea5e9, #0369a1);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.app {
  background: #fff;
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  height: fit-content;
}

h1 { margin-bottom: 1.25rem; font-size: 1.4rem; color: #0c4a6e; }

#search-form { display: flex; gap: 0.5rem; }
#city-input {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
}
#search-form button {
  padding: 0.6rem 1.2rem;
  background: #0284c7;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
#search-form button:disabled { opacity: 0.6; cursor: not-allowed; }

.status { margin-top: 1rem; font-size: 0.9rem; color: #64748b; }
.status.error { color: #dc2626; }

.result { margin-top: 1.5rem; text-align: center; }
.result .temp { font-size: 2.5rem; font-weight: bold; color: #0c4a6e; margin: 0.5rem 0; }
.result p { color: #475569; }
```

### Step 3 — API layer with `async/await` and error handling

Create `app.js`. Start with two small functions that each wrap one HTTP call, both of which throw a descriptive error rather than returning `undefined` on failure:

```javascript
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Resolve a free-text city name to coordinates.
 * @param {string} city
 * @returns {Promise<{ name: string, country: string, latitude: number, longitude: number }>}
 */
async function geocodeCity(city) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    // fetch() only rejects on network failure — HTTP 4xx/5xx must be checked manually
    throw new Error(`Geocoding request failed (status ${response.status})`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`No location found for "${city}"`);
  }

  const { name, country, latitude, longitude } = data.results[0];
  return { name, country, latitude, longitude };
}

/**
 * Fetch the current weather for a coordinate pair.
 * @param {number} latitude
 * @param {number} longitude
 */
async function getCurrentWeather(latitude, longitude) {
  const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current_weather=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed (status ${response.status})`);
  }

  const data = await response.json();
  if (!data.current_weather) {
    throw new Error('Weather data unavailable for this location');
  }

  return data.current_weather; // { temperature, windspeed, weathercode, ... }
}
```

### Step 4 — A small lookup table for weather codes

Open-Meteo returns a numeric WMO weather code, not a human-readable string:

```javascript
const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm',
};

function describeWeatherCode(code) {
  return WEATHER_CODES[code] || 'Unknown conditions';
}
```

### Step 5 — UI state management (loading / success / error)

```javascript
const formEl       = document.getElementById('search-form');
const inputEl      = document.getElementById('city-input');
const statusEl     = document.getElementById('status');
const resultEl     = document.getElementById('result');
const submitBtn    = formEl.querySelector('button');

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.classList.toggle('error', isError);
  resultEl.hidden = true;
}

function showResult({ name, country }, weather) {
  document.getElementById('result-city').textContent = `${name}, ${country}`;
  document.getElementById('result-temp').textContent = `${weather.temperature}°C`;
  document.getElementById('result-wind').textContent = `Wind: ${weather.windspeed} km/h`;
  document.getElementById('result-condition').textContent = describeWeatherCode(weather.weathercode);

  statusEl.hidden = true;
  resultEl.hidden = false;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Searching...' : 'Search';
}
```

### Step 6 — Wiring it together on form submit

```javascript
formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const city = inputEl.value.trim();
  if (!city) return;

  setLoading(true);
  showStatus(`Looking up "${city}"...`);

  try {
    const location = await geocodeCity(city);
    const weather = await getCurrentWeather(location.latitude, location.longitude);
    showResult(location, weather);
  } catch (err) {
    // Both geocodeCity and getCurrentWeather throw Error objects with useful messages
    showStatus(err.message, true);
  } finally {
    setLoading(false);
  }
});
```

### Step 7 — (Optional but recommended) handle offline / network failure explicitly

`fetch` rejects the returned Promise for genuine network failures (DNS failure, no connectivity, CORS block) — that rejection is already caught by the surrounding `try/catch` above. Test it deliberately:

```javascript
// In devtools: Network tab → set throttling to "Offline", then submit the form.
// Expected: showStatus displays "Failed to fetch" (or similar), not a silent failure.
```

### Step 8 — Run it

Open `index.html` in a browser (a local static server avoids any `file://` CORS quirks — e.g. `npx serve .` or VS Code Live Server). Search for a city and confirm the temperature renders.

---

## Verification

| Check | How to test | Expected result |
|-------|-------------|------------------|
| Successful search | Search "London" | City name, temperature, wind, and condition render |
| Loading state | Search any city, observe button immediately | Button reads "Searching..." and is disabled during the request |
| City not found | Search "asdkjhasdkjh" | Error message "No location found for..." shown, no stale result displayed |
| Empty input | Submit with an empty field | Form's `required` attribute blocks submission |
| HTTP error handling | Temporarily point `FORECAST_URL` at a bad path | Error message with the status code is shown, not an unhandled rejection in the console |
| Offline handling | DevTools → Network → Offline, then search | Error message shown, app remains usable afterward |
| Repeated searches | Search two different cities in a row | Result updates fully to the second city; no stale fields from the first |

---

## Stretch Goals

1. **Debounced live search** — as the user types, show geocoding suggestions in a dropdown (debounce the input by ~300 ms so you don't call the API on every keystroke).
2. **°C / °F toggle** — add a unit toggle and convert `temperature` client-side without re-fetching.
3. **Geolocation** — add a "Use my location" button using the browser's `navigator.geolocation.getCurrentPosition`, skipping the geocoding step entirely.
4. **5-day forecast** — call Open-Meteo's `daily=temperature_2m_max,temperature_2m_min,weathercode` parameters and render a horizontal forecast strip.
5. **Request cancellation** — use `AbortController` to cancel an in-flight request if the user submits a new search before the previous one resolves.

---

## Completion Checklist

- [ ] Searching a valid city shows temperature, wind speed, and a human-readable condition
- [ ] A loading indicator is visible for the duration of the network calls
- [ ] Searching an invalid/unknown city shows a clear error message, not a crash
- [ ] `response.ok` is checked explicitly for both API calls (fetch does not throw on 4xx/5xx)
- [ ] All async code is wrapped in `try/catch`, and the `finally` block always resets the loading state
- [ ] The result panel and the error panel are never both visible at the same time
- [ ] Submitting a second search fully replaces the previous result (no stale data)
