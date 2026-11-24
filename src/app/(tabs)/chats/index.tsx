import Badge from '@/components/ui/Badge';
import { ConnectionErrorState } from '@/components/ui/ConnectionErrorState';
import { OrbitBackground } from '@/components/orbit';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Discussion, DiscussionType } from '@/data_api/models/discussion.types';
import { getApiErrorMessage } from '@/data_api/lib/logger';
import { discussionService } from '@/data_api/services/discussionService';
import { useAuth } from '@/hooks/useAuth';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeftRight,
  HeadphonesIcon,
  MessageCircle,
  Search
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ✅ Clés alignées sur DiscussionType enum
// Same colours as the chat backgrounds: deposit/withdrawal gold, support blue, forum chrome.
const typeConfig: Record<string, { icon: React.ReactNode; colors: readonly [string, string] }> = {
  [DiscussionType.SUPPORT]: {
    icon: <HeadphonesIcon color="#fff" size={24} />,
    colors: ['#3D8BFF', '#1F5FE0'],
  },
  [DiscussionType.DEPOT_RETRAIT]: {
    icon: <ArrowLeftRight color="#1A1405" size={24} />,
    colors: ['#FFD255', '#FF9F1C'],
  },
  [DiscussionType.FORUM]: {
    icon: <MessageCircle color="#fff" size={24} />,
    colors: [pick('#5C6B92', '#8A95B5'), pick('#2D3A63', '#C5CFE6')],
  },
};

// Fallback si le type n'est pas reconnu
const defaultConfig = {
  icon: <MessageCircle color="#fff" size={24} />,
  colors: [pick('#5C6B92', '#8A95B5'), pick('#2D3A63', '#C5CFE6')] as const,
};

// Formate la date ISO en heure lisible
function formatTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatsScreen() {
  const navigationInProgressRef = useRef(false);
  const [search, setSearch] = useState('');
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth(); // ✅ Récupérez l'utilisateur connecté
  const insets = useSafeAreaInsets();

  const fetchDiscussions = useCallback(async () => {
    if (!user?.trackingId) {
      return;
    }
    setError('');
    try {
      const response = await discussionService.getByUserId(user.trackingId);
      setDiscussions(response);
    } catch (err) {
      console.error('Failed to fetch discussions:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Recharge la liste (et donc le dernier message) à chaque retour sur cet écran,
  // par ex. après avoir envoyé un message puis fait "retour" depuis une discussion.
  useFocusEffect(
    useCallback(() => {
      navigationInProgressRef.current = false;
      fetchDiscussions();
    }, [fetchDiscussions])
  );

  // ✅ Filtrage sur les vraies discussions (par titre)
  const filtered = discussions.filter((d) =>
    d.titre.toLowerCase().includes(search.toLowerCase())
  );

  const navigateToChat = (discussion: Discussion) => {
    if (navigationInProgressRef.current) return;
    navigationInProgressRef.current = true;
    if (discussion.type === DiscussionType.DEPOT_RETRAIT) {
      router.push({
        pathname: '/user_chats/deposit-withdrawal',
        params: { id: discussion.trackingId },  // ← ajoute ça
      });
    } else {
      router.push({
        pathname: '/user_chats/[id]',
        params: { id: discussion.trackingId, name: discussion.titre },
      });
    }
  };

  return (
    <OrbitBackground orbits={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search color={Colors.textSecondary} size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une conversation..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Loader */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.goldText} size="large" />
        </View>
      ) : error ? (
        <ConnectionErrorState onRetry={fetchDiscussions} fullscreen />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.trackingId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune conversation trouvée</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const config = typeConfig[item.type] ?? defaultConfig;
            return (
              <TouchableOpacity
                style={styles.convItem}
                onPress={() => navigateToChat(item)}
                activeOpacity={0.75}
              >
                <LinearGradient colors={config.colors} style={styles.avatarContainer} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {config.icon}
                </LinearGradient>
                <View style={styles.convContent}>
                  <View style={styles.convHeader}>
                    <Text style={styles.convName} numberOfLines={1}>{item.titre}</Text>
                    <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
                  </View>
                  <View style={styles.convFooter}>
                    <Text style={styles.convLastMsg} numberOfLines={1}>
                      {item.lastMessageContent ?? 'Aucun message'}
                    </Text>
                    {/* Badge unread : à brancher si votre API le fournit */}
                    <Badge count={0} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </OrbitBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 30, textTransform: 'uppercase' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.night,
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: pick('rgba(120,150,230,0.18)', 'rgba(40,70,150,0.16)'),
  },
  searchInput: {
    flex: 1,
    color: Colors.chrome,
    fontFamily: Font.body,
    fontSize: 15,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  separator: { height: 10 },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
    borderRadius: 24,
    backgroundColor: pick('rgba(17,28,63,0.9)', '#FFFFFF'),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: {
    width: 54, height: 54, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  convContent: { flex: 1, minWidth: 0 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  convName: { flex: 1, color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16 },
  convTime: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 12 },
  convFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convLastMsg: { flex: 1, color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, marginRight: 8 },
});
