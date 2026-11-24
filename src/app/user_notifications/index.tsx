import { useWideWeb } from '@/hooks/useWideWeb';
import { webSidebarStyles } from '@/components/webSidebarStyles';
import { ChatBackground } from '@/components/ChatBackground';
import { ImagePreviewModal } from '@/components/ImagePreviewModel';
import { DateSeparator } from '@/components/dateSeparator';
import { formatDayLabel } from '@/components/chatGrouping';
import { ChatHeader } from '@/components/orbit';
import JMLogo from '@/components/ui/JMLogo';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import type { AppNotification } from '@/data_api/models/appNotification.types';
import { notificationService } from '@/data_api/services/notificationService';
import { markNotificationsSeen } from '@/storage/appNotificationSeen';
import { useAuth } from '@/hooks/useAuth';
import { router, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Bell, ChevronLeft, ImageOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function NotificationImage({ uri, width, onPress }: { uri: string; width: number; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.image, styles.imageFallback, { width }]}>
        <ImageOff color={Colors.textSecondary} size={20} />
        <Text style={styles.imageFallbackText}>Image momentanément indisponible</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} accessibilityRole="button" accessibilityLabel="Aperçu de l’image">
      <Image
        source={{ uri }}
        style={[styles.image, { width }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </TouchableOpacity>
  );
}

type NotificationSection = {
  title: string;
  dateKey: string;
  data: AppNotification[];
};

export default function UserNotificationsScreen() {
  const { user } = useAuth();
  const wide = useWideWeb();
  const { width: windowWidth } = useWindowDimensions();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const itemsRef = useRef<AppNotification[]>([]);
  const cursorRef = useRef<number | null>(null);
  const hasMoreRef = useRef(false);
  const loadedOlderPagesRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const canLoadOlderRef = useRef(false);

  const sections = useMemo(() => {
    const sortedItems = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const grouped = new Map<string, NotificationSection>();

    for (const item of sortedItems) {
      const date = new Date(item.createdAt);
      const dateKey = Number.isNaN(date.getTime())
        ? `invalid-${item.createdAt}`
        : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      let section = grouped.get(dateKey);

      if (!section) {
        section = {
          title: Number.isNaN(date.getTime()) ? 'Date inconnue' : formatDayLabel(date),
          dateKey,
          data: [],
        };
        grouped.set(dateKey, section);
      }
      section.data.push(item);
    }

    return Array.from(grouped.values());
  }, [items]);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const page = await notificationService.getMinePage({ limit: 20 });
      const existingItems = itemsRef.current;
      const merged = Array.from(new Map(
        [...page.items, ...existingItems].map((item) => [item.trackingId, item]),
      ).values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      itemsRef.current = merged;
      setItems(merged);
      if (!loadedOlderPagesRef.current) {
        cursorRef.current = page.nextCursor;
        hasMoreRef.current = page.hasMore;
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      }
      if (user?.trackingId) {
        await markNotificationsSeen(user.trackingId, page.items.map((item) => item.createdAt));
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.trackingId]);

  const loadOlder = useCallback(async () => {
    const beforeId = cursorRef.current;
    if (!canLoadOlderRef.current || !hasMoreRef.current || beforeId === null || loadingMoreRef.current) return;
    canLoadOlderRef.current = false;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await notificationService.getMinePage({ limit: 20, beforeId });
      const merged = Array.from(new Map(
        [...itemsRef.current, ...page.items].map((item) => [item.trackingId, item]),
      ).values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      itemsRef.current = merged;
      setItems(merged);
      cursorRef.current = page.nextCursor;
      hasMoreRef.current = page.hasMore;
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      loadedOlderPagesRef.current = true;
    } catch {
      setFailed(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { type?: string };
      if (data.type === 'ADMIN_BROADCAST' || data.type === 'transaction') void load();
    });
    return () => subscription.remove();
  }, [load]);

  const renderItem = ({ item }: { item: AppNotification }) => (
    <View style={styles.messageWrap}>
      <View style={styles.messageCard}>
        <View style={styles.messageHeader}>
          <View style={styles.messageIcon}>
            <JMLogo size={18} />
          </View>
            <Text style={styles.sender}>JM Services</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
          {!!item.imageUrl && <NotificationImage uri={item.imageUrl} width={Math.min(windowWidth * 0.76, 400)} onPress={() => setPreviewUri(item.imageUrl!)} />}
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ChatBackground variant="default" />
      <ChatHeader
        title="Notifications"
        subtitle="Messages de JM Services"
        onBack={() => router.back()}
        avatar={<View style={styles.headerAvatar}><Bell color={Colors.goldText} size={22} /></View>}
      />

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.goldText} size="large" /></View>
      ) : (
        <SectionList
          sections={sections}
          // react-native-web draws inverted SectionLists upside down: on the web the newest is simply on top
          inverted={Platform.OS !== 'web'}
          scrollEventThrottle={16}
          onScroll={(event) => {
            if (event.nativeEvent.contentOffset.y > 24) canLoadOlderRef.current = true;
          }}
          keyExtractor={(item) => item.trackingId}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, items.length === 0 && styles.emptyList, wide && webSidebarStyles.readable]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <DateSeparator label={section.title} />}
          onEndReached={() => { if (hasMore && !loadingMore) void loadOlder(); }}
          onEndReachedThreshold={0.25}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.goldText} style={{ padding: 16 }} /> : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
              tintColor={Colors.primaryGreen}
              colors={[Colors.primaryGreen]}
              progressBackgroundColor={Colors.cardBg}
            />
          }
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Bell color={Colors.textSecondary} size={24} /></View>
              <Text style={styles.emptyTitle}>{failed ? 'Notifications indisponibles' : 'Aucune notification'}</Text>
              <Text style={styles.emptyText}>{failed ? 'Vérifiez votre connexion puis actualisez la page.' : 'Les messages envoyés par JM Services apparaîtront ici.'}</Text>
              {failed && <TouchableOpacity onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>Réessayer</Text></TouchableOpacity>}
            </View>
          )}
        />
      )}
      <ImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} showDownload={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,194,51,0.12)', borderWidth: 1, borderColor: 'rgba(255,194,51,0.35)', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: Colors.darkBg },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, padding: 16, gap: 10 },
  emptyList: { justifyContent: 'center' },
  messageWrap: { width: '100%', alignItems: 'flex-start' },
  messageCard: { alignSelf: 'flex-start', maxWidth: '88%', padding: 14, borderRadius: 22, borderTopLeftRadius: 6, backgroundColor: pick('#16224D', '#F1F4FB'), gap: 8 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: Colors.navy, overflow: 'hidden' },
  sender: { color: Colors.blueLight, fontFamily: Font.bodyBold, fontSize: 13 },
  date: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 11, alignSelf: 'flex-end' },
  title: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 16 },
  body: { color: Colors.chrome, fontFamily: Font.body, fontSize: 15, lineHeight: 21 },
  image: { height: 210, borderRadius: 16, marginTop: 2, backgroundColor: Colors.cardBg },
  imageFallback: { alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: Colors.border },
  imageFallbackText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 24 },
  emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: 'rgba(90,162,255,0.14)', marginBottom: 12 },
  emptyTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 18, textTransform: 'uppercase', marginBottom: 5 },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: 14, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.gold, backgroundColor: 'rgba(255,194,51,0.1)' },
  retryText: { color: Colors.goldText, fontFamily: Font.bodyBold, fontSize: 14 },
});
