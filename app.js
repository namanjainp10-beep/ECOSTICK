/* ECOSTICK dashboard
   - DEVICE_URL empty  -> demo mode with simulated readings
   - DEVICE_URL set    -> polls your device (e.g. ESP32) for JSON like:
     {"pm25":42,"pm10":88,"temp":31.2,"humidity":48,"pressure":1006.4,
      "soilMoisture":35,"soilPh":6.8,"soilTemp":27.5}                       */
const CONFIG = {
  DEVICE_URL: "",          // e.g. "http://192.168.1.50/data"
  POLL_MS: 3000,
  MAX_POINTS: 120
};

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const history = [];
let paused = false, metric = "pm25", simState = null;

/* ---------- AQI (India CPCB breakpoints) ---------- */
const BP = {
  pm25: [[0,30,0,50],[31,60,51,100],[61,90,101,200],[91,120,201,300],[121,250,301,400],[251,500,401,500]],
  pm10: [[0,50,0,50],[51,100,51,100],[101,250,101,200],[251,350,201,300],[351,430,301,400],[431,800,401,500]]
};
const CATS = [
  [50,"Good","#3fae5a","Air is clean. Enjoy being outside."],
  [100,"Satisfactory","#9cc43a","Fine for most people. Very sensitive people may notice it."],
  [200,"Moderate","#e6b422","Sensitive groups should limit long outdoor activity."],
  [300,"Poor","#e8832a","Limit time outside. Consider a mask."],
  [400,"Very poor","#d44a3a","Avoid outdoor exercise. Keep windows closed."],
  [Infinity,"Severe","#8a2a5c","Stay indoors if you can."]
];
function sub(type, c){
  for (const [cl,ch,il,ih] of BP[type]) if (c <= ch) return Math.round((ih-il)/(ch-cl)*(c-cl)+il);
  return 500;
}
const aqiOf = d => Math.max(sub("pm25", d.pm25), sub("pm10", d.pm10));
const catOf = a => CATS.find(c => a <= c[0]);

/* ---------- Rain likelihood (simple indicator, not a forecast) ---------- */
function dewPoint(t, rh){
  const a = 17.62, b = 243.12, g = Math.log(rh/100) + a*t/(b+t);
  return b*g/(a-g);
}
function rainChance(d){
  const spread = d.temp - dewPoint(d.temp, d.humidity);
  let score = clamp((d.humidity - 55) * 1.6, 0, 60);      // humid air
  score += clamp((6 - spread) * 4, 0, 20);                 // close to dew point
  const past = history.length > 10 ? history[history.length - 10].pressure : null;
  const drop = past ? past - d.pressure : 0;               // falling pressure
  score += clamp(drop * 10, 0, 20);
  const why = d.humidity > 75 ? "air is very humid" : drop > 0.8 ? "pressure is falling" : spread < 3 ? "air is near saturation" : "air is fairly dry";
  return { pct: Math.round(clamp(score, 0, 95)), why };
}

/* ---------- Plant advice ---------- */
function advise(d, aqi, rain){
  const out = [];
  const add = (cls, t) => out.push([cls, t]);
  if (d.soilMoisture < 25) add(rain.pct > 60 ? "warn" : "bad", rain.pct > 60 ? "Soil is dry, but rain looks likely. Wait before watering." : "Soil is dry. Water your plants.");
  else if (d.soilMoisture < 40) add("warn", "Soil moisture is getting low. Check again in a few hours.");
  else if (d.soilMoisture > 80) add("warn", "Soil is waterlogged. Hold off watering and check drainage.");
  else add("", "Soil moisture is in a healthy range.");
  if (d.soilPh < 5.5) add("warn", "Soil is acidic. Most plants prefer pH 6.0–7.5.");
  else if (d.soilPh > 8) add("warn", "Soil is alkaline. Compost can help bring pH down.");
  if (d.temp > 38) add("bad", "Heat stress risk. Give shade and water in the evening.");
  else if (d.temp < 5) add("warn", "Cold risk. Protect tender plants overnight.");
  if (aqi > 200) add("warn", "Dust and pollution build up on leaves. Rinse them gently.");
  return out;
}

