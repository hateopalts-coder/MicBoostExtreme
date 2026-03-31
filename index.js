/**
 * MicBoostExtreme - Bunny/Vendetta Mobile Plugin
 * Patches getUserMedia to inject Web Audio processing chain
 * Gain → Distortion → Bass → Compressor → output
 */

import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { registerCommand, unregisterCommand } from "@vendetta/commands";
import Settings from "./Settings";

// ─── defaults ────────────────────────────────────────────────────────────────
const DEFAULTS = {
  enabled: false,
  gain: 10,        // 1–100  (linear multiplier)
  bass: 0,         // 0–100  (dB shelf boost)
  distortion: 0,   // 0–100  (waveshaper amount)
  overdrive: false,
  preset: "Normal",
};

for (const [k, v] of Object.entries(DEFAULTS)) {
  if (storage[k] === undefined) storage[k] = v;
}

// ─── audio context + nodes ───────────────────────────────────────────────────
let ctx = null;
let sourceNode = null;
let outputDest = null;

function makeDistortionCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  const k = amount === 0 ? 0.001 : amount * 4; // 0–400
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function buildChain(stream) {
  if (ctx) ctx.close().catch(() => {});

  ctx = new AudioContext();
  sourceNode = ctx.createMediaStreamSource(stream);

  // 1. Gain node
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1 + (storage.gain / 100) * 49; // 1x – 50x

  // 2. Bass shelf (BiquadFilter lowshelf)
  const bassNode = ctx.createBiquadFilter();
  bassNode.type = "lowshelf";
  bassNode.frequency.value = 200;
  bassNode.gain.value = (storage.bass / 100) * 30; // 0 – 30 dB

  // 3. Distortion (WaveShaper)
  const distNode = ctx.createWaveShaper();
  distNode.curve = makeDistortionCurve(storage.distortion);
  distNode.oversample = "4x";

  // 4. Overdrive extra gain
  const odNode = ctx.createGain();
  odNode.gain.value = storage.overdrive ? 8 : 1;

  // 5. Dynamics compressor — prevents full silence-clipping
  const compNode = ctx.createDynamicsCompressor();
  compNode.threshold.value = -20;
  compNode.knee.value = 0;
  compNode.ratio.value = 20;
  compNode.attack.value = 0;
  compNode.release.value = 0.1;

  // Chain
  outputDest = ctx.createMediaStreamDestination();
  sourceNode
    .connect(gainNode)
    .connect(bassNode)
    .connect(distNode)
    .connect(odNode)
    .connect(compNode)
    .connect(outputDest);

  return outputDest.stream;
}

// ─── patch getUserMedia ───────────────────────────────────────────────────────
const _origGetUM = navigator.mediaDevices.getUserMedia.bind(
  navigator.mediaDevices
);

function patchedGetUserMedia(constraints) {
  if (!storage.enabled || !constraints?.audio) {
    return _origGetUM(constraints);
  }
  return _origGetUM(constraints).then((stream) => buildChain(stream));
}

// ─── presets ─────────────────────────────────────────────────────────────────
export const PRESETS = {
  Normal:   { gain: 5,  bass: 0,  distortion: 0,   overdrive: false },
  Loud:     { gain: 30, bass: 20, distortion: 15,  overdrive: false },
  Earrape:  { gain: 80, bass: 50, distortion: 80,  overdrive: true  },
  "Bass+":  { gain: 20, bass: 80, distortion: 10,  overdrive: false },
  EXTREME:  { gain: 100,bass: 100,distortion: 100, overdrive: true  }, // 💀
};

export function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(storage, p, { preset: name });
  if (storage.enabled && ctx) rebuildChain();
}

function rebuildChain() {
  if (!outputDest) return;
  const tracks = outputDest.stream.getAudioTracks();
  if (!tracks.length) return;
  // get original stream from source node
  const origStream = sourceNode.mediaStream;
  buildChain(origStream);
}

// ─── plugin lifecycle ─────────────────────────────────────────────────────────
export default {
  onLoad() {
    navigator.mediaDevices.getUserMedia = patchedGetUserMedia;
  },

  onUnload() {
    navigator.mediaDevices.getUserMedia = _origGetUM;
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  },

  settings: Settings,
};
