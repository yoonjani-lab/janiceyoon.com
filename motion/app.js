const NS = "http://www.w3.org/2000/svg";

const SCENES = {
	cafe: { label: "Rain Cafe", weather: "rain" },
	market: { label: "Night Market", weather: "fireflies" },
	snow: { label: "Snow Garden", weather: "snow" },
	studio: { label: "Day Studio", weather: "petals" },
};

const WEATHER_LABELS = {
	auto: "Match the place",
	rain: "Rain",
	snow: "Snow",
	petals: "Petals",
	fireflies: "Fireflies",
	clear: "Clear",
};

const PRESETS = ["#E8A15A", "#E07A8A", "#7D9A78", "#8ECAE6", "#F2C14E", "#C7B8FF"];
const CLOCK_PRESETS = ["#141414", "#F3EFE4", "#111C47", "#7A2E2E", "#1E3A34", "#D7C4A3"];

const DEFAULTS = {
	scene: "cafe",
	accent: "#E8A15A",
	clock: "#141414",
	weather: "auto",
	density: 62,
	speed: 100,
	light: 72,
};

const back = document.getElementById("back");
const front = document.getElementById("front");
const canvas = document.getElementById("weather");
const ctx = canvas.getContext("2d");
const panel = document.getElementById("panel");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let state = loadState();
let drops = [];
let running = false;

function el(name, attrs, parent) {
	const node = document.createElementNS(NS, name);
	Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
	if (parent) parent.appendChild(node);
	return node;
}

function makeSvg() {
	const svg = el("svg", {
		viewBox: "0 0 1600 900",
		preserveAspectRatio: "xMidYMid slice",
	});
	el("defs", {}, svg);
	return svg;
}

function defs(svg) {
	return svg.querySelector("defs");
}

function linearGrad(svg, id, stops, x2 = "0", y2 = "1") {
	const grad = el("linearGradient", { id, x1: "0", y1: "0", x2, y2 }, defs(svg));
	stops.forEach(([offset, color]) => {
		el("stop", { offset, "stop-color": color }, grad);
	});
	return grad;
}

