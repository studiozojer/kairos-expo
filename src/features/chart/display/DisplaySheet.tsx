import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";

import { useTheme } from "@/theme";

import type { Preset } from "../schema/preset";
import {
  RING_LABELS,
  isBodyEnabled,
  isRingEnabled,
  renderableRings,
  toggleBody,
  toggleRing,
} from "./displayPreset";
import { BUNDLED_PRESET_NAMES } from "./presets";

/**
 * DisplaySheet — the in-memory rendering surface for the chart wheel. A
 * bottom sheet that edits the WIRE `Preset` the wheel is built from: pick a
 * bundled base preset, toggle rings off/on, toggle which bodies show, and
 * switch the aspect overlay. Every control mutates the preset through the pure
 * helpers in displayPreset.ts; the parent feeds the result back through
 * `buildConfiguration` and the wheel re-renders.
 *
 * This is the deliberate small surface from the display-preset direction note:
 * a style preset plus a few toggles, none of the 30-field `PlanetsRingStyle`
 * switchboard. The controls are the fields that already exist on the wire, so
 * nothing here is persisted or invented.
 */

export interface DisplaySheetProps {
  visible: boolean;
  preset: Preset;
  /** The currently-selected bundled preset name (for the picker highlight). */
  presetName: string;
  /** Body display names to offer as toggles (from `bodyChoices(chart)`). */
  bodyNames: string[];
  onSelectPreset: (name: string) => void;
  onChangePreset: (next: Preset) => void;
  onClose: () => void;
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function DisplaySheet({
  visible,
  preset,
  presetName,
  bodyNames,
  onSelectPreset,
  onChangePreset,
  onClose,
}: DisplaySheetProps) {
  const theme = useTheme();
  const rings = renderableRings(preset);

  const toggleAspects = (next: boolean) => {
    onChangePreset({
      ...preset,
      aspects: { ...preset.aspects, enabled: next },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.color.bgSolidCard,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            borderTopWidth: theme.border.hairline,
            borderColor: theme.color.bdCard,
            maxHeight: "78%",
          }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: theme.space.lg,
              paddingTop: theme.space.lg,
              paddingBottom: theme.space.sm,
            }}>
            <Text style={[theme.type.whyteMd, { color: theme.color.txPrimary }]}>Display</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView bounces={false}>
            {/* Preset picker */}
            <Text
              style={[
                theme.type.whyteXxs,
                { color: theme.color.txTertiary, paddingHorizontal: theme.space.lg, marginTop: theme.space.sm },
              ]}>
              STYLE
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.space.lg,
                paddingVertical: theme.space.sm,
                gap: theme.space.xs,
              }}>
              {BUNDLED_PRESET_NAMES.map((name) => {
                const active = name === presetName;
                return (
                  <Pressable
                    key={name}
                    onPress={() => onSelectPreset(name)}
                    style={{
                      paddingHorizontal: theme.space.md,
                      paddingVertical: theme.space.sm,
                      borderRadius: theme.radius.full,
                      backgroundColor: active
                        ? theme.color.bgSolidButton
                        : theme.color.bgSolidCardSecondary,
                      borderWidth: theme.border.hairline,
                      borderColor: active ? theme.color.bgSolidButton : theme.color.bdCard,
                    }}>
                    <Text
                      style={[
                        theme.type.whyteSm,
                        { color: active ? theme.color.txButton : theme.color.txSecondary },
                      ]}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Rings + aspects */}
            <Text
              style={[
                theme.type.whyteXxs,
                { color: theme.color.txTertiary, paddingHorizontal: theme.space.lg, marginTop: theme.space.md },
              ]}>
              LAYERS
            </Text>
            <View style={{ paddingHorizontal: theme.space.lg }}>
              {rings.map((type) => (
                <ToggleRow
                  key={type}
                  label={RING_LABELS[type]}
                  value={isRingEnabled(preset, type)}
                  onChange={(v) => onChangePreset(toggleRing(preset, type, v))}
                />
              ))}
              <ToggleRow label="Aspects" value={preset.aspects.enabled} onChange={toggleAspects} />
            </View>

            {/* Bodies */}
            <Text
              style={[
                theme.type.whyteXxs,
                { color: theme.color.txTertiary, paddingHorizontal: theme.space.lg, marginTop: theme.space.md },
              ]}>
              BODIES
            </Text>
            <View style={{ paddingHorizontal: theme.space.lg, paddingBottom: theme.space.xxl }}>
              {bodyNames.map((name) => (
                <ToggleRow
                  key={name}
                  label={name}
                  value={isBodyEnabled(preset, name)}
                  onChange={(v) => onChangePreset(toggleBody(preset, name, v))}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: theme.space.sm,
        borderBottomWidth: theme.border.hairline,
        borderBottomColor: theme.color.bdSecondary,
      }}>
      <Text style={[theme.type.whyteSm, { color: theme.color.txPrimary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.color.txAccent }}
        thumbColor={theme.color.bgSolidCard}
      />
    </View>
  );
}
