import { OrbitBackground } from '@/components/orbit';
import { Colors, Gradients, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Categorie } from '@/data_api/models/categorie.types';
import { Evenement } from '@/data_api/models/evenement.types';
import { getApiErrorMessage, logError } from '@/data_api/lib/logger';
import { categorieService } from '@/data_api/services/categorieService';
import { evenementService } from '@/data_api/services/evenementService';
import { useFileUrl } from '@/hooks/useFileUrl';
import { useWideWeb } from '@/hooks/useWideWeb';
import { isEventExpired } from '@/utils/eventDate';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { AlertTriangle, Calendar, ChevronRight, MapPin, Trophy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList, Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const ALL_FILTER = 'Tous';
const EXPIRED_FILTER = 'expired';

// Without a cover picture: the blue / gold / light blue gradients of the home screen, with a trophy.
const COVER_GRADIENTS = [
  ['#1F4FC4', '#0D1F5C'],
  ['#F0A020', '#8A4A05'],
  ['#3D7BE0', '#173A86'],
] as const;

function EventCoverImage({ coverImage, style, index = 0 }: { coverImage?: string | null; style?: any; index?: number }) {
  const uri = useFileUrl('events', coverImage);
  if (!uri) {
    return (
      <LinearGradient colors={COVER_GRADIENTS[index % COVER_GRADIENTS.length]} style={[style, styles.coverFallback]}>
        <Trophy color="rgba(255,255,255,0.22)" size={96} strokeWidth={1.6} />
      </LinearGradient>
    );
  }
  return <Image source={{ uri }} style={style} />;
}

export default function EventsScreen() {
  const [activeFilter, setActiveFilter] = useState(ALL_FILTER);
  const [events, setEvents] = useState<Evenement[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const wide = useWideWeb();
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [eventsData, categoriesData] = await Promise.all([
        evenementService.getAll(),
        categorieService.getAll(),
      ]);
      setEvents(eventsData);
      setCategories(categoriesData);
    } catch (err) {
      logError('Load events failed');
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const categoryLabel = (categorieId?: string | null) =>
    categories.find((c) => c.trackingId === categorieId)?.libelle ?? 'Sans catégorie';

  const activeEvents = events.filter((e) => !isEventExpired(e.dateFin));
  const expiredCount = events.filter((e) => isEventExpired(e.dateFin)).length;

  const filterChips = [
    { key: ALL_FILTER, label: 'Tous', count: activeEvents.length, isExpired: false },
    ...categories.map((c) => ({
      key: c.trackingId,
      label: c.libelle,
      count: activeEvents.filter((e) => e.categorieId === c.trackingId).length,
      isExpired: false,
    })),
    { key: EXPIRED_FILTER, label: 'Expirés', count: expiredCount, isExpired: true },
  ];

  const filtered = activeFilter === EXPIRED_FILTER
    ? events.filter((e) => isEventExpired(e.dateFin))
    : activeFilter === ALL_FILTER
      ? activeEvents
      : activeEvents.filter((e) => e.categorieId === activeFilter);

  return (
    <OrbitBackground orbits={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.headerTitle}>Événements</Text>
        <Text style={styles.headerSub}>
          {activeFilter === EXPIRED_FILTER
            ? `${filtered.length} événement${filtered.length !== 1 ? 's' : ''} expiré${filtered.length !== 1 ? 's' : ''}`
            : `${filtered.length} événement${filtered.length !== 1 ? 's' : ''} à venir`}
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <FlatList
          data={filterChips}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key;
            return (
              <TouchableOpacity
                style={[
                  styles.filter,
                  isActive && (item.isExpired ? styles.filterExpiredActive : styles.filterActive),
                ]}
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveFilter(item.key)}
                activeOpacity={0.8}
              >
                {item.isExpired && <AlertTriangle color={isActive ? pick('#FF7B7B', '#D93A3F') : Colors.textSecondary} size={13} />}
                <Text
                  style={[
                    styles.filterText,
                    isActive && (item.isExpired ? styles.filterTextExpiredActive : styles.filterTextActive),
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <View style={[styles.filterCount, isActive && (item.isExpired ? styles.filterCountExpiredActive : styles.filterCountActive)]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                    {item.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.goldText} size="large" />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={loadData}>
            <Text style={styles.emptyBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          // website on a computer: cards in a 3-column grid (key forces a remount when the column count changes)
          key={wide ? 'grid' : 'list'}
          numColumns={wide ? 3 : 1}
          columnWrapperStyle={wide ? styles.gridRow : undefined}
          data={filtered}
          keyExtractor={(item) => item.trackingId}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeFilter === EXPIRED_FILTER ? 'Aucun événement expiré.' : 'Aucun événement pour le moment.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const expired = isEventExpired(item.dateFin);
            return (
              <TouchableOpacity
                style={[styles.card, wide && styles.cardGrid, expired && styles.cardExpired]}
                onPress={() => router.push({ pathname: '/user_events/[id]', params: { id: item.trackingId } })}
                activeOpacity={0.85}
              >
                <EventCoverImage index={index} coverImage={item.coverImage} style={[styles.cardImage, expired && styles.cardImageExpired]} />
                <LinearGradient colors={['transparent', 'rgba(6,11,30,0.7)']} style={styles.cardImageGrad} />
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>
                    {new Date(item.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>{categoryLabel(item.categorieId)}</Text>
                </View>
                {expired && (
                  <View style={styles.expiredBadge}>
                    <AlertTriangle color="#FF7B7B" size={12} />
                    <Text style={styles.expiredBadgeText}>Expiré</Text>
                  </View>
                )}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.titre}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                  <View style={styles.cardMeta}>
                    <View style={styles.metaItem}>
                      <Calendar color={expired ? pick('#FF7B7B', '#D93A3F') : Colors.blueLight} size={15} />
                      <Text style={styles.metaText}>
                        {new Date(item.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MapPin color={expired ? pick('#FF7B7B', '#D93A3F') : Colors.blueLight} size={15} />
                      <Text style={styles.metaText} numberOfLines={1}>{item.lieu ?? 'Lieu non précisé'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => router.push({ pathname: '/user_events/[id]', params: { id: item.trackingId } })}
                  >
                    <Text style={styles.viewBtnText}>Voir les détails</Text>
                    <ChevronRight color={Colors.goldText} size={18} />
                  </TouchableOpacity>
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
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  dateBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(6,11,30,0.72)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  dateBadgeText: { color: Colors.pureWhite, fontFamily: Font.bodyBold, fontSize: 13 },
  header: { paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 30, textTransform: 'uppercase' },
  headerSub: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, marginTop: 2 },
  filtersWrapper: { paddingBottom: 12, flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.navy },
  filterActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterExpiredActive: { backgroundColor: 'rgba(255,107,107,0.16)', borderColor: 'rgba(255,107,107,0.5)' },
  filterText: { color: Colors.chrome, fontFamily: Font.bodySemiBold, fontSize: 14, flexShrink: 0 },
  filterTextActive: { color: Colors.onGold, fontFamily: Font.bodyExtraBold },
  filterTextExpiredActive: { color: pick('#FF7B7B', '#D93A3F'), fontFamily: Font.bodyExtraBold },
  filterCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: pick('rgba(141,154,192,0.18)', 'rgba(80,95,140,0.14)'), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  filterCountActive: { backgroundColor: 'rgba(26,20,5,0.15)' },
  filterCountExpiredActive: { backgroundColor: 'rgba(255,107,107,0.2)' },
  filterCountText: { color: Colors.textSecondary, fontFamily: Font.bodyExtraBold, fontSize: 12 },
  filterCountTextActive: { color: Colors.onGold },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 4, gap: 18, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,194,51,0.1)', borderWidth: 1.5, borderColor: Colors.gold },
  emptyBtnText: { color: Colors.goldText, fontFamily: Font.bodyBold },
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: pick('rgba(17,28,63,0.95)', '#FFFFFF'), borderWidth: 1, borderColor: Colors.border },
  gridRow: { gap: 20 },
  cardGrid: { width: '31.5%' },
  cardExpired: { borderColor: 'rgba(255,107,107,0.3)', opacity: 0.8 },
  cardImage: { width: '100%', height: 180, resizeMode: 'cover' },
  cardImageExpired: { opacity: 0.45 },
  cardImageGrad: { position: 'absolute', top: 90, left: 0, right: 0, height: 90 },
  catBadge: { position: 'absolute', top: 144, left: 14, backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  catText: { color: Colors.onGold, fontFamily: Font.bodyExtraBold, fontSize: 12 },
  expiredBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(6,11,30,0.75)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,107,107,0.5)' },
  expiredBadgeText: { color: '#FF7B7B', fontFamily: Font.bodyBold, fontSize: 12 },
  cardContent: { padding: 16, gap: 8 },
  cardTitle: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 18 },
  cardDesc: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metaText: { color: Colors.chrome, fontFamily: Font.bodySemiBold, fontSize: 13, flexShrink: 1 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  viewBtnText: { color: Colors.goldText, fontFamily: Font.bodyBold, fontSize: 15 },
});
