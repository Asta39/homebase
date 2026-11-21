/** Open-Meteo: free, no API key. https://open-meteo.com */

export type Place = { name: string; lat: number; lon: number }
export type Weather = {
  temp: number; code: number; isDay: boolean; high: number; low: number; rain: number
  hourly: { time: string; temp: number; code: number }[]
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=${encodeURIComponent(q)}`)
  if (!r.ok) throw new Error(`Location search failed (${r.status})`)
  const d = await r.json()
  return (d.results ?? []).map((p: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
    name: [p.name, p.admin1, p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude,
  }))
}

export async function getWeather(p: Place): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&timezone=auto&forecast_days=2`
    + '&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Weather failed (${r.status})`)
  const d = await r.json()
  const now = d.current.time.slice(0, 13)
  const start = Math.max(0, d.hourly.time.findIndex((t: string) => t.slice(0, 13) === now))
  return {
    temp: Math.round(d.current.temperature_2m), code: d.current.weather_code, isDay: !!d.current.is_day,
    high: Math.round(d.daily.temperature_2m_max[0]), low: Math.round(d.daily.temperature_2m_min[0]),
    rain: d.daily.precipitation_probability_max[0] ?? 0,
    hourly: d.hourly.time.slice(start + 1, start + 7).map((t: string, i: number) => ({
      time: t.slice(11, 16), temp: Math.round(d.hourly.temperature_2m[start + 1 + i]), code: d.hourly.weather_code[start + 1 + i],
    })),
  }
}

/** WMO weather code → art key + label */
export function describe(code: number, isDay = true): [string, string] {
  if (code === 0) return [isDay ? 'sun' : 'moon', 'Clear']
  if (code <= 2) return [isDay ? 'partly' : 'cloud', 'Partly cloudy']
  if (code === 3) return ['cloud', 'Cloudy']
  if (code <= 48) return ['fog', 'Fog']
  if (code <= 57) return ['drizzle', 'Drizzle']
  if (code <= 67) return ['rain', 'Rain']
  if (code <= 77) return ['snow', 'Snow']
  if (code <= 82) return ['rain', 'Showers']
  if (code <= 86) return ['snow', 'Snow showers']
  return ['storm', 'Thunderstorm']
}
