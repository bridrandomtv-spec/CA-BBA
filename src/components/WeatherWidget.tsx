// Widget météo — appelle /api/weather (proxy serveur, même origine) au lieu
// d'api.open-meteo.com : avec la CSP durcie (connect-src 'self'), l'appel
// direct aurait été BLOQUÉ en production et le widget serait tombé en erreur
// dès le déploiement. Le format de réponse est celui d'open-meteo, inchangé.
import { useState, useEffect } from 'react';
import { Droplets, Wind, Sun, Cloud, CloudRain, CloudLightning, MapPin, Loader2 } from 'lucide-react';

interface WeatherData {
  temp: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  icon: any;
  color: string;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Network error: ${res.status}`);

        const data = await res.json();
        const current = data.current;

        let condition = "مشمس وصافي";
        let IconComponent = Sun;
        let colorClass = "text-yellow-500";
        let code = current.weather_code;

        if (code === 0) {
          condition = "مشمس وصافي";
          IconComponent = Sun;
          colorClass = "text-yellow-500";
        } else if (code >= 1 && code <= 3) {
          condition = "غائم جزئياً";
          IconComponent = Cloud;
          colorClass = "text-zinc-400";
        } else if (code >= 45 && code <= 48) {
          condition = "ضباب";
          IconComponent = Cloud;
          colorClass = "text-zinc-400";
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
          condition = "ممطر";
          IconComponent = CloudRain;
          colorClass = "text-blue-500";
        } else if (code >= 71 && code <= 77) {
          condition = "ثلج";
          IconComponent = Cloud;
          colorClass = "text-white";
        } else if (code >= 95 && code <= 99) {
          condition = "عواصف رعدية";
          IconComponent = CloudLightning;
          colorClass = "text-purple-500";
        }

        setWeather({
          temp: Math.round(current.temperature_2m),
          humidity: Math.round(current.relative_humidity_2m),
          windSpeed: Math.round(current.wind_speed_10m),
          condition: condition,
          icon: IconComponent,
          color: colorClass
        });
        setError(false);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(true);
        setLoading(false);
      }
    };

    fetchWeather();

    // Le proxy met en cache 10 min côté serveur : un rafraîchissement client
    // toutes les 15 min ne génère au pire qu'un appel fournisseur par tranche.
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden min-h-[140px]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>

      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-white text-lg">طقس الملعب</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-800 px-2 py-1 rounded-lg">
          <MapPin size={12} className="text-zinc-500" />
          <span className="text-[10px] text-zinc-400 font-bold">برج بوعريريج (مباشر)</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-20 relative z-10">
          <Loader2 className="w-6 h-6 text-yellow-500 animate-spin mb-2" />
          <span className="text-xs text-zinc-500">جاري الاتصال بالأقمار الصناعية...</span>
        </div>
      ) : error || !weather ? (
        <div className="flex flex-col justify-center items-center h-20 relative z-10">
          <span className="text-xs text-red-500">حدث خطأ في جلب بيانات الطقس</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 ${weather.color === 'text-yellow-500' ? 'bg-yellow-500/10' : 'bg-zinc-800'} rounded-full flex items-center justify-center ${weather.color} relative`}>
                <weather.icon size={32} className={weather.color === 'text-yellow-500' ? 'fill-yellow-500' : ''} />
                {weather.color === 'text-yellow-500' && (
                  <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping opacity-75"></div>
                )}
              </div>
              <div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white tracking-tighter">{weather.temp}°</span>
                  <span className="text-sm font-bold text-zinc-500 mb-1">C</span>
                </div>
                <p className={`text-sm font-bold ${weather.color}`}>{weather.condition}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-r border-zinc-800 pr-4">
              <div className="flex items-center gap-2 text-xs">
                <Wind size={14} className="text-zinc-500" />
                <span className="text-zinc-400 font-bold" dir="ltr">{weather.windSpeed} km/h</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Droplets size={14} className="text-zinc-500" />
                <span className="text-zinc-400 font-bold">{weather.humidity}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center gap-2 text-[10px] text-zinc-400 relative z-10">
            <span className={`w-2 h-2 rounded-full ${weather.temp > 35 ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <span>
              {weather.temp > 35
                ? 'الطقس حار جداً، يُنصح بإحضار قبعات واقية للملعب.'
                : 'الظروف مثالية لإجراء المباراة القادمة في ملعب 20 أوت'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
