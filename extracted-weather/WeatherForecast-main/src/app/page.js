"use client";

import BackButton from "./components/BackButton"; 
import React, { useState } from 'react';
import { useRouter } from "next/navigation";
import styles from './page.module.css';

const Home = () => {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState('');

  const getWeather = async () => {
    if (!city) {
      setError('Please enter a city');
      return;
    }
    const query = new URLSearchParams({ city, state });
    try {
      const res = await fetch(`/api/weather?${query.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setWeather({
          city: data.name,
          temperatureF: data.main.temp,
          condition: data.weather[0].description,
        });
        setError('');
      } else {
        setError(data.error || 'Error fetching weather');
        setWeather(null);
      }
    } catch {
      setError('Failed to fetch weather data');
      setWeather(null);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🌤️ Weather Forecast</h1>
      <div className={styles.inputGroup}>
        <input
          type="text"
          placeholder="Enter city name"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={styles.input}
        />
        <input
          type="text"
          placeholder="State (optional)"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className={styles.input}
        />
      </div>
      <div className={styles.buttonGroup}>
        <button onClick={getWeather} className={styles.button}>
            🔍 Get Weather
        </button>
        {/* &nbsp;&nbsp;
        <BackButton /> */}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {weather && (
        <div className={styles.weatherCard}>
            <h2 className={styles.weatherTitle}>📍 {weather.city}</h2>
            <div className={styles.weatherInfo}>
            <div className={styles.temperature}>🌡️ {Math.round(weather.temperatureF)}°F</div>
            <div className={styles.condition}>{weather.condition}</div>
            </div>
        </div>
        )}

    </div>
  );
};

export default Home;
