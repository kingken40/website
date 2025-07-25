// src/WeatherPage.js
import React, { useState } from 'react';
import axios from 'axios';
import './styles/styles.css'; // Import your styles
const WeatherPage = () => {
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [weather, setWeather] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const getWeather = async () => {
        const apiKey = 'c7fe858b7752c6456b2b27d883f601da'; // Replace with your OpenWeatherMap API key
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},${state}&units=imperial&appid=${apiKey}`;
        setLoading(true); // Show loading
        try {
            const response = await axios.get(url);
            const data = response.data;
            if (response.status === 200) {
                const temperatureF = data.main.temp;
                const temperatureC = ((temperatureF - 32) * 5) / 9; // Convert F to C
                let comment = '';
                // Add comments based on temperature
                if (temperatureF > 100) {
                    comment = 'Scorching!';
                } else if (temperatureF > 90) {
                    comment = 'Hot!';
                } else if (temperatureF > 70) {
                    comment = 'Warm!';
                } else if (temperatureF > 50) {
                    comment = 'Cool!';
                } else {
                    comment = 'Cold!';
                }
                setWeather({
                    city: data.name,
                    state: state,
                    temperatureF: temperatureF,
                    temperatureC: temperatureC,
                    condition: data.weather[0].description,
                    humidity: `${data.main.humidity}%`,
                    comment: comment
                });
                setError('');
            } else {
                setError(data.message);
                setWeather(null);
            }
        } catch (err) {
            setError('Could not fetch weather data. Please check your input.');
            setWeather(null);
        } finally {
            setLoading(false); // Hide loading
        }
    };
    return (
        <div className="app">
            <h1>Weather Forecast</h1>
            <div className="weather-form">
                <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="State (2-letter code)"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                />
                <button onClick={getWeather}>Get Weather</button>
            </div>
            {loading && <div id="loading">Loading...</div>}
            {error && <p className="error">{error}</p>}
            {weather && (
                <div className="weather-output">
                    <h2>Weather in {weather.city}, {weather.state}</h2>
                    <p>Temperature: {weather.temperatureF.toFixed(1)} °F / {weather.temperatureC.toFixed(1)} °C - {weather.comment}</p>
                    <p>Condition: {weather.condition}</p>
                    <p>Humidity: {weather.humidity}</p>
                </div>
            )}
        </div>
    );
};
export default WeatherPage;