import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { StyleSheet, Text, View } from 'react-native';

/** `accent="admin"`: teal pill of the admin space. */
export function DateSeparator({ label, accent = 'client' }: { label: string; accent?: 'client' | 'admin' }) {
  return (
    <View style={st.wrap}>
      <View style={[st.pill, accent === 'admin' && st.pillAdmin]}>
        <Text style={st.text}>{label}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pill: {
    backgroundColor: pick('#16224D', '#F1F4FB'),
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    // légère ombre pour bien la détacher du fond quand elle "flotte" au scroll
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pillAdmin: { backgroundColor: '#13303A' },
  text: {
    color: Colors.chrome,
    fontFamily: Font.bodyBold,
    fontSize: 13,
  },
});