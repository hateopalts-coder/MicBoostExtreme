// MicBoostExtreme — Bunny Plugin
// No build step required. Uses vendetta globals.

const { plugin: { storage } } = vendetta;
const { metro: { common: { React } } } = vendetta;
const { ui: { components: { Forms, General } } } = vendetta;

if (storage.enabled    === undefined) storage.enabled    = false;
if (storage.gain       === undefined) storage.gain       = 10;
if (storage.bass       === undefined) storage.bass       = 0;
if (storage.distortion === undefined) storage.distortion = 0;
if (storage.overdrive  === undefined) storage.overdrive  = false;
if (storage.preset     === undefined) storage.preset     = "Normal";

const PRESETS = {
  Normal:  { gain: 5,   bass: 0,   distortion: 0,   overdrive: false },
  Loud:    { gain: 30,  bass: 20,  distortion: 15,  overdrive: false },
  Earrape: { gain: 80,  bass: 50,  distortion: 80,  overdrive: true  },
  "Bass+": { gain: 20,  bass: 80,  distortion: 10,  overdrive: false },
  EXTREME: { gain: 100, bass: 100, distortion: 100, overdrive: true  },
};

let _ctx = null;

function makeDistortionCurve(amount) {
  const n = 256, curve = new Float32Array(n);
  const k = amount < 1 ? 0.001 : amount * 4;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function buildChain(stream) {
  if (_ctx) _ctx.close().catch(() => {});
  _ctx = new AudioContext();
  const src = _ctx.createMediaStreamSource(stream);
  const gain = _ctx.createGain();
  gain.gain.value = 1 + (storage.gain / 100) * 49;
  const bass = _ctx.createBiquadFilter();
  bass.type = "lowshelf"; bass.frequency.value = 200;
  bass.gain.value = (storage.bass / 100) * 30;
  const dist = _ctx.createWaveShaper();
  dist.curve = makeDistortionCurve(storage.distortion);
  dist.oversample = "4x";
  const od = _ctx.createGain();
  od.gain.value = storage.overdrive ? 8 : 1;
  const comp = _ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 0;
  comp.ratio.value = 20; comp.attack.value = 0; comp.release.value = 0.1;
  const dest = _ctx.createMediaStreamDestination();
  src.connect(gain).connect(bass).connect(dist).connect(od).connect(comp).connect(dest);
  return dest.stream;
}

const _orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

const COLORS = { Normal:"#5865F2", Loud:"#3BA55C", Earrape:"#ED4245", "Bass+":"#FAA81A", EXTREME:"#111" };

function Settings() {
  const [, fu] = React.useReducer(x => x + 1, 0);
  const set = (k, v) => { storage[k] = v; storage.preset = "Custom"; fu(); };
  const { FormSection, FormRow, FormSwitch, FormSlider, FormText } = Forms;
  const { View, Text, TouchableOpacity } = General;
  return React.createElement(React.Fragment, null,
    React.createElement(FormSection, { title: "MicBoost Extreme" },
      React.createElement(FormRow, {
        label: "Enable",
        subLabel: "Patches mic through audio chain on next VC join",
        trailing: React.createElement(FormSwitch, { value: storage.enabled, onValueChange: v => { storage.enabled = v; fu(); } })
      })
    ),
    React.createElement(FormSection, { title: "Presets" },
      React.createElement(View, { style: { flexDirection:"row", flexWrap:"wrap", gap:8, padding:12 } },
        ...Object.keys(PRESETS).map(name =>
          React.createElement(TouchableOpacity, {
            key: name, onPress: () => { Object.assign(storage, PRESETS[name], { preset: name }); fu(); },
            style: { backgroundColor: COLORS[name], paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth: storage.preset===name?2:0, borderColor:"#fff" }
          }, React.createElement(Text, { style:{color:"#fff",fontWeight:"700",fontSize:13} }, name==="EXTREME"?"💀 EXTREME":name))
        )
      )
    ),
    React.createElement(FormSection, { title: `Controls — ${storage.preset}` },
      React.createElement(FormText, null, `Gain: ${Math.round(storage.gain)}`),
      React.createElement(FormSlider, { value:storage.gain, minimumValue:1, maximumValue:100, onValueChange:v=>set("gain",v) }),
      React.createElement(FormText, null, `Bass: ${Math.round(storage.bass)}`),
      React.createElement(FormSlider, { value:storage.bass, minimumValue:0, maximumValue:100, onValueChange:v=>set("bass",v) }),
      React.createElement(FormText, null, `Distortion: ${Math.round(storage.distortion)}`),
      React.createElement(FormSlider, { value:storage.distortion, minimumValue:0, maximumValue:100, onValueChange:v=>set("distortion",v) }),
      React.createElement(FormRow, {
        label: "Overdrive", subLabel: "8× extra gain",
        trailing: React.createElement(FormSwitch, { value:storage.overdrive, onValueChange:v=>set("overdrive",v) })
      })
    )
  );
}

module.exports = {
  onLoad()   { navigator.mediaDevices.getUserMedia = (c) => !storage.enabled || !c?.audio ? _orig(c) : _orig(c).then(buildChain); },
  onUnload() { navigator.mediaDevices.getUserMedia = _orig; if (_ctx) { _ctx.close().catch(()=>{}); _ctx=null; } },
  settings: Settings
};
