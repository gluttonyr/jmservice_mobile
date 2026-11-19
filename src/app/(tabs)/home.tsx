import { OrbitBackground, OrbitStar } from '@/components/orbit';
import { SocialLinks } from '@/components/SocialLinks';
import { UserAvatar } from '@/components/UserAvatar';
import JMLogo from '@/components/ui/JMLogo';
import { Colors, Gradients } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { Banniere } from '@/data_api/models/banniere.types';
import { DiscussionType } from '@/data_api/models/discussion.types';
import { Evenement } from '@/data_api/models/evenement.types';
import { banniereService } from '@/data_api/services/banniereService';
import { discussionService } from '@/data_api/services/discussionService';
import { evenementService } from '@/data_api/services/evenementService';
import { notificationService } from '@/data_api/services/notificationService';
import { transactionService } from '@/data_api/services/transactionService';
import { useAuth } from '@/hooks/useAuth';
import { useFileUrl } from '@/hooks/useFileUrl';
import { usePromoCode } from '@/hooks/usePromoCode';
import { getLastSeenNotificationAt } from '@/storage/appNotificationSeen';
import { openAppLink } from '@/utils/appLink';
import { goToTab } from '@/utils/tabNavigation';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ArrowDown, ArrowRight, ArrowUp, Bell, ChevronRight, History, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse } from 'react-native-svg';
import Toast from 'react-native-toast-message';

const CAROUSEL_GAP = 14;
const SIDE = 20;

// Event cards without a cover picture take these colours in turn (as in the design).
const EVENT_GRADIENTS = [
  ['#1F4FC4', '#0D1F5C'],
  ['#F0A020', '#8A4A05'],
  ['#3D7BE0', '#173A86'],
] as const;

function EventCover({ coverImage, index }: { coverImage?: string | null; index: number }) {
  const uri = useFileUrl('events', coverImage);
  if (uri) return <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  return (
    <LinearGradient colors={EVENT_GRADIENTS[index % EVENT_GRADIENTS.length]} style={StyleSheet.absoluteFill}>
      <View style={styles.eventIconWrap}>
        <Trophy color="rgba(255,255,255,0.22)" size={92} strokeWidth={1.6} />
      </View>
    </LinearGradient>
  );
}

function BannerImage({ image }: { image?: string | null }) {
  const uri = useFileUrl('banners', image);
  if (!uri) return null;
  return <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
}

/** Initials on the blue tile when the user has no profile photo. */
function Initials({ prenom, nom }: { prenom?: string; nom?: string }) {
  const letters = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || 'JM';
  return (
    <LinearGradient colors={Gradients.blue} style={styles.initials} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={styles.initialsText}>{letters}</Text>
    </LinearGradient>
  );
}

