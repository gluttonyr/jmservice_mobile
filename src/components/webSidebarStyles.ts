import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';

// Website on a computer: the bottom tab bar becomes a left sidebar (used by the (tabs) and (admin) layouts).
export const webSidebarStyles = StyleSheet.create({
  root: { flexDirection: 'row-reverse', backgroundColor: Colors.darkBg },
  tabBar: {
    flexDirection: 'column',
    width: 270,
    paddingTop: 0,
    paddingHorizontal: 16,
    gap: 8,
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  tabItem: {
    flex: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  tabItemActive: { backgroundColor: Colors.cardBg },
  tabLabel: { fontSize: 16, fontFamily: Font.bodySemiBold },
  // Admin space: turquoise night instead of the client blue.
  rootAdmin: { backgroundColor: Colors.adminBg },
  tabBarAdmin: { borderRightColor: Colors.adminBorder },
  tabItemActiveAdmin: { backgroundColor: Colors.adminCard },
  brandAdmin: { borderBottomColor: Colors.adminBorder },
  // JM Services logo at the top of the sidebar
  brand: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // Tab page content: a readable width, centered next to the sidebar.
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
  // Lists and forms on full-width screens: a readable width, centered.
  readable: { width: '100%', maxWidth: 900, alignSelf: 'center' },
});
