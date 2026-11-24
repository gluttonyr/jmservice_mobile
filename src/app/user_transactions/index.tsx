import { useWideWeb } from '@/hooks/useWideWeb';
import { webSidebarStyles } from '@/components/webSidebarStyles';
import { FlowHeader, OrbitBackground, StarStepper } from '@/components/orbit';
import { Colors, StatusColors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Transaction, TransactionStatus } from '@/data_api/models/transaction.types';
import { getApiErrorMessage } from '@/data_api/lib/logger';
import { transactionService } from '@/data_api/services/transactionService';
import { socketService } from '@/data_api/services/socketService';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type StatusConfig = {
  label: string;
  description: string;
  color: string;
  step: number;
  terminal?: 'success' | 'error' | 'neutral';
};

const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
  EN_ATTENTE_AUTO: {
    label: 'Vérification automatique en cours',
    description: 'Nous vérifions votre paiement.',
    color: '#F59E0B',
    step: 1,
  },
  EN_VERIFICATION: {
    label: 'Vérification automatique en cours',
    description: 'Nous vérifions votre paiement.',
    color: '#38BDF8',
    step: 2,
  },
  EN_ATTENTE_PREUVE: {
    label: 'Dépôt à recommencer',
    description: 'Nous n’avons pas encore pu confirmer votre paiement. Nous vérifions votre demande avant que vous ne recommenciez.',
    color: '#F97316',
    step: 2,
  },
  EN_ATTENTE_ADMIN: {
    label: 'Paiement vérifié, en attente de validation',
    description: 'Votre paiement est confirmé. Nous finalisons le crédit de votre compte 1XBET.',
    color: '#A78BFA',
    step: 2,
  },
  EN_RECLAMATION: {
    label: 'Réclamation en cours',
    description: 'Nous examinons votre demande. Vous recevrez une notification après vérification.',
    color: '#C084FC',
    step: 2,
  },
  VALIDEE: {
    label: 'Transaction validée',
    description: 'Le paiement a été confirmé avec succès.',
    color: Colors.goldText,
    step: 3,
    terminal: 'success',
  },
  REJETEE: {
    label: 'Transaction refusée',
    description: 'La transaction n’a pas été acceptée.',
    color: '#F87171',
    step: 3,
    terminal: 'error',
  },
  ANNULEE: {
    label: 'Transaction annulée',
    description: 'Cette transaction a été annulée.',
    color: Colors.textSecondary,
    step: 3,
    terminal: 'neutral',
  },
};

const FLOW_STEPS = ['Demande', 'Vérification', 'Terminé'];

// Short label of the status pill on finished transactions.
const TERMINAL_LABEL: Partial<Record<TransactionStatus, string>> = {
  VALIDEE: 'Validée',
  REJETEE: 'Refusée',
  ANNULEE: 'Annulée',
};

