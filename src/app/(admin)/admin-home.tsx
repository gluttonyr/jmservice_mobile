import { OrbitBackground } from '@/components/orbit';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { Banniere } from '@/data_api/models/banniere.types';
import { Discussion, DiscussionStatus } from '@/data_api/models/discussion.types';
import { AdminDashboardStats } from '@/data_api/models/stats.types';
import type { AdminCaptureStatus } from '@/data_api/models/transaction.types';
import { banniereService } from '@/data_api/services/banniereService';
import { discussionService } from '@/data_api/services/discussionService';
import { statsService } from '@/data_api/services/statsService';
import { transactionService } from '@/data_api/services/transactionService';
import { useFileUrl } from '@/hooks/useFileUrl';
import { usePresenceCount } from '@/hooks/usepresenceCount';
import { goToTab } from '@/utils/tabNavigation';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Bell, ChevronRight, Crown, Image as ImageIcon, Settings2, Shield } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMPTY_STATS: AdminDashboardStats = {
  usersTotal: 0,
  usersNewToday: 0,
  usersOnline: 0,
  supportTotal: 0,
  forumMessages: 0,
};

// ─── Catégorisation d'une discussion ──────────────────────────────────────────

type DiscussionCategory = 'deposit' | 'withdrawal' | 'support';

const CATEGORY_CONFIG: Record<DiscussionCategory, { label: string; color: string; bg: string }> = {
  deposit: { label: 'Dépôt', color: Colors.gold, bg: 'rgba(255,194,51,0.16)' },
  withdrawal: { label: 'Retrait', color: '#FF9F6B', bg: 'rgba(255,140,80,0.16)' },
  support: { label: 'Support', color: '#6FA8FF', bg: 'rgba(47,123,255,0.16)' },
};

function getDiscussionCategory(discussion: Discussion): DiscussionCategory {
  if (discussion.statut === DiscussionStatus.DEPOT) return 'deposit';
  if (discussion.statut === DiscussionStatus.RETRAIT) return 'withdrawal';
  return 'support';
}

// Format type WhatsApp, identique à (admin)/chats/index.tsx
function formatActivityTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `${diffHours} h`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatSignal(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? `aujourd'hui ${time}`
    : `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${time}`;
}