function makeRand(seed) {
	let a = seed >>> 0;
	return function rand() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function skyline(svg, buildings, baseline, rand) {
	buildings.forEach((b) => {
		const y = baseline - b.h;
		el("rect", { x: b.x, y, width: b.w, height: b.h + 80, fill: b.fill }, svg);
		if (b.antenna) {
			el("rect", { x: b.x + b.w / 2, y: y - 34, width: 3, height: 34, fill: b.fill }, svg);
			el("circle", { cx: b.x + b.w / 2 + 1.5, cy: y - 36, r: 3, class: "win lit" }, svg);
		}
		const ww = b.big ? 22 : 13;
		const hh = b.big ? 28 : 16;
		const gapX = b.big ? 16 : 11;
		const gapY = b.big ? 18 : 14;
		const cols = Math.max(1, Math.floor((b.w - 22) / (ww + gapX)));
		const rows = Math.max(1, Math.floor((b.h - (b.shop ? 90 : 28)) / (hh + gapY)));
		const usedW = cols * ww + (cols - 1) * gapX;
		const offsetX = b.x + (b.w - usedW) / 2;
		for (let r = 0; r < rows; r += 1) {
			for (let c = 0; c < cols; c += 1) {
				const on = rand() < b.lit;
				const flicker = on && rand() < 0.2;
				const rect = el("rect", {
					x: offsetX + c * (ww + gapX),
					y: y + 16 + r * (hh + gapY),
					width: ww,
					height: hh,
					rx: 1.2,
					class: on ? (flicker ? "win lit flicker" : "win lit") : "win",
				}, svg);
				if (flicker) rect.style.animationDelay = `${(rand() * 6).toFixed(2)}s`;
			}
		}
		if (b.shop) {
			el("rect", {
				x: b.x + 14,
				y: baseline - 72,
				width: b.w - 28,
				height: 54,
				class: "shop",
				rx: 2,
			}, svg);
		}
	});
}

function cloud(svg, x, y, scale, delay) {
	const g = el("g", { class: "drift", style: `animation-delay:${delay}s` }, svg);
	[[0, 0, 70, 22], [36, 6, 48, 18], [-34, 8, 40, 16]].forEach(([dx, dy, rx, ry]) => {
		el("ellipse", {
			cx: x + dx * scale,
			cy: y + dy * scale,
			rx: rx * scale,
			ry: ry * scale,
			fill: "white",
			opacity: "0.1",
		}, g);
	});
}

function flower(svg, cx, cy, r, petals, delay) {
	const g = el("g", { class: "float", style: `animation-delay:${delay}s` }, svg);
	for (let i = 0; i < petals; i += 1) {
		const angle = (Math.PI * 2 * i) / petals;
		const px = cx + Math.cos(angle) * r * 0.42;
		const py = cy + Math.sin(angle) * r * 0.42;
		el("ellipse", {
			cx: px,
			cy: py,
			rx: r * 0.38,
			ry: r * 0.24,
			class: "petal",
			transform: `rotate(${(angle * 180) / Math.PI} ${px} ${py})`,
		}, g);
	}
	el("circle", { cx, cy, r: r * 0.18, class: "flower-core" }, g);
}

function pine(svg, x, y, scale) {
	const g = el("g", { class: "sway", style: `animation-delay:${(x % 5)}s` }, svg);
	el("polygon", { points: `${x},${y} ${x - 26 * scale},${y + 48 * scale} ${x + 26 * scale},${y + 48 * scale}`, fill: "#1d3b38" }, g);
	el("polygon", { points: `${x},${y + 28 * scale} ${x - 34 * scale},${y + 84 * scale} ${x + 34 * scale},${y + 84 * scale}`, fill: "#24504a" }, g);
	el("polygon", { points: `${x},${y + 58 * scale} ${x - 40 * scale},${y + 122 * scale} ${x + 40 * scale},${y + 122 * scale}`, fill: "#173430" }, g);
	el("rect", { x: x - 5 * scale, y: y + 122 * scale, width: 10 * scale, height: 22 * scale, fill: "#5a3b2a" }, g);
}

function interiorFrame(svg, wall, trim) {
	el("path", {
		d: "M0 0 H1600 V900 H0 Z M168 64 H1432 V676 H168 Z",
		fill: wall,
		"fill-rule": "evenodd",
	}, svg);
	el("rect", { x: 788, y: 64, width: 24, height: 612, fill: trim }, svg);
	el("rect", { x: 168, y: 348, width: 1264, height: 20, fill: trim }, svg);
	el("rect", { x: 120, y: 676, width: 1360, height: 26, rx: 2, fill: trim }, svg);
	el("rect", { x: 0, y: 702, width: 1600, height: 198, fill: wall }, svg);
	el("polygon", { points: "210,92 470,92 360,640 196,640", fill: "white", opacity: "0.05" }, svg);
}

function plant(svg, x, y) {
	const g = el("g", { class: "sway" }, svg);
	el("rect", { x: x - 22, y: y + 28, width: 44, height: 36, rx: 4, fill: "#c46a45" }, g);
	el("ellipse", { cx: x, cy: y + 30, rx: 24, ry: 7, fill: "#a65634" }, g);
	el("path", { d: `M${x} ${y + 30} C ${x - 10} ${y - 10}, ${x - 28} ${y - 20}, ${x - 6} ${y - 48}`, fill: "none", stroke: "#2f6a45", "stroke-width": "3" }, g);
	el("ellipse", { cx: x - 18, cy: y - 8, rx: 22, ry: 10, fill: "#3f8a58", transform: `rotate(-30 ${x - 18} ${y - 8})` }, g);
	el("ellipse", { cx: x + 16, cy: y - 16, rx: 20, ry: 9, fill: "#2f6d49", transform: `rotate(24 ${x + 16} ${y - 16})` }, g);
	el("ellipse", { cx: x + 2, cy: y - 36, rx: 16, ry: 8, fill: "#4e9a62", transform: `rotate(-8 ${x + 2} ${y - 36})` }, g);
}

function cup(svg, x, y) {
	el("ellipse", { cx: x, cy: y + 8, rx: 46, ry: 10, fill: "#f4efe6" }, svg);
	el("path", { d: `M${x - 28} ${y + 6} L${x - 22} ${y - 36} H${x + 22} L${x + 28} ${y + 6} Z`, fill: "#f7f3ec" }, svg);
	el("ellipse", { cx: x, cy: y - 34, rx: 22, ry: 6, fill: "#6a3e28" }, svg);
	el("path", {
		d: `M${x + 24} ${y - 24} Q${x + 48} ${y - 24} ${x + 48} ${y - 4} Q${x + 48} ${y + 12} ${x + 24} ${y + 4}`,
		fill: "none",
		stroke: "#f7f3ec",
		"stroke-width": "5",
	}, svg);
	const steam = el("g", {}, svg);
	el("path", { d: `M${x - 8} ${y - 48} Q${x - 18} ${y - 70} ${x - 6} ${y - 92}`, class: "steam" }, steam);
	el("path", { d: `M${x + 6} ${y - 46} Q${x + 18} ${y - 72} ${x + 4} ${y - 98}`, class: "steam", style: "animation-delay:-1.6s" }, steam);
}

function buildCafeBack() {
	const svg = makeSvg();
	const rand = makeRand(11);
	linearGrad(svg, "sky", [["0%", "#243556"], ["58%", "#1a2744"], ["100%", "#12182a"]]);
	el("rect", { width: "1600", height: "900", fill: "url(#sky)" }, svg);
	el("circle", { cx: "1240", cy: "150", r: "46", fill: "#f4efe2", opacity: "0.9" }, svg);
	el("circle", { cx: "1258", cy: "140", r: "40", fill: "#1a2744" }, svg);
	for (let i = 0; i < 28; i += 1) {
		const star = el("circle", {
			cx: 80 + rand() * 1440,
			cy: 30 + rand() * 280,
			r: rand() < 0.3 ? 1.8 : 1,
			fill: "white",
			opacity: "0.75",
		}, svg);
		if (rand() < 0.4) {
			star.setAttribute("class", "twinkle");
			star.style.animationDelay = `${(rand() * 4).toFixed(2)}s`;
		}
	}
	cloud(svg, 280, 120, 1, 0);
	cloud(svg, 860, 80, 1.3, -8);
	cloud(svg, 1380, 160, 0.9, -16);
	skyline(svg, [
		{ x: -20, w: 210, h: 430, fill: "#1a2234", lit: 0.34 },
		{ x: 180, w: 160, h: 560, fill: "#243044", lit: 0.58, antenna: true },
		{ x: 350, w: 250, h: 390, fill: "#151b2c", lit: 0.28 },
		{ x: 610, w: 130, h: 640, fill: "#2a354c", lit: 0.62, antenna: true },
		{ x: 750, w: 280, h: 460, fill: "#1c2538", lit: 0.4 },
		{ x: 1040, w: 180, h: 600, fill: "#121826", lit: 0.5 },
		{ x: 1230, w: 230, h: 500, fill: "#26324a", lit: 0.36, big: true },
		{ x: 1460, w: 180, h: 420, fill: "#1a2234", lit: 0.3 },
	], 860, rand);
	el("path", {
		d: "M1188 250 L1230 150 L1272 250 M1230 150 V118 M1208 188 H1252 M1216 214 H1244",
		fill: "none",
		stroke: "#b7c3da",
		"stroke-width": "2",
	}, svg);
	return svg;
}

function buildCafeFront() {
	const svg = makeSvg();
	interiorFrame(svg, "#241913", "#3c2c24");
	el("path", { d: "M168 64 H300 C250 180 270 520 214 676 H168 Z", fill: "#4a3030", opacity: "0.92" }, svg);
	plant(svg, 430, 600);
	cup(svg, 1210, 650);
	el("rect", { x: "980", y: "640", width: "70", height: "36", rx: "2", fill: "#f2efe6" }, svg);
	el("rect", { x: "986", y: "646", width: "58", height: "4", fill: "#111c47", opacity: "0.35" }, svg);
	el("rect", { x: "986", y: "654", width: "46", height: "3", fill: "#111c47", opacity: "0.2" }, svg);
	const cat = el("g", {}, svg);
	el("ellipse", { cx: "690", cy: "662", rx: "40", ry: "16", fill: "#1a1412" }, cat);
	el("circle", { cx: "726", cy: "646", r: "15", fill: "#1a1412" }, cat);
	el("polygon", { points: "714,640 720,624 728,640", fill: "#1a1412" }, cat);
	el("polygon", { points: "730,640 738,624 746,640", fill: "#1a1412" }, cat);
	el("path", {
		d: "M652 660 Q632 636 654 626",
		fill: "none",
		stroke: "#1a1412",
		"stroke-width": "5",
		"stroke-linecap": "round",
	}, cat);
	el("line", { x1: "800", y1: "64", x2: "800", y2: "150", stroke: "#3c2c24", "stroke-width": "3" }, svg);
	el("polygon", { points: "770,150 830,150 816,188 784,188", fill: "#f0d7a8" }, svg);
	return svg;
}

function buildMarket() {
	const svg = makeSvg();
	const rand = makeRand(27);
	linearGrad(svg, "sky", [["0%", "#2a103c"], ["45%", "#1a0c28"], ["100%", "#100610"]]);
	el("rect", { width: "1600", height: "900", fill: "url(#sky)" }, svg);
	for (let i = 0; i < 40; i += 1) {
		const star = el("circle", {
			cx: rand() * 1600,
			cy: rand() * 420,
			r: rand() < 0.2 ? 1.7 : 1,
			fill: "white",
		}, svg);
		star.setAttribute("class", "twinkle");
		star.style.animationDelay = `${(rand() * 5).toFixed(2)}s`;
	}
	skyline(svg, [
		{ x: 40, w: 220, h: 360, fill: "#1b1024", lit: 0.45, shop: true },
		{ x: 280, w: 180, h: 480, fill: "#241433", lit: 0.6, antenna: true },
		{ x: 480, w: 260, h: 320, fill: "#160c20", lit: 0.3, shop: true },
		{ x: 760, w: 150, h: 540, fill: "#2c1840", lit: 0.55 },
		{ x: 930, w: 240, h: 400, fill: "#1a1026", lit: 0.4, shop: true, big: true },
		{ x: 1190, w: 170, h: 500, fill: "#120816", lit: 0.62, antenna: true },
		{ x: 1380, w: 200, h: 360, fill: "#221230", lit: 0.36, shop: true },
	], 700, rand);
	["LATE", "CUP", "GLOW", "NO.8"].forEach((name, index) => {
		const x = 150 + index * 360;
		el("rect", { x, y: 250 + (index % 2) * 40, width: name.length * 22 + 28, height: 42, rx: 4, class: "sign-board" }, svg);
		const text = el("text", {
			x: x + 14,
			y: 278 + (index % 2) * 40,
			fill: "#140818",
			"font-family": "Anton, Arial Narrow, sans-serif",
			"font-size": "22",
			"letter-spacing": "2",
		}, svg);
		text.textContent = name;
	});
	el("rect", { x: "0", y: "700", width: "1600", height: "200", fill: "#0c0610" }, svg);
	el("line", { x1: "0", y1: "790", x2: "1600", y2: "790", stroke: "rgba(237,235,220,0.25)", "stroke-width": "4", "stroke-dasharray": "28 24" }, svg);
	for (let i = 0; i < 7; i += 1) {
		el("ellipse", {
			cx: 120 + i * 220,
			cy: 760,
			rx: 50,
			ry: 12,
			fill: "var(--accent)",
			opacity: "0.28",
		}, svg);
	}
	el("path", { d: "M80 150 H1520", stroke: "#f2e6c8", "stroke-width": "2", opacity: "0.45" }, svg);
	for (let i = 0; i < 8; i += 1) {
		const x = 140 + i * 180;
		el("line", { x1: x, y1: 150, x2: x, y2: 196, stroke: "#f2e6c8", "stroke-width": "2" }, svg);
		el("ellipse", { cx: x, cy: 214, rx: 16, ry: 20, fill: "var(--accent)", opacity: "0.9" }, svg);
		el("ellipse", { cx: x, cy: 214, rx: 6, ry: 8, fill: "#fff4d2" }, svg);
	}
	return svg;
}

function buildSnowBack() {
	const svg = makeSvg();
	linearGrad(svg, "sky", [["0%", "#e7f0f7"], ["55%", "#b7cde0"], ["100%", "#8eabc4"]]);
	el("rect", { width: "1600", height: "900", fill: "url(#sky)" }, svg);
	el("circle", { cx: "250", cy: "140", r: "42", fill: "#fffaf2", opacity: "0.95" }, svg);
	cloud(svg, 620, 120, 1.1, 0);
	cloud(svg, 1100, 90, 0.8, -12);
	el("path", { d: "M0 560 L160 390 L340 520 L520 280 L760 500 L980 330 L1200 520 L1420 360 L1600 500 L1600 900 L0 900 Z", fill: "#9bb6cc" }, svg);
	el("path", { d: "M0 640 L240 500 L460 620 L720 460 L980 640 L1260 500 L1600 630 L1600 900 L0 900 Z", fill: "#7f9db6" }, svg);
	[[180, 520, 1.1], [360, 560, 0.8], [540, 500, 1.35], [760, 580, 0.7], [1320, 540, 1.15], [1480, 500, 0.9]].forEach(([x, y, s]) => {
		pine(svg, x, y, s);
	});
	el("polygon", { points: "980,470 1160,370 1340,470", fill: "#6d4034" }, svg);
	el("rect", { x: "1010", y: "470", width: "300", height: "170", fill: "#8a5342" }, svg);
	el("rect", { x: "1124", y: "530", width: "72", height: "110", fill: "#4e3228" }, svg);
	el("rect", { x: "1040", y: "510", width: "54", height: "46", class: "win lit" }, svg);
	el("rect", { x: "1236", y: "510", width: "54", height: "46", class: "win lit" }, svg);
	el("rect", { x: "0", y: "700", width: "1600", height: "200", fill: "#f7fbff" }, svg);
	return svg;
}

function buildSnowFront() {
	const svg = makeSvg();
	interiorFrame(svg, "#2a211c", "#5c4636");
	el("rect", { x: "250", y: "628", width: "18", height: "48", rx: "2", fill: "#f6f0e4" }, svg);
	el("ellipse", { cx: "259", cy: "622", rx: "5", ry: "8", class: "candle" }, svg);
	cup(svg, 1180, 650);
	pine(svg, 480, 560, 0.55);
	return svg;
}

function buildStudio() {
	const svg = makeSvg();
	linearGrad(svg, "sky", [["0%", "#f7f3e8"], ["100%", "#e7e2d0"]]);
	el("rect", { width: "1600", height: "900", fill: "url(#sky)" }, svg);
	el("circle", { cx: "1180", cy: "210", r: "78", class: "sun" }, svg);
	el("circle", { cx: "1180", cy: "210", r: "108", fill: "none", stroke: "var(--accent)", "stroke-width": "2", opacity: "0.7" }, svg);
	el("circle", { cx: "1180", cy: "210", r: "140", fill: "none", stroke: "#111c47", "stroke-width": "1.5", opacity: "0.35" }, svg);
	el("path", {
		d: "M0 610 C220 540 380 700 640 630 C920 550 1080 730 1600 590 L1600 900 L0 900 Z",
		fill: "#111c47",
		opacity: "0.88",
	}, svg);
	el("path", {
		d: "M0 720 C260 650 520 810 820 730 C1100 650 1300 820 1600 740 L1600 900 L0 900 Z",
		fill: "#111c47",
	}, svg);
	[[240, 280, 54, 6, 0], [430, 180, 36, 5, -2], [690, 240, 48, 7, -4], [960, 150, 30, 5, -1], [250, 460, 28, 5, -3], [720, 430, 40, 6, -6]].forEach(([x, y, r, n, delay]) => {
		flower(svg, x, y, r, n, delay);
	});
	return svg;
}

function mount(scene) {
	const builders = {
		cafe: [buildCafeBack, buildCafeFront],
		market: [buildMarket, makeSvg],
		snow: [buildSnowBack, buildSnowFront],
		studio: [buildStudio, makeSvg],
	};
	const [drawBack, drawFront] = builders[scene];
	back.replaceChildren(drawBack());
	front.replaceChildren(drawFront());
	document.title = `${SCENES[scene].label} — Clock`;
	document.body.dataset.scene = scene;
}

function activeWeather() {
	if (state.weather === "auto") return SCENES[state.scene].weather;
	return state.weather;
}

function resizeCanvas() {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.floor(window.innerWidth * dpr);
	canvas.height = Math.floor(window.innerHeight * dpr);
	canvas.style.width = `${window.innerWidth}px`;
	canvas.style.height = `${window.innerHeight}px`;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	syncCount();
}

function targetCount() {
	const kind = activeWeather();
	if (kind === "clear" || state.density === 0) return 0;
	const area = window.innerWidth * window.innerHeight;
	const divisor = kind === "rain" ? 12000 : kind === "snow" ? 16000 : 24000;
	return Math.max(0, Math.round((area / divisor) * (state.density / 55)));
}

function syncCount() {
	const count = targetCount();
	while (drops.length < count) drops.push(makeDrop(true));
	if (drops.length > count) drops.length = count;
}

function makeDrop(anywhere) {
	const drop = {};
	resetDrop(drop, anywhere);
	return drop;
}

function resetDrop(drop, anywhere) {
	const kind = activeWeather();
	drop.kind = kind;
	drop.x = Math.random() * window.innerWidth;
	drop.y = anywhere ? Math.random() * window.innerHeight : -40 - Math.random() * 80;
	if (kind === "rain") {
		drop.len = 12 + Math.random() * 18;
		drop.vy = 12 + Math.random() * 10;
		drop.vx = 1.4 + Math.random() * 1.4;
		drop.w = Math.random() < 0.18 ? 1.7 : 1;
		drop.a = 0.22 + Math.random() * 0.38;
	} else if (kind === "snow") {
		drop.r = 1.2 + Math.random() * 2.8;
		drop.vy = 0.45 + Math.random() * 0.9;
		drop.phase = Math.random() * Math.PI * 2;
		drop.a = 0.4 + Math.random() * 0.55;
	} else if (kind === "petals") {
		drop.r = 3 + Math.random() * 5;
		drop.vy = 0.35 + Math.random() * 0.75;
		drop.vx = 0.25 + Math.random() * 0.7;
		drop.rot = Math.random() * Math.PI;
		drop.spin = (Math.random() - 0.5) * 0.03;
		drop.a = 0.4 + Math.random() * 0.45;
	} else if (kind === "fireflies") {
		drop.r = 1.4 + Math.random() * 1.8;
		drop.phase = Math.random() * Math.PI * 2;
		drop.a = 0.45 + Math.random() * 0.5;
		drop.y = Math.random() * window.innerHeight;
	}
}

function hexToRgba(hex, alpha) {
	const n = hex.replace("#", "");
	const r = parseInt(n.slice(0, 2), 16);
	const g = parseInt(n.slice(2, 4), 16);
	const b = parseInt(n.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawFrame(dt) {
	const width = window.innerWidth;
	const height = window.innerHeight;
	const kind = activeWeather();
	const speed = (state.speed / 100) * (reduceMotion ? 0 : 1);
	ctx.clearRect(0, 0, width, height);
	drops.forEach((drop) => {
		if (drop.kind !== kind) resetDrop(drop, true);
		if (kind === "rain") {
			drop.x += drop.vx * speed * dt;
			drop.y += drop.vy * speed * dt;
			ctx.strokeStyle = `rgba(232, 238, 246, ${drop.a})`;
			ctx.lineWidth = drop.w;
			ctx.beginPath();
			ctx.moveTo(drop.x, drop.y);
			ctx.lineTo(drop.x - drop.vx * 2.4, drop.y - drop.len);
			ctx.stroke();
			if (drop.y > height + 30 || drop.x > width + 40) resetDrop(drop, false);
		} else if (kind === "snow") {
			drop.phase += 0.015 * Math.max(speed, reduceMotion ? 0 : 1) * dt;
			drop.x += Math.sin(drop.phase) * 0.55 * Math.max(speed, 0.3);
			drop.y += drop.vy * speed * dt;
			ctx.fillStyle = `rgba(255, 255, 255, ${drop.a})`;
			ctx.beginPath();
			ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
			ctx.fill();
			if (drop.y > height + 8) resetDrop(drop, false);
		} else if (kind === "petals") {
			drop.rot += drop.spin * Math.max(speed, reduceMotion ? 0 : 1) * dt;
			drop.x += drop.vx * speed * dt;
			drop.y += drop.vy * speed * dt;
			ctx.save();
			ctx.translate(drop.x, drop.y);
			ctx.rotate(drop.rot);
			ctx.fillStyle = hexToRgba(state.accent, drop.a);
			ctx.beginPath();
			ctx.ellipse(0, 0, drop.r, drop.r * 0.5, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
			if (drop.y > height + 16 || drop.x > width + 20) resetDrop(drop, false);
		} else if (kind === "fireflies") {
			drop.phase += 0.02 * Math.max(speed, reduceMotion ? 0 : 0.2) * dt;
			drop.x += Math.cos(drop.phase) * 0.45 * Math.max(speed, 0.2);
			drop.y += Math.sin(drop.phase * 0.8) * 0.32 * Math.max(speed, 0.2);
			const glow = 0.35 + Math.abs(Math.sin(drop.phase * 2)) * 0.65;
			ctx.fillStyle = hexToRgba(state.accent, drop.a * glow * 0.45);
			ctx.beginPath();
			ctx.arc(drop.x, drop.y, drop.r * 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = `rgba(255, 250, 235, ${0.75 + glow * 0.25})`;
			ctx.beginPath();
			ctx.arc(drop.x, drop.y, drop.r * 0.7, 0, Math.PI * 2);
			ctx.fill();
			if (drop.x < -20) drop.x = width + 10;
			if (drop.x > width + 20) drop.x = -10;
			if (drop.y < -20) drop.y = height + 10;
			if (drop.y > height + 20) drop.y = -10;
		}
	});
}

function loop(now) {
	const dt = Math.min(2.4, (now - (loop.last || now)) / 16.67);
	loop.last = now;
	drawFrame(dt);
	if (!reduceMotion) requestAnimationFrame(loop);
}

function mixHex(hex, target, amount) {
	const channel = (value) => {
		const n = parseInt(value.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	const [r, g, b] = channel(hex);
	const [tr, tg, tb] = channel(target);
	const blend = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
	return `#${blend(r, tr)}${blend(g, tg)}${blend(b, tb)}`;
}

function luminance(hex) {
	const n = parseInt(hex.slice(1), 16);
	const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((value) => {
		const scaled = value / 255;
		return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function applyVars() {
	const dial = safeHex(state.clock) || DEFAULTS.clock;
	const n = parseInt(dial.slice(1), 16);
	const red = (n >> 16) & 255;
	const green = (n >> 8) & 255;
	const blue = n & 255;
	const lightFace = luminance(dial) > 0.45;
	const second = red > 150 && red > green * 1.35 && red > blue * 1.35
		? (lightFace ? "#1a1a1a" : "#f7f7f7")
		: "#ff1f1f";
	document.documentElement.style.setProperty("--accent", state.accent);
	document.documentElement.style.setProperty("--light", String(state.light / 100));
	document.documentElement.style.setProperty("--speed", String(state.speed / 100));
	document.documentElement.style.setProperty("--dial", dial);
	document.documentElement.style.setProperty("--dial-deep", mixHex(dial, "#000000", 0.72));
	document.documentElement.style.setProperty("--dial-mid", mixHex(dial, "#ffffff", 0.12));
	document.documentElement.style.setProperty("--dial-light", mixHex(dial, "#ffffff", 0.38));
	document.documentElement.style.setProperty("--dial-ink", lightFace ? "#161616" : "#f7f7f7");
	document.documentElement.style.setProperty("--dial-second", second);
}

function weatherName() {
	const kind = activeWeather();
	return WEATHER_LABELS[kind] || kind;
}

function reflect() {
	document.querySelectorAll(".scene-btn").forEach((button) => {
		button.setAttribute("aria-pressed", button.dataset.scene === state.scene ? "true" : "false");
	});
	document.querySelectorAll("#swatches .swatch").forEach((button) => {
		button.setAttribute("aria-pressed", button.dataset.color.toLowerCase() === state.accent.toLowerCase() ? "true" : "false");
	});
	document.querySelectorAll("#clock-swatches .swatch").forEach((button) => {
		button.setAttribute("aria-pressed", button.dataset.color.toLowerCase() === state.clock.toLowerCase() ? "true" : "false");
	});
	document.getElementById("weather-kind").value = state.weather;
	document.getElementById("density").value = String(state.density);
	document.getElementById("speed").value = String(state.speed);
	document.getElementById("light").value = String(state.light);
	document.getElementById("accent").value = state.accent;
	document.getElementById("clock-color").value = state.clock;
	document.getElementById("weather-label").textContent = weatherName();
	document.getElementById("density-val").textContent = String(state.density);
	document.getElementById("speed-val").textContent = `${(state.speed / 100).toFixed(1)}×`;
	document.getElementById("light-val").textContent = String(state.light);
}

function commit(remount) {
	if (!SCENES[state.scene]) state.scene = "cafe";
	applyVars();
	if (remount) mount(state.scene);
	reflect();
	syncCount();
	try {
		localStorage.setItem("ja-motion", JSON.stringify(state));
	} catch (error) {
		/* Private mode can block storage; the page still works. */
	}
	if (reduceMotion) drawFrame(0);
	updateThemeButton();
	syncTheme();
}

function safeHex(value) {
	const hex = String(value || "").replace("#", "");
	return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex}` : null;
}

function clamp(value, min, max, fallback) {
	const number = Number(value);
	if (Number.isNaN(number)) return fallback;
	return Math.min(max, Math.max(min, Math.round(number)));
}

function loadState() {
	const params = new URLSearchParams(window.location.search);
	let stored = {};
	try {
		stored = JSON.parse(localStorage.getItem("ja-motion") || "{}");
	} catch (error) {
		stored = {};
	}
	const next = { ...DEFAULTS, ...stored };
	const scene = params.get("scene");
	const accent = safeHex(params.get("accent"));
	const clock = safeHex(params.get("clock"));
	const weather = params.get("weather");
	if (scene && SCENES[scene]) next.scene = scene;
	if (accent) next.accent = accent;
	if (clock) next.clock = clock;
	if (weather && WEATHER_LABELS[weather]) next.weather = weather;
	if (params.has("density")) next.density = clamp(params.get("density"), 0, 100, next.density);
	if (params.has("speed")) next.speed = clamp(params.get("speed"), 40, 180, next.speed);
	if (params.has("light")) next.light = clamp(params.get("light"), 15, 100, next.light);
	if (!SCENES[next.scene]) next.scene = "cafe";
	if (!safeHex(next.accent)) next.accent = DEFAULTS.accent;
	if (!safeHex(next.clock)) next.clock = DEFAULTS.clock;
	if (!WEATHER_LABELS[next.weather]) next.weather = "auto";
	next.density = clamp(next.density, 0, 100, DEFAULTS.density);
	next.speed = clamp(next.speed, 40, 180, DEFAULTS.speed);
	next.light = clamp(next.light, 15, 100, DEFAULTS.light);
	return next;
}

function bind() {
	const swatches = document.getElementById("swatches");
	PRESETS.forEach((color) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "swatch";
		button.dataset.color = color;
		button.style.background = color;
		button.setAttribute("aria-label", color);
		button.addEventListener("click", () => {
			state.accent = color;
			commit(false);
		});
		swatches.appendChild(button);
	});
	const picker = document.createElement("input");
	picker.type = "color";
	picker.id = "accent";
	picker.className = "color-input";
	picker.value = state.accent;
	picker.setAttribute("aria-label", "Custom accent color");
	picker.addEventListener("input", () => {
		state.accent = picker.value;
		commit(false);
	});
	swatches.appendChild(picker);

	const clockSwatches = document.getElementById("clock-swatches");
	CLOCK_PRESETS.forEach((color) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "swatch";
		button.dataset.color = color;
		button.style.background = color;
		button.setAttribute("aria-label", `Clock ${color}`);
		button.addEventListener("click", () => {
			state.clock = color;
			commit(false);
		});
		clockSwatches.appendChild(button);
	});
	const clockPicker = document.createElement("input");
	clockPicker.type = "color";
	clockPicker.id = "clock-color";
	clockPicker.className = "color-input";
	clockPicker.value = state.clock;
	clockPicker.setAttribute("aria-label", "Custom clock color");
	clockPicker.addEventListener("input", () => {
		state.clock = clockPicker.value;
		commit(false);
	});
	clockSwatches.appendChild(clockPicker);

	document.querySelectorAll(".scene-btn").forEach((button) => {
		button.addEventListener("click", () => {
			state.scene = button.dataset.scene;
			commit(true);
		});
	});

	document.getElementById("weather-kind").addEventListener("change", (event) => {
		state.weather = event.target.value;
		drops = [];
		commit(false);
	});
	document.getElementById("density").addEventListener("input", (event) => {
		state.density = Number(event.target.value);
		commit(false);
	});
	document.getElementById("speed").addEventListener("input", (event) => {
		state.speed = Number(event.target.value);
		commit(false);
	});
	document.getElementById("light").addEventListener("input", (event) => {
		state.light = Number(event.target.value);
		commit(false);
	});

	document.getElementById("focus").addEventListener("click", () => {
		document.body.classList.add("is-focus");
	});
	document.getElementById("focus-exit").addEventListener("click", () => {
		document.body.classList.remove("is-focus");
	});
	document.getElementById("toggle").addEventListener("click", () => {
		panel.classList.toggle("is-open");
		document.getElementById("toggle").textContent = panel.classList.contains("is-open") ? "Close" : "Customize";
	});

	window.addEventListener("keydown", (event) => {
		if (event.target.matches("input, select, textarea")) return;
		const keys = { Digit1: "cafe", Digit2: "market", Digit3: "snow", Digit4: "studio" };
		if (keys[event.code]) {
			state.scene = keys[event.code];
			commit(true);
		} else if (event.key === "f" || event.key === "F") {
			document.body.classList.toggle("is-focus");
		} else if (event.key === "Escape") {
			document.body.classList.remove("is-focus");
		}
	});

	window.addEventListener("resize", resizeCanvas);
}

const THEMES = {
	cafe: {
		bpm: 72,
		root: 53,
		type: "triangle",
		filter: 1400,
		lead: 0.07,
		melody: [0, 4, 7, 11, 12, 11, 7, 4, 2, 4, 7, 9, 7, 4, 2, 0],
		bass: [0, null, null, null, 7, null, null, null, 9, null, null, null, 5, null, null, null],
		kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
	},
	snow: {
		bpm: 60,
		root: 57,
		type: "sine",
		filter: 2400,
		lead: 0.06,
		melody: [12, null, 7, null, 15, null, 7, 3, 12, null, 10, null, 7, null, 3, null],
		bass: [0, null, null, null, null, null, null, null, 5, null, null, null, null, null, null, null],
		kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	},
	market: {
		bpm: 108,
		root: 48,
		type: "sawtooth",
		filter: 900,
		lead: 0.045,
		melody: [15, 12, 10, 12, 7, 10, 12, 15, 12, 10, 7, 10, 15, 12, 10, 7],
		bass: [0, null, 0, null, 10, null, 10, null, 5, null, 5, null, 7, null, 7, null],
		kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
		hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
	},
	studio: {
		bpm: 100,
		root: 55,
		type: "triangle",
		filter: 2100,
		lead: 0.065,
		melody: [7, 11, 12, 7, 4, 7, 9, 4, 7, 12, 14, 12, 9, 7, 4, 0],
		bass: [0, null, null, null, 7, null, null, null, 9, null, null, null, 5, null, null, null],
		kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
	},
};

const NOTE_GLYPHS = ["♪", "♫", "♩", "♬"];
const NOTE_POOL = 80;

let music = null;
let musicOn = false;
let musicAction = 0;
let musicVolume = 0.7;
let loopToken = 0;
let hopTimers = [];
let activeNodes = [];
let noteBits = [];
let secondAngle = 0;
let noteStamp = 0;

function buildNotes() {
	const field = document.getElementById("note-field");
	if (!field || field.childElementCount) return;
	for (let index = 0; index < NOTE_POOL; index += 1) {
		const el = document.createElement("span");
		el.className = "music-note";
		el.textContent = NOTE_GLYPHS[index % NOTE_GLYPHS.length];
		field.appendChild(el);
		noteBits.push({
			el,
			alive: false,
			mode: "ride",
			x: 50,
			y: 50,
			vx: 0,
			vy: 0,
			radius: 0,
			angle: 0,
			lean: 0,
			rot: 0,
			spin: 0,
			slide: 0,
			releaseAt: 34,
			life: 0,
			maxLife: 1,
			size: 16,
			opacity: 0,
			melt: 1,
			squash: 1,
		});
	}
}

function pointOnHand(angle, radius, lean) {
	const outwardX = Math.sin(angle);
	const outwardY = -Math.cos(angle);
	const sideX = Math.cos(angle);
	const sideY = Math.sin(angle);
	return {
		x: 50 + outwardX * radius + sideX * lean,
		y: 50 + outwardY * radius + sideY * lean,
	};
}

function paintNote(note) {
	note.el.style.left = `${note.x}%`;
	note.el.style.top = `${note.y}%`;
	note.el.style.fontSize = `${note.size}px`;
	note.el.style.opacity = note.alive ? String(note.opacity) : "0";
	note.el.style.setProperty("--rot", `${note.rot}deg`);
	note.el.style.setProperty("--melt", String(note.melt));
	note.el.style.setProperty("--squash", String(note.squash));
}

function takeNote() {
	const free = noteBits.find((note) => !note.alive);
	if (free) return free;
	return noteBits.filter((note) => note.mode === "melt").sort((a, b) => a.life - b.life)[0] || null;
}

function noteSize() {
	return 18 + Math.round(Math.random() * 16);
}

function shedNotes(pitch) {
	if (!musicOn || pitch == null) return;
	const alive = noteBits.reduce((count, note) => count + (note.alive ? 1 : 0), 0);
	if (alive >= 12) return;
	document.getElementById("clock-face").classList.add("is-playing");
	const note = takeNote();
	if (!note) return;
	const size = noteSize();
	note.alive = true;
	note.mode = "ride";
	note.size = size;
	note.angle = secondAngle;
	note.radius = 10 + Math.random() * 6;
	note.lean = (Math.random() - 0.5) * 4;
	note.slide = 12 + Math.random() * 8;
	note.releaseAt = 26 + Math.random() * 4;
	note.rot = Math.random() * 24 - 12;
	note.spin = (Math.random() - 0.5) * 18;
	note.life = 1;
	note.maxLife = 1;
	note.melt = 1;
	note.squash = 1;
	note.opacity = 0.72;
	note.el.textContent = NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)];
	note.el.classList.add("is-on");
	const point = pointOnHand(note.angle, note.radius, note.lean);
	note.x = point.x;
	note.y = point.y;
	paintNote(note);
}

function releaseNote(note) {
	const tangent = 6 + Math.random() * 6;
	note.mode = "melt";
	note.vx = Math.cos(note.angle) * tangent;
	note.vy = Math.sin(note.angle) * tangent + 6;
	note.spin = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 24);
	note.maxLife = 2.2 + Math.random() * 0.8;
	note.life = note.maxLife;
}

function tickNotes(dt) {
	if (!noteBits.length) return;
	noteBits.forEach((note) => {
		if (!note.alive) return;
		if (note.mode === "ride") {
			note.angle = secondAngle;
			note.radius += note.slide * dt;
			note.rot += note.spin * dt;
			const point = pointOnHand(note.angle, note.radius, note.lean);
			note.x = point.x;
			note.y = point.y;
			if (note.radius >= note.releaseAt) releaseNote(note);
		} else {
			const heavy = 1;
			note.vy += 16 * heavy * dt;
			note.vx *= Math.exp(-1.1 * dt);
			note.x += note.vx * dt;
			note.y += note.vy * dt;
			note.rot += note.spin * dt;
			const dx = note.x - 50;
			const dy = note.y - 50;
			const dist = Math.hypot(dx, dy) || 0.001;
			const limit = 32;
			if (dist > limit) {
				const nx = dx / dist;
				const ny = dy / dist;
				note.x = 50 + nx * limit;
				note.y = 50 + ny * limit;
				const outward = note.vx * nx + note.vy * ny;
				if (outward > 0) {
					note.vx -= outward * nx;
					note.vy -= outward * ny;
				}
			}
			const age = 1 - note.life / note.maxLife;
			note.melt = 1 + age * 0.08;
			note.squash = 1 - age * 0.04;
			note.life -= dt;
			note.opacity = Math.max(0, 0.78 * (1 - age));
			if (note.life <= 0) {
				note.alive = false;
				note.opacity = 0;
				note.el.classList.remove("is-on");
			}
		}
		paintNote(note);
	});
}

function clearHops() {
	hopTimers.forEach((timer) => window.clearTimeout(timer));
	hopTimers = [];
}

function hideNotes() {
	clearHops();
	const face = document.getElementById("clock-face");
	if (face) face.classList.remove("is-playing");
	noteBits.forEach((note) => {
		note.alive = false;
		note.opacity = 0;
		note.el.classList.remove("is-on");
		paintNote(note);
	});
}

function midiToFreq(midi) {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureMusic() {
	if (music) return music;
	const audioCtx = new AudioContext();
	const master = audioCtx.createGain();
	master.gain.value = musicVolume;
	const themeBus = audioCtx.createGain();
	themeBus.gain.value = 0;
	const filter = audioCtx.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 1600;
	filter.connect(themeBus);
	themeBus.connect(master);
	master.connect(audioCtx.destination);
	music = { ctx: audioCtx, master, themeBus, filter, timer: 0, delay: null, feedback: null, wet: null };
	return music;
}

function resetDelay() {
	if (!music) return;
	["delay", "feedback", "wet"].forEach((key) => {
		if (!music[key]) return;
		try { music[key].disconnect(); } catch (error) { /* node already disconnected */ }
		music[key] = null;
	});
	const delay = music.ctx.createDelay();
	delay.delayTime.value = 0.22;
	const feedback = music.ctx.createGain();
	feedback.gain.value = 0.18;
	const wet = music.ctx.createGain();
	wet.gain.value = 0.2;
	music.themeBus.connect(delay);
	delay.connect(feedback);
	feedback.connect(delay);
	feedback.connect(wet);
	wet.connect(music.master);
	music.delay = delay;
	music.feedback = feedback;
	music.wet = wet;
}

function stopNode(node) {
	try { node.disconnect(); } catch (error) { /* already disconnected */ }
	const when = music ? music.ctx.currentTime : 0;
	try {
		node.stop(when);
	} catch (error) {
		try { node.stop(when + 30); } catch (ignored) { /* node had not started */ }
	}
}

function cutTheme() {
	loopToken += 1;
	if (music) window.clearTimeout(music.timer);
	clearHops();
	activeNodes.forEach(stopNode);
	activeNodes = [];
	if (!music) return;
	const now = music.ctx.currentTime;
	music.themeBus.gain.cancelScheduledValues(now);
	music.themeBus.gain.setValueAtTime(0, now);
	if (music.wet) {
		music.wet.gain.cancelScheduledValues(now);
		music.wet.gain.setValueAtTime(0, now);
	}
	resetDelay();
}

function rememberNode(node) {
	activeNodes.push(node);
	node.onended = () => {
		activeNodes = activeNodes.filter((item) => item !== node);
	};
}

function envGain(audioCtx, start, peak, attack, release) {
	const gain = audioCtx.createGain();
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
	return gain;
}

function playTone(time, freq, duration, peak, type) {
	const { ctx, filter } = music;
	const osc = ctx.createOscillator();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, time);
	const gain = envGain(ctx, time, peak, 0.02, duration);
	osc.connect(gain);
	gain.connect(filter);
	osc.start(time);
	osc.stop(time + duration + 0.05);
	rememberNode(osc);
}

function playKick(time) {
	const { ctx, filter } = music;
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(130, time);
	osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);
	const gain = envGain(ctx, time, 0.32, 0.005, 0.16);
	osc.connect(gain);
	gain.connect(filter);
	osc.start(time);
	osc.stop(time + 0.2);
	rememberNode(osc);
}

function playHat(time) {
	const { ctx, filter } = music;
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	const highpass = ctx.createBiquadFilter();
	highpass.type = "highpass";
	highpass.frequency.value = 7000;
	const gain = envGain(ctx, time, 0.05, 0.001, 0.03);
	source.connect(highpass);
	highpass.connect(gain);
	gain.connect(filter);
	source.start(time);
	source.stop(time + 0.05);
	rememberNode(source);
}

function updateThemeButton() {
	const button = document.getElementById("theme-toggle");
	const song = document.getElementById("song-name");
	const name = SCENES[state.scene] ? SCENES[state.scene].label : "Theme";
	if (song) song.textContent = name;
	if (!button) return;
	button.textContent = musicOn ? "Pause" : "Play";
	button.setAttribute("aria-pressed", musicOn ? "true" : "false");
	button.setAttribute("aria-label", musicOn ? `Pause ${name}` : `Play ${name}`);
}

function applyVolume() {
	if (!music) return;
	const now = music.ctx.currentTime;
	music.master.gain.cancelScheduledValues(now);
	if (musicVolume <= 0) music.master.gain.setValueAtTime(0, now);
	else music.master.gain.setTargetAtTime(musicVolume, now, 0.03);
}

function scheduleTheme(token) {
	if (!musicOn || !music || token !== loopToken) return;
	const theme = THEMES[state.scene] || THEMES.cafe;
	const beat = 60 / theme.bpm;
	const step = beat / 2;
	const now = music.ctx.currentTime + 0.06;
	music.filter.frequency.setTargetAtTime(theme.filter, now, 0.15);
	theme.melody.forEach((note, index) => {
		const time = now + index * step;
		if (theme.kick[index]) playKick(time);
		if (theme.hat && theme.hat[index]) playHat(time);
		if (note != null) playTone(time, midiToFreq(theme.root + 12 + note), step * 1.6, theme.lead, theme.type);
		if (theme.bass[index] != null) playTone(time, midiToFreq(theme.root - 12 + theme.bass[index]), step * 1.8, 0.09, "sine");
		if (note != null) {
			const delay = Math.max(0, (time - music.ctx.currentTime) * 1000);
			hopTimers.push(window.setTimeout(() => {
				if (token !== loopToken || !musicOn) return;
				shedNotes(note);
			}, delay));
		}
	});
	music.timer = window.setTimeout(() => scheduleTheme(token), theme.melody.length * step * 1000);
}

function syncTheme() {
	if (!music || !musicOn) return;
	cutTheme();
	const now = music.ctx.currentTime;
	music.themeBus.gain.setValueAtTime(1, now);
	document.getElementById("clock-face").classList.add("is-playing");
	scheduleTheme(loopToken);
}

async function setMusic(on) {
	const action = ++musicAction;
	musicOn = on;
	updateThemeButton();
	if (!on) {
		hideNotes();
		if (music) {
			cutTheme();
			if (music.ctx.state === "running") await music.ctx.suspend();
		}
		if (musicOn && music && music.ctx.state === "suspended") await music.ctx.resume();
		return;
	}
	const audio = ensureMusic();
	if (audio.ctx.state === "suspended") await audio.ctx.resume();
	if (action !== musicAction || !musicOn) {
		if (!musicOn && audio.ctx.state === "running") await audio.ctx.suspend();
		return;
	}
	applyVolume();
	syncTheme();
}

function startClock() {
	const hour = document.getElementById("hour-hand");
	const minute = document.getElementById("minute-hand");
	const second = document.getElementById("second-hand");
	const face = document.getElementById("clock-face");
	const digits = document.getElementById("digital-digits");
	const period = document.getElementById("digital-period");
	let lastSecond = -1;

	function frame() {
		const date = new Date();
		const ms = date.getMilliseconds();
		const s = date.getSeconds() + ms / 1000;
		const m = date.getMinutes() + s / 60;
		const h = (date.getHours() % 12) + m / 60;
		hour.style.transform = `rotate(${h * 30}deg)`;
		minute.style.transform = `rotate(${m * 6}deg)`;
		second.style.transform = `rotate(${s * 6}deg)`;
		secondAngle = s * (Math.PI / 30);
		const now = performance.now();
		const dt = noteStamp ? Math.min(0.05, (now - noteStamp) / 1000) : 0.016;
		noteStamp = now;
		if (musicOn && document.getElementById("clock-face").classList.contains("is-playing")) tickNotes(dt);
		const wholeSecond = date.getSeconds();
		if (wholeSecond !== lastSecond) {
			lastSecond = wholeSecond;
			const hourNumber = date.getHours() % 12 || 12;
			digits.textContent = `${String(hourNumber).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
			period.textContent = date.getHours() >= 12 ? "PM" : "AM";
			face.setAttribute("aria-label", `${digits.textContent} ${period.textContent}`);
		}
		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
}

function bindTheme() {
	const button = document.getElementById("theme-toggle");
	const volume = document.getElementById("theme-volume");
	const volumeVal = document.getElementById("volume-val");
	button.addEventListener("click", (event) => {
		event.stopPropagation();
		setMusic(!musicOn);
	});
	volume.addEventListener("input", () => {
		musicVolume = Number(volume.value) / 100;
		volumeVal.textContent = volume.value;
		applyVolume();
	});
	updateThemeButton();
}

buildNotes();
startClock();
bindTheme();
bind();
applyVars();
mount(state.scene);
reflect();
resizeCanvas();
if (!running) {
	running = true;
	if (reduceMotion) drawFrame(0);
	else requestAnimationFrame(loop);
}
