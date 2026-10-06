import { $ } from '../config.js';
import { WEATHER, WEATHER_ROUNDS } from '../data/weather.js';
import { G, P, log } from './core.js';
import { FX } from '../fx/three-fx.js';
import { tip } from '../ui/tutorial.js';

export const W = () => G.weather.id;
export function weatherMod(el){ const m = WEATHER[W()].mod; return (m && m[el]) || 0; }
export function rollForecast(not){ const ids = Object.keys(WEATHER).filter(k => k !== not && k !== 'clear'); return ids[Math.random() * ids.length | 0]; }
export function changeWeather(id, byCard){
  G.weather = {id, left:WEATHER_ROUNDS};
  if (!byCard || G.forecast === id) G.forecast = rollForecast(id);
  log(`☁ Thời tiết đổi: <b>${WEATHER[id].name}</b>. ${WEATHER[id].desc}`, 'react');
  FX.setWeather(id); document.querySelector('.board')?.setAttribute('data-weather', id);
  if (id === 'heat') dryAll();
  tip('weather');
}
export function dryAll(){ for (const t of [...G.heroes, ...P(0).fam, ...P(1).fam]) delete t.st.wet; }