// Same wording as the capture panel of admin_transactions (server state only).
function captureTitle(status: AdminCaptureStatus | null): string {
  if (!status) return 'État de la capture inconnu';
  if (status.depositsClosed) return 'Dépôts fermés par l’administrateur';
  if (status.available) {
    return status.manualOverride && !status.deviceAvailable
      ? 'Dépôts ouverts manuellement'
      : 'Capture automatique active';
  }
  if (status.reason === 'notification_access_required') return 'Autorisation de capture à rétablir';
  if (status.reason === 'capture_not_configured') return 'Configuration de capture incomplète';
  return 'Téléphone de capture silencieux';
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

// ─── Ouverture de la caisse : interrupteurs Dépôts / Retraits ─────────────────

type CashDeskKind = 'deposits' | 'withdrawals';

/**
 * The admin opens or closes deposits and withdrawals for every client (parametres DEPOTS_FERMES /
 * RETRAITS_FERMES). The switch wins over the capture phone: deposits stay closed even when it sends its signal.
 */
function CashDeskSwitches({ status, onChange }: { status: AdminCaptureStatus | null; onChange: (s: AdminCaptureStatus) => void }) {
  const [saving, setSaving] = useState<CashDeskKind | null>(null);
  // Servers older than these switches do not send the state: nothing is shown rather than a wrong state.
  const known = !!status && typeof status.depositsClosed === 'boolean' && typeof status.withdrawalsClosed === 'boolean';

  const toggle = (kind: CashDeskKind, open: boolean) => {
    const label = kind === 'deposits' ? 'les dépôts' : 'les retraits';
    const apply = async () => {
      setSaving(kind);
      try {
        const next = kind === 'deposits'
          ? await transactionService.setDepositsClosed(!open)
          : await transactionService.setWithdrawalsClosed(!open);
        onChange(next);
      } catch {
        Alert.alert('Erreur', `Impossible de modifier l’ouverture de ${label}. Réessayez.`);
      } finally {
        setSaving(null);
      }
    };
    Alert.alert(
      open ? `Ouvrir ${label} ?` : `Fermer ${label} ?`,
      open
        ? `Les clients pourront de nouveau faire ${kind === 'deposits' ? 'des dépôts (si la capture des paiements est active)' : 'des retraits'}.`
        : `Plus aucun client ne pourra faire ${kind === 'deposits' ? 'de dépôt' : 'de retrait'} tant que vous ne les rouvrez pas, même si le téléphone de capture envoie son signal.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: open ? 'Ouvrir' : 'Fermer', style: open ? 'default' : 'destructive', onPress: () => { void apply(); } },
      ],
    );
  };

  if (!known) return null;
  const rows: { kind: CashDeskKind; title: string; open: boolean }[] = [
    { kind: 'deposits', title: 'Dépôts', open: !status!.depositsClosed },
    { kind: 'withdrawals', title: 'Retraits', open: !status!.withdrawalsClosed },
  ];
  return (
    <View style={styles.cashDeskCard}>
      <Text style={styles.cashDeskTitle}>Ouverture de la caisse</Text>
      {rows.map((row, index) => (
        <View key={row.kind} style={[styles.cashDeskRow, index > 0 && styles.cashDeskRowBorder]}>
          <View style={[styles.cashDeskDot, { backgroundColor: row.open ? Colors.success : Colors.error }]} />
          <View style={styles.cashDeskCopy}>
            <Text style={styles.cashDeskLabel}>{row.title}</Text>
            <Text style={[styles.cashDeskState, { color: row.open ? Colors.success : Colors.error }]}>
              {row.open ? 'Ouverts aux clients' : 'Fermés pour tous les clients'}
            </Text>
          </View>
          {saving === row.kind ? (
            <ActivityIndicator color={Colors.admin} />
          ) : (
            <Switch
              value={row.open}
              onValueChange={(value) => toggle(row.kind, value)}
              disabled={saving !== null}
              trackColor={{ false: 'rgba(255,107,107,0.45)', true: 'rgba(25,211,197,0.55)' }}
              thumbColor={row.open ? Colors.admin : '#E8EDF7'}
              accessibilityLabel={`${row.title} ${row.open ? 'ouverts' : 'fermés'}`}
            />
          )}
        </View>
      ))}
      <Text style={styles.cashDeskHint}>
        Prioritaire sur la capture : des dépôts fermés ici restent fermés même si le téléphone de capture envoie son signal.
      </Text>
    </View>
  );
}

// ─── Composant image (respecte les règles des hooks dans une liste) ───────────

function BannerPreviewImage({ image, style }: { image?: string | null; style?: any }) {
  const uri = useFileUrl('banners', image);
  if (!uri) return <View style={[style, { backgroundColor: Colors.adminCard }]} />;
  return <Image source={{ uri }} style={style} />;
}

/** Green (or red) dot with two rings, pulsing while the capture is active. */
function CaptureRadar({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  const color = active ? Colors.success : '#FF6B6B';
  return (
    <View style={styles.radar}>
      <View style={[styles.radarRing, { width: 76, height: 76, borderRadius: 38, borderColor: `${color}33` }]} />
      <Animated.View
        style={[
          styles.radarRing,
          {
            width: 50, height: 50, borderRadius: 25, borderColor: `${color}66`,
            opacity: active ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1,
            transform: [{ scale: active ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) : 1 }],
          },
        ]}
      />
      <View style={[styles.radarDot, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const [banners, setBanners] = useState<Banniere[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [unreadDiscussions, setUnreadDiscussions] = useState<Discussion[]>([]);
  const [captureStatus, setCaptureStatus] = useState<AdminCaptureStatus | null>(null);
  const [counts, setCounts] = useState({ claims: 0, captureReconciliation: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const onlineCount = usePresenceCount();

  useEffect(() => {
    banniereService.getAll().then(setBanners).catch(() => { });
  }, []);

  useEffect(() => {
    statsService.getAdminDashboardStats().then(setStats).catch(() => { });
  }, []);

  // Rechargé à chaque retour sur cet écran : après avoir ouvert une discussion,
  // ses messages sont marqués lus (voir MessageGateway.handleJoin), donc la
  // liste "non lues" doit refléter ça au retour.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      discussionService.getUnreadForAdmin().then(setUnreadDiscussions).catch(() => { });
      // Claims and deposits to reconcile: the counters of the admin transaction list.
      transactionService.getAllForAdmin({ page: 1, limit: 1 })
        .then((page) => { if (active && page.counts) setCounts(page.counts); })
        .catch(() => { });
      const refreshCapture = () => transactionService.getCaptureStatus()
        .then((status) => { if (active) setCaptureStatus(status); })
        .catch(() => { if (active) setCaptureStatus(null); });
      void refreshCapture();
      const timer = setInterval(() => { void refreshCapture(); }, 15_000);
      return () => { active = false; clearInterval(timer); };
    }, [])
  );

  const openDiscussion = (discussion: Discussion) => {
    const category = getDiscussionCategory(discussion);
    goToTab('chats');
    router.push({
      pathname: '/admin_chats/[id]',
      params: {
        id: discussion.trackingId,
        name: discussion.username || discussion.titre,
        category,
      },
    });
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const captureActive = !!captureStatus?.available;
  const openTransactions = () => router.push('/admin_transactions' as any);

  return (
    <OrbitBackground variant="admin" orbits={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }}>

        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.adminAvatarWrap}>
            <LinearGradient colors={[Colors.admin, Colors.adminEnd]} style={styles.adminAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Crown color={Colors.adminBg} size={26} strokeWidth={2.4} />
            </LinearGradient>
            <View style={styles.adminOnlineDot} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerGreet}>{greeting},</Text>
            <Text style={styles.headerName} numberOfLines={1}>ADMINISTRATEUR</Text>
          </View>
          <View style={styles.adminBadge}>
            <Shield color={Colors.admin} size={12} />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </Animated.View>

        {/* ── Capture automatique ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.captureCard, !captureActive && styles.captureCardOff]}
            onPress={openTransactions}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <CaptureRadar active={captureActive} />
            <View style={styles.captureCopy}>
              <Text style={styles.captureTitle}>{captureTitle(captureStatus)}</Text>
              <Text style={styles.captureSignal}>
                {captureStatus?.lastHeartbeatAt
                  ? `Dernier signal : ${formatSignal(captureStatus.lastHeartbeatAt)}`
                  : captureActive ? 'Aucun signal reçu' : 'Dépôts bloqués par sécurité'}
              </Text>
              <Text style={styles.captureLink}>Transactions et capture ›</Text>
            </View>
          </TouchableOpacity>

          <CashDeskSwitches status={captureStatus} onChange={setCaptureStatus} />

          <View style={styles.countersRow}>
            <TouchableOpacity style={[styles.counter, styles.counterClaims]} onPress={openTransactions} activeOpacity={0.85}>
              <Text style={[styles.counterNum, { color: '#FF8FCB' }]}>{counts.claims}</Text>
              <Text style={styles.counterLabel}>{counts.claims > 1 ? 'réclamations à traiter' : 'réclamation à traiter'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.counter, styles.counterReconcile]} onPress={openTransactions} activeOpacity={0.85}>
              <Text style={[styles.counterNum, { color: Colors.gold }]}>{counts.captureReconciliation}</Text>
              <Text style={styles.counterLabel}>{counts.captureReconciliation > 1 ? 'dépôts à rapprocher' : 'dépôt à rapprocher'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Utilisateurs ── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.usersCard}>
            <View style={styles.usersTop}>
              <View>
                <Text style={styles.usersLabel}>Utilisateurs inscrits</Text>
                <Text style={styles.usersTotal}>{stats.usersTotal.toLocaleString('fr-FR')}</Text>
              </View>
              <View style={styles.usersLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.gold }]} />
                  <Text style={styles.legendText}>{onlineCount} en ligne</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.blue }]} />
                  <Text style={styles.legendText}>{stats.usersNewToday} nouveaux</Text>
                </View>
              </View>
            </View>
            <View style={styles.chipsRow}>
              {[
                { value: onlineCount, label: 'actifs' },
                { value: stats.usersNewToday, label: "aujourd'hui" },
                { value: stats.forumMessages, label: 'msg forum' },
              ].map((chip) => (
                <View key={chip.label} style={styles.chip}>
                  <Text style={styles.chipNum}>{chip.value}</Text>
                  <Text style={styles.chipLabel}>{chip.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── Activité récente ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACTIVITÉ RÉCENTE</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          {unreadDiscussions.length === 0 ? (
            <Text style={styles.activityEmptyText}>Aucun message non lu pour l'instant.</Text>
          ) : (
            unreadDiscussions.slice(0, 5).map((discussion) => {
              const conf = CATEGORY_CONFIG[getDiscussionCategory(discussion)];
              const name = discussion.username || discussion.titre;
              return (
                <TouchableOpacity key={discussion.trackingId} style={styles.activityRow} onPress={() => openDiscussion(discussion)} activeOpacity={0.75}>
                  <View style={[styles.activityAvatar, { backgroundColor: conf.bg }]}>
                    <Text style={[styles.activityAvatarText, { color: conf.color }]}>{initials(name)}</Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{name} · {conf.label}</Text>
                    <Text style={styles.activityBody} numberOfLines={1}>{discussion.lastMessageContent ?? 'Nouveau message'}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={styles.activityTime}>{formatActivityTime(discussion.lastMessageAt)}</Text>
                    {!!discussion.unreadCount && (
                      <View style={styles.activityUnreadBadge}>
                        <Text style={styles.activityUnreadBadgeText}>{discussion.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Bannières (aperçu slides home) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <ImageIcon color={Colors.admin} size={18} />
              <Text style={styles.sectionTitle}>BANNIÈRES</Text>
            </View>
            <TouchableOpacity style={styles.configureBtn} onPress={() => router.push('/config/slide-editor' as any)} activeOpacity={0.8}>
              <Settings2 color={Colors.admin} size={14} />
              <Text style={styles.configureBtnText}>Configurer</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slidesPreviewScroll}>
            {banners.map((slide, i) => (
              <TouchableOpacity
                key={slide.trackingId}
                style={styles.slidePreviewCard}
                onPress={() => router.push({ pathname: '/config/slide-editor' as any, params: { focusId: slide.trackingId } })}
                activeOpacity={0.85}
              >
                <BannerPreviewImage image={slide.image} style={styles.slidePreviewImage} />
                <LinearGradient colors={['transparent', 'rgba(6,20,26,0.92)']} style={styles.slidePreviewGrad}>
                  <Text style={styles.slidePreviewIndex}>{i + 1}</Text>
                  <Text style={styles.slidePreviewTitle} numberOfLines={1}>{slide.titre}</Text>
                </LinearGradient>
                <View style={styles.slidePreviewEditDot}>
                  <Settings2 color="#fff" size={11} />
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.slideAddCard}
              onPress={() => router.push({ pathname: '/config/slide-editor' as any, params: { addNew: 'true' } })}
              activeOpacity={0.8}
            >
              <Text style={styles.slideAddPlus}>+</Text>
              <Text style={styles.slideAddLabel}>Ajouter</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── Notifications push ── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.pushCard} onPress={() => router.push('/admin_notifications' as any)} activeOpacity={0.8}>
            <View style={styles.pushIcon}>
              <Bell color={Colors.admin} size={20} />
            </View>
            <View style={styles.pushCopy}>
              <Text style={styles.pushTitle}>Notifications push</Text>
              <Text style={styles.pushSubtitle}>Envoyer un message à tous les utilisateurs</Text>
            </View>
            <ChevronRight color={Colors.admin} size={20} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </OrbitBackground>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const card = {
  backgroundColor: 'rgba(14,34,41,0.92)',
  borderRadius: 28,
  borderWidth: 1,
  borderColor: Colors.adminBorder,
} as const;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 6 },
  adminAvatarWrap: { position: 'relative' },
  adminAvatar: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  adminOnlineDot: {
    position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.success, borderWidth: 3, borderColor: Colors.adminBg,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerGreet: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15 },
  headerName: { color: Colors.chrome, fontFamily: Font.title, fontSize: 19, lineHeight: 26 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 12, backgroundColor: 'rgba(25,211,197,0.14)',
  },
  adminBadgeText: { color: Colors.admin, fontFamily: Font.bodyExtraBold, fontSize: 11, letterSpacing: 1.5 },

  section: { paddingHorizontal: 20, marginTop: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 20 },

  // Capture
  captureCard: { ...card, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderColor: 'rgba(25,211,197,0.35)' },
  captureCardOff: { borderColor: 'rgba(255,107,107,0.4)' },
  radar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  radarRing: { position: 'absolute', borderWidth: 1.5 },
  radarDot: { width: 22, height: 22, borderRadius: 11 },
  captureCopy: { flex: 1, minWidth: 0, gap: 3 },
  captureTitle: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 17 },
  captureSignal: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13 },
  captureLink: { color: Colors.admin, fontFamily: Font.bodyBold, fontSize: 14, marginTop: 2 },

  cashDeskCard: { ...card, marginTop: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  cashDeskTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 18, marginBottom: 6 },
  cashDeskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  cashDeskRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(25,211,197,0.14)' },
  cashDeskDot: { width: 10, height: 10, borderRadius: 5 },
  cashDeskCopy: { flex: 1, minWidth: 0 },
  cashDeskLabel: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16 },
  cashDeskState: { fontFamily: Font.bodySemiBold, fontSize: 13, marginTop: 1 },
  cashDeskHint: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12, lineHeight: 17, marginTop: 4 },

  countersRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  counter: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  counterClaims: { backgroundColor: 'rgba(255,110,190,0.08)', borderColor: 'rgba(255,110,190,0.3)' },
  counterReconcile: { backgroundColor: 'rgba(255,194,51,0.08)', borderColor: 'rgba(255,194,51,0.35)' },
  counterNum: { fontFamily: Font.title, fontSize: 30, lineHeight: 36 },
  counterLabel: { color: Colors.chrome, fontFamily: Font.body, fontSize: 14 },

  // Users
  usersCard: { ...card, padding: 18, gap: 14 },
  usersTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  usersLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 14 },
  usersTotal: { color: Colors.pureWhite, fontFamily: Font.title, fontSize: 44, lineHeight: 52 },
  usersLegend: { gap: 8, alignItems: 'flex-end', paddingTop: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: Colors.chrome, fontFamily: Font.bodyMedium, fontSize: 15 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(23,48,56,0.8)', borderRadius: 18, paddingVertical: 10 },
  chipNum: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 17 },
  chipLabel: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12 },

  // Activity
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF5A5F' },
  liveText: { color: '#FF8A8A', fontFamily: Font.bodyBold, fontSize: 14 },
  activityRow: { ...card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 24, marginBottom: 8 },
  activityAvatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activityAvatarText: { fontFamily: Font.bodyExtraBold, fontSize: 17 },
  activityContent: { flex: 1, minWidth: 0 },
  activityTitle: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 15 },
  activityBody: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, marginTop: 1 },
  activityRight: { alignItems: 'flex-end', gap: 5 },
  activityTime: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 11 },
  activityEmptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, paddingVertical: 14, textAlign: 'center' },
  activityUnreadBadge: {
    minWidth: 26, height: 26, borderRadius: 13, backgroundColor: Colors.admin,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  activityUnreadBadgeText: { color: Colors.adminBg, fontFamily: Font.bodyExtraBold, fontSize: 13 },

  // Banners
  configureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(25,211,197,0.1)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(25,211,197,0.3)',
  },
  configureBtnText: { color: Colors.admin, fontFamily: Font.bodyBold, fontSize: 13 },
  slidesPreviewScroll: { gap: 10, paddingRight: 4 },
  slidePreviewCard: { width: 150, height: 100, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: Colors.adminBorder },
  slidePreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  slidePreviewGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%', justifyContent: 'flex-end', padding: 10, gap: 2 },
  slidePreviewIndex: { color: 'rgba(255,255,255,0.5)', fontFamily: Font.bodyBold, fontSize: 10 },
  slidePreviewTitle: { color: '#fff', fontFamily: Font.bodyBold, fontSize: 12 },
  slidePreviewEditDot: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  slideAddCard: {
    width: 80, height: 100, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(25,211,197,0.35)',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25,211,197,0.05)',
  },
  slideAddPlus: { color: Colors.admin, fontFamily: Font.body, fontSize: 26, lineHeight: 30 },
  slideAddLabel: { color: Colors.admin, fontFamily: Font.bodyBold, fontSize: 12 },

  // Push notifications
  pushCard: { ...card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24 },
  pushIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(25,211,197,0.12)' },
  pushCopy: { flex: 1, gap: 2 },
  pushTitle: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 15 },
  pushSubtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13 },
});