/* ---------- Data source ---------- */
function simulate(){
  if (!simState) simState = { t: 0, soil: 55, pres: 1008 };
  const s = simState; s.t += 1;
  s.soil = clamp(s.soil - 0.15 + (Math.random() < 0.02 ? 25 : 0), 8, 90);
  s.pres += (Math.random() - 0.55) * 0.3;
  const day = Math.sin(s.t / 40);
  const temp = 30 + day * 4 + Math.random() * 0.4;
  return {
    pm25: Math.max(5, 70 + Math.sin(s.t / 25) * 35 + (Math.random() - .5) * 8),
    pm10: Math.max(10, 130 + Math.sin(s.t / 25) * 50 + (Math.random() - .5) * 12),
    temp, humidity: clamp(55 - day * 15 + (Math.random() - .5) * 3, 20, 98),
    pressure: s.pres, soilMoisture: s.soil, soilPh: 6.7 + (Math.random() - .5) * 0.1,
    soilTemp: temp - 3
  };
}
async function read(){
  if (!CONFIG.DEVICE_URL) return simulate();
  const r = await fetch(CONFIG.DEVICE_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.json();
}

/* ---------- Render ---------- */
const f = (v, n = 0) => Number(v).toFixed(n);
function render(d){
  const aqi = aqiOf(d), cat = catOf(aqi), rain = rainChance(d);
  $("aqi").textContent = $("stickAqi").textContent = aqi;
  $("soil").textContent = f(d.soilMoisture);
  $("stickCat").textContent = cat[1];
  $("aqiMsg").textContent = cat[1] + ". " + cat[3];
  $("stickAir").style.background = cat[2];
  $("pm25").textContent = f(d.pm25); $("pm10").textContent = f(d.pm10);
  $("temp").textContent = f(d.temp,1); $("hum").textContent = f(d.humidity);
  $("pres").textContent = f(d.pressure,1);
  $("stickTemp").textContent = f(d.temp,1) + " °C"; $("stickHum").textContent = f(d.humidity) + "% RH";
  $("stickSoil").textContent = f(d.soilMoisture) + "%";
  $("soilFill").style.setProperty("--lvl", d.soilMoisture + "%");
  $("ph").textContent = f(d.soilPh,1); $("soilT").textContent = f(d.soilTemp,1);
  $("rainBar").style.width = rain.pct + "%";
  $("rainPct").textContent = rain.pct + "%"; $("rainWhy").textContent = rain.why;
  $("advice").innerHTML = advise(d, aqi, rain).map(([c,t]) => `<li class="${c}">${t}</li>`).join("");

  // pollution pattern hint from recent PM2.5 change
  const prev = history.length > 10 ? history[history.length - 10].pm25 : null;
  let trend = "Steady", hint = "";
  if (prev){
    const ch = (d.pm25 - prev) / prev;
    if (ch > 0.25){ trend = "Rising"; hint = "PM2.5 is climbing fast. Possible nearby smoke, traffic or construction dust."; }
    else if (ch < -0.25){ trend = "Falling"; hint = "Air is clearing up."; }
  }
  $("aqiTrend").textContent = trend; $("sourceHint").textContent = hint;
}

/* ---------- History chart ---------- */
const METRICS = { pm25:"PM2.5", pm10:"PM10", temp:"Temperature", humidity:"Humidity", soilMoisture:"Soil moisture", pressure:"Pressure" };
function buildTabs(){
  $("tabs").innerHTML = Object.entries(METRICS).map(([k,l]) =>
    `<button role="tab" data-k="${k}" aria-selected="${k===metric}">${l}</button>`).join("");
  $("tabs").onclick = e => { const k = e.target.dataset.k; if (k){ metric = k; buildTabs(); drawChart(); } };
}
function drawChart(){
  const el = $("chart");
  if (history.length < 2){ el.innerHTML = ""; $("chartNote").textContent = "Collecting readings…"; return; }
  const vals = history.map(h => h[metric]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v,i) => `${(i/(vals.length-1))*600},${150 - ((v-lo)/span)*140}`).join(" ");
  el.innerHTML = `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
  $("chartNote").textContent = `${METRICS[metric]}: low ${lo.toFixed(1)}, high ${hi.toFixed(1)} over ${history.length} readings.`;
}
function downloadCsv(){
  const keys = ["time","pm25","pm10","temp","humidity","pressure","soilMoisture","soilPh","soilTemp"];
  const rows = history.map(h => keys.map(k => h[k]).join(","));
  const blob = new Blob([keys.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "ecostick-readings.csv"; a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Loop ---------- */
function setStatus(cls, text){ $("dot").className = "dot " + cls; $("statusText").textContent = text; }
async function tick(){
  if (paused) return;
  try {
    const d = await read();
    d.time = new Date().toISOString();
    render(d);
    history.push(d); if (history.length > CONFIG.MAX_POINTS) history.shift();
    drawChart();
    setStatus(CONFIG.DEVICE_URL ? "live" : "demo", (CONFIG.DEVICE_URL ? "Live" : "Demo data") + " · " + new Date().toLocaleTimeString());
  } catch (e){
    setStatus("err", "Can't reach the device. Check DEVICE_URL and Wi-Fi.");
  }
}
$("pauseBtn").onclick = () => { paused = !paused; $("pauseBtn").textContent = paused ? "Resume" : "Pause"; };
$("csvBtn").onclick = downloadCsv;
$("modeNote").textContent = CONFIG.DEVICE_URL ? "" : "Showing simulated demo data. Set DEVICE_URL in app.js to connect your ECOSTICK.";
buildTabs(); tick(); setInterval(tick, CONFIG.POLL_MS);
