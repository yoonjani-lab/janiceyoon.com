const STATIONS = [
  {
    id: "bloom",
    name: "Bloom",
    hours: [6, 7, 8, 9],
    bpm: 76,
    track: "Morning Garden",
    mood: "Petals opening. Soft guitar of a slow morning.",
    why: "Early hours want something that wakes you without shouting.",
    scale: [0, 2, 4, 7, 9],
    wave: "triangle",
    swing: 0.04,
    drums: "soft",
    colors: { bg: "#edebdc", ink: "#111c47", accent: "#e85d75", glow: "#f7c6ce" }
  },
  {
    id: "drift",
    name: "Drift",
    hours: [10, 11, 12, 13],
    bpm: 84,
    track: "Study Window",
    mood: "Lo-fi haze. A beat you can think beside.",
    why: "Late morning is for staying in the work without watching the clock.",
    scale: [0, 3, 5, 7, 10],
    wave: "sine",
    swing: 0.12,
    drums: "lofi",
    colors: { bg: "#dce6d4", ink: "#1b3320", accent: "#3f7a4c", glow: "#c5ddb0" }
  },
  {
    id: "sunlit",
    name: "Sunlit",
    hours: [14, 15, 16],
    bpm: 110,
    track: "Open Road Pop",
    mood: "Bright indie pulse. Afternoon light on the dashboard.",
    why: "The day is fully on — the clock should move like you do.",
    scale: [0, 2, 4, 5, 7, 9, 11],
    wave: "sawtooth",
    swing: 0.02,
    drums: "pop",
    colors: { bg: "#f3ead0", ink: "#4a2a0a", accent: "#e38b2a", glow: "#f6d48a" }
  },
  {
    id: "golden",
    name: "Golden",
    hours: [17, 18, 19],
    bpm: 92,
    track: "Dusk Soul",
    mood: "Warm bass, unhurried. The color of leaving work.",
    why: "Evening is a fade, not a stop. Time stretches here.",
    scale: [0, 3, 5, 7, 8, 10],
    wave: "triangle",
    swing: 0.08,
    drums: "soul",
    colors: { bg: "#f0d9c4", ink: "#3b1c18", accent: "#c45c38", glow: "#efb089" }
  },
  {
    id: "night",
    name: "Night Drive",
    hours: [20, 21, 22, 23],
    bpm: 118,
    track: "Neon Highway",
    mood: "Synth pulse under streetlights. Forward, not frantic.",
    why: "Night is for movement you chose, not the schedule you were given.",
    scale: [0, 2, 3, 7, 9],
    wave: "sawtooth",
    swing: 0,
    drums: "drive",
    colors: { bg: "#12182e", ink: "#e8e4d4", accent: "#6ea8ff", glow: "#314a86" }
  },
  {
    id: "insomnia",
    name: "Insomnia",
    hours: [0, 1, 2, 3, 4, 5],
    bpm: 64,
    track: "2AM Static",
    mood: "Sparse keys and air. Time that refuses to land.",
    why: "The hours nobody designs for. This clock stays up with you.",
    scale: [0, 1, 5, 7, 8],
    wave: "sine",
    swing: 0.16,
    drums: "sparse",
    colors: { bg: "#1b1428", ink: "#efe7ff", accent: "#b38bff", glow: "#4a3570" }
  }
];

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const els = {
  vinylWrap: document.getElementById("vinylWrap"),
  vinyl: document.getElementById("vinyl"),
  labelStation: document.getElementById("labelStation"),
  labelTime: document.getElementById("labelTime"),
  digital: document.getElementById("digital"),
  keyLine: document.getElementById("keyLine"),
  trackName: document.getElementById("trackName"),
  trackMood: document.getElementById("trackMood"),
  trackWhy: document.getElementById("trackWhy"),
  playBtn: document.getElementById("playBtn"),
  playIcon: document.getElementById("playIcon"),
  followHour: document.getElementById("followHour"),
  volume: document.getElementById("volume"),
  stations: document.getElementById("stations"),
  hourHand: document.getElementById("hourHand"),
  minuteHand: document.getElementById("minuteHand"),
  secondHand: document.getElementById("secondHand"),
  ticks: document.getElementById("ticks")
};

