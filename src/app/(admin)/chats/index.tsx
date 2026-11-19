import { UserAvatar } from '@/components/UserAvatar';
import { ConnectionErrorState } from '@/components/ui/ConnectionErrorState';
import { Font } from '@/constants/fonts';
import { Colors } from '@/constants/colors';
import { AdminDiscussionCategory, Discussion, DiscussionStatus, DiscussionType } from '@/data_api/models/discussion.types';
import { getApiErrorMessage } from '@/data_api/lib/logger';
import { discussionService } from '@/data_api/services/discussionService';
import { socketService } from '@/data_api/services/socketService';
import { useAuth } from '@/hooks/useAuth';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  HeadphonesIcon,
  MailWarning,
  Mail,
  MessageCircle,
  Search,
  Shield,
  Phone,
  UserRound,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

// Le tri ne se base plus uniquement sur "type" : depot/retrait/support
// se basent maintenant sur le statut de la discussion.
type CategoryFilter = 'all' | 'unread' | 'depot' | 'retrait' | 'support';
const DISCUSSION_PAGE_SIZE = 25;

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES: {
  key: CategoryFilter;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}[] = [
    {
      key: 'all',
      label: 'Tous',
      icon: <Shield color="#fff" size={14} />,
      color: Colors.admin,
      bg: 'rgba(25,211,197,0.15)',
    },
    {
      key: 'unread',
      label: 'Non lu',
      icon: <MailWarning color="#fff" size={14} />,
      color: '#F87171',
      bg: 'rgba(248,113,113,0.12)',
    },
    {
      key: 'depot',
      label: 'Dépôt',
      icon: <ArrowDownToLine color="#fff" size={14} />,
      color: Colors.admin,
      bg: 'rgba(25,211,197,0.12)',
    },
    {
      key: 'retrait',
      label: 'Retrait',
      icon: <ArrowUpFromLine color="#fff" size={14} />,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
    },
    {
      key: 'support',
      label: 'Support',
      icon: <HeadphonesIcon color="#fff" size={14} />,
      color: '#38BDF8',
      bg: 'rgba(56,189,248,0.12)',
    },
  ];

const TYPE_CONFIG: Record<
  DiscussionType,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  [DiscussionType.DEPOT_RETRAIT]: {
    icon: <ArrowDownToLine color={Colors.admin} size={18} />,
    color: Colors.admin,
    bg: 'rgba(25,211,197,0.1)',
  },
  [DiscussionType.SUPPORT]: {
    icon: <HeadphonesIcon color="#38BDF8" size={18} />,
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.1)',
  },
  [DiscussionType.FORUM]: {
    icon: <MessageCircle color="#CE93D8" size={18} />,
    color: '#CE93D8',
    bg: 'rgba(206,147,216,0.1)',
  },
};

// DiscussionStatus → label lisible
const STATUS_CONFIG: Record<
  DiscussionStatus,
  { label: string; color: string; bg: string }
