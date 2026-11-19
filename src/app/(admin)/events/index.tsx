import { Font } from '@/constants/fonts';
import { Colors } from '@/constants/colors';
import { Categorie } from '@/data_api/models/categorie.types';
import { Evenement } from '@/data_api/models/evenement.types';
import { categorieService } from '@/data_api/services/categorieService';
import { evenementService } from '@/data_api/services/evenementService';
import { getApiErrorMessage, logError } from '@/data_api/lib/logger';
import { useFileUrl } from '@/hooks/useFileUrl';
import { formatEventDate, isEventExpired } from '@/utils/eventDate';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import {
    AlertTriangle,
    Calendar,
    Check,
    MapPin,
    Pencil,
    Plus,
    Trophy,
    ShieldCheck, Tag,
    Trash2,
    X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList, Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// ─── Composant image (respecte les règles des hooks dans une liste) ───────────
function EventCoverImage({ coverImage, style }: { coverImage?: string | null; style?: any }) {
  const uri = useFileUrl('events', coverImage);
  if (!uri) {
    return (
      <LinearGradient colors={['#0F4A50', '#0A1F26']} style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Trophy color="rgba(25,211,197,0.25)" size={90} strokeWidth={1.6} />
      </LinearGradient>
    );
  }
  return <Image source={{ uri }} style={style} />;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'events' | 'categories';

type EventFilter = 'active' | 'expired';

export default function AdminEventsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [eventFilter, setEventFilter] = useState<EventFilter>('active');
  const [events, setEvents] = useState<Evenement[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // modal état pour edit catégorie
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Categorie | null>(null); // null = création
  const [catInputValue, setCatInputValue] = useState('');
  const [catDescValue, setCatDescValue] = useState('');
  const [catInputError, setCatInputError] = useState('');
  const [savingCat, setSavingCat] = useState(false);

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
      logError('Load admin events/categories failed');
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
  const expiredEvents = events.filter((e) => isEventExpired(e.dateFin));
  const displayedEvents = eventFilter === 'expired' ? expiredEvents : activeEvents;

  // ── Events handlers ──
  const handleDeleteEvent = (trackingId: string) => {
    Alert.alert(
      "Supprimer l'événement",
      'Cette action est irréversible. Confirmer la suppression ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await evenementService.remove(trackingId);
              setEvents((prev) => prev.filter((e) => e.trackingId !== trackingId));
            } catch (err) {
              Alert.alert('Erreur', getApiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const handleEditEvent = (trackingId: string) => {
    router.push({ pathname: '/admin_events/edit', params: { id: trackingId } });
  };

  const handleCreateEvent = () => {
    router.push('/admin_events/create');
  };

  // ── Categories handlers ──
  const openCreateCat = () => {
    setEditingCat(null);
    setCatInputValue('');
    setCatDescValue('');
    setCatInputError('');
    setCatModalVisible(true);
  };

  const openEditCat = (cat: Categorie) => {
    setEditingCat(cat);
    setCatInputValue(cat.libelle);
    setCatDescValue(cat.description ?? '');
    setCatInputError('');
    setCatModalVisible(true);
  };

  const handleSaveCat = async () => {
    const trimmed = catInputValue.trim();
    if (!trimmed) { setCatInputError('Le nom est requis'); return; }
    const duplicate = categories.some(
      (c) => c.libelle.toLowerCase() === trimmed.toLowerCase() && c.trackingId !== editingCat?.trackingId
    );
    if (duplicate) { setCatInputError('Cette catégorie existe déjà'); return; }

    setSavingCat(true);
    try {
      if (editingCat) {
        const updated = await categorieService.update(editingCat.trackingId, {
          libelle: trimmed,
          description: catDescValue.trim() || undefined,
        });
        setCategories((prev) =>
          prev.map((c) => (c.trackingId === editingCat.trackingId ? updated : c))
        );
      } else {
        const created = await categorieService.create({
          libelle: trimmed,
          description: catDescValue.trim() || undefined,
        });
        setCategories((prev) => [...prev, created]);
      }
      setCatModalVisible(false);
    } catch (err) {
      setCatInputError(getApiErrorMessage(err));
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = (cat: Categorie) => {
    const usedBy = events.filter((e) => e.categorieId === cat.trackingId).length;
    Alert.alert(
      'Supprimer la catégorie',
      usedBy > 0
        ? `Cette catégorie est utilisée par ${usedBy} événement(s). Confirmer la suppression ?`
        : 'Confirmer la suppression de cette catégorie ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await categorieService.remove(cat.trackingId);
              setCategories((prev) => prev.filter((c) => c.trackingId !== cat.trackingId));
            } catch (err) {
              Alert.alert('Erreur', getApiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <LinearGradient colors={[Colors.adminSurface, Colors.adminBg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.adminBadge}>
              <ShieldCheck color={Colors.admin} size={12} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            <Text style={styles.headerTitle}>Gestion des Événements</Text>
            <Text style={styles.headerSub}>
              {activeTab === 'events'
                ? `${displayedEvents.length} événement${displayedEvents.length !== 1 ? 's' : ''} ${eventFilter === 'expired' ? 'expiré(s)' : 'actif(s)'}`
                : `${categories.length} catégories`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={activeTab === 'events' ? handleCreateEvent : openCreateCat}
          >
            <LinearGradient
              colors={[Colors.admin, Colors.adminEnd]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {/* zIndex: on the web the absolute gradient would otherwise cover the icon. */}
            <View style={{ zIndex: 1 }}>
              <Plus color={Colors.adminBg} size={24} strokeWidth={3} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.tabActive]}
            onPress={() => setActiveTab('events')}
          >
            {activeTab === 'events' && (
              <LinearGradient
                colors={[Colors.admin, Colors.adminEnd]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            )}
            <View style={{ zIndex: 1 }}><Calendar color={activeTab === 'events' ? Colors.adminBg : Colors.textSecondary} size={15} /></View>
            <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
              Événements
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
            onPress={() => setActiveTab('categories')}
          >
            {activeTab === 'categories' && (
              <LinearGradient
                colors={[Colors.admin, Colors.adminEnd]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            )}
            <View style={{ zIndex: 1 }}><Tag color={activeTab === 'categories' ? Colors.adminBg : Colors.textSecondary} size={15} /></View>
            <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
              Catégories
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Filtre actifs / expirés ── */}
        {activeTab === 'events' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.eventFilterScroll}
            contentContainerStyle={styles.eventFilterRow}
          >
            <TouchableOpacity
              style={[styles.eventFilterChip, eventFilter === 'active' && styles.eventFilterChipActive]}
              onPress={() => setEventFilter('active')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.eventFilterText, eventFilter === 'active' && styles.eventFilterTextActive]}
                numberOfLines={1}
              >
                Actifs
              </Text>
              <View style={[styles.eventFilterCount, eventFilter === 'active' && styles.eventFilterCountActive]}>
                <Text style={styles.eventFilterCountText}>{activeEvents.length}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.eventFilterChip, eventFilter === 'expired' && styles.eventFilterChipExpiredActive]}
              onPress={() => setEventFilter('expired')}
              activeOpacity={0.8}
            >
              <AlertTriangle color={eventFilter === 'expired' ? '#ff4d4d' : Colors.textSecondary} size={13} />
              <Text
                style={[styles.eventFilterText, eventFilter === 'expired' && styles.eventFilterTextExpiredActive]}
                numberOfLines={1}
              >
                Expirés
              </Text>
              <View style={[styles.eventFilterCount, eventFilter === 'expired' && styles.eventFilterCountExpiredActive]}>
                <Text style={styles.eventFilterCountText}>{expiredEvents.length}</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.admin} size="large" />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={loadData}>
            <Text style={styles.emptyBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Events list ── */}
          {activeTab === 'events' && (
            <FlatList
              data={displayedEvents}
              keyExtractor={(item) => item.trackingId}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {eventFilter === 'expired' ? 'Aucun événement expiré.' : "Aucun événement pour l'instant."}
                  </Text>
                  {eventFilter === 'active' && (
                    <TouchableOpacity style={styles.emptyBtn} onPress={handleCreateEvent}>
                      <Text style={styles.emptyBtnText}>Créer le premier événement</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              renderItem={({ item }) => {
                const expired = isEventExpired(item.dateFin);
                return (
                  <View style={[styles.card, expired && styles.cardExpired]}>
                    <EventCoverImage coverImage={item.coverImage} style={[styles.cardImage, expired && styles.cardImageExpired]} />
                    <LinearGradient
                      colors={['transparent', 'rgba(6,11,30,0.75)']}
                      style={styles.cardImageGrad}
                    />
                    <View style={styles.catBadge}>
                      <Text style={styles.catText}>{categoryLabel(item.categorieId)}</Text>
                    </View>
                    {expired && (
                      <View style={styles.expiredBadge}>
                        <AlertTriangle color="#ff4d4d" size={11} />
                        <Text style={styles.expiredBadgeText}>Expiré</Text>
                      </View>
                    )}
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.titre}</Text>
                      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                      <View style={styles.cardMeta}>
                        <View style={styles.metaItem}>
                          <Calendar color={expired ? '#ff4d4d' : Colors.admin} size={13} />
                          <Text style={styles.metaText}>{formatEventDate(item.dateDebut, item.dateFin)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <MapPin color={expired ? '#ff4d4d' : Colors.admin} size={13} />
                          <Text style={styles.metaText}>{item.lieu ?? 'Lieu non précisé'}</Text>
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => handleEditEvent(item.trackingId)}>
                          <Pencil color={Colors.admin} size={15} />
                          <Text style={styles.editBtnText}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteEvent(item.trackingId)}>
                          <Trash2 color="#ff4d4d" size={15} />
                          <Text style={styles.deleteBtnText}>Supprimer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* ── Categories list ── */}
          {activeTab === 'categories' && (
            <FlatList
              data={categories}
              keyExtractor={(item) => item.trackingId}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Aucune catégorie pour l'instant.</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={openCreateCat}>
                    <Text style={styles.emptyBtnText}>Créer la première catégorie</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => {
                const usedBy = events.filter((e) => e.categorieId === item.trackingId).length;
                return (
                  <View style={styles.catCard}>
                    <View style={styles.catCardLeft}>
                      <View style={styles.catIconCircle}>
                        <Tag color={Colors.admin} size={16} />
                      </View>
                      <View>
                        <Text style={styles.catCardName}>{item.libelle}</Text>
                        <Text style={styles.catCardCount}>
                          {usedBy} événement{usedBy !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.catCardActions}>
                      <TouchableOpacity style={styles.catEditBtn} onPress={() => openEditCat(item)}>
                        <Pencil color={Colors.admin} size={15} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.catDeleteBtn} onPress={() => handleDeleteCat(item)}>
                        <Trash2 color="#ff4d4d" size={15} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Modal catégorie ── */}
      <Modal
        visible={catModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCatModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setCatModalVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCatModalVisible(false)}
              >
                <X color={Colors.textSecondary} size={18} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nom de la catégorie</Text>
            <TextInput
              style={[styles.modalInput, catInputError && styles.modalInputError]}
              placeholder="Ex: Championnat"
              placeholderTextColor={Colors.textSecondary}
              value={catInputValue}
              onChangeText={(v) => { setCatInputValue(v); setCatInputError(''); }}
              autoFocus
            />
            {!!catInputError && (
              <Text style={styles.modalErrorText}>{catInputError}</Text>
            )}

            <Text style={styles.modalLabel}>Description (optionnel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Courte description de la catégorie"
              placeholderTextColor={Colors.textSecondary}
              value={catDescValue}
              onChangeText={setCatDescValue}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCatModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveCat} disabled={savingCat}>
                <LinearGradient
                  colors={[Colors.admin, Colors.adminEnd]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {savingCat ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <View style={{ zIndex: 1 }}><Check color={Colors.adminBg} size={16} strokeWidth={3} /></View>
                    <Text style={styles.modalSaveText}>
                      {editingCat ? 'Enregistrer' : 'Créer'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBg },

  // ── Header ──
  header: { paddingTop: 60, paddingBottom: 0, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingBottom: 16,
  },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(25,211,197,0.1)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(25,211,197,0.25)',
    alignSelf: 'flex-start', marginBottom: 6,
  },
  adminBadgeText: { fontFamily: Font.bodyExtraBold, color: Colors.admin, fontSize: 10, letterSpacing: 1 },
  headerTitle: { fontFamily: Font.title, color: Colors.white, fontSize: 22, letterSpacing: 0.4 },
  headerSub: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  createBtn: {
    width: 48, height: 48, borderRadius: 24,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row', gap: 8,
    paddingBottom: 16,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.adminCard,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  tabActive: { borderColor: 'transparent' },
  tabText: { fontFamily: Font.bodyBold, color: Colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: '#000', fontFamily: Font.bodyExtraBold },

  // ── Filtre actifs / expirés ──
  eventFilterScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 50, marginBottom: 16 },
  eventFilterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eventFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: Colors.adminCard, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  eventFilterChipActive: { backgroundColor: 'rgba(25,211,197,0.15)', borderColor: 'rgba(25,211,197,0.4)' },
  eventFilterChipExpiredActive: { backgroundColor: 'rgba(255,77,77,0.12)', borderColor: 'rgba(255,77,77,0.4)' },
  eventFilterText: { fontFamily: Font.bodyBold, color: Colors.textSecondary, fontSize: 12, flexShrink: 0 },
  eventFilterTextActive: { color: Colors.admin },
  eventFilterTextExpiredActive: { color: '#ff4d4d' },
  eventFilterCount: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  eventFilterCountActive: { backgroundColor: 'rgba(25,211,197,0.2)' },
  eventFilterCountExpiredActive: { backgroundColor: 'rgba(255,77,77,0.2)' },
  eventFilterCountText: { fontFamily: Font.bodyExtraBold, color: Colors.white, fontSize: 11 },

  // ── Loader ──
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Lists ──
  list: { padding: 20, gap: 16, paddingBottom: 40 },

  // ── Event card ──
  card: {
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: Colors.adminCard,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardExpired: { borderColor: 'rgba(255,77,77,0.3)', opacity: 0.8 },
  cardImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cardImageExpired: { opacity: 0.45 },
  cardImageGrad: { position: 'absolute', top: 80, left: 0, right: 0, height: 80 },
  catBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(25,211,197,0.2)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(25,211,197,0.3)',
  },
  catText: { fontFamily: Font.bodyBold, color: Colors.admin, fontSize: 11 },
  expiredBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,77,77,0.2)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.4)',
  },
  expiredBadgeText: { fontFamily: Font.bodyBold, color: '#ff4d4d', fontSize: 11 },
  cardContent: { padding: 14, gap: 8 },
  cardTitle: { fontFamily: Font.bodyExtraBold, color: Colors.white, fontSize: 16 },
  cardDesc: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  cardMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: Font.bodySemiBold, color: Colors.textSecondary, fontSize: 12 },
  actions: {
    flexDirection: 'row', gap: 10, marginTop: 4,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.adminBorder,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(25,211,197,0.08)',
    borderWidth: 1, borderColor: 'rgba(25,211,197,0.2)',
  },
  editBtnText: { fontFamily: Font.bodyBold, color: Colors.admin, fontSize: 13 },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.2)',
  },
  deleteBtnText: { fontFamily: Font.bodyBold, color: '#ff4d4d', fontSize: 13 },

  // ── Category card ──
  catCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.adminCard,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.adminBorder,
    padding: 14,
  },
  catCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(25,211,197,0.1)',
    borderWidth: 1, borderColor: 'rgba(25,211,197,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  catCardName: { fontFamily: Font.bodyExtraBold, color: Colors.white, fontSize: 15 },
  catCardCount: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  catCardActions: { flexDirection: 'row', gap: 8 },
  catEditBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(25,211,197,0.08)',
    borderWidth: 1, borderColor: 'rgba(25,211,197,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  catDeleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Empty ──
  empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyText: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 15, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(25,211,197,0.1)',
    borderWidth: 1, borderColor: 'rgba(25,211,197,0.25)',
  },
  emptyBtnText: { color: Colors.admin, fontFamily: Font.bodyBold },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.adminCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.adminBorder,
    padding: 24, paddingBottom: 40, gap: 14,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontFamily: Font.bodyExtraBold, color: Colors.white, fontSize: 17 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalLabel: { fontFamily: Font.bodySemiBold, color: Colors.textSecondary, fontSize: 13 },
  modalInput: { fontFamily: Font.body,
    backgroundColor: Colors.adminBg,
    borderWidth: 1, borderColor: Colors.adminBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: Colors.white, fontSize: 15,
  },
  modalInputError: { borderColor: '#ff4d4d' },
  modalErrorText: { fontFamily: Font.bodySemiBold, color: '#ff4d4d', fontSize: 12, marginTop: -8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: Colors.adminBg,
    borderWidth: 1, borderColor: Colors.adminBorder,
    alignItems: 'center',
  },
  modalCancelText: { fontFamily: Font.bodyBold, color: Colors.textSecondary, fontSize: 14 },
  modalSaveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, borderRadius: 12, overflow: 'hidden',
  },
  modalSaveText: { fontFamily: Font.bodyExtraBold, color: '#000', fontSize: 14 },
});
