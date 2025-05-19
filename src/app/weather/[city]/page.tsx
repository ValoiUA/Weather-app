'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type WeatherData = {
  name: string;
  main: {
    temp: number;
    humidity: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
  };
  weather: {
    id: number;
    description: string;
    icon: string;
    main: string;
  }[];
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  coord: {
    lat: number;
    lon: number;
  };
  clouds: {
    all: number;
  };
  visibility: number;
  timezone: number;
  dt: number;
};

type HourlyForecast = {
  dt: number;
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  pop: number;
};

type DailyForecast = {
  dt: number;
  temp: {
    day: number;
    min: number;
    max: number;
    night: number;
    eve: number;
    morn: number;
  };
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  humidity: number;
  wind_speed: number;
  wind_deg: number;
  clouds: number;
  pop: number;
  sunrise: number;
  sunset: number;
};

export default function WeatherPage({ params }: { params: { city: string } }) {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  const API_KEY = '710a8376497edd9944e2f9a9f72d0382';
  const city = decodeURIComponent(params.city);

  const getWeatherIcon = (weatherId: number, isDay: boolean = true) => {
    if (weatherId >= 200 && weatherId < 300) return '⚡';
    if (weatherId >= 300 && weatherId < 400) return '🌧️';
    if (weatherId >= 500 && weatherId < 600) return '🌧️';
    if (weatherId >= 600 && weatherId < 700) return '❄️';
    if (weatherId >= 700 && weatherId < 800) return '🌫️';
    if (weatherId === 800) return isDay ? '☀️' : '🌙';
    if (weatherId === 801) return isDay ? '🌤️' : '☁️';
    if (weatherId === 802) return '⛅';
    if (weatherId > 802) return '☁️';
    return '🌡️';
  };

  const getDayName = (timestamp: number, timezone: number) => {
    const date = new Date((timestamp + timezone) * 1000);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }; 
  
  const getDateFromTimestamp = (timestamp: number, timezone: number) => {
    const date = new Date((timestamp + timezone) * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC'
    });
  }; 

  const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const formatTime = (timestamp: number, timezone: number) => {
    const date = new Date((timestamp + timezone) * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'UTC' 
    });
  };

  useEffect(() => {
    const fetchWeatherAndForecast = async () => {
      try {
        setLoading(true);
        
        // Fetch current weather
        const weatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`
        );
        
        if (!weatherResponse.ok) {
          throw new Error('City not found');
        }
        
        const weatherData = await weatherResponse.json();
        setWeather(weatherData);
        
        // Fetch weather data including hourly and daily forecast (One Call API 3.0)
        console.log('Fetching forecast for:', weatherData.coord);
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherData.coord.lat}&lon=${weatherData.coord.lon}&appid=${API_KEY}&units=metric`;
        console.log('Forecast URL:', forecastUrl);
        
        try {
          const forecastResponse = await fetch(forecastUrl);
          const forecastData = await forecastResponse.json();
          
          if (!forecastResponse.ok) {
            throw new Error(forecastData.message || 'Failed to fetch forecast');
          }
          
          console.log('Forecast data:', forecastData);
          
          // Process 5-day / 3-hour forecast data
          if (forecastData.list && forecastData.list.length > 0) {
            // Get next 24 hours (8 x 3-hour intervals)
            const next24Hours = forecastData.list.slice(0, 8).map((item: any) => ({
              dt: item.dt,
              temp: item.main.temp,
              feels_like: item.main.feels_like,
              humidity: item.main.humidity,
              wind_speed: item.wind.speed,
              weather: item.weather,
              pop: item.pop || 0
            }));
            
            setHourlyForecast(next24Hours);
            
            // For daily forecast, we'll group by day
            const dailyData = forecastData.list.reduce((acc: any, item: any) => {
              const date = new Date(item.dt * 1000);
              const dateString = date.toLocaleDateString();
              
              if (!acc[dateString]) {
                acc[dateString] = {
                  dt: item.dt,
                  temp: {
                    day: item.main.temp,
                    max: item.main.temp_max,
                    min: item.main.temp_min,
                  },
                  weather: item.weather,
                  humidity: item.main.humidity,
                  wind_speed: item.wind.speed,
                  pop: item.pop || 0
                };
              } else {
                // Update max/min temps
                const day = acc[dateString];
                if (item.main.temp_max > day.temp.max) day.temp.max = item.main.temp_max;
                if (item.main.temp_min < day.temp.min) day.temp.min = item.main.temp_min;
              }
              
              return acc;
            }, {});
            
            // Convert to array and skip today
            const dailyForecastArray = Object.values(dailyData).slice(1, 7);
            setDailyForecast(dailyForecastArray as DailyForecast[]);
          }
        } catch (error) {
          console.error('Error fetching forecast:', error);
          setHourlyForecast([]);
          setDailyForecast([]);
        }
        
        // Update time and date
        const now = new Date();
        const localTime = new Date(now.getTime() + (weatherData.timezone * 1000));
        
        setTime(localTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'UTC' 
        }));
        
        setDate(localTime.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'UTC'
        }));
        
      } catch (err) {
        setError('Failed to fetch weather data. Please try another city.');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherAndForecast();
  }, [city]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-pulse mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full opacity-30"></div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Loading Weather
          </h2>
          <p className="text-gray-400">Fetching weather for {city}...</p>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-gray-300 mb-6">{error || 'Failed to load weather data.'}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/" 
              className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-all duration-300"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isDaytime = (date: Date, sunrise: number, sunset: number, timezone: number) => {
    const hour = date.getUTCHours() + (timezone / 3600);
    const sunriseHour = new Date((sunrise + timezone) * 1000).getUTCHours();
    const sunsetHour = new Date((sunset + timezone) * 1000).getUTCHours();
    return hour > sunriseHour && hour < sunsetHour;
  };

  const currentIsDaytime = isDaytime(new Date(), weather.sys.sunrise, weather.sys.sunset, weather.timezone);
  const weatherIcon = getWeatherIcon(weather.weather[0].id, currentIsDaytime);
  const windDirection = getWindDirection(weather.wind.deg);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${
      currentIsDaytime 
        ? 'from-blue-900 via-blue-800 to-purple-900' 
        : 'from-gray-900 via-gray-800 to-gray-900'
    } p-4 md:p-8 transition-colors duration-500`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Link 
            href="/" 
            className="bg-gray-800/80 hover:bg-gray-700/90 backdrop-blur-lg text-white p-3 rounded-xl transition-all duration-300 border border-gray-700/50 shadow-lg"
            aria-label="Back to home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <div className="text-right bg-gray-800/80 backdrop-blur-lg rounded-xl p-3 border border-gray-700/50 shadow-lg">
            <p className="text-gray-400 text-sm">{date}</p>
            <p className="text-white font-medium">{time}</p>
          </div>
        </header>

        {/* Main Weather Card */}
        <div className="bg-gray-800/80 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-gray-700/50 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                {weather.name}, {weather.sys.country}
              </h1>
              <p className="text-gray-300 text-lg capitalize">{weather.weather[0].description}</p>
            </div>
            <div className="text-8xl my-4 md:my-0 transform transition-transform hover:scale-110">
              {weatherIcon}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700/50">
            <div className="text-6xl font-bold text-white text-center md:text-left">
              {Math.round(weather.main.temp)}°C
            </div>
            <div className="text-gray-300 text-center md:text-left">
              Feels like {Math.round(weather.main.feels_like)}°C
            </div>
          </div>
        </div>

        {/* Weather Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
            <h3 className="text-gray-400 text-sm font-medium mb-3">WIND</h3>
            <div className="flex items-center">
              <div className="text-3xl mr-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                💨
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {weather.wind.speed} m/s
                </div>
                <div className="text-gray-400 text-sm">
                  {windDirection} {weather.wind.gust ? `| Gusts: ${weather.wind.gust} m/s` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
            <h3 className="text-gray-400 text-sm font-medium mb-3">HUMIDITY</h3>
            <div className="flex items-center">
              <div className="text-3xl mr-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                💧
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {weather.main.humidity}%
                </div>
                <div className="text-gray-400 text-sm">
                  {weather.main.humidity > 70 ? 'High' : weather.main.humidity > 40 ? 'Moderate' : 'Low'} humidity
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
            <h3 className="text-gray-400 text-sm font-medium mb-3">PRESSURE</h3>
            <div className="flex items-center">
              <div className="text-3xl mr-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                📊
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {weather.main.pressure} hPa
                </div>
                <div className="text-gray-400 text-sm">
                  {weather.main.pressure > 1013 ? 'High' : 'Low'} pressure
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
            <h3 className="text-gray-400 text-sm font-medium mb-3">VISIBILITY</h3>
            <div className="flex items-center">
              <div className="text-3xl mr-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                👁️
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {weather.visibility / 1000} km
                </div>
                <div className="text-gray-400 text-sm">
                  {weather.visibility > 10000 ? 'Excellent' : weather.visibility > 5000 ? 'Good' : 'Reduced'} visibility
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
            <h3 className="text-gray-400 text-sm font-medium mb-3">SUNRISE & SUNSET</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="text-2xl mr-3 text-yellow-400">🌅</div>
                <div>
                  <div className="text-white font-medium">Sunrise</div>
                  <div className="text-gray-400 text-sm">
                    {formatTime(weather.sys.sunrise, weather.timezone)}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="text-2xl mr-3 text-orange-400">🌇</div>
                <div>
                  <div className="text-white font-medium">Sunset</div>
                  <div className="text-gray-400 text-sm">
                    {formatTime(weather.sys.sunset, weather.timezone)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
            <h3 className="text-gray-400 text-sm font-medium mb-3">TEMPERATURE RANGE</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="text-2xl mr-3 text-blue-400">❄️</div>
                  <div>
                    <div className="text-white font-medium">Min</div>
                    <div className="text-gray-400 text-sm">
                      {Math.round(weather.main.temp_min)}°C
                    </div>
                  </div>
                </div>
                <div className="h-10 w-px bg-gray-700/50"></div>
                <div className="flex items-center">
                  <div className="text-2xl mr-3 text-red-400">🔥</div>
                  <div>
                    <div className="text-white font-medium">Max</div>
                    <div className="text-gray-400 text-sm">
                      {Math.round(weather.main.temp_max)}°C
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-gradient-to-r from-blue-400 via-green-400 to-red-400 h-2.5 rounded-full" 
                  style={{ 
                    width: `${((weather.main.temp - weather.main.temp_min) / (weather.main.temp_max - weather.main.temp_min)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Hourly Forecast */}
        {hourlyForecast.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Today's Forecast</h2>
            <div className="flex overflow-x-auto pb-4 -mx-2">
              <div className="flex space-x-4 px-2">
                {hourlyForecast.map((hour, index) => {
                  const hourDate = new Date(hour.dt * 1000);
                  const hourString = hourDate.getHours() + ':00';
                  const isDaytime = hour.dt > weather.sys.sunrise && hour.dt < weather.sys.sunset;
                  
                  return (
                    <div key={hour.dt} className="flex-shrink-0 w-24 bg-gray-800/80 backdrop-blur-lg rounded-2xl p-3 border border-gray-700/50 shadow-lg">
                      <div className="text-center text-gray-300 text-sm mb-1">
                        {index === 0 ? 'Now' : hourString}
                      </div>
                      <div className="text-3xl text-center mb-2">
                        {getWeatherIcon(hour.weather[0].id, isDaytime)}
                      </div>
                      <div className="text-center text-white font-medium">
                        {Math.round(hour.temp)}°
                      </div>
                      <div className="text-center text-xs text-gray-400 mt-1">
                        {Math.round(hour.pop * 100)}%💧
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 6-Day Forecast */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">6-Day Forecast</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {dailyForecast.map((day, index) => (
              <div key={day.dt} className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-4 border border-gray-700/50 shadow-lg hover:shadow-blue-500/10 transition-all">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-white">
                      {index === 0 ? 'Tomorrow' : getDayName(day.dt, weather.timezone)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {getDateFromTimestamp(day.dt, weather.timezone)}
                    </div>
                  </div>
                  <div className="text-4xl">
                    {getWeatherIcon(day.weather[0].id, true)}
                  </div>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-2xl font-bold text-white">
                    {Math.round(day.temp.max)}°
                  </div>
                  <div className="text-gray-400 text-sm">
                    {Math.round(day.temp.min)}°
                  </div>
                  <div className="text-sm text-gray-300">
                    {day.weather[0].description}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700/50 grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-gray-400">💨</div>
                    <div>{Math.round(day.wind_speed)} m/s</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400">💧</div>
                    <div>{day.humidity}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400">☔</div>
                    <div>{Math.round(day.pop * 100)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search Again Button */}
        <div className="text-center">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-lg py-4 px-8 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-blue-500/20 transform hover:-translate-y-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Search Another City
          </Link>
        </div>
      </div>
    </div>
  );
}