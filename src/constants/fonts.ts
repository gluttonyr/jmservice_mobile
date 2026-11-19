import {
  Saira_700Bold_Italic,
  Saira_800ExtraBold_Italic,
  Saira_900Black_Italic,
} from '@expo-google-fonts/saira';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/** Passed to useFonts() in the root layout. */
export const FONT_ASSETS = {
  Saira_700Bold_Italic,
  Saira_800ExtraBold_Italic,
  Saira_900Black_Italic,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

/**
 * Font families of the « Orbite » design. Titles: Saira italic (uppercase, like "SERVICES" in the logo).
 * Body: Plus Jakarta Sans. Each weight is its own family, so never combine them with fontWeight.
 */
export const Font = {
  title: 'Saira_900Black_Italic',
  titleBold: 'Saira_800ExtraBold_Italic',
  titleMedium: 'Saira_700Bold_Italic',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const;