type Slide =
  | { kind: 'banner'; banner: Banniere }
  | { kind: 'promo'; code: string }
  | { kind: 'welcome' };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const promoCode = usePromoCode();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sliderRef = useRef<FlatList<Slide>>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<Evenement[]>([]);
  const [banners, setBanners] = useState<Banniere[]>([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [depotRetraitId, setDepotRetraitId] = useState<string | null>(null);
  const [depositsAvailable, setDepositsAvailable] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refreshCaptureStatus = () => {
      transactionService.getCaptureStatus()
        .then((status) => { if (active) setDepositsAvailable(status.available); })
        .catch(() => { if (active) setDepositsAvailable(false); });
    };
    refreshCaptureStatus();
    if (user?.trackingId) {
      const userId = user.trackingId;
      notificationService.getMinePage({ limit: 1 }).then(async ({ items }) => {
        const lastSeenAt = await getLastSeenNotificationAt(userId);
        if (active) setHasNewNotifications(items.some((item) => new Date(item.createdAt).getTime() > lastSeenAt));
      }).catch(() => {});
    }
    const timer = setInterval(refreshCaptureStatus, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.trackingId]));

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => setHasNewNotifications(true));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    evenementService.getAll().then((data) => setUpcomingEvents(data.slice(0, 3))).catch(() => {});
  }, []);

  useEffect(() => {
    banniereService.getAll().then(setBanners).catch(() => {}).finally(() => setBannersLoaded(true));
  }, []);

  // La discussion "Dépôt / Retrait" est créée automatiquement pour chaque utilisateur
  // (DiscussionService.createForUser côté backend) : les boutons de l'accueil ouvrent la même.
  useEffect(() => {
    if (!user?.trackingId) return;
    discussionService
      .getByUserId(user.trackingId)
      .then((discussions) => {
        const depotRetrait = discussions.find((d) => d.type === DiscussionType.DEPOT_RETRAIT);
        setDepotRetraitId(depotRetrait?.trackingId ?? null);
      })
      .catch(() => {});
  }, [user?.trackingId]);

  // Carousel: the admin's banners, then the promo code (never on iOS: App Store review).
  // Nothing configured or offline: a welcome card, so the layout keeps its place.
  const slides: Slide[] = banners.map((banner) => ({ kind: 'banner', banner }));
  if (Platform.OS !== 'ios' && promoCode) slides.push({ kind: 'promo', code: promoCode });
  if (slides.length === 0 && bannersLoaded) slides.push({ kind: 'welcome' });

  const cardWidth = Math.max(0, pageWidth - SIDE * 2 - (slides.length > 1 ? 44 : 0));
  const step = cardWidth + CAROUSEL_GAP;

  useEffect(() => {
    if (slides.length < 2 || step <= 0) return;
    const timer = setInterval(() => {
      const next = (activeSlide + 1) % slides.length;
      sliderRef.current?.scrollToOffset({ offset: next * step, animated: true });
      setActiveSlide(next);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeSlide, slides.length, step]);

  const openDeposit = () => {
    if (!depositsAvailable || !depotRetraitId) return;
    router.push({ pathname: '/user_chats/deposit-withdrawal', params: { id: depotRetraitId, initialMode: 'deposit' } });
  };

  const openWithdrawal = () => {
    if (!depotRetraitId) return;
    router.push({ pathname: '/user_chats/deposit-withdrawal', params: { id: depotRetraitId, initialMode: 'withdrawal' } });
  };

  const copyPromo = (code: string) => {
    Clipboard.setString(code);
    Toast.show({ type: 'success', text1: 'Code copié', text2: `Utilisez ${code} lors de votre inscription chez le bookmaker.` });
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    if (item.kind === 'banner') {
      const { banner } = item;
      return (
        <TouchableOpacity
          activeOpacity={banner.lien ? 0.85 : 1}
          onPress={() => openAppLink(banner.lien)}
          style={[styles.slide, { width: cardWidth }]}
        >
          <BannerImage image={banner.image} />
          <LinearGradient
            colors={['rgba(13,24,56,0.96)', 'rgba(13,24,56,0.6)', 'rgba(13,24,56,0.05)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.slideContent}>
            <View style={styles.slideBadge}><Text style={styles.slideBadgeText}>OFFRE SPÉCIALE</Text></View>
            <Text style={styles.slideTitle} numberOfLines={2}>{banner.titre}</Text>
            {!!banner.sousTitre && <Text style={styles.slideSubtitle} numberOfLines={2}>{banner.sousTitre}</Text>}
            {!!banner.texteCta && <Text style={styles.slideCta}>{banner.texteCta} ›</Text>}
          </View>
        </TouchableOpacity>
      );
    }
    if (item.kind === 'promo') {
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => copyPromo(item.code)} style={[styles.slide, { width: cardWidth }]}>
          <View style={styles.slideLogo} pointerEvents="none"><JMLogo size={120} /></View>
          <View style={styles.slideContent}>
            <View style={styles.slideBadge}><Text style={styles.slideBadgeText}>OFFRE SPÉCIALE</Text></View>
            <Text style={styles.slideTitle} numberOfLines={2}>BONUS AVEC LE{'\n'}CODE {item.code}</Text>
            <Text style={styles.slideCta}>Copier le code ›</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={[styles.slide, { width: cardWidth }]}>
        <View style={styles.slideLogo} pointerEvents="none"><JMLogo size={120} /></View>
        <View style={styles.slideContent}>
          <View style={styles.slideBadge}><Text style={styles.slideBadgeText}>BIENVENUE</Text></View>
          <Text style={styles.slideTitle} numberOfLines={2}>BIENVENUE SUR{'\n'}JM SERVICES</Text>
          <Text style={styles.slideSubtitle}>Découvrez nos offres et actualités</Text>
        </View>
      </View>
    );
  };

  return (
    <OrbitBackground orbits={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: insets.top + 12 }}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <UserAvatar image={user?.image} size={52} style={styles.avatarPhoto} fallback={<Initials prenom={user?.prenom} nom={user?.nom} />} />
            <View style={styles.headerNameWrap}>
              <Text style={styles.headerGreet}>Bonjour,</Text>
              <Text style={styles.headerName} numberOfLines={1}>{[user?.prenom, user?.nom].filter(Boolean).join(' ')}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <SocialLinks variant="toolbar" />
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/user_notifications' as any)}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les notifications"
            >
              <Bell color={Colors.chrome} size={21} />
              {hasNewNotifications && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Main card: deposit / withdrawal */}
        <Animated.View style={[styles.heroWrap, { opacity: fadeAnim }]}>
          <LinearGradient colors={['#2F6BF0', '#1A47C2', '#163B9E']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
              <Ellipse cx="200" cy="150" rx="250" ry="95" transform="rotate(-14 200 150)" stroke="rgba(255,214,120,0.45)" strokeWidth="1.3" fill="none" />
            </Svg>
            <View style={styles.heroStar} pointerEvents="none"><OrbitStar size={30} /></View>
            <Text style={styles.heroTitle}>QUE FAISONS-NOUS{'\n'}AUJOURD'HUI ?</Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openDeposit}
              disabled={!depositsAvailable}
              style={[styles.action, !depositsAvailable && styles.actionDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Dépôt"
            >
              <LinearGradient colors={Gradients.gold} style={styles.actionInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={[styles.actionIcon, styles.actionIconGold]}><ArrowDown color={Colors.onGold} size={24} strokeWidth={2.5} /></View>
                <View style={styles.actionCopy}>
                  <Text style={[styles.actionTitle, { color: Colors.onGold }]}>DÉPÔT</Text>
                  <Text style={[styles.actionSub, { color: 'rgba(26,20,5,0.8)' }]}>
                    {depositsAvailable ? 'Recharger votre compte' : 'Dépôts temporairement indisponibles'}
                  </Text>
                </View>
                <ArrowRight color={Colors.onGold} size={24} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={openWithdrawal} style={styles.action} accessibilityRole="button" accessibilityLabel="Retrait">
              <View style={[styles.actionInner, styles.actionOutline]}>
                <View style={[styles.actionIcon, styles.actionIconBlue]}><ArrowUp color={Colors.pureWhite} size={24} strokeWidth={2.5} /></View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>RETRAIT</Text>
                  <Text style={styles.actionSub}>{Platform.OS === 'ios' ? 'Retirer vers Mobile Money' : 'Récupérer vos gains'}</Text>
                </View>
                <ArrowRight color={Colors.pureWhite} size={24} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.history}
              activeOpacity={0.8}
              onPress={() => router.push('/user_transactions' as any)}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir mes transactions et mon historique"
            >
              <History color={Colors.pureWhite} size={20} />
              <Text style={styles.historyTitle}>Mes transactions</Text>
              <Text style={styles.historyLink}>Voir l'historique ›</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Banners carousel */}
        {slides.length > 0 && cardWidth > 0 && (
          <View>
            <FlatList
              ref={sliderRef}
              data={slides}
              horizontal
              keyExtractor={(item, i) => (item.kind === 'banner' ? item.banner.trackingId : `${item.kind}-${i}`)}
              renderItem={renderSlide}
              showsHorizontalScrollIndicator={false}
              snapToInterval={step}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: SIDE, gap: CAROUSEL_GAP }}
              onMomentumScrollEnd={(e) => setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / step))}
            />
            {slides.length > 1 && (
              <View style={styles.pagination}>
                {slides.map((_, i) => <View key={i} style={[styles.dot, i === activeSlide && styles.dotActive]} />)}
              </View>
            )}
          </View>
        )}

        {/* Upcoming events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ÉVÉNEMENTS À VENIR</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => goToTab('events')}>
              <Text style={styles.seeAllText}>Tout voir</Text>
              <ChevronRight color={Colors.blueLight} size={16} />
            </TouchableOpacity>
          </View>
        </View>
        {upcomingEvents.length === 0 ? (
          <Text style={styles.emptyEvents}>Aucun événement prévu pour le moment.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsScroll}>
            {upcomingEvents.map((event, index) => (
              <TouchableOpacity
                key={event.trackingId}
                style={styles.eventCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/user_events/[id]', params: { id: event.trackingId } })}
              >
                <EventCover coverImage={event.coverImage} index={index} />
                <LinearGradient colors={['transparent', 'rgba(6,11,30,0.85)']} style={styles.eventShade} />
                <View style={styles.eventDate}>
                  <Text style={styles.eventDateText}>
                    {new Date(event.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.eventTitle} numberOfLines={2}>{event.titre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </OrbitBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIDE, marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  avatarPhoto: { borderRadius: 16 },
  initials: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: Colors.pureWhite, fontFamily: Font.title, fontSize: 20 },
  headerNameWrap: { flexShrink: 1, minWidth: 0 },
  headerGreet: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },
  headerName: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  iconButton: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.border,
  },
  notificationDot: {
    position: 'absolute', top: 4, right: 4, width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.gold, borderWidth: 1.5, borderColor: Colors.navy,
  },

  heroWrap: {
    marginHorizontal: SIDE, marginBottom: 22, borderRadius: 30,
    shadowColor: Colors.blue, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  hero: { borderRadius: 30, padding: 20, paddingTop: 22, overflow: 'hidden' },
  heroStar: { position: 'absolute', top: 18, right: 22 },
  heroTitle: { color: Colors.pureWhite, fontFamily: Font.title, fontSize: 26, lineHeight: 30, marginBottom: 18 },
  action: { marginBottom: 12, borderRadius: 22 },
  actionDisabled: { opacity: 0.5 },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 14 },
  actionOutline: { backgroundColor: 'rgba(10,22,70,0.55)', borderWidth: 1.5, borderColor: 'rgba(160,190,255,0.45)' },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionIconGold: { backgroundColor: 'rgba(26,20,5,0.12)' },
  actionIconBlue: { backgroundColor: 'rgba(120,160,255,0.22)' },
  actionCopy: { flex: 1 },
  actionTitle: { color: Colors.pureWhite, fontFamily: Font.title, fontSize: 21, lineHeight: 26 },
  actionSub: { color: 'rgba(232,237,247,0.8)', fontFamily: Font.bodyMedium, fontSize: 13 },
  history: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, paddingHorizontal: 6 },
  historyTitle: { flex: 1, color: Colors.pureWhite, fontFamily: Font.bodyBold, fontSize: 15 },
  historyLink: { color: Colors.pureWhite, fontFamily: Font.bodyBold, fontSize: 14 },

  slide: {
    height: 150, borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.navy,
    borderWidth: 1, borderColor: 'rgba(255,194,51,0.28)',
  },
  slideLogo: { position: 'absolute', right: -6, bottom: 6 },
  slideContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 14, maxWidth: '72%' },
  slideBadge: { alignSelf: 'flex-start', backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  slideBadgeText: { color: Colors.onGold, fontFamily: Font.bodyExtraBold, fontSize: 11, letterSpacing: 1.5 },
  slideTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 19, lineHeight: 22 },
  slideSubtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12, marginTop: 4 },
  slideCta: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 14, marginTop: 8 },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(141,154,192,0.35)' },
  dotActive: { width: 22, backgroundColor: Colors.gold },

  section: { paddingHorizontal: SIDE, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 20 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: Colors.blueLight, fontFamily: Font.bodyBold, fontSize: 14 },
  emptyEvents: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, paddingHorizontal: SIDE },

  eventsScroll: { paddingHorizontal: SIDE, gap: 12 },
  eventCard: { width: 150, height: 170, borderRadius: 22, overflow: 'hidden', backgroundColor: Colors.navy },
  eventIconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  eventShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  eventDate: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(6,11,30,0.7)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4,
  },
  eventDateText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 12 },
  eventTitle: { position: 'absolute', left: 12, right: 12, bottom: 12, color: Colors.pureWhite, fontFamily: Font.bodyBold, fontSize: 15 },
});