// "Aujourd'hui à 11:05", "Hier à 09:12", "6 nov. à 19:47".
function formatWhen(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return `Aujourd'hui à ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Hier à ${time}`;
  const sameYear = date.getFullYear() === today.getFullYear();
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${day} à ${time}`;
}

const formatAmount = (value: number) => value.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');

export default function UserTransactionsScreen() {
  const { token } = useAuth();
  const wide = useWideWeb();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [claimTarget, setClaimTarget] = useState<Transaction | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const loadRequestRef = useRef(0);

  const submitClaim = async () => {
    if (!claimTarget || claimSubmitting) return;
    setClaimSubmitting(true);
    try {
      const claimed = await transactionService.claim(claimTarget.trackingId);
      setTransactions((current) => current.map((item) =>
        item.trackingId === claimed.trackingId ? claimed : item,
      ));
      setClaimTarget(null);
    } catch {
      Alert.alert('Réclamation impossible', 'Cette transaction ne peut plus être réclamée. Actualisez la liste pour voir son état.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const load = useCallback(async (requestedPage = 1, append = false) => {
    const requestId = ++loadRequestRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const result = await transactionService.getAll({ page: requestedPage, limit: 25 });
      if (requestId !== loadRequestRef.current) return;
      setTransactions((current) => {
        if (!append) return result.items;
        const byId = new Map(current.map((item) => [item.trackingId, item]));
        result.items.forEach((item) => byId.set(item.trackingId, item));
        return [...byId.values()];
      });
      setPage(requestedPage);
      setHasMore(result.hasMore);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      if (!append) Alert.alert('Erreur', getApiErrorMessage(error));
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    socketService.connect(token);
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleTransactionStatusChanged = () => load();
    socket.on('transactionStatusChanged', handleTransactionStatusChanged);
    return () => {
      socket.off('transactionStatusChanged', handleTransactionStatusChanged);
    };
  }, [load, token]);

  const insets = useSafeAreaInsets();

  return (
    <OrbitBackground orbits={false}>
      <FlowHeader title="Mes transactions" onBack={() => router.back()} top={insets.top} />

      {loading ? (
        <View style={st.loader}>
          <ActivityIndicator color={Colors.goldText} size="large" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.trackingId}
          contentContainerStyle={[st.list, wide && webSidebarStyles.readable]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(1);
              }}
              tintColor={Colors.primaryGreen}
            />
          }
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) void load(page + 1, true);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.goldText} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={() => (
            <Text style={st.emptyText}>Aucune transaction pour le moment.</Text>
          )}
          renderItem={({ item, index }) => {
            const config = item.type === 'RETRAIT' && item.statut === 'VALIDEE'
              ? {
                ...STATUS_CONFIG[item.statut],
                description: `Votre compte 1XBET a été débité${item.montant > 0 ? ` de ${item.montant.toLocaleString('fr-FR')} FCFA` : ''}. Votre retrait a été envoyé au numéro indiqué.`,
              }
              : item.type === 'DEPOT' && item.statut === 'EN_ATTENTE_PREUVE' && !!item.creditError
                ? {
                  ...STATUS_CONFIG[item.statut],
                  label: 'Crédit en vérification',
                  description: item.creditError,
                }
              : item.type === 'RETRAIT' && item.statut === 'EN_VERIFICATION'
              ? {
                ...STATUS_CONFIG[item.statut],
                label: 'Retrait en vérification',
                description: 'Nous vérifions votre code de retrait et votre compte 1XBET.',
              }
              : item.type === 'RETRAIT' && item.statut === 'REJETEE'
                ? {
                  ...STATUS_CONFIG[item.statut],
                  description: `Retrait refusé. ${item.motifRejet || 'La vérification n’a pas abouti.'}`,
                }
              : item.type === 'RETRAIT' && item.statut === 'EN_ATTENTE_PREUVE'
                ? {
                  ...STATUS_CONFIG[item.statut],
                  label: item.creditError?.toLocaleLowerCase().includes('code de retrait invalide') ? 'Code invalide' : 'Code de retrait à vérifier',
                  description: item.creditError || 'Le code n’a pas pu être confirmé. Ne le renvoyez pas pendant la vérification.',
                }
              : item.type === 'RETRAIT' && item.statut === 'EN_ATTENTE_ADMIN'
              ? {
                ...STATUS_CONFIG[item.statut],
                label: 'Compte débité · retrait à envoyer',
                  description: `Demande de retrait validée. Votre compte 1XBET a été débité${item.montant > 0 ? ` de ${item.montant.toLocaleString('fr-FR')} FCFA` : ''}. Patientez pendant la préparation de l’envoi au numéro indiqué.`,
              }
                : STATUS_CONFIG[item.statut];

            const tone = StatusColors[item.statut];
            const finished = !!config.terminal;
            const rejected = item.statut === 'REJETEE';
            const credited = item.type === 'DEPOT' && item.statut === 'VALIDEE';
            const last = index === transactions.length - 1;
            const amount = item.montant > 0 ? formatAmount(item.montant) : null;
            const dotColor = finished ? tone.fg : Colors.blueLight;

            return (
              <View style={st.row}>
                {/* Timeline */}
                <View style={st.rail}>
                  <View style={[st.dot, { backgroundColor: dotColor }, !finished && st.dotActive]} />
                  {!last && <View style={st.railLine} />}
                </View>

                <View style={[st.card, !finished && st.cardActive, rejected && st.cardRejected]}>
                  <View style={st.cardHeader}>
                    <View style={st.titleGroup}>
                      <Text style={st.cardType} numberOfLines={1}>
                        {item.type === 'DEPOT' ? 'Dépôt' : 'Retrait'} · {item.operateur || 'Mobile Money'}
                      </Text>
                      <View style={st.metaRow}>
                        {finished && (
                          <View style={[st.pill, { backgroundColor: tone.bg }]}>
                            <Text style={[st.pillText, { color: tone.fg }]}>{TERMINAL_LABEL[item.statut]}</Text>
                          </View>
                        )}
                        <Text style={st.cardDate}>{formatWhen(item.createdAt)}</Text>
                      </View>
                    </View>
                    {amount ? (
                      <View style={st.amountWrap}>
                        <Text style={[st.cardAmount, credited && { color: Colors.success }, rejected && st.amountMuted]}>
                          {credited ? `+${amount}` : amount}
                        </Text>
                        {!finished && <Text style={st.cardCurrency}>FCFA</Text>}
                      </View>
                    ) : (
                      <Text style={st.amountUnknown}>Montant non renseigné</Text>
                    )}
                  </View>

                  {/* In progress, or a finished case with something to explain (Matistore texts). */}
                  {(!finished || (item.type === 'RETRAIT' && item.statut === 'VALIDEE')) && (
                    <View style={[st.statusPanel, { backgroundColor: finished ? tone.bg : 'rgba(47,123,255,0.14)' }]}>
                      <Text style={[st.statusTitle, { color: finished ? tone.fg : pick('#7FB2FF', '#1F5FE0') }]}>{config.label}</Text>
                      <Text style={st.statusDescription}>{config.description}</Text>
                    </View>
                  )}

                  {!finished && (
                    <StarStepper
                      steps={FLOW_STEPS}
                      current={Math.min(FLOW_STEPS.length, config.step)}
                      color={Colors.blueLight}
                      activeColor={pick(Colors.pureWhite, Colors.blue)}
                      compact
                    />
                  )}

                  {rejected && (
                    <View style={st.rejectionBox}>
                      <Text style={st.rejectionText}>
                        <Text style={st.rejectionLabel}>Motif du refus : </Text>
                        {item.motifRejet || (item.type === 'RETRAIT' ? 'la vérification n’a pas abouti.' : 'la transaction n’a pas été acceptée.')}
                      </Text>
                    </View>
                  )}

                  {!!item.numeroTelephone && (
                    <Text style={st.detailLine} selectable>Numéro : {item.numeroTelephone}</Text>
                  )}

                  {rejected && !item.dateTraitementReclamation && (
                    <TouchableOpacity style={st.claimButton} onPress={() => setClaimTarget(item)} activeOpacity={0.8}>
                      <Text style={st.claimButtonText}>RÉCLAMER CETTE TRANSACTION</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
      <Modal
        visible={!!claimTarget}
        transparent
        animationType="fade"
        onRequestClose={() => !claimSubmitting && setClaimTarget(null)}
      >
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Confirmer la réclamation</Text>
            <Text style={st.modalIntro}>Vérifiez le récapitulatif. Nous recevrons votre demande et les informations de cette transaction.</Text>
            {!!claimTarget && (
              <View style={st.claimSummary}>
                <Text style={st.summaryLine}>{claimTarget.type === 'DEPOT' ? 'Dépôt' : 'Retrait'} · {claimTarget.operateur || 'Transaction'}</Text>
                <Text style={st.summaryLine}>Date : {new Date(claimTarget.createdAt).toLocaleString('fr-FR')}</Text>
                {claimTarget.montant > 0 && <Text style={st.summaryLine}>Montant : {claimTarget.montant.toLocaleString('fr-FR')} FCFA</Text>}
                {!!claimTarget.numeroTelephone && <Text style={st.summaryLine}>Numéro : {claimTarget.numeroTelephone}</Text>}
                {!!claimTarget.motifRejet && <Text style={st.summaryReason}>Motif du refus : {claimTarget.motifRejet}</Text>}
              </View>
            )}
            <View style={st.modalButtons}>
              <TouchableOpacity
                style={st.modalCancel}
                disabled={claimSubmitting}
                onPress={() => setClaimTarget(null)}
              >
                <Text style={st.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalConfirm, claimSubmitting && st.buttonDisabled]}
                disabled={claimSubmitting}
                onPress={() => void submitClaim()}
              >
                {claimSubmitting
                  ? <ActivityIndicator color={Colors.onGold} size="small" />
                  : <Text style={st.modalConfirmText}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </OrbitBackground>
  );
}

const st = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, flexGrow: 1 },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, textAlign: 'center', marginTop: 40 },

  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 28, alignItems: 'center', paddingTop: 26 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotActive: { width: 22, height: 22, borderRadius: 11, borderWidth: 4, borderColor: 'rgba(90,162,255,0.3)' },
  railLine: { flex: 1, width: 3, borderRadius: 2, backgroundColor: pick('rgba(120,150,230,0.2)', 'rgba(40,70,150,0.16)'), marginTop: 6 },

  card: {
    flex: 1,
    backgroundColor: pick('rgba(17,28,63,0.95)', '#FFFFFF'),
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 16,
    gap: 14,
    marginBottom: 14,
  },
  cardActive: { borderColor: 'rgba(90,162,255,0.4)' },
  cardRejected: { borderColor: 'rgba(255,107,107,0.3)' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleGroup: { flex: 1, gap: 6, minWidth: 0 },
  cardType: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardDate: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: Font.bodyBold, fontSize: 13 },
  amountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexShrink: 0 },
  cardAmount: { color: Colors.chrome, fontFamily: Font.title, fontSize: 22 },
  amountMuted: { color: pick('#A3AECB', '#5B6789') },
  cardCurrency: { color: Colors.textSecondary, fontFamily: Font.titleBold, fontSize: 12 },
  amountUnknown: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12, maxWidth: 100, textAlign: 'right' },

  statusPanel: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, gap: 3 },
  statusTitle: { fontFamily: Font.bodyBold, fontSize: 15 },
  statusDescription: { color: Colors.chrome, fontFamily: Font.body, fontSize: 13, lineHeight: 19 },

  rejectionBox: { backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  rejectionLabel: { color: pick('#FF9A9A', '#C9373C'), fontFamily: Font.bodyBold },
  rejectionText: { color: pick('#FFC2C2', '#C9373C'), fontFamily: Font.body, fontSize: 14, lineHeight: 20 },

  detailLine: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },

  claimButton: {
    borderWidth: 1.5, borderColor: Colors.gold, backgroundColor: 'rgba(255,194,51,0.06)',
    borderRadius: 18, paddingVertical: 14, alignItems: 'center',
  },
  claimButtonText: { color: Colors.goldText, fontFamily: Font.title, fontSize: 16 },

  modalBackdrop: { flex: 1, backgroundColor: pick('rgba(3,6,18,0.78)', 'rgba(12,22,52,0.45)'), justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: Colors.secondaryBg, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 13 },
  modalTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 20, textTransform: 'uppercase' },
  modalIntro: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, lineHeight: 19 },
  claimSummary: { backgroundColor: Colors.cardBg, borderRadius: 16, padding: 14, gap: 7 },
  summaryLine: { color: Colors.chrome, fontFamily: Font.body, fontSize: 13, lineHeight: 18 },
  summaryReason: { color: pick('#FFA3A3', '#C9373C'), fontFamily: Font.body, fontSize: 13, lineHeight: 18, marginTop: 3 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 2 },
  modalCancel: { paddingHorizontal: 14, paddingVertical: 11 },
  modalCancelText: { color: Colors.textSecondary, fontFamily: Font.bodyBold, fontSize: 14 },
  modalConfirm: { minWidth: 110, alignItems: 'center', backgroundColor: Colors.gold, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  modalConfirmText: { color: Colors.onGold, fontFamily: Font.bodyExtraBold, fontSize: 14 },
  buttonDisabled: { opacity: 0.55 },
});