> = {
  [DiscussionStatus.DEPOT]: {
    label: 'Dépôt',
    color: Colors.admin,
    bg: 'rgba(25,211,197,0.12)',
  },
  [DiscussionStatus.RETRAIT]: {
    label: 'Retrait',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
  },
  [DiscussionStatus.AUTRE]: {
    label: 'Autre',
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.12)',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ⚠️ Ajuste ce champ si le nom exact dans ton modèle Discussion est différent
// (ex: isRead, hasUnread, nbNonLu, etc.)
function getUnreadCount(d: Discussion): number {
  return (d as any).unreadCount ?? 0;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Format type WhatsApp :
// - < 1 min      -> "à l'instant"
// - < 1h         -> "X minute(s)"
// - même jour    -> "X heure(s)"
// - < 7 jours    -> nom du jour (Lundi, Mardi, ...)
// - >= 7 jours   -> date complète JJ/MM/AAAA
function formatTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''}`;

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return `${diffHours} heure${diffHours > 1 ? 's' : ''}`;

    if (diffDays < 7) {
      return capitalize(date.toLocaleDateString('fr-FR', { weekday: 'long' }));
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminChatsScreen() {
  const navigationInProgressRef = useRef(false);
  const { token } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profileDiscussion, setProfileDiscussion] = useState<Discussion | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<CategoryFilter, number>>({
    all: 0, unread: 0, depot: 0, retrait: 0, support: 0,
  });
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const profileRequestIdRef = useRef(0);
  const hasLoadedDataRef = useRef(false);
  const listRef = useRef<FlatList<Discussion>>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchDiscussions = useCallback(async (requestedPage = 1, append = false, background = false) => {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true);
    else if (!background) setLoading(true);
    if (!append) setError('');
    try {
      const response = await discussionService.getAll({
        page: requestedPage,
        limit: DISCUSSION_PAGE_SIZE,
        search: debouncedSearch,
        category: activeCategory as AdminDiscussionCategory,
      });
      if (requestId !== requestIdRef.current) return;
      hasLoadedDataRef.current = true;
      setDiscussions((current) => {
        if (!append) return response.items;
        const byId = new Map(current.map((item) => [item.trackingId, item]));
        response.items.forEach((item) => byId.set(item.trackingId, item));
        return [...byId.values()].sort((a, b) =>
          new Date(b.lastMessageAt ?? b.updatedAt).getTime() - new Date(a.lastMessageAt ?? a.updatedAt).getTime(),
        );
      });
      setPage((current) => append ? Math.max(current, requestedPage) : requestedPage);
      setHasMore(response.hasMore);
      setCategoryCounts(response.counts);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to fetch discussions:', err);
      if ((!append && !background) || !hasLoadedDataRef.current) setError(getApiErrorMessage(err));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeCategory, debouncedSearch]);

  // Recharge la liste (et donc le dernier message) à chaque retour sur cet écran.
  useFocusEffect(
    useCallback(() => {
      navigationInProgressRef.current = false;
      void fetchDiscussions(1, false);
      if (!token) return;
      socketService.connect(token);
      const socket = socketService.getSocket();
      if (!socket) return;
      const handleDiscussionUpdated = () => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        void fetchDiscussions(1, false, true);
      };
      socket.on('discussionUpdated', handleDiscussionUpdated);
      return () => { socket.off('discussionUpdated', handleDiscussionUpdated); };
    }, [fetchDiscussions, token])
  );

  const getCategoryCount = (cat: CategoryFilter) => categoryCounts[cat];

  // Discussions en attente de traitement (dépôt ou retrait non résolu)
  const pendingCount = categoryCounts.depot + categoryCounts.retrait;

  const openProfile = async (discussion: Discussion) => {
    const requestId = ++profileRequestIdRef.current;
    setProfileDiscussion(discussion);
    setProfileLoading(true);
    try {
      const userProfile = await discussionService.getAdminUserProfile(discussion.trackingId);
      if (requestId === profileRequestIdRef.current) {
        setProfileDiscussion((current) => current?.trackingId === discussion.trackingId
          ? { ...current, userProfile }
          : current);
      }
    } catch {
      if (requestId === profileRequestIdRef.current) setProfileDiscussion(null);
    } finally {
      if (requestId === profileRequestIdRef.current) setProfileLoading(false);
    }
  };

  const navigateToChat = (discussion: Discussion) => {
    if (navigationInProgressRef.current) return;
    navigationInProgressRef.current = true;
    // Il n'existe qu'un seul écran de détail admin (admin_chats/[id]) : il n'y a pas
    // de page dédiée "admin_chats/deposit-withdrawal" (cette route n'existait pas,
    // ce qui faisait planter/tourner indéfiniment le chargement pour les discussions
    // de type Dépôt/Retrait). On y dérive plutôt une "catégorie" d'affichage à partir
    // du statut de la discussion, comme admin_chats/[id] l'attend.
    const category =
      discussion.statut === DiscussionStatus.DEPOT ? 'deposit' :
      discussion.statut === DiscussionStatus.RETRAIT ? 'withdrawal' :
      'support';

    router.push({
      pathname: '/admin_chats/[id]',
      params: { id: discussion.trackingId, name: discussion.username || discussion.titre, category },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.adminBadge}>
              <Shield color={Colors.admin} size={12} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            <Text style={styles.headerTitle}>Messagerie</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.alertBanner}>
              <AlertCircle color="#F59E0B" size={16} />
              <Text style={styles.alertText}>{pendingCount} dépôts/retraits</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {CATEGORIES.slice(1).map((cat) => (
            <View key={cat.key} style={[styles.statCard, { borderColor: cat.color + '30' }]}>
              <Text style={[styles.statNum, { color: cat.color }]}>
                {getCategoryCount(cat.key)}
              </Text>
              <Text style={styles.statLabel}>{cat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchContainer}>
        <Search color={Colors.textSecondary} size={16} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une conversation..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* ── Category tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.tab,
                isActive && { backgroundColor: cat.bg, borderColor: cat.color + '50' },
              ]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabText, isActive && { color: cat.color }]}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
              <View
                style={[
                  styles.tabCount,
                  isActive && { backgroundColor: cat.color + '20' },
                ]}
              >
                <Text style={[styles.tabCountText, isActive && { color: cat.color }]}>
                  {getCategoryCount(cat.key)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.admin} size="large" />
        </View>
      ) : error ? (
        <ConnectionErrorState message={error} onRetry={fetchDiscussions} fullscreen />
      ) : (
        <FlatList
          ref={listRef}
          data={discussions}
          keyExtractor={(item) => item.trackingId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={() => {
            if (hasMore && !loading && !loadingMore) void fetchDiscussions(page + 1, true);
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.admin} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucune conversation trouvée</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const typeConf = TYPE_CONFIG[item.type];
            const statusConf = STATUS_CONFIG[item.statut];
            const unreadCount = getUnreadCount(item);

            // Initiales depuis le titre
            const initials = item.username
              ? item.username
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : '';

            return (
              <View style={styles.convItem}>
                <TouchableOpacity
                  style={styles.avatarWrapper}
                  onPress={() => void openProfile(item)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Afficher le profil de ${item.username ?? 'cet utilisateur'}`}
                >
                  <UserAvatar
                    image={item.userProfile?.image}
                    size={52}
                    fallback={
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: typeConf.bg,
                            borderColor: typeConf.color + '40',
                          },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: typeConf.color }]}>
                          {initials}
                        </Text>
                      </View>
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.convMain}
                  onPress={() => navigateToChat(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.convContent}>
                  <View style={styles.convTopRow}>
  <Text style={styles.convName} numberOfLines={1}>
    {item.username ?? 'Utilisateur inconnu'}
  </Text>

  <Text style={styles.convTime}>
    {formatTime(item.lastMessageAt)}
  </Text>
</View>

<View style={styles.lastMessageRow}>
  <Text style={styles.convLastMsg} numberOfLines={1}>
    {item.lastMessageContent ?? 'Aucun message'}
  </Text>

  {unreadCount > 0 && (
    <View style={styles.unreadBadge}>
      <Text style={styles.unreadBadgeText}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  )}
</View>

                  <View style={styles.convBottomRow}>
                    {/* {statusConf && (
                      <View
                        style={[styles.statusPill, { backgroundColor: statusConf.bg }]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusConf.color },
                          ]}
                        />
                        <Text
                          style={[styles.statusLabel, { color: statusConf.color }]}
                        >
                          {statusConf.label}
                        </Text>
                      </View>
                    )} */}
                  </View>
                  </View>

                  <ChevronRight
                    color={Colors.textSecondary}
                    size={16}
                    style={{ opacity: 0.5 }}
                  />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={profileDiscussion !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { profileRequestIdRef.current += 1; setProfileLoading(false); setProfileDiscussion(null); }}
      >
        <View style={styles.profileOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { profileRequestIdRef.current += 1; setProfileLoading(false); setProfileDiscussion(null); }} />
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <UserAvatar
                image={profileDiscussion?.userProfile?.image}
                size={50}
                fallback={
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {(profileDiscussion?.userProfile
                        ? `${profileDiscussion.userProfile.nom?.[0] ?? ''}${profileDiscussion.userProfile.prenom?.[0] ?? ''}`
                        : profileDiscussion?.username?.slice(0, 2) ?? '??').toUpperCase()}
                    </Text>
                  </View>
                }
              />
              <View style={styles.profileHeadingText}>
                <Text style={styles.profileName}>
                  {profileDiscussion?.userProfile
                    ? `${profileDiscussion.userProfile.nom} ${profileDiscussion.userProfile.prenom}`.trim()
                    : profileDiscussion?.username ?? 'Profil utilisateur'}
                </Text>
                <Text style={styles.profileSubtitle}>Profil utilisateur</Text>
              </View>
              <TouchableOpacity
                onPress={() => { profileRequestIdRef.current += 1; setProfileLoading(false); setProfileDiscussion(null); }}
                style={styles.profileClose}
                accessibilityLabel="Fermer le profil"
              >
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            {profileLoading ? (
              <ActivityIndicator color={Colors.admin} />
            ) : profileDiscussion?.userProfile ? (
              <View style={styles.profileDetails}>
                <ProfileDetail icon={<UserRound color={Colors.admin} size={16} />} label="Nom d’utilisateur" value={`@${profileDiscussion.userProfile.username}`} />
                <ProfileDetail icon={<Mail color={Colors.admin} size={16} />} label="Adresse e-mail" value={profileDiscussion.userProfile.email} />
                <ProfileDetail icon={<Phone color={Colors.admin} size={16} />} label="Téléphone" value={profileDiscussion.userProfile.telephone || 'Non renseigné'} />
                <View style={styles.profileDetailRow}>
                  <View style={styles.profileDetailIcon}><Shield color={Colors.admin} size={16} /></View>
                  <View style={styles.profileDetailText}>
                    <Text style={styles.profileDetailLabel}>État du compte</Text>
                    <Text style={[styles.profileDetailValue, { color: profileDiscussion.userProfile.active ? Colors.admin : '#F87171' }]}>
                      {profileDiscussion.userProfile.active ? 'Actif' : 'Désactivé'}
                    </Text>
                  </View>
                </View>
                <View style={styles.profileDetailRow}>
                  <View style={styles.profileDetailIcon}><AlertCircle color={Colors.admin} size={16} /></View>
                  <View style={styles.profileDetailText}>
                    <Text style={styles.profileDetailLabel}>Membre depuis</Text>
                    <Text style={styles.profileDetailValue}>
                      {profileDiscussion.userProfile.createdAt
                        ? new Date(profileDiscussion.userProfile.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Date inconnue'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.profileUnavailable}>Les détails du profil ne sont pas disponibles.</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProfileDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.profileDetailRow}>
      <View style={styles.profileDetailIcon}>{icon}</View>
      <View style={styles.profileDetailText}>
        <Text style={styles.profileDetailLabel}>{label}</Text>
        <Text style={styles.profileDetailValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBg },

  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.adminSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.adminBorder,
    gap: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  adminBadgeText: { fontFamily: Font.bodyExtraBold,
    color: Colors.admin,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  headerTitle: { fontFamily: Font.title,
    color: Colors.white,
    fontSize: 26,
    letterSpacing: 0.3,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  alertText: { fontFamily: Font.bodyBold, color: '#F59E0B', fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.adminCard,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  statNum: { fontFamily: Font.bodyExtraBold, fontSize: 20 },
  statLabel: { fontFamily: Font.bodySemiBold,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.adminCard,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.adminBorder,
  },
  searchInput: { fontFamily: Font.body,
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    paddingVertical: 11,
  },

  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 70,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.adminBorder,
    backgroundColor: Colors.adminCard,
  },
  tabText: { fontFamily: Font.bodyBold,
    color: Colors.textSecondary,
    fontSize: 11,
    flexShrink: 0,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: { fontFamily: Font.bodyExtraBold, color: Colors.textSecondary, fontSize: 10 },

  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 30 },
  separator: { height: 1, backgroundColor: Colors.adminBorder, marginLeft: 88 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 14 },

  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  convMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrapper: { position: 'relative', width: 52, height: 52 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: Font.bodyExtraBold, fontSize: 16, letterSpacing: 0.5 },

  convContent: { flex: 1, gap: 3 },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  convName: { fontFamily: Font.bodyBold, color: Colors.white, fontSize: 14, flex: 1, marginRight: 8 },

  // Colonne heure + badge non-lu (aligné à droite, comme WhatsApp)
  convTimeCol: {
    alignItems: 'flex-end',
    gap: 5,
    minWidth: 20,
  },
  convTime: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 11 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.admin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { fontFamily: Font.bodyExtraBold,
    color: '#0B1E00',
    fontSize: 11,
  },



  convBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusLabel: { fontFamily: Font.bodyBold, fontSize: 10 },
  lastMessageRow: {
  flexDirection: 'row',
  alignItems: 'center',
  minWidth: 0,
  gap: 8,
},

convLastMsg: { fontFamily: Font.body,
  flex: 1,
  minWidth: 0,
  color: Colors.textSecondary,
  fontSize: 12.5,
},

  profileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  profileCard: {
    backgroundColor: Colors.adminSurface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.adminBorder,
    padding: 20,
    gap: 20,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(25,211,197,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(25,211,197,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontFamily: Font.bodyExtraBold, color: Colors.admin, fontSize: 17 },
  profileHeadingText: { flex: 1, gap: 3 },
  profileName: { fontFamily: Font.bodyExtraBold, color: Colors.white, fontSize: 16 },
  profileSubtitle: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 11 },
  profileClose: { padding: 5 },
  profileDetails: { gap: 14 },
  profileDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  profileDetailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(25,211,197,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetailText: { flex: 1, gap: 2 },
  profileDetailLabel: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 10 },
  profileDetailValue: { fontFamily: Font.bodySemiBold, color: Colors.white, fontSize: 13 },
  profileUnavailable: { fontFamily: Font.body,
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
