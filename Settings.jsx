/**
 * Settings.jsx — MicBoostExtreme UI
 * Matches the style shown in screenshot + adds EXTREME preset
 */

import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { React } from "@vendetta/metro/common";
import {
  Forms,
  General,
} from "@vendetta/ui/components";

const { FormSection, FormRow, FormSwitch, FormSlider, FormText } = Forms;
const { View, Text, TouchableOpacity, StyleSheet } = General;

import { PRESETS, applyPreset } from "./index";

const PRESET_COLORS = {
  Normal:  "#5865F2",
  Loud:    "#3BA55C",
  Earrape: "#ED4245",
  "Bass+": "#FAA81A",
  EXTREME: "#000000",  // black — most extreme
};

const styles = StyleSheet.create({
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  presetText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  selectedBorder: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  label: {
    color: "#B5BAC1",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});

export default function Settings() {
  const proxy = useProxy(storage);

  function SliderRow({ label, storageKey, min = 0, max = 100 }) {
    return (
      <>
        <FormText style={styles.label}>
          {label}: {Math.round(proxy[storageKey])}
        </FormText>
        <FormSlider
          value={proxy[storageKey]}
          minimumValue={min}
          maximumValue={max}
          onValueChange={(v) => {
            proxy[storageKey] = v;
            proxy.preset = "Custom";
          }}
        />
      </>
    );
  }

  return (
    <>
      {/* Master toggle */}
      <FormSection title="MicBoost Extreme">
        <FormRow
          label="Enable"
          subLabel="Processes your mic through the audio chain"
          trailing={
            <FormSwitch
              value={proxy.enabled}
              onValueChange={(v) => (proxy.enabled = v)}
            />
          }
        />
      </FormSection>

      {/* Presets */}
      <FormSection title="Presets">
        <View style={styles.presetRow}>
          {Object.keys(PRESETS).map((name) => (
            <TouchableOpacity
              key={name}
              style={[
                styles.presetBtn,
                { backgroundColor: PRESET_COLORS[name] },
                proxy.preset === name && styles.selectedBorder,
              ]}
              onPress={() => applyPreset(name)}
            >
              <Text style={styles.presetText}>
                {name === "EXTREME" ? "💀 EXTREME" : name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </FormSection>

      {/* Sliders */}
      <FormSection title="Manual Controls">
        <SliderRow label="Gain"       storageKey="gain"       min={1} max={100} />
        <SliderRow label="Bass"       storageKey="bass"       />
        <SliderRow label="Distortion" storageKey="distortion" />

        <FormRow
          label="Overdrive"
          subLabel="Extra 8× gain multiplier on top of chain"
          trailing={
            <FormSwitch
              value={proxy.overdrive}
              onValueChange={(v) => {
                proxy.overdrive = v;
                proxy.preset = "Custom";
              }}
            />
          }
        />
      </FormSection>

      {/* Info */}
      <FormSection title="Info">
        <FormRow
          label="How it works"
          subLabel={
            "Patches getUserMedia → runs your mic through:\n" +
            "Gain (up to 50×) → Bass shelf (+30dB) → WaveShaper distortion → Overdrive → Compressor\n\n" +
            "EXTREME preset = max everything 💀"
          }
        />
      </FormSection>
    </>
  );
}