let currentId = stationForHour(new Date().getHours()).id;
let playing = false;
let audio = null;
let lastHour = new Date().getHours();

function stationForHour(hour) {
  return STATIONS.find((s) => s.hours.includes(hour)) || STATIONS[0];
}

function currentStation() {
  return STATIONS.find((s) => s.id === currentId);
}

function rootMidi(date) {
  return 48 + (date.getHours() % 12);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function drawTicks() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x1 = 100 + Math.cos(a) * 88;
    const y1 = 100 + Math.sin(a) * 88;
    const x2 = 100 + Math.cos(a) * (i % 3 === 0 ? 78 : 82);
    const y2 = 100 + Math.sin(a) * (i % 3 === 0 ? 78 : 82);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    frag.appendChild(line);
  }
  els.ticks.appendChild(frag);
}

function setHands(date) {
  const ms = date.getMilliseconds();
  const s = date.getSeconds() + ms / 1000;
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;
  els.hourHand.setAttribute("transform", `rotate(${h * 30} 100 100)`);
  els.minuteHand.setAttribute("transform", `rotate(${m * 6} 100 100)`);
  els.secondHand.setAttribute("transform", `rotate(${s * 6} 100 100)`);
}

function applyTheme(station) {
  const { bg, ink, accent, glow } = station.colors;
  const root = document.documentElement;
  root.style.setProperty("--bg", bg);
  root.style.setProperty("--ink", ink);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--glow", glow);
}

function renderStations() {
  els.stations.innerHTML = "";
  STATIONS.forEach((station, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "station" + (station.id === currentId ? " active" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", station.id === currentId ? "true" : "false");
    btn.innerHTML = `<strong>${index + 1}. ${station.name}</strong><span>${station.bpm} BPM · ${station.hours[0]}–${station.hours.at(-1) + 1}h</span>`;
    btn.addEventListener("click", () => selectStation(station.id, true));
    els.stations.appendChild(btn);
  });
}

function selectStation(id, userPicked) {
  currentId = id;
  if (userPicked) els.followHour.checked = false;
  const station = currentStation();
  applyTheme(station);
  renderStations();
  updateCopy(new Date());
  if (playing) restartAudio();
}

function updateCopy(date) {
  const station = currentStation();
  const key = KEY_NAMES[date.getHours() % 12];
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const time = date.toLocaleTimeString(undefined, { hour12: true });
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  els.labelStation.textContent = station.name;
  els.labelTime.textContent = `${hh}:${mm}`;
  els.digital.textContent = `${weekday} · ${time}`;
  els.keyLine.textContent = `Key of ${key} · ${station.bpm} BPM`;
  els.trackName.textContent = station.track;
  els.trackMood.textContent = station.mood;
  const auto = stationForHour(date.getHours());
  els.trackWhy.textContent = els.followHour.checked
    ? `${station.why} Right now the hour asked for ${auto.name}.`
    : `You chose ${station.name} over the hour’s pick (${auto.name}). ${station.why}`;
}

function createAudio() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = Number(els.volume.value);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.28;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.22;
  const wet = ctx.createGain();
  wet.gain.value = 0.18;

  filter.connect(master);
  master.connect(ctx.destination);
  master.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(delay);
  delayGain.connect(wet);
  wet.connect(ctx.destination);

  return { ctx, master, filter, nodes: [] };
}

function envGain(ctx, start, peak, attack, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  return g;
}

function playKick(audioObj, time, gain) {
  const { ctx, filter } = audioObj;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
  const g = envGain(ctx, time, gain, 0.004, 0.18);
  osc.connect(g);
  g.connect(filter);
  osc.start(time);
  osc.stop(time + 0.22);
}

function playHat(audioObj, time, gain) {
  const { ctx, filter } = audioObj;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;
  const g = envGain(ctx, time, gain, 0.001, 0.04);
  src.connect(hp);
  hp.connect(g);
  g.connect(filter);
  src.start(time);
  src.stop(time + 0.05);
}

