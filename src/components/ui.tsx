import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing, Type, useTheme } from '@/constants/theme';

type Variant = keyof typeof Type;

export function T({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const c = useTheme();
  return (
    <Text
      {...rest}
      style={[Type[variant], { color: color ?? (muted ? c.textSecondary : c.text) }, style]}
    />
  );
}

export function Screen({
  children,
  scroll = true,
  footer,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
}) {
  const c = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.background }}>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const c = useTheme();
  const bg = { primary: c.accent, secondary: c.surface, ghost: 'transparent', danger: c.dangerSoft }[variant];
  const fg = { primary: c.accentText, secondary: c.text, ghost: c.accent, danger: c.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? c.border : 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <T variant="heading" color={fg}>{title}</T>}
    </Pressable>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: 'warn' | 'danger' | 'accent' }) {
  const c = useTheme();
  const bg = tone === 'warn' ? c.warnSoft : tone === 'danger' ? c.dangerSoft : tone === 'accent' ? c.accentSoft : c.surface;
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: tone ? 'transparent' : c.border }, style]}>
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.accent : c.surface, borderColor: selected ? c.accent : c.border },
      ]}>
      <T variant="small" color={selected ? c.accentText : c.text}>{label}</T>
    </Pressable>
  );
}

export function CheckRow({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.checkRow}>
      <View style={[styles.box, { borderColor: checked ? c.accent : c.border, backgroundColor: checked ? c.accent : c.surface }]}>
        {checked ? <T variant="small" color={c.accentText}>✓</T> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Five-step severity meter (1 barely visible … 5 pronounced). */
export function SeverityMeter({ value }: { value: number }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={`Severity ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: i <= value ? c.accent : c.border }}
        />
      ))}
    </View>
  );
}

export const Gap = ({ size = Spacing.md }: { size?: number }) => <View style={{ height: size }} />;

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  button: {
    minHeight: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { borderRadius: Radius.md, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1 },
  checkRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', paddingVertical: Spacing.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
