/** 第三方能力：Open-Meteo（无需 API Key） */

export type WeatherSnapshot = {
  city: string;
  latitude: number;
  longitude: number;
  temperature: number;
  windspeed: number;
  weathercode: number;
  label: string;
  fetchedAt: string;
};

const CODE_LABEL: Record<number, string> = {
  0: "晴朗",
  1: "大体晴朗",
  2: "局部多云",
  3: "阴天",
  45: "有雾",
  48: "雾凇",
  51: "毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  80: "阵雨",
  95: "雷阵雨",
};

export async function fetchBeijingWeather(): Promise<WeatherSnapshot> {
  const latitude = 39.9042;
  const longitude = 116.4074;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current_weather=true&timezone=Asia%2FShanghai`;

  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo 请求失败: ${res.status}`);
  const data = await res.json();
  const current = data.current_weather;
  const code = Number(current.weathercode);
  return {
    city: "北京",
    latitude,
    longitude,
    temperature: Number(current.temperature),
    windspeed: Number(current.windspeed),
    weathercode: code,
    label: CODE_LABEL[code] ?? `天气代码 ${code}`,
    fetchedAt: new Date().toISOString(),
  };
}
