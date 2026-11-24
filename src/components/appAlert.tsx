import { useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type AlertButton, type AlertOptions } from 'react-native';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';

// Every Alert.alert of the app (website and phones) is drawn by the app in the JM Services style, instead of
// the browser's confirm() box (« <domain> indique », OK / Annuler) or the phone's system dialog.
// Calls keep the React Native API: Alert.alert(title, message?, buttons?, options?). <AlertHost /> (root layout) shows them.

type QueuedAlert = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
  onDismiss?: () => void;
};

let queue: QueuedAlert[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const current = () => queue[0] ?? null;

Alert.alert = (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
  queue = [...queue, {
    id: nextId++,
    title,
    message,
    buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
    cancelable: options?.cancelable ?? true,
    onDismiss: options?.onDismiss,
  }];
  emit();
};

export function AlertHost() {
  const alert = useSyncExternalStore(subscribe, current, current);
  const queryClient = useQueryClient();
  // Admin space in turquoise, client space in gold.
  const isAdmin = (queryClient.getQueryData<{ role?: string }>(['user'])?.role ?? '') === 'ADMIN';
  if (!alert) return null;

  const accent = isAdmin ? Colors.admin : Colors.gold;
  const cancelButton = alert.buttons.find((b) => b.style === 'cancel');
  const others = alert.buttons.filter((b) => b !== cancelButton);
  const primary = others[others.length - 1];

  const close = (button?: AlertButton) => {
    queue = queue.slice(1);
    emit();
    button?.onPress?.();
  };
  // Tap outside / Android back: same as « Annuler », or as the only button of an information message.
  const dismissButton = cancelButton ?? (alert.buttons.length === 1 ? alert.buttons[0] : undefined);
  const dismiss = () => {
    if (!alert.cancelable || !dismissButton) return;
    close(dismissButton);
    alert.onDismiss?.();
  };

  const stacked = alert.buttons.length > 2;
  const ordered = stacked ? [...others, ...(cancelButton ? [cancelButton] : [])] : [...(cancelButton ? [cancelButton] : []), ...others];

  return (
    <Modal key={alert.id} visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Fermer le message">
        <Pressable
          style={[styles.card, isAdmin ? styles.cardAdmin : styles.cardClient]}
          onPress={() => {}}
          accessibilityRole="alert"
          accessibilityViewIsModal
        >
          <View style={[styles.accentBar, { backgroundColor: accent }]} />
          <Text style={styles.title}>{alert.title}</Text>
          {alert.message ? <Text style={styles.message}>{alert.message}</Text> : null}
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {ordered.map((button, index) => {
              const isCancel = button === cancelButton;
              const isDanger = button.style === 'destructive';
              const filled = !isCancel && (button === primary || isDanger);
              return (
                <TouchableOpacity
                  key={`${button.text ?? 'OK'}-${index}`}
                  style={[
                    styles.button,
                    !stacked && styles.buttonInRow,
                    filled
                      ? { backgroundColor: isDanger ? Colors.error : accent }
                      : isCancel
                        ? styles.buttonCancel
                        : { borderWidth: 1.5, borderColor: accent },
                  ]}
                  onPress={() => close(button)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: filled ? (isDanger ? '#FFFFFF' : Colors.onGold) : isCancel ? Colors.chrome : accent },
                    ]}
                    numberOfLines={2}
                  >
                    {button.text ?? 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: pick('rgba(3,6,16,0.74)', 'rgba(12,22,52,0.45)'),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  cardClient: { backgroundColor: pick('#111C3F', '#FFFFFF'), borderColor: pick('rgba(120,150,230,0.28)', 'rgba(40,70,150,0.2)') },
  cardAdmin: { backgroundColor: '#0E2229', borderColor: 'rgba(25,211,197,0.35)' },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 21, lineHeight: 27 },
  message: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, lineHeight: 22, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  actionsStacked: { flexDirection: 'column' },
  button: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonInRow: { flex: 1 },
  buttonCancel: { borderWidth: 1, borderColor: pick('rgba(232,237,247,0.22)', 'rgba(22,33,90,0.18)') },
  buttonText: { fontFamily: Font.bodyBold, fontSize: 15, textAlign: 'center' },
});