function playTone(audioObj, time, freq, dur, gain, type) {
  const { ctx, filter } = audioObj;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  const g = envGain(ctx, time, gain, 0.02, dur);
  osc.connect(g);
  g.connect(filter);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function scheduleLoop() {
  if (!audio || !playing) return;
  const station = currentStation();
  const now = audio.ctx.currentTime;
  const date = new Date();
  const beat = 60 / station.bpm;
  const bars = 2;
  const steps = 16;
  const stepDur = (beat * 4 * bars) / steps;
  const root = rootMidi(date);
  const minuteOpen = 900 + date.getMinutes() * 18;
  audio.filter.frequency.setTargetAtTime(minuteOpen, now, 0.2);

  for (let i = 0; i < steps; i += 1) {
    const t = now + 0.08 + i * stepDur + (i % 2 ? station.swing * beat : 0);
    const drum = station.drums;
    if (i % 4 === 0) playKick(audio, t, drum === "sparse" ? 0.28 : 0.42);
    if (drum !== "sparse" && (i % 4 === 2)) playHat(audio, t, 0.12);
    if (["pop", "drive", "lofi"].includes(drum) && i % 8 === 4) playHat(audio, t, 0.18);
    if (drum === "pop" && i % 2 === 1) playHat(audio, t, 0.06);

    const degree = station.scale[i % station.scale.length];
    const bass = midiToFreq(root + (i % 8 === 0 ? 0 : degree) - 12);
    if (i % 2 === 0) playTone(audio, t, bass, beat * 0.9, 0.12, "sine");

    if (i % 2 === 1 || drum === "sparse") {
      const oct = drum === "drive" ? 12 : 24;
      const freq = midiToFreq(root + degree + oct);
      playTone(audio, t, freq, beat * 0.45, drum === "sparse" ? 0.08 : 0.07, station.wave);
    }
  }

  audio.timer = window.setTimeout(scheduleLoop, beat * 4 * bars * 1000 - 40);
}

async function startAudio() {
  if (!audio) audio = createAudio();
  if (audio.ctx.state === "suspended") await audio.ctx.resume();
  playing = true;
  els.playBtn.setAttribute("aria-pressed", "true");
  els.playIcon.textContent = "Pause";
  els.vinyl.classList.add("spinning");
  els.vinyl.style.animationDuration = `${240 / currentStation().bpm}s`;
  els.vinylWrap.classList.add("playing");
  scheduleLoop();
}

function stopAudio() {
  playing = false;
  if (audio && audio.timer) window.clearTimeout(audio.timer);
  els.playBtn.setAttribute("aria-pressed", "false");
  els.playIcon.textContent = "Listen";
  els.vinyl.classList.remove("spinning");
  els.vinylWrap.classList.remove("playing");
}

function restartAudio() {
  if (audio && audio.timer) window.clearTimeout(audio.timer);
  if (audio) audio.filter.frequency.value = 1600;
  els.vinyl.style.animationDuration = `${240 / currentStation().bpm}s`;
  scheduleLoop();
}

els.playBtn.addEventListener("click", () => {
  if (playing) stopAudio();
  else startAudio();
});

els.volume.addEventListener("input", () => {
  if (audio) audio.master.gain.value = Number(els.volume.value);
});

els.followHour.addEventListener("change", () => {
  if (els.followHour.checked) selectStation(stationForHour(new Date().getHours()).id, false);
  updateCopy(new Date());
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input")) return;
  if (event.code === "Space") {
    event.preventDefault();
    els.playBtn.click();
  }
  const num = Number(event.key);
  if (num >= 1 && num <= 6) selectStation(STATIONS[num - 1].id, true);
});

function tick() {
  const date = new Date();
  setHands(date);
  updateCopy(date);
  const hour = date.getHours();
  if (els.followHour.checked && hour !== lastHour) {
    selectStation(stationForHour(hour).id, false);
  }
  lastHour = hour;
  requestAnimationFrame(tick);
}

drawTicks();
selectStation(currentId, false);
els.followHour.checked = true;
tick();
