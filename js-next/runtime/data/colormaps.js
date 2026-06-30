"use strict";

const CMASHER_COLORMAPS = {
  redshift: {
    kind: "diverging",
    stops: [
      { t: 0, c: [24, 10, 50] },
      { t: 0.125, c: [92, 26, 179] },
      { t: 0.25, c: [72, 126, 220] },
      { t: 0.375, c: [127, 197, 220] },
      { t: 0.5, c: [255, 255, 255] },
      { t: 0.625, c: [211, 178, 117] },
      { t: 0.75, c: [192, 89, 32] },
      { t: 0.875, c: [131, 15, 49] },
      { t: 1, c: [39, 4, 18] },
    ],
  },
  iceburn: {
    kind: "diverging",
    stops: [
      { t: 0, c: [148, 241, 243] },
      { t: 0.125, c: [56, 173, 226] },
      { t: 0.25, c: [58, 101, 190] },
      { t: 0.375, c: [42, 48, 78] },
      { t: 0.5, c: [0, 0, 0] },
      { t: 0.625, c: [76, 35, 38] },
      { t: 0.75, c: [159, 70, 38] },
      { t: 0.875, c: [215, 136, 22] },
      { t: 1, c: [245, 222, 69] },
    ],
  },
  ember: {
    kind: "sequential",
    stops: [
      { t: 0, c: [252, 249, 239] },
      { t: 0.2, c: [248, 218, 153] },
      { t: 0.42, c: [238, 150, 72] },
      { t: 0.68, c: [184, 68, 54] },
      { t: 1, c: [72, 28, 52] },
    ],
  },
  torch: {
    kind: "sequential",
    stops: [
      { t: 0, c: [12, 18, 55] },
      { t: 0.22, c: [51, 50, 122] },
      { t: 0.45, c: [131, 55, 131] },
      { t: 0.7, c: [219, 93, 78] },
      { t: 1, c: [255, 218, 107] },
    ],
  },
  rainforest: {
    kind: "sequential",
    stops: [
      { t: 0, c: [247, 250, 244] },
      { t: 0.24, c: [190, 222, 196] },
      { t: 0.5, c: [93, 170, 146] },
      { t: 0.75, c: [32, 109, 124] },
      { t: 1, c: [20, 45, 83] },
    ],
  },
  ocean: {
    kind: "sequential",
    stops: [
      { t: 0, c: [9, 13, 22] },
      { t: 0.22, c: [24, 52, 100] },
      { t: 0.5, c: [24, 125, 157] },
      { t: 0.76, c: [98, 207, 196] },
      { t: 1, c: [240, 251, 227] },
    ],
  },
};

const CMASHER_LUT_SIZE = 4096;
const CMASHER_LUT_LAST = CMASHER_LUT_SIZE - 1;
const CMASHER_LUT_CACHE = new Map();

function interpolateColorStops(stops, t, shade = 1) {
  const clampedT = clamp(t, 0, 1);
  let left = stops[0];
  let right = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (clampedT >= stops[i].t && clampedT <= stops[i + 1].t) {
      left = stops[i];
      right = stops[i + 1];
      break;
    }
  }
  const local = right.t === left.t ? 0 : (clampedT - left.t) / (right.t - left.t);
  return [
    clamp(Math.round((left.c[0] + (right.c[0] - left.c[0]) * local) * shade), 0, 255),
    clamp(Math.round((left.c[1] + (right.c[1] - left.c[1]) * local) * shade), 0, 255),
    clamp(Math.round((left.c[2] + (right.c[2] - left.c[2]) * local) * shade), 0, 255),
  ];
}

function cmasherMap(name) {
  return CMASHER_COLORMAPS[name] || CMASHER_COLORMAPS.redshift;
}

function currentFieldColormapName(magnitude = false) {
  if (magnitude) return state.theme === "dark" ? "torch" : "ember";
  return state.theme === "dark" ? "iceburn" : "redshift";
}

function currentMaterialColormapName(context) {
  const crossesCenter = context.min < context.center && context.max > context.center;
  if (state.materialPart === "imag" || crossesCenter) return state.theme === "dark" ? "iceburn" : "redshift";
  return state.theme === "dark" ? "ocean" : "rainforest";
}

function cmasherColor(name, value, shade = 1, signed = false) {
  const t = signed ? 0.5 + 0.5 * clamp(value, -1, 1) : clamp(value, 0, 1);
  return interpolateColorStops(cmasherMap(name).stops, t, shade);
}

function cmasherColorLut(name, signed = false, shade = 1) {
  const key = `${name}|${signed ? 1 : 0}|${shade}`;
  const cached = CMASHER_LUT_CACHE.get(key);
  if (cached) return cached;

  const lut = new Uint8ClampedArray(CMASHER_LUT_SIZE * 3);
  for (let i = 0; i < CMASHER_LUT_SIZE; i += 1) {
    const t = i / CMASHER_LUT_LAST;
    const value = signed ? 2 * t - 1 : t;
    const [r, g, b] = cmasherColor(name, value, shade, signed);
    const p = i * 3;
    lut[p] = r;
    lut[p + 1] = g;
    lut[p + 2] = b;
  }
  CMASHER_LUT_CACHE.set(key, lut);
  return lut;
}

function cmasherGradient(name) {
  const parts = [...cmasherMap(name).stops]
    .reverse()
    .map((stop) => `rgb(${stop.c[0]}, ${stop.c[1]}, ${stop.c[2]}) ${((1 - stop.t) * 100).toFixed(1)}%`);
  return `linear-gradient(to bottom, ${parts.join(", ")})`;
}
