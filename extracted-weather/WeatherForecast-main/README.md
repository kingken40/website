## Weather Forecast App

Live demo: [https://weather-forecast-ken.vercel.app/](https://weather-forecast-ken.vercel.app/)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser to see the result.

You can start editing the page by modifying app/page.js. The page auto-updates as you edit the file.

This project uses next/font to automatically optimize and load Geist, a new font family for Vercel.

## How It Works
- Enter a city name and optionally a state abbreviation (e.g., “Miami, FL”) to get the current weather.

- If you only provide the city name without a state, the app fetches weather for the largest or most prominent city with that name by default, as determined by the OpenWeatherMap API.

- Because some city names exist in multiple states (such as Springfield, Jackson, or Salem), including the state name helps ensure accurate and precise weather data.
