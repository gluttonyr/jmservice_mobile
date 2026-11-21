import { ChatInputBar } from '@/components/ChatinputBar';
import { ChatMessage } from '@/components/ChatMessage';
import { DateSeparator } from '@/components/dateSeparator';
import { HistoryLoader } from '@/components/historyLoader';
import { ImagePreviewModal } from '@/components/ImagePreviewModel';
import { ChatBackground } from '@/components/ChatBackground';
import { InfoModal } from '@/components/infomodal';

import { ChoiceCard, FlowHeader, OrbitBackground, PaymentOrbit, Plaque, StarStepper } from '@/components/orbit';
import GreenButton from '@/components/ui/GreenButton';
import JMLogo from '@/components/ui/JMLogo';
import { Colors, Gradients } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { getApiErrorMessage } from '@/data_api/lib/logger';
import { DiscussionStatus } from '@/data_api/models/discussion.types';
import { MessageType } from '@/data_api/models/message.types';
import { Operateur } from '@/data_api/models/operateur.types';
import { operateurService } from '@/data_api/services/operateurService';
import { bookmakerService } from '@/data_api/services/bookmakerService';
import { Bookmaker, DEFAULT_BOOKMAKER } from '@/data_api/models/bookmaker.types';
import { transactionService } from '@/data_api/services/transactionService';
import { socketService } from '@/data_api/services/socketService';
import { useServculPlayerValidation } from '@/hooks/useServculPlayerValidation';
import { useAuth } from '@/hooks/useAuth';
import type { Transaction } from '@/data_api/models/transaction.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dialUssd } from '@/modules/expo-ussd-dialer';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useChat } from '@/hooks/useChat';
import { useChatSections } from '@/hooks/useChatSection';

import { useDiscussionPresence } from '@/hooks/useDiscussionPresence';
import { resolveFileUrl, useFileUrl } from '@/hooks/useFileUrl';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  History,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardPaste,
  Copy,
  ExternalLink,
  WifiOff,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useWideWeb } from '@/hooks/useWideWeb';
import { webSidebarStyles } from '@/components/webSidebarStyles';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Linking,
  Platform,
  PermissionsAndroid,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CountryPicker, {
  Country,
  CountryCode,
  DARK_THEME,
} from '@/components/CountryPicker';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Svg, { Ellipse } from 'react-native-svg';
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode as PhoneCountryCode } from 'libphonenumber-js';

type Mode = 'chat' | 'deposit' | 'withdrawal';
// 0 = bookmaker, then the existing steps (deposit order: 0 → 1 operator → 4 account → 2 amount → 3 number → 5 transfer).
type DepositStep = 0 | 1 | 2 | 3 | 4 | 5;
type WithdrawalStep = 0 | 1 | 2 | 3;
const LAST_SEEN_TRANSACTIONS_KEY = 'transactions_last_seen_at';
const LAST_USED_TRANSACTION_INPUTS_KEY = 'transaction_last_inputs:';
// Opened by the « Ouvrir 1xBet » button on the website when the 1xBet app cannot be opened.
const XBET_WEBSITE = 'https://1xbet.com';

type SavedPhoneInput = {
  phoneNumber?: string;
  callingCode?: string;
  countryCode?: string;
};

type LastUsedTransactionInputs = {
  bookmakerCode?: string;
  accountId?: string;
  phoneByOperator?: Record<string, SavedPhoneInput>;
  phoneNumber?: string;
  callingCode?: string;
  countryCode?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getDepositCreationError = (error: unknown) => {
  const response = isRecord(error) && isRecord(error.response) ? error.response : null;
  if (response?.status === 503) {
    return {
      title: 'Dépôts temporairement indisponibles',
      message: 'Le service de vérification des paiements est temporairement indisponible. Vous ne pouvez pas créer de dépôt pour le moment. Réessayez un peu plus tard.',
    };
  }
  if (response?.status === 409) {
    const responseData = isRecord(response.data) ? response.data : null;
    const serverMessage = typeof responseData?.message === 'string' ? responseData.message : '';
    const verified = serverMessage.includes('déjà vérifié');
    return {
      title: verified ? 'Dépôt en cours de validation' : 'Dépôt déjà en cours',
      message: verified
        ? 'Votre paiement a bien été reçu. Nous finalisons le crédit de votre compte ; vous pourrez faire un autre dépôt après le traitement de celui-ci.'
        : 'Un dépôt précédent est encore en attente de vérification. Pour éviter un paiement en double, attendez sa mise à jour avant d’en créer un autre.',
    };
  }
  return {
    title: 'Création du dépôt impossible',
    message: getApiErrorMessage(error)
      .replace(/Servcul/gi, 'notre service de paiement')
      .replace(/l’administrateur|administrateur/gi, 'notre équipe')
      .replace(/MatiStore|JM Services/gi, 'nous'),
  };
};

// Formate un montant saisi/choisi en groupant les milliers par un espace (ex: "5000" → "5 000").
const formatAmountInput = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Récupère la valeur numérique réelle d'un montant formaté (ignore les espaces).
const parseAmount = (formatted: string): number => {
  const digits = formatted.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : NaN;
};

const isPhoneValidForCountry = (value: string, countryCode: CountryCode) => {
  const phone = value.trim();
  if (!phone) return false;
  try {
    return isValidPhoneNumber(phone, countryCode as PhoneCountryCode);
  } catch {
    return false;
  }
};

const formatPhoneForCountry = (value: string, countryCode: CountryCode) => {
  try {
    const parsed = parsePhoneNumberFromString(value, countryCode as PhoneCountryCode);
    return parsed?.isValid() ? parsed.formatNational() : value;
  } catch {
    return value;
  }
};

// ── Composant image opérateur ────────────────────────────────────────────────
function OperatorImage({
  imageUrl,
  style,
  folder = 'operateurs',
}: {
  imageUrl?: string | null;
  style?: object;
  folder?: string;
}) {
  const uri = useFileUrl(folder, imageUrl);
  if (!uri) return <View style={[style, { backgroundColor: Colors.border }]} />;
  return <Image source={{ uri }} style={style} resizeMode="contain" />;
}

export default function DepositWithdrawalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initialMode } = useLocalSearchParams<{ initialMode?: string }>();
  const { transactionId: incomingTransactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const { user } = useAuth();

  const {
    messages,
    loading,
    sending,
    sendText,
    sendFile,
    sendSticker,
    currentUserId,
    deleteMessage,
    loadMoreHistory,
    loadingMore,
    hasMoreHistory,
  } = useChat(id);

  const [mode, setMode] = useState<Mode>('chat');
  const [depositStep, setDepositStep] = useState<DepositStep>(0);
  const [withdrawalStep, setWithdrawalStep] = useState<WithdrawalStep>(0);
  const [lastUsedInputs, setLastUsedInputs] = useState<LastUsedTransactionInputs | null>(null);

  useEffect(() => {
    if (!user?.trackingId) {
      setLastUsedInputs(null);
      return;
    }
    setLastUsedInputs(null);
    let active = true;
    AsyncStorage.getItem(`${LAST_USED_TRANSACTION_INPUTS_KEY}${user.trackingId}`)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as LastUsedTransactionInputs;
        setLastUsedInputs(parsed);
      })
      .catch(() => {
        if (active) setLastUsedInputs(null);
      });
    return () => { active = false; };
  }, [user?.trackingId]);

  const rememberTransactionInputs = useCallback(async (inputs: LastUsedTransactionInputs, selectedOperatorId: string) => {
    if (!user?.trackingId) return;
    const phoneByOperator = { ...(lastUsedInputs?.phoneByOperator ?? {}) };
    if (selectedOperatorId && inputs.phoneNumber?.trim()) {
      phoneByOperator[selectedOperatorId] = {
        phoneNumber: inputs.phoneNumber.trim(),
        callingCode: inputs.callingCode,
        countryCode: inputs.countryCode,
      };
    }
    const saved = {
      ...lastUsedInputs,
      ...inputs,
      phoneByOperator,
      accountId: inputs.accountId?.trim(),
      phoneNumber: inputs.phoneNumber?.trim(),
    };
    setLastUsedInputs(saved);
    try {
      await AsyncStorage.setItem(`${LAST_USED_TRANSACTION_INPUTS_KEY}${user.trackingId}`, JSON.stringify(saved));
    } catch {
      // Le stockage du dernier numéro ne doit jamais bloquer une transaction confirmée.
    }
  }, [lastUsedInputs, user?.trackingId]);

  // ── Bookmakers depuis l'API ──────────────────────────────────────────────
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [loadingBookmakers, setLoadingBookmakers] = useState(false);
  const [bookmakerCode, setBookmakerCode] = useState(DEFAULT_BOOKMAKER.code);

  const loadBookmakers = useCallback(() => {
    setLoadingBookmakers(true);
    bookmakerService
      .getAll()
      .then((items) => setBookmakers(items.length ? items : [DEFAULT_BOOKMAKER]))
      // A server without the bookmaker list still takes 1XBET deposits: keep the app usable.
      .catch(() => setBookmakers([DEFAULT_BOOKMAKER]))
      .finally(() => setLoadingBookmakers(false));
  }, []);

  useEffect(() => {
    loadBookmakers();
  }, [loadBookmakers]);

  // Preselect the last bookmaker used, if it can still be chosen.
  useEffect(() => {
    const saved = lastUsedInputs?.bookmakerCode;
    if (saved && bookmakers.some((b) => b.code === saved && b.disponible)) setBookmakerCode(saved);
  }, [bookmakers, lastUsedInputs?.bookmakerCode]);

  const currentBookmaker = bookmakers.find((b) => b.code === bookmakerCode && b.disponible);

  const adminPresent = useDiscussionPresence(id);
  // ── Opérateurs depuis l'API ──────────────────────────────────────────────
  const [operators, setOperators] = useState<Operateur[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);

  const loadOperators = useCallback(() => {
    setLoadingOperators(true);
    operateurService
      .getAll()
      .then((items) => {
        setOperators(items);
        const imageUrls = items
          .map((operator) => resolveFileUrl('operateurs', operator.imageUrl))
          .filter(Boolean);
        imageUrls.forEach((url) => { void Image.prefetch(url).catch(() => false); });
      })
      .catch(() => setOperators([]))
      .finally(() => setLoadingOperators(false));
  }, []);

  useEffect(() => {
    loadOperators();
  }, [loadOperators]);

  const [operatorId, setOperatorId] = useState('');
  const selectOperator = useCallback((nextOperatorId: string) => {
    if (nextOperatorId === operatorId) return;
    setOperatorId(nextOperatorId);
    if (mode === 'deposit') {
      setPhoneNumber('');
      setCallingCode('228');
      setCountryCode('TG');
    } else if (mode === 'withdrawal') {
      setWPhoneNumber('');
      setWCallingCode('228');
      setWCountryCode('TG');
    }
  }, [mode, operatorId]);
  const [amount, setAmount] = useState('');

  // ── Dépôt — téléphone avec sélecteur de pays ────────────────────────────
  const [countryCode, setCountryCode] = useState<CountryCode>('TG');
  const [callingCode, setCallingCode] = useState('228');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDepositPicker, setShowDepositPicker] = useState(false);
  const phone = `+${callingCode}${phoneNumber.replace(/\D/g, '')}`;
  const depositPhoneValid = isPhoneValidForCountry(phoneNumber, countryCode);

  // ── Dépôt — ID de compte ─────────────────────────────────────────────────
  const [accountId, setAccountId] = useState('');
  const depositPlayerValidation = useServculPlayerValidation(accountId);

  // ── Retrait — téléphone avec sélecteur de pays ───────────────────────────
  const [wCountryCode, setWCountryCode] = useState<CountryCode>('TG');
  const [wCallingCode, setWCallingCode] = useState('228');
  const [wPhoneNumber, setWPhoneNumber] = useState('');
  const [showWithdrawalPicker, setShowWithdrawalPicker] = useState(false);
  const withdrawalPhone = `+${wCallingCode}${wPhoneNumber.replace(/\D/g, '')}`;
  const withdrawalPhoneValid = isPhoneValidForCountry(wPhoneNumber, wCountryCode);
  const [withdrawalAccountId, setWithdrawalAccountId] = useState('');
  const withdrawalPlayerValidation = useServculPlayerValidation(withdrawalAccountId);

  // Restore only the phone saved for the currently selected operator.
  useEffect(() => {
    if (!operatorId) return;
    const saved = lastUsedInputs?.phoneByOperator?.[operatorId];
    if (!saved?.phoneNumber) return;
    if (mode === 'deposit' && !phoneNumber.trim()) {
      setPhoneNumber(saved.phoneNumber);
      setCallingCode(saved.callingCode || '228');
      if (saved.countryCode) setCountryCode(saved.countryCode as CountryCode);
    } else if (mode === 'withdrawal' && !wPhoneNumber.trim()) {
      setWPhoneNumber(saved.phoneNumber);
      setWCallingCode(saved.callingCode || '228');
      if (saved.countryCode) setWCountryCode(saved.countryCode as CountryCode);
    }
  }, [lastUsedInputs, mode, operatorId]);

  const [withdrawalCode, setWithdrawalCode] = useState('');

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cancellingDeposit, setCancellingDeposit] = useState(false);
  const [manualDialOpened, setManualDialOpened] = useState(false);
  const [paymentCodeCopied, setPaymentCodeCopied] = useState(false);
  const [showCancelDepositSheet, setShowCancelDepositSheet] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBusyRef = useRef(false);
  const cancelInProgressRef = useRef(false);
  const creditErrorShownRef = useRef<string | null>(null);
  const successNoticeShownRef = useRef<string | null>(null);
  const [text, setText] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [hasUnseenTransaction, setHasUnseenTransaction] = useState(false);
  const [depositCaptureAvailable, setDepositCaptureAvailable] = useState(false);
  const listRef = useRef<SectionList>(null);
  const audio = useAudioRecorder();

  // Messages groupés par jour pour les séparateurs de date flottants.
  const sections = useChatSections(messages);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      if (!sections.length) return;
      const lastSectionIndex = sections.length - 1;
      const lastItemIndex = sections[lastSectionIndex].data.length - 1;
      try {
        listRef.current?.scrollToLocation({
          sectionIndex: lastSectionIndex,
          itemIndex: lastItemIndex,
          animated,
          viewPosition: 1,
        });
      } catch { }
    }, 120);
  }, [sections]);

  const lastMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1].trackingId;
    if (lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (initialMode === 'deposit') setMode('deposit');
    else if (initialMode === 'withdrawal') setMode('withdrawal');
  }, [initialMode]);

  useEffect(() => {
    if (!incomingTransactionId) return;
    transactionService.getById(incomingTransactionId)
      .then((loadedTransaction) => {
        setTransaction(loadedTransaction);
        setMode('deposit');
        setDepositStep(5);
        setProcessing(
          loadedTransaction.statut === 'EN_ATTENTE_AUTO'
          || loadedTransaction.statut === 'EN_VERIFICATION',
        );
      })
      .catch(() => Alert.alert('Erreur', 'Impossible de charger cette transaction.'));
  }, [incomingTransactionId]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const refreshCaptureStatus = () => transactionService.getCaptureStatus()
      .then((status) => { if (!cancelled) setDepositCaptureAvailable(status.available); })
      .catch(() => { if (!cancelled) setDepositCaptureAvailable(false); });
    void refreshCaptureStatus();
    const captureTimer = setInterval(refreshCaptureStatus, 20_000);
    (async () => {
      try {
        const lastSeen = await AsyncStorage.getItem(LAST_SEEN_TRANSACTIONS_KEY);
        if (cancelled) return;
        const lastSeenAt = lastSeen ? new Date(lastSeen).getTime() : 0;
        const result = await transactionService.getUpdatedSince(new Date(lastSeenAt).toISOString());
        if (cancelled) return;
        setHasUnseenTransaction(result.hasUpdates);
      } catch {
        // Le badge ne bloque pas l'ouverture de la discussion.
      }
    })();
    return () => { cancelled = true; clearInterval(captureTimer); };
  }, []));

  const currentOperator = operators.find((o) => o.trackingId === operatorId);
  const depositProgressStep = depositStep === 0 ? 1 : depositStep === 1 ? 2 : depositStep === 4 ? 3 : depositStep === 5 ? 5 : 4;
  const depositProgressLabels = ['Bookmaker', 'Opérateur', 'Compte', 'Paiement', 'Code'];
  const paymentProgressStep = transaction?.creditError
    ? 2
    : transaction?.statut === 'VALIDEE'
      ? 4
      : transaction?.statut === 'EN_ATTENTE_ADMIN'
        || (transaction?.statut === 'EN_VERIFICATION' && !!transaction.referencePaiement)
        ? 3
        : 1;
  const paymentProgressLabels = ['Paiement', 'Paiement reçu', 'Crédit en cours', 'Compte crédité'];
  // Pill in the middle of the payment orbit.
  const paymentStatus = transaction?.creditError
    ? { label: 'Crédit à vérifier', bg: 'rgba(255,107,107,0.16)', fg: '#FF8A8A' }
    : transaction?.statut === 'VALIDEE'
      ? { label: 'Compte crédité', bg: 'rgba(61,220,151,0.16)', fg: Colors.success }
      : paymentProgressStep >= 3
        ? { label: 'Paiement reçu', bg: 'rgba(47,123,255,0.2)', fg: '#8FB4FF' }
        : { label: 'Paiement en attente', bg: 'rgba(255,194,51,0.16)', fg: Colors.gold };
  // Le montant affiché contient des espaces (séparateurs de milliers) : le code USSD
  // composé, lui, ne doit contenir que des chiffres.
  const rawAmount = amount.replace(/[^0-9]/g, '');
  const depositPaymentAlreadyReceived = !!(transaction?.referencePaiement || transaction?.creditError);

  // Le numéro saisi par l'utilisateur (indicatif + numéro, sans le "+") : selon
  // l'opérateur, {numero} peut apparaître 0, 1 ou plusieurs fois dans le
  // format — ou pas du tout (ex: TMoney n'en a pas besoin).
  const depositNumero = `${callingCode}${phoneNumber.replace(/\D/g, '')}`;

  const buildUssdCode = (op: Operateur, numero: string, montant: string) =>
    op.formatUssd
      .replace(/\{numero\}/g, numero)
      .replace(/\{montant\}/g, montant);

  // ── Handlers chat ────────────────────────────────────────────────────────
  const handleSendText = () => {
    if (!text.trim()) return;
    sendText(text.trim());
    setText('');
    scrollToBottom();
  };

  const handleSendFile = async (
    file: { uri: string; name: string; type: string },
    type: MessageType,
  ) => {
    await sendFile(file, type);
  };

  const handleSendSticker = (stickerImage: string) => {
    sendSticker(stickerImage);
  };

  // ── Soumission dépôt ─────────────────────────────────────────────────────
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [withdrawalNotice, setWithdrawalNotice] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const createDepositTransaction = useCallback(async () => {
    if (!depositPhoneValid) {
      throw new Error('Vérifiez le format du numéro pour le pays sélectionné.');
    }
    if (depositPlayerValidation.player?.userId !== Number(accountId.trim())) {
      throw new Error('Vérifiez votre compte 1XBET avant de continuer.');
    }
    if (transaction) return transaction;
    if (!currentOperator) throw new Error('Opérateur introuvable');
    if (!currentBookmaker) throw new Error('Choisissez votre bookmaker.');
    setCreatingTransaction(true);
    try {
      const created = await transactionService.create({
        type: 'DEPOT',
        montant: parseAmount(amount),
        operateur: currentOperator.nom,
        numeroTelephone: phone,
        compteDestinataire: accountId.trim(),
        bookmaker: currentBookmaker.code,
      });
      void rememberTransactionInputs({
        bookmakerCode: currentBookmaker.code,
        accountId: accountId.trim(),
        phoneNumber,
        callingCode,
        countryCode,
      }, currentOperator.trackingId);
      setTransaction(created);
      return created;
    } finally {
      setCreatingTransaction(false);
    }
  }, [accountId, amount, callingCode, countryCode, currentBookmaker, currentOperator, depositPhoneValid, depositPlayerValidation.player, phone, rememberTransactionInputs, transaction]);

  const prepareDeposit = async () => {
    if (!depositCaptureAvailable) {
      Alert.alert('Dépôts temporairement indisponibles', 'Le service de vérification des paiements est temporairement indisponible. Réessayez un peu plus tard.');
      return;
    }
    if (depositPlayerValidation.player?.userId !== Number(accountId.trim())) {
      Alert.alert('ID 1XBET non vérifié', 'Vérifiez votre compte 1XBET avant de continuer.');
      return;
    }
    setDepositStep(2);
  };

  const createDepositAndContinue = async () => {
    if (!depositCaptureAvailable) {
      Alert.alert('Dépôts temporairement indisponibles', 'Le service de vérification des paiements est temporairement indisponible. Réessayez un peu plus tard.');
      return;
    }
    if (!currentOperator || creatingTransaction || !depositPhoneValid) return;
    const parsedAmount = parseAmount(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 300) {
      Alert.alert('Montant invalide', 'Saisissez un montant valide pour continuer.');
      return;
    }
    try {
      await createDepositTransaction();
      setDepositStep(5);
    } catch (error) {
      const depositError = getDepositCreationError(error);
      Toast.show({
        type: 'error',
        text1: depositError.title,
        text2: depositError.message,
      });
    }
  };

  const beginDeposit = async () => {
    if (!depositCaptureAvailable) {
      Alert.alert('Dépôts temporairement indisponibles', 'Le service de vérification des paiements est temporairement indisponible. Réessayez un peu plus tard.');
      return;
    }
    if (!currentOperator || creatingTransaction || depositPaymentAlreadyReceived) return;
    if (!depositPhoneValid) {
      Toast.show({ type: 'error', text1: 'Numéro invalide', text2: 'Vérifiez le format du numéro pour le pays sélectionné.' });
      return;
    }
    const parsedAmount = parseAmount(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 300) {
      Alert.alert('Montant invalide', 'Saisissez un montant valide pour continuer.');
      return;
    }
    const code = buildUssdCode(currentOperator, depositNumero, rawAmount);
    setProcessing(true);

    const resetAfterUssdFailure = (error?: unknown) => {
      setProcessing(false);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
      const ussdFailure = errorMessage.match(
        /USSD request failed \(code (-?\d+), voice subscription \d+\)/i,
      );
      const userErrorMessage = ussdFailure
        ? `La demande USSD a échoué sur le réseau mobile (code ${ussdFailure[1]}). La SIM vocale a bien été sélectionnée. Vérifiez le code et la couverture réseau, puis réessayez.`
        : errorMessage || 'Vérifiez votre réseau et votre carte SIM, puis réessayez.';
      Toast.show({
        type: 'error',
        text1: 'Code USSD non exécuté',
        text2: userErrorMessage,
      });
    };

    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
          {
            title: 'Autorisation requise',
            message: "JM Services a besoin d'effectuer l'appel USSD pour votre dépôt.",
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          },
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Autorisation d’appel refusée. Autorisez les appels pour lancer le code depuis JM Services.');
        }
        const phoneStatePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          {
            title: 'Choix de la carte SIM',
            message: 'JM Services a besoin de voir les cartes SIM disponibles pour vous laisser choisir celle du paiement.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          },
        );
        if (phoneStatePermission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Autorisez l’accès aux cartes SIM pour choisir celle du paiement.');
        }
      }

      try {
        await createDepositTransaction();
      } catch (error) {
        setProcessing(false);
        const depositError = getDepositCreationError(error);
        Toast.show({
          type: 'error',
          text1: depositError.title,
          text2: depositError.message,
        });
        return;
      }

      if (Platform.OS === 'ios') {
        // iOS may refuse to prefill USSD strings containing * or # through tel:.
        // Keep the code in the clipboard so the user can paste it in Phone if needed.
        Clipboard.setString(code);
        await Linking.openURL(`tel:${encodeURIComponent(code)}`);
        setManualDialOpened(true);
        return;
      }

      await dialUssd(code);
    } catch (error) {
      resetAfterUssdFailure(error);
    }
  };

  const copyDepositCode = async () => {
    if (!depositCaptureAvailable) {
      Alert.alert('Dépôts temporairement indisponibles', 'Le service de vérification des paiements est temporairement indisponible. Réessayez un peu plus tard.');
      return;
    }
    if (!currentOperator || creatingTransaction || depositPaymentAlreadyReceived) return;
    if (!depositPhoneValid) {
      Toast.show({ type: 'error', text1: 'Numéro invalide', text2: 'Vérifiez le format du numéro pour le pays sélectionné.' });
      return;
    }
    const parsedAmount = parseAmount(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 300) {
      Alert.alert('Montant invalide', 'Saisissez un montant valide pour continuer.');
      return;
    }

    setProcessing(true);
    try {
      await createDepositTransaction();
      Clipboard.setString(buildUssdCode(currentOperator, depositNumero, rawAmount));
      setPaymentCodeCopied(true);
      Toast.show({
        type: 'success',
        text1: 'Code copié',
        text2: 'Composez-le sur le téléphone utilisant le numéro indiqué. Nous vérifierons la réception de votre paiement.',
      });
    } catch (error) {
      setProcessing(false);
      const depositError = getDepositCreationError(error);
      Toast.show({
        type: 'error',
        text1: depositError.title,
        text2: depositError.message,
      });
    }
  };

  const stopTransactionPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Soumission retrait ───────────────────────────────────────────────────
  const handleWithdrawalSubmit = async () => {
    if (withdrawalSubmitting) return;
    if (!currentOperator) {
      Alert.alert('Opérateur requis', 'Choisissez l’opérateur Mobile Money du numéro destinataire.');
      setWithdrawalStep(1);
      return;
    }
    if (!withdrawalPhoneValid) {
      setWithdrawalNotice({
        type: 'error',
        title: 'Numéro invalide',
        message: 'Vérifiez le format du numéro pour le pays sélectionné.',
      });
      return;
    }
    if (withdrawalPlayerValidation.player?.userId !== Number(withdrawalAccountId.trim())) {
      Alert.alert('ID 1XBET non vérifié', 'Vérifiez votre compte 1XBET avant de continuer.');
      return;
    }
    if (!currentBookmaker) {
      Alert.alert('Bookmaker requis', 'Choisissez votre bookmaker.');
      setWithdrawalStep(0);
      return;
    }
    setWithdrawalSubmitting(true);
    try {
      const created = await transactionService.create({
        type: 'RETRAIT',
        operateur: currentOperator.nom,
        compteDestinataire: withdrawalAccountId.trim(),
        numeroTelephone: withdrawalPhone,
        codeRetrait: withdrawalCode.trim(),
        bookmaker: currentBookmaker.code,
      });
      void rememberTransactionInputs({
        bookmakerCode: currentBookmaker.code,
        accountId: withdrawalAccountId.trim(),
        phoneNumber: wPhoneNumber,
        callingCode: wCallingCode,
        countryCode: wCountryCode,
      }, currentOperator.trackingId);
      setTransaction(created);
      try {
        await sendText(
        `📤 *Demande de retrait*\n` +
        `Code 1xBet : ${withdrawalCode}\n` +
        `Numéro: ${withdrawalPhone}`,
          DiscussionStatus.RETRAIT
        );
      } catch {
        // Transaction créée côté serveur; l'échec du message chat ne doit pas annuler la demande.
      }
      setWithdrawalNotice(created.statut === 'EN_ATTENTE_ADMIN'
        ? {
          type: 'success',
          title: 'Débit 1XBET confirmé',
          message: `Votre compte 1XBET a été débité${created.montant > 0 ? ` de ${created.montant.toLocaleString('fr-FR')} FCFA` : ''}. Patientez pendant la préparation de l’envoi au numéro indiqué.`,
        }
        : {
          type: 'error',
          title: created.creditError?.toLocaleLowerCase().includes('code de retrait invalide') ? 'Code de retrait invalide' : 'Retrait à vérifier',
          message: created.creditError
          || 'Le code de retrait n’a pas pu être validé pour le moment. Veuillez revérifier le code et réessayer. Si le problème persiste, contactez notre support.',
        });
    } catch {
      setWithdrawalNotice({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible d’enregistrer la demande de retrait. Réessayez.',
      });
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    stopTransactionPolling();
    setMode('chat');
    setDepositStep(0);
    setProcessing(false);
    setManualDialOpened(false);
    setPaymentCodeCopied(false);
    setWithdrawalStep(0);
    setOperatorId('');
    setAmount('');
    // Dépôt téléphone
    setPhoneNumber('');
    setCallingCode('228');
    setCountryCode('TG');
    // Dépôt ID de compte
    setAccountId('');
    setWithdrawalAccountId('');
    // Retrait téléphone
    setWPhoneNumber('');
    setWCallingCode('228');
    setWCountryCode('TG');
    // Retrait code
    setWithdrawalCode('');
    setTransaction(null);
  }, [stopTransactionPolling]);

  const cancelDeposit = async () => {
    if (!transaction || cancellingDeposit) return;
    cancelInProgressRef.current = true;
    setCancellingDeposit(true);
    try {
      await transactionService.cancel(transaction.trackingId);
      stopTransactionPolling();
      resetForm();
      Toast.show({
        type: 'success',
        text1: 'Dépôt annulé',
        text2: 'Votre demande de dépôt a été annulée.',
      });
    } catch (error) {
      try {
        const latest = await transactionService.getById(transaction.trackingId);
        setTransaction(latest);
      } catch {
        // Preserve the cancellation error if refreshing the transaction also fails.
      }
      Toast.show({
        type: 'error',
        text1: 'Annulation impossible',
        text2: getApiErrorMessage(error),
      });
    } finally {
      cancelInProgressRef.current = false;
      setCancellingDeposit(false);
    }
  };

  const pollingTransactionId = transaction?.trackingId;
  useEffect(() => {
    if (!pollingTransactionId || mode !== 'deposit') return;
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleTransactionStatusChanged = (event: { transactionId?: string; trackingId?: string }) => {
      if ((event.transactionId ?? event.trackingId) !== pollingTransactionId || pollBusyRef.current) return;
      pollBusyRef.current = true;
      transactionService.getById(pollingTransactionId)
        .then((updated) => {
          if (cancelInProgressRef.current) return;
          setTransaction(updated);
          if (updated.statut === 'VALIDEE') {
            stopTransactionPolling();
            if (successNoticeShownRef.current !== updated.trackingId) {
              successNoticeShownRef.current = updated.trackingId;
              setWithdrawalNotice({
                type: 'success',
                title: 'Dépôt crédité',
                message: `Votre dépôt de ${updated.montant} FCFA a été crédité sur votre compte 1XBET.\nNuméro : ${updated.numeroTelephone || '—'}${updated.referencePaiement ? `\nRéférence : ${updated.referencePaiement}` : ''}`,
              });
            }
          } else if (updated.creditError) {
            const errorKey = `${updated.trackingId}:${updated.creditError}`;
            if (creditErrorShownRef.current !== errorKey) {
              creditErrorShownRef.current = errorKey;
              setWithdrawalNotice({ type: 'error', title: 'Crédit non confirmé', message: updated.creditError });
            }
          } else if (updated.statut === 'REJETEE' || updated.statut === 'ANNULEE') {
            stopTransactionPolling();
            resetForm();
            if (updated.statut === 'REJETEE' && updated.motifRejet?.includes('trois minutes')) {
              Toast.show({
                type: 'error',
                text1: 'Délai dépassé',
                text2: 'Votre dépôt a été refusé car le paiement n’a pas été détecté dans les trois minutes. Vous pouvez recommencer depuis le chat.',
              });
            } else {
              router.push('/user_transactions');
            }
          }
        })
        .catch(() => {
          // Keep the existing interval poll as a fallback if the socket refresh fails.
        })
        .finally(() => {
          pollBusyRef.current = false;
        });
    };
    socket.on('transactionStatusChanged', handleTransactionStatusChanged);
    return () => {
      socket.off('transactionStatusChanged', handleTransactionStatusChanged);
    };
  }, [mode, pollingTransactionId, resetForm, stopTransactionPolling]);

  useEffect(() => {
    if (!pollingTransactionId || mode !== 'deposit') return;

    pollRef.current = setInterval(async () => {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      try {
        const updated = await transactionService.getById(pollingTransactionId);
        if (cancelInProgressRef.current) return;
        setTransaction(updated);
        if (updated.statut === 'VALIDEE') {
          stopTransactionPolling();
          if (successNoticeShownRef.current !== updated.trackingId) {
            successNoticeShownRef.current = updated.trackingId;
            setWithdrawalNotice({
              type: 'success',
              title: 'Dépôt crédité',
              message: `Votre dépôt de ${updated.montant} FCFA a été crédité sur votre compte 1XBET.\nNuméro : ${updated.numeroTelephone || '—'}${updated.referencePaiement ? `\nRéférence : ${updated.referencePaiement}` : ''}`,
            });
          }
        } else if (updated.creditError) {
          const errorKey = `${updated.trackingId}:${updated.creditError}`;
          if (creditErrorShownRef.current !== errorKey) {
            creditErrorShownRef.current = errorKey;
            setWithdrawalNotice({ type: 'error', title: 'Crédit non confirmé', message: updated.creditError });
          }
        } else if (updated.statut === 'REJETEE' || updated.statut === 'ANNULEE') {
          stopTransactionPolling();
          resetForm();
          if (updated.statut === 'REJETEE' && updated.motifRejet?.includes('trois minutes')) {
            Toast.show({
              type: 'error',
              text1: 'Délai dépassé',
              text2: 'Votre dépôt a été refusé car le paiement n’a pas été détecté dans les trois minutes. Vous pouvez recommencer depuis le chat.',
            });
          } else {
            router.push('/user_transactions');
          }
        }
      } catch {
        // Une erreur réseau ponctuelle ne doit pas interrompre le suivi.
      } finally {
        pollBusyRef.current = false;
      }
    }, 3000);

    return stopTransactionPolling;
  }, [mode, pollingTransactionId, resetForm, stopTransactionPolling]);

  // ── Ouvrir le composeur USSD ─────────────────────────────────────────────
  // ── Ouvrir 1xBet ────────────────────────────────────────────────────────
  const open1xBet = async () => {
    if (Platform.OS === 'web') {
      // Android browser: an "intent" link opens the 1xBet app (same xbet:// link as the native app);
      // without the app, the browser goes to the 1xBet website instead. Elsewhere: the website in a new tab.
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        window.location.href = `intent://open#Intent;scheme=xbet;S.browser_fallback_url=${encodeURIComponent(XBET_WEBSITE)};end`;
      } else {
        window.open(XBET_WEBSITE, '_blank');
      }
      return;
    }
    const appSchemes = ['xbet://open', 'xbet://openapp'];
    for (const scheme of appSchemes) {
      try {
        const canOpen = await Linking.canOpenURL(scheme);
        if (canOpen) {
          await Linking.openURL(scheme);
          return;
        }
      } catch { }
    }
    Alert.alert(
      "Impossible d'ouvrir 1xBet",
      "Veuillez ouvrir l'application 1xBet manuellement.",
    );
  };
  const insets = useSafeAreaInsets();
  const wide = useWideWeb();

  // Step 0 of both flows. Bookmakers without an API are listed as "Bientôt" and cannot be chosen.
  const renderBookmakerStep = (subtitle: string, onNext: () => void) => (
    <>
      <Text style={st.pageTitle}>Choisir le bookmaker</Text>
      <Text style={st.pageSubtitle}>{subtitle}</Text>
      {loadingBookmakers ? (
        <ActivityIndicator color={Colors.primaryGreen} style={{ marginVertical: 32 }} />
      ) : (
        <View>
          {bookmakers.map((bm) => (
            <ChoiceCard
              key={bm.trackingId}
              title={bm.nom}
              caption={bm.disponible ? 'Dépôts et retraits' : 'Bientôt disponible'}
              selected={bm.disponible && bookmakerCode === bm.code}
              soon={!bm.disponible}
              onPress={() => setBookmakerCode(bm.code)}
              logo={bm.imageUrl
                ? <OperatorImage folder="bookmakers" imageUrl={bm.imageUrl} style={st.choiceLogoImage} />
                : <Text style={st.bookmakerLogoText} numberOfLines={1} adjustsFontSizeToFit>{bm.nom}</Text>}
            />
          ))}
        </View>
      )}
      <GreenButton
        title="Suivant →"
        onPress={() => currentBookmaker && onNext()}
        disabled={!currentBookmaker || loadingBookmakers}
        style={st.pageBtn}
      />
    </>
  );

  // Operator list of both flows.
  const renderOperatorChoices = (list: Operateur[], caption: string) => (
    <View>
      {list.map((op) => (
        <ChoiceCard
          key={op.trackingId}
          title={op.nom}
          caption={caption}
          selected={operatorId === op.trackingId}
          onPress={() => selectOperator(op.trackingId)}
          logo={<OperatorImage imageUrl={op.imageUrl} style={st.choiceLogoImage} />}
        />
      ))}
    </View>
  );

  // ─── DEPOSIT ─────────────────────────────────────────────────────────────
  if (mode === 'deposit') {
    return (
      <>
        <KeyboardAvoidingView
          style={[
            st.container,
            { paddingBottom: Platform.OS === 'android' ? insets.bottom : 0 }
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <OrbitBackground orbits={false}>
          {/* Website on a computer: header and steps take the same readable width as the content. */}
          <View style={wide && webSidebarStyles.readable}>
            <FlowHeader
              title={depositStep === 5 ? 'Effectuer le transfert' : 'Dépôt'}
              subtitle={`Étape ${depositProgressStep} sur ${depositProgressLabels.length}`}
              onBack={resetForm}
              top={insets.top}
            />
            {depositStep !== 5 && (
              <View style={st.stepperWrap}>
                <StarStepper steps={depositProgressLabels} current={depositProgressStep} />
              </View>
            )}
          </View>

          {!depositCaptureAvailable && !transaction && (
            <View style={[st.captureUnavailableBox, wide && webSidebarStyles.readable]}>
              <Text style={st.captureUnavailableTitle}>Dépôts temporairement indisponibles</Text>
              <Text style={st.captureUnavailableText}>La vérification des paiements est temporairement indisponible. Vous pourrez reprendre votre dépôt dès que le service sera rétabli.</Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={[st.pageContent, wide && webSidebarStyles.readable]}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Étape 0 : Choix bookmaker ──────────────────────────────── */}
            {depositStep === 0 && renderBookmakerStep(
              'Sélectionnez le site de paris à recharger',
              () => setDepositStep(1),
            )}

            {/* ── Étape 1 : Choix opérateur ──────────────────────────────── */}
            {depositStep === 1 && (
              <>
                <Text style={st.pageTitle}>Choisir l'opérateur</Text>
                <Text style={st.pageSubtitle}>
                  Sélectionnez votre réseau de paiement mobile
                </Text>
                {loadingOperators ? (
                  <ActivityIndicator
                    color={Colors.primaryGreen}
                    style={{ marginVertical: 32 }}
                  />
                ) : operators.length === 0 ? (
                  <View style={st.connectionErrorBox}>
                    <WifiOff color="#f59e0b" size={22} />
                    <Text style={st.connectionErrorText}>
                      Veuillez vérifier votre connexion pour pouvoir utiliser cette fonctionnalité.
                    </Text>
                    <TouchableOpacity style={st.retryBtn} onPress={loadOperators} activeOpacity={0.8}>
                      <Text style={st.retryBtnText}>Réessayer</Text>
                    </TouchableOpacity>
                  </View>
                ) : renderOperatorChoices(operators, 'Paiement par code USSD')}
                <GreenButton
                  title="Suivant →"
                  onPress={() => operatorId && setDepositStep(4)}
                  disabled={!operatorId || loadingOperators}
                  style={st.pageBtn}
                />
              </>
            )}

            {/* ── Étape 2 : Montant ──────────────────────────────────────── */}
            {depositStep === 2 && (
              <>
                <Text style={st.pageTitle}>Montant du dépôt</Text>
                <Text style={st.pageSubtitle}>Entrez le montant en FCFA</Text>
                <View style={st.amountCard}>
                  <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Ellipse cx="200" cy="110" rx="260" ry="62" transform="rotate(-8 200 110)" stroke="rgba(255,194,51,0.35)" strokeWidth="1.2" fill="none" />
                  </Svg>
                  <Text style={st.amountCaption}>VOUS DÉPOSEZ</Text>
                  <View style={st.amountRow}>
                    <TextInput
                      style={[st.amountInput, st.webNoOutline]}
                      placeholder="0"
                      placeholderTextColor="rgba(232,237,247,0.35)"
                      value={amount}
                      onChangeText={(text) => setAmount(formatAmountInput(text))}
                      maxLength={9}
                      keyboardType="numeric"
                      accessibilityLabel="Montant du dépôt en FCFA"
                    />
                    <Text style={st.amountCurrency}>FCFA</Text>
                  </View>
                  <Text style={st.amountMinimum}>Minimum 300 FCFA</Text>
                </View>
                <View style={st.chips}>
                  {['5 000', '10 000', '25 000', '50 000', '100 000'].map((v) => {
                    const active = amount === v;
                    const label = `${parseAmount(v) / 1000}K`;
                    return (
                      <TouchableOpacity key={v} style={st.chip} onPress={() => setAmount(v)} accessibilityLabel={`${v} FCFA`} activeOpacity={0.8}>
                        {active ? (
                          <LinearGradient colors={Gradients.gold} style={st.chipInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Text style={[st.chipText, st.chipTextActive]}>{label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={st.chipInner}><Text style={st.chipText}>{label}</Text></View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={st.summaryCard}>
                  <View style={st.summaryRow}>
                    <Text style={st.summaryLabel}>Opérateur</Text>
                    <Text style={st.summaryValue}>{currentOperator?.nom ?? '—'}</Text>
                  </View>
                  <View style={st.summaryRow}>
                    <Text style={st.summaryLabel}>Compte {currentBookmaker?.nom ?? '1XBET'}</Text>
                    <Text style={st.summaryValue}>{accountId.trim() || '—'}</Text>
                  </View>
                  {!!depositPlayerValidation.player?.name && (
                    <View style={st.summaryRow}>
                      <Text style={st.summaryLabel}>Joueur</Text>
                      <View style={st.summaryPlayer}>
                        <Check color={Colors.success} size={16} strokeWidth={3} />
                        <Text style={[st.summaryValue, { color: Colors.success }]} numberOfLines={1}>
                          {depositPlayerValidation.player.name.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                {!!amount && parseAmount(amount) < 300 && (
                  <Text style={st.errorText}>
                    Le montant minimum est de 300 FCFA
                  </Text>
                )}
                <GreenButton
                  title="Suivant →"
                  onPress={() => {
                    const numAmount = parseAmount(amount);
                    if (!amount || isNaN(numAmount) || numAmount < 300) {
                      Alert.alert(
                        "Montant invalide",
                        "Le montant minimum de dépôt est de 300 FCFA.",
                        [{ text: "OK" }]
                      );
                      return;
                    }
                    setDepositStep(3);
                  }}
                  disabled={!amount || isNaN(parseAmount(amount)) || parseAmount(amount) < 300}
                  style={st.pageBtn}
                />
              </>
            )}

            {/* ── Étape 3 : Numéro ───────────────────────────────────────── */}
            {depositStep === 3 && (
              <>
                <Text style={st.pageTitle}>Numéro de dépôt</Text>
                <Text style={st.pageSubtitle}>
                  Numéro {currentOperator?.nom} à utiliser pour le dépôt
                </Text>
                <View style={st.phoneInputWrap}>
                  <TouchableOpacity
                    style={st.countrySelector}
                    onPress={() => setShowDepositPicker(true)}
                    activeOpacity={0.7}
                  >
                    <CountryPicker
                      countryCode={countryCode}
                      withFlag
                      withEmoji
                      withFilter
                      withCallingCode
                      withAlphaFilter
                      theme={DARK_THEME}
                      onSelect={(country: Country) => {
                        setCountryCode(country.cca2);
                        setCallingCode(country.callingCode[0]);
                        setShowDepositPicker(false);
                      }}
                      visible={showDepositPicker}
                      onClose={() => setShowDepositPicker(false)}
                      containerButtonStyle={st.pickerHidden}
                    />
                    <Text style={st.callingCodeText}>+{callingCode}</Text>
                    <ChevronDown color={Colors.textSecondary} size={14} />
                  </TouchableOpacity>
                  <View style={st.phoneDivider} />
                  <TextInput
                    style={[st.phoneInput, st.webNoOutline]}
                    placeholder="XX XX XX XX"
                    placeholderTextColor={Colors.textSecondary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    onBlur={() => setPhoneNumber((value) => formatPhoneForCountry(value, countryCode))}
                    keyboardType="phone-pad"
                  />
                  {depositPhoneValid && <CheckCircle2 color={Colors.primaryGreen} size={20} style={st.phoneValidIcon} />}
                </View>
                {!!phoneNumber.trim() && !depositPhoneValid && (
                  <Text style={st.phoneValidationError}>Numéro invalide pour le pays sélectionné.</Text>
                )}
                <GreenButton
                  title={creatingTransaction ? 'Création du dépôt...' : 'Préparer le paiement →'}
                  onPress={() => void createDepositAndContinue()}
                  disabled={!depositPhoneValid || creatingTransaction}
                  style={st.pageBtn}
                />
              </>
            )}

            {/* ── Étape 4 : ID de compte ─────────────────────────────────── */}
            {depositStep === 4 && (
              <>
                <Text style={st.pageTitle}>Identifiant de compte</Text>
                <Text style={st.pageSubtitle}>
                  Saisissez ou collez votre ID de compte 1XBET. Le nom du joueur doit être vérifié avant de continuer.
                </Text>
                {!!lastUsedInputs?.accountId && lastUsedInputs.accountId !== accountId.trim() && (
                  <TouchableOpacity
                    style={st.lastUsedAccountCard}
                    onPress={() => setAccountId(lastUsedInputs.accountId ?? '')}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={`Utiliser l’identifiant 1XBET ${lastUsedInputs.accountId} déjà utilisé`}
                  >
                    <View style={st.lastUsedAccountIcon}><Check color={Colors.primaryGreen} size={18} strokeWidth={2.6} /></View>
                    <View style={st.lastUsedAccountCopy}>
                      <Text style={st.lastUsedAccountLabel}>Identifiant utilisé récemment</Text>
                      <Text style={st.lastUsedAccountValue}>{lastUsedInputs.accountId}</Text>
                    </View>
                    <Text style={st.lastUsedAccountAction}>Utiliser →</Text>
                  </TouchableOpacity>
                )}
                <View style={st.inputWrapWithIcon}>
                  <TextInput
                    style={[st.pageInput, st.webNoOutline, { flex: 1 }]}
                    placeholder="Ex: 123456789"
                    placeholderTextColor={Colors.textSecondary}
                    value={accountId}
                    onChangeText={setAccountId}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />
                  {depositPlayerValidation.checking && (
                    <ActivityIndicator color={Colors.primaryGreen} style={{ marginHorizontal: 10 }} />
                  )}
                  <TouchableOpacity
                    style={st.pasteBtn}
                    onPress={async () => {
                    setAccountId((await Clipboard.getString()).trim());
                    }}
                  >
                    <ClipboardPaste color={Colors.blueLight} size={20} />
                  </TouchableOpacity>
                </View>
                {depositPlayerValidation.player && (
                  <View style={st.playerFound}>
                    <Check color={Colors.success} size={16} strokeWidth={3} />
                    <Text style={st.playerFoundText}>
                      {depositPlayerValidation.player.name
                        ? `Utilisateur trouvé : ${depositPlayerValidation.player.name}`
                        : 'Compte 1XBET trouvé'}
                    </Text>
                  </View>
                )}
                {depositPlayerValidation.error && (
                  <Text style={st.errorText}>{depositPlayerValidation.error}</Text>
                )}
                <GreenButton
                  title="Suivant →"
                  onPress={() => void prepareDeposit()}
                  disabled={
                    !accountId.trim()
                    || creatingTransaction
                    || depositPlayerValidation.checking
                    || depositPlayerValidation.player?.userId !== Number(accountId.trim())
                  }
                  style={st.pageBtn}
                />
              </>
            )}

            {/* ── Étape 5 : Effectuer le transfert ──────────────────────── */}
            {depositStep === 5 && currentOperator && (
              <>
                <PaymentOrbit labels={paymentProgressLabels as [string, string, string, string]} current={paymentProgressStep}>
                  <View style={[st.statusPill, { backgroundColor: paymentStatus.bg }]}>
                    <View style={[st.statusDot, { backgroundColor: paymentStatus.fg }]} />
                    <Text style={[st.statusPillText, { color: paymentStatus.fg }]} numberOfLines={1}>{paymentStatus.label}</Text>
                  </View>
                  <Text style={st.orbitAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {formatAmountInput(String(transaction?.montant ?? rawAmount))}
                  </Text>
                  <Text style={st.orbitVia} numberOfLines={1}>FCFA via {currentOperator.nom}</Text>
                  {(processing || transaction?.statut === 'EN_ATTENTE_ADMIN') && !transaction?.creditError && (
                    <View style={st.orbitChecking}>
                      <ActivityIndicator color={Colors.blueLight} size="small" />
                      <Text style={st.orbitCheckingText}>Vérification…</Text>
                    </View>
                  )}
                </PaymentOrbit>
                {!!transaction?.creditError && (
                  <View style={st.creditErrorBox}>
                    <Text style={st.creditErrorTitle}>Crédit non confirmé</Text>
                    <Text style={st.creditErrorText}>{transaction.creditError}</Text>
                    <Text style={st.creditErrorText}>
                      Montant : {transaction.montant} FCFA · Numéro : {transaction.numeroTelephone || '—'}
                      {transaction.referencePaiement ? ` · Référence : ${transaction.referencePaiement}` : ''}
                    </Text>
                  </View>
                )}
                {/* iOS: the code is not displayed, only copied (the client dials it in the Phone app). */}
                {Platform.OS !== 'ios' ? (
                  <Plaque
                    caption={`Code USSD ${currentOperator.nom}`}
                    value={buildUssdCode(currentOperator, depositNumero, rawAmount)}
                    dashes={false}
                    size="lg"
                  />
                ) : (
                  <Text style={st.codeLabel}>Code de paiement {currentOperator.nom}</Text>
                )}
                <Text style={st.codeInstructions}>
                  {Platform.OS === 'web'
                    ? 'Copiez ce code, puis composez-le sur votre téléphone avec le numéro indiqué. Nous vérifierons la réception de votre paiement.'
                    : Platform.OS === 'ios'
                    ? 'Touchez « Copier le code de paiement », ouvrez l’app Téléphone, collez le code puis appelez. Nous vérifierons la réception de votre paiement.'
                    : 'Nous lancerons le code et vérifierons la réception de votre paiement. Vous pouvez aussi le copier pour le composer sur un autre téléphone.'}
                </Text>
                {/* A browser can't dial USSD: on web the client copies the code and dials it on the phone.
                    iOS keeps only the copy button. */}
                {Platform.OS === 'android' && (
                <GreenButton
                  title={depositPaymentAlreadyReceived
                    ? 'Paiement déjà reçu'
                    : creatingTransaction ? 'Enregistrement...' : 'Effectuer le paiement →'}
                  onPress={() => { if (!manualDialOpened) void beginDeposit(); }}
                  disabled={creatingTransaction || depositPaymentAlreadyReceived}
                  style={st.pageBtn}
                />
                )}
                <TouchableOpacity
                  style={[st.copyDepositCodeBtn, (creatingTransaction || depositPaymentAlreadyReceived) && st.copyDepositCodeBtnDisabled]}
                  onPress={() => void copyDepositCode()}
                  disabled={creatingTransaction || depositPaymentAlreadyReceived}
                  activeOpacity={0.8}
                >
                  <Copy color={Colors.blueLight} size={20} />
                  <Text style={st.copyDepositCodeText}>
                    {creatingTransaction ? 'Enregistrement...' : Platform.OS === 'ios' ? 'Copier le code de paiement' : 'Copier le code et attendre'}
                  </Text>
                </TouchableOpacity>
                {processing && (
                  <View style={st.processingBox}>
                    <Text style={st.processingText}>
                      {paymentCodeCopied
                        ? 'Code copié. Composez-le sur le téléphone utilisant le numéro indiqué. Nous vérifierons la réception de votre paiement.'
                        : 'Nous vérifions automatiquement votre paiement.'}
                    </Text>
                  </View>
                )}
                {transaction && !transaction.creditError && !transaction.referencePaiement
                  && ['EN_ATTENTE_AUTO', 'EN_VERIFICATION', 'EN_ATTENTE_PREUVE'].includes(transaction.statut) && (
                  <TouchableOpacity
                    style={[st.cancelDepositBtn, cancellingDeposit && st.cancelDepositBtnDisabled]}
                    onPress={() => setShowCancelDepositSheet(true)}
                    disabled={cancellingDeposit}
                    activeOpacity={0.8}
                  >
                    {cancellingDeposit
                      ? <ActivityIndicator color={Colors.error} size="small" />
                      : <Text style={st.cancelDepositText}>Annuler le dépôt</Text>}
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
          </OrbitBackground>
        </KeyboardAvoidingView>
        <InfoModal
          visible={showCancelDepositSheet}
          onClose={() => setShowCancelDepositSheet(false)}
          type="warning"
          title="Annuler le dépôt ?"
          message="La demande en cours sera annulée. Si vous avez déjà envoyé l’argent, ne l’annulez pas."
          confirmText="Oui, annuler le dépôt"
          secondaryText="Continuer le dépôt"
          onConfirm={() => void cancelDeposit()}
          onSecondary={() => {}}
        />
        <InfoModal
          visible={!!withdrawalNotice}
          onClose={() => {
            const completed = withdrawalNotice?.type === 'success';
            setWithdrawalNotice(null);
            if (completed) {
              resetForm();
              router.push('/user_transactions');
            }
          }}
          type={withdrawalNotice?.type ?? 'info'}
          title={withdrawalNotice?.title ?? ''}
          message={withdrawalNotice?.message}
          confirmText="OK"
        />
      </>
    );
  }

  // ─── WITHDRAWAL ──────────────────────────────────────────────────────────
  if (mode === 'withdrawal') {
    return (
      <KeyboardAvoidingView
        style={st.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <OrbitBackground orbits={false}>
        <View style={wide && webSidebarStyles.readable}>
          <FlowHeader title="Retrait" subtitle={`Étape ${withdrawalStep + 1} sur 4`} onBack={resetForm} top={insets.top} />
          <View style={st.stepperWrap}>
            <StarStepper steps={['Bookmaker', 'Opérateur', 'Compte', 'Code']} current={withdrawalStep + 1} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[st.pageContent, wide && webSidebarStyles.readable]}
          keyboardShouldPersistTaps="handled"
        >
          {withdrawalStep === 0 && renderBookmakerStep(
            'Sélectionnez le site de paris d’où vient votre retrait',
            () => setWithdrawalStep(1),
          )}

          {withdrawalStep === 1 && (
            <>
              <Text style={st.pageTitle}>Choisir l'opérateur</Text>
              <Text style={st.pageSubtitle}>Sélectionnez le réseau Mobile Money qui recevra votre retrait.</Text>
              {loadingOperators
                ? <ActivityIndicator color={Colors.primaryGreen} style={{ marginVertical: 32 }} />
                : renderOperatorChoices(operators.filter((op) => op.active), 'Reçoit votre retrait')}
              {!loadingOperators && !operators.some((op) => op.active) && <Text style={st.errorText}>Aucun opérateur disponible. Réessayez plus tard.</Text>}
              <GreenButton title="Suivant →" onPress={() => operatorId && setWithdrawalStep(2)} disabled={!operatorId || loadingOperators} style={st.pageBtn} />
            </>
          )}

          {withdrawalStep === 2 && (
            <>
              <Text style={st.pageTitle}>Vérifier votre compte 1XBET</Text>
              <Text style={st.pageSubtitle}>Saisissez votre ID avant de continuer.</Text>
              <Text style={st.inputLabel}>ID de compte 1XBET</Text>
              {!!lastUsedInputs?.accountId && lastUsedInputs.accountId !== withdrawalAccountId.trim() && (
                <TouchableOpacity
                  style={st.lastUsedAccountCard}
                  onPress={() => setWithdrawalAccountId(lastUsedInputs.accountId ?? '')}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Utiliser l’identifiant 1XBET ${lastUsedInputs.accountId} déjà utilisé`}
                >
                  <View style={st.lastUsedAccountIcon}><Check color={Colors.primaryGreen} size={18} strokeWidth={2.6} /></View>
                  <View style={st.lastUsedAccountCopy}>
                    <Text style={st.lastUsedAccountLabel}>Identifiant utilisé récemment</Text>
                    <Text style={st.lastUsedAccountValue}>{lastUsedInputs.accountId}</Text>
                  </View>
                  <Text style={st.lastUsedAccountAction}>Utiliser →</Text>
                </TouchableOpacity>
              )}
              <View style={st.inputWrapWithIcon}>
                <TextInput
                  style={[st.pageInput, st.webNoOutline, { flex: 1 }]}
                  placeholder="Ex: 123456789"
                  placeholderTextColor={Colors.textSecondary}
                  value={withdrawalAccountId}
                  onChangeText={setWithdrawalAccountId}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                {withdrawalPlayerValidation.checking && (
                  <ActivityIndicator color={Colors.primaryGreen} style={{ marginHorizontal: 10 }} />
                )}
                <TouchableOpacity
                  style={st.pasteBtn}
                  onPress={async () => setWithdrawalAccountId((await Clipboard.getString()).trim())}
                >
                  <ClipboardPaste color={Colors.blueLight} size={20} />
                </TouchableOpacity>
              </View>
              {withdrawalPlayerValidation.player && (
                <View style={st.playerFound}>
                  <Check color={Colors.success} size={16} strokeWidth={3} />
                  <Text style={st.playerFoundText}>
                    {withdrawalPlayerValidation.player.name
                      ? `Utilisateur trouvé : ${withdrawalPlayerValidation.player.name}`
                      : 'Compte 1XBET trouvé'}
                  </Text>
                </View>
              )}
              {withdrawalPlayerValidation.error && (
                <Text style={st.errorText}>{withdrawalPlayerValidation.error}</Text>
              )}
              <Text style={st.sectionTitle}>Comment effectuer un retrait ?</Text>
              {[
                { title: 'Connectez-vous à 1xBet', text: 'Ouvrez l’application 1xBet et accédez à votre compte.' },
                { title: 'Générez votre code de retrait', text: 'Générez un code unique de retrait, copiez-le et revenez dans l’application.' },
                { title: 'Revenez ici', text: 'Touchez « Suivant », collez votre code de retrait et indiquez votre numéro Mobile Money.' },
              ].map((item, index) => (
                <View key={item.title} style={st.instructionCard}>
                  <View style={st.instructionNumber}><Text style={st.instructionNumberText}>{index + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.instructionStep}>{item.title}</Text>
                    <Text style={st.instructionText}>{item.text}</Text>
                  </View>
                </View>
              ))}
              {Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={st.xbetBtn}
                onPress={open1xBet}
                activeOpacity={0.85}
              >
                <ExternalLink color={Colors.blueLight} size={20} />
                <Text style={st.xbetBtnText}>Ouvrir 1xBet</Text>
              </TouchableOpacity>
              )}
              <GreenButton
                title={"Suivant"}
                onPress={() => setWithdrawalStep(3)}
                disabled={
                  withdrawalSubmitting
                  || !withdrawalPlayerValidation.player
                  || withdrawalPlayerValidation.player.userId !== Number(withdrawalAccountId.trim())
                  || withdrawalPlayerValidation.checking
                }
                style={st.pageBtn}
              />
            </>
          )}

          {withdrawalStep === 3 && (
            <>
              <Text style={st.pageTitle}>Saisir votre code</Text>
              <Text style={st.pageSubtitle}>
                Collez le code généré sur 1xBet et entrez votre numéro Mobile
                Money
              </Text>

              <Text style={st.inputLabel}>Code de retrait 1xBet</Text>
              <View style={st.inputWrapWithIcon}>
                <TextInput
                  style={[st.pageInput, st.webNoOutline, { flex: 1 }]}
                  placeholder="Ex: WD-XXXXXXXX"
                  placeholderTextColor={Colors.textSecondary}
                  value={withdrawalCode}
                  onChangeText={setWithdrawalCode}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={st.pasteBtn}
                  onPress={async () => {
                    const t = await Clipboard.getString();
                    setWithdrawalCode(t);
                  }}
                >
                  <ClipboardPaste color={Colors.blueLight} size={20} />
                </TouchableOpacity>
              </View>

              <Text style={[st.inputLabel, { marginTop: 20 }]}>
                Numéro Mobile Money
              </Text>
              <View style={st.phoneInputWrap}>
                <TouchableOpacity
                  style={st.countrySelector}
                  onPress={() => setShowWithdrawalPicker(true)}
                  activeOpacity={0.7}
                >
                  <CountryPicker
                    countryCode={wCountryCode}
                    withFlag
                    withEmoji
                    withFilter
                    withCallingCode
                    withAlphaFilter
                    theme={DARK_THEME}
                    onSelect={(country: Country) => {
                      setWCountryCode(country.cca2);
                      setWCallingCode(country.callingCode[0]);
                      setShowWithdrawalPicker(false);
                    }}
                    visible={showWithdrawalPicker}
                    onClose={() => setShowWithdrawalPicker(false)}
                    containerButtonStyle={st.pickerHidden}
                  />
                  <Text style={st.callingCodeText}>+{wCallingCode}</Text>
                  <ChevronDown color={Colors.textSecondary} size={14} />
                </TouchableOpacity>
                <View style={st.phoneDivider} />
                <TextInput
                  style={[st.phoneInput, st.webNoOutline]}
                  placeholder="XX XX XX XX"
                  placeholderTextColor={Colors.textSecondary}
                  value={wPhoneNumber}
                  onChangeText={setWPhoneNumber}
                  onBlur={() => setWPhoneNumber((value) => formatPhoneForCountry(value, wCountryCode))}
                  keyboardType="phone-pad"
                />
                {withdrawalPhoneValid && <CheckCircle2 color={Colors.primaryGreen} size={20} style={st.phoneValidIcon} />}
              </View>
              {!!wPhoneNumber.trim() && !withdrawalPhoneValid && (
                <Text style={st.phoneValidationError}>Numéro invalide pour le pays sélectionné.</Text>
              )}
              <GreenButton
                title="Envoyer la demande ✓"
                onPress={handleWithdrawalSubmit}
                disabled={!withdrawalCode.trim() || !withdrawalPhoneValid || withdrawalSubmitting}
                style={st.pageBtn}
              />
            </>
          )}
        </ScrollView>
        </OrbitBackground>
        <InfoModal
          visible={!!withdrawalNotice}
          onClose={() => {
            const completed = withdrawalNotice?.type === 'success';
            setWithdrawalNotice(null);
            if (completed) {
              resetForm();
              router.push('/user_transactions');
            }
          }}
          type={withdrawalNotice?.type ?? 'info'}
          title={withdrawalNotice?.title ?? ''}
          message={withdrawalNotice?.message}
          confirmText="OK"
        />
      </KeyboardAvoidingView>
    );
  }



  // Deposit / withdrawal cards: under the chat on phones, in a side panel on a computer.
  const actionCards = (
    <View style={[st.actionRow, wide && st.actionColumn, !wide && { paddingBottom: 10 }]}>
      <TouchableOpacity
        style={[st.actionCard, !depositCaptureAvailable && { opacity: 0.45 }]}
        onPress={() => setMode('deposit')}
        activeOpacity={0.85}
        disabled={!depositCaptureAvailable}
        accessibilityRole="button"
        accessibilityLabel="Dépôt"
      >
        <LinearGradient colors={Gradients.gold} style={st.actionCardInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={[st.actionIconWrap, st.actionIconGold]}>
            <ArrowDown color={Colors.onGold} size={22} strokeWidth={2.5} />
          </View>
          <View style={st.actionCopy}>
            <Text style={[st.actionCardTitle, { color: Colors.onGold }]}>DÉPÔT</Text>
            <Text style={[st.actionCardSub, { color: 'rgba(26,20,5,0.8)' }]} numberOfLines={2}>
              {depositCaptureAvailable ? 'Recharger votre compte' : 'Dépôts temporairement indisponibles'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity
        style={st.actionCard}
        onPress={() => setMode('withdrawal')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Retrait"
      >
        <View style={[st.actionCardInner, st.actionCardOutline]}>
          <View style={[st.actionIconWrap, st.actionIconNavy]}>
            <ArrowUp color={Colors.gold} size={22} strokeWidth={2.5} />
          </View>
          <View style={st.actionCopy}>
            <Text style={st.actionCardTitle}>RETRAIT</Text>
            <Text style={st.actionCardSub} numberOfLines={2}>Vers Mobile Money</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  // ─── CHAT VIEW ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={st.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ChatBackground variant="finance" />
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
          <ChevronLeft color={Colors.chrome} size={28} />
        </TouchableOpacity>
        <View style={st.headerAvatar}>
          <JMLogo size={36} />
        </View>
        <View style={st.headerInfo}>
          <Text style={st.headerName} numberOfLines={1} ellipsizeMode="tail">Dépôt / Retrait</Text>
          <Text style={st.headerStatus} numberOfLines={1}>Équipe JM Services</Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.setItem(LAST_SEEN_TRANSACTIONS_KEY, new Date().toISOString()).catch(() => {});
            setHasUnseenTransaction(false);
            router.push('/user_transactions');
          }}
          style={st.historyBtn}
          accessibilityRole="button"
          accessibilityLabel="Mes transactions"
        >
          <History color={Colors.gold} size={24} />
          {hasUnseenTransaction && <View style={st.notifDot} />}
        </TouchableOpacity>
      </View>

      <WideWrap on={wide} style={st.wideBody}>
        <WideWrap on={wide} style={st.wideChat}>
          {loading ? (
            <View style={st.loader}>
              <ActivityIndicator color={Colors.primaryGreen} size="large" />
            </View>
          ) : (
            <SectionList
              ref={listRef}
              sections={sections}
              keyExtractor={(item) => item.trackingId}
              contentContainerStyle={st.msgList}
              stickySectionHeadersEnabled
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              refreshControl={
                <RefreshControl
                  refreshing={loadingMore}
                  onRefresh={loadMoreHistory}
                  tintColor={Colors.primaryGreen}
                  colors={[Colors.primaryGreen]}
                  progressBackgroundColor={Colors.cardBg}
                />
              }
              renderSectionHeader={({ section }) => <DateSeparator label={section.title} />}

              renderItem={({ item }) => (
                <ChatMessage
                  item={item}
                  currentUserId={currentUserId}
                  onImagePress={setPreviewUri}
                  // onDelete={deleteMessage}
                />
              )}
              ListEmptyComponent={() => (
                <View style={st.emptyWrap}>
                  <Text style={st.emptyText}>
                    Bonjour ! Vous pouvez effectuer vos dépôts et retraits ici.
                    {'\n'}{wide ? 'Choisissez une action à gauche.' : 'Choisissez une action ci-dessous.'}
                  </Text>
                </View>
              )}
            />
          )}

          {!wide && actionCards}

          <ChatInputBar
            text={text}
            onChangeText={setText}
            onSendText={handleSendText}
            onSendFile={handleSendFile}
            onSendSticker={handleSendSticker}
            sending={sending}
            audio={audio}
            allowStickers={false}
          />
        </WideWrap>
        {wide && (
          <View style={st.widePanel}>
            <Text style={st.widePanelTitle}>Que voulez-vous faire ?</Text>
            {actionCards}
          </View>
        )}
      </WideWrap>

      <ImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} />
    </KeyboardAvoidingView>
  );
}

// Website on a computer: wraps children in a View; elsewhere renders them as is (the phone layout is unchanged).
function WideWrap({ on, style, children }: { on: boolean; style: any; children: ReactNode }) {
  return on ? <View style={style}>{children}</View> : <>{children}</>;
}

const st = StyleSheet.create({
  stepperWrap: { paddingHorizontal: 20, paddingTop: 8 },
  sectionTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 20, textTransform: 'uppercase', marginTop: 26, marginBottom: 12 },
  playerFound: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  playerFoundText: { color: Colors.success, fontFamily: Font.bodySemiBold, fontSize: 14, flexShrink: 1 },
  // The browser draws its own focus ring inside our rounded fields.
  webNoOutline: Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
  choiceLogoImage: { width: '86%', height: '86%' },
  headerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.navy, borderWidth: 2, borderColor: 'rgba(90,162,255,0.4)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  historyBtn: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,194,51,0.12)', borderWidth: 1, borderColor: 'rgba(255,194,51,0.35)' },
  amountCard: { borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(47,123,255,0.55)', backgroundColor: 'rgba(6,11,30,0.75)', paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', marginBottom: 16, overflow: 'hidden' },
  amountCaption: { color: Colors.blueLight, fontFamily: Font.bodyExtraBold, fontSize: 13, letterSpacing: 3 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginVertical: 8, maxWidth: '100%' },
  amountMinimum: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 13 },
  chipInner: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.navy },
  summaryCard: { backgroundColor: 'rgba(17,28,63,0.9)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15 },
  summaryValue: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  summaryPlayer: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, maxWidth: '100%' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontFamily: Font.bodyBold, fontSize: 13 },
  orbitAmount: { color: Colors.chrome, fontFamily: Font.title, fontSize: 40, lineHeight: 48, marginTop: 6 },
  orbitVia: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 14 },
  orbitChecking: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  orbitCheckingText: { color: Colors.blueLight, fontFamily: Font.bodyBold, fontSize: 13 },
  processingBox: { paddingVertical: 14, paddingHorizontal: 8 },
  processingText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  instructionNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,194,51,0.16)', alignItems: 'center', justifyContent: 'center' },
  instructionNumberText: { color: Colors.gold, fontFamily: Font.title, fontSize: 15 },
  actionCard: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  actionCardOutline: { backgroundColor: Colors.navy, borderWidth: 1.5, borderColor: 'rgba(255,194,51,0.45)' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionIconGold: { backgroundColor: 'rgba(26,20,5,0.12)' },
  actionIconNavy: { backgroundColor: 'rgba(120,150,230,0.14)' },
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  captureUnavailableBox: { marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,176,32,0.12)', borderWidth: 1, borderColor: 'rgba(255,176,32,0.4)', gap: 5 },
  captureUnavailableTitle: { color: '#FFC94D', fontFamily: Font.bodyExtraBold, fontSize: 13 },
  captureUnavailableText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12, lineHeight: 17 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 14, paddingHorizontal: 14, backgroundColor: 'rgba(8,16,44,0.96)', borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerName: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 19 },
  headerStatus: { color: Colors.success, fontFamily: Font.bodyMedium, fontSize: 14 },

  stepBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.secondaryBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  stepSegmentActive: { backgroundColor: Colors.primaryGreen },
  depositProgressItem: { flex: 1, alignItems: 'center', gap: 5 },
  depositProgressLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },
  depositProgressLabelActive: { color: Colors.white },
  notifDot: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF5A5F', borderWidth: 2, borderColor: Colors.night },

  pageContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  pageTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 28, lineHeight: 34, textTransform: 'uppercase', marginBottom: 4 },
  pageSubtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, marginBottom: 22, lineHeight: 21 },
  pageBtn: { width: '100%', marginTop: 22 },
  depositPendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,194,51,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.3)',
  },
  depositPendingText: { color: Colors.primaryGreen, fontSize: 14, fontWeight: '700' },
  paymentProgressCard: {
    gap: 12,
    padding: 14,
    marginBottom: 18,
    borderRadius: 14,
    backgroundColor: Colors.cardBg,
  },
  paymentProgressTitle: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  paymentProgressTrack: { flexDirection: 'row', gap: 5 },
  paymentProgressItem: { flex: 1, gap: 6 },
  paymentProgressLine: { height: 3, borderRadius: 2, backgroundColor: Colors.border },
  paymentProgressLineActive: { backgroundColor: Colors.primaryGreen },
  paymentProgressLabel: { color: Colors.textSecondary, fontSize: 9, lineHeight: 12 },
  paymentProgressLabelActive: { color: Colors.white, fontWeight: '700' },
  creditErrorBox: { gap: 8, padding: 14, marginBottom: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,107,107,0.45)', backgroundColor: 'rgba(255,107,107,0.08)' },
  creditErrorTitle: { color: '#FF8A8A', fontFamily: Font.bodyExtraBold, fontSize: 14 },
  creditErrorText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12, lineHeight: 18 },
  cancelDepositBtn: { alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 10, paddingVertical: 14 },
  cancelDepositBtnDisabled: { opacity: 0.5 },
  cancelDepositText: { color: '#FF7B7B', fontFamily: Font.bodyBold, fontSize: 16 },
  copyDepositCodeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', marginTop: 12, paddingVertical: 17, borderRadius: 22, borderWidth: 1.5, borderColor: Colors.blueLight, backgroundColor: Colors.navy },
  copyDepositCodeBtnDisabled: { opacity: 0.5 },
  copyDepositCodeText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16 },

  operatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  operatorCard: {
    width: '30%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  connectionErrorBox: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20, backgroundColor: 'rgba(255,176,32,0.06)', borderWidth: 1, borderColor: 'rgba(255,176,32,0.25)', borderRadius: 22, marginBottom: 8 },
  connectionErrorText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,194,51,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.3)',
  },
  retryBtnText: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 13 },
  operatorCardActive: { backgroundColor: 'rgba(255,194,51,0.05)' },
  operatorLogoFrame: {
    width: 88,
    height: 68,
    marginBottom: 10,
    padding: 5,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  operatorImage: { width: '100%', height: '100%' },
  bookmakerCardSoon: { opacity: 0.55 },
  bookmakerLogoFrame: {
    width: 88,
    height: 68,
    marginBottom: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bookmakerLogoText: { color: Colors.navy, fontFamily: Font.title, fontSize: 16, paddingHorizontal: 4 },
  bookmakerSoonBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  bookmakerSoonText: { color: '#f59e0b', fontSize: 10, fontWeight: '800' },
  operatorCardName: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  operatorCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  amountInput: { color: Colors.pureWhite, fontFamily: Font.title, fontSize: 52, lineHeight: 64, paddingVertical: 0, minWidth: 60, textAlign: 'center' },
  amountCurrency: { color: Colors.gold, fontFamily: Font.title, fontSize: 24, marginLeft: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { flex: 1, borderRadius: 18, overflow: 'hidden' },

  chipText: { color: Colors.chrome, fontFamily: Font.title, fontSize: 17 },
  chipTextActive: { color: Colors.onGold },

  phoneInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.night, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(120,150,230,0.18)', paddingHorizontal: 16, marginBottom: 4 },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 8,
  },
  pickerHidden: {
    opacity: 0,
    position: 'absolute',
    width: 0,
    height: 0,
  },
  callingCodeText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16, marginLeft: 6 },
  phoneDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.border,
    marginHorizontal: 10,
  },
  phoneValidIcon: { marginLeft: 8 },
  phoneValidationError: { color: '#FF8A8A', fontFamily: Font.bodyMedium, fontSize: 12, marginTop: 4, marginBottom: 8 },
  phoneInput: { flex: 1, color: Colors.chrome, fontFamily: Font.bodyMedium, fontSize: 16, paddingVertical: 16 },

  inputWrap: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  inputWrapWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.night, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(120,150,230,0.18)', paddingLeft: 16, paddingRight: 6 },
  pageInput: { color: Colors.chrome, fontFamily: Font.bodyMedium, fontSize: 17, paddingVertical: 16 },
  inputLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 14, marginBottom: 8 },
  pasteBtn: { padding: 10 },
  lastUsedAccountCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14, borderRadius: 20, backgroundColor: 'rgba(255,194,51,0.08)', borderWidth: 1, borderColor: 'rgba(255,194,51,0.35)' },
  lastUsedAccountIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,194,51,0.14)',
  },
  lastUsedAccountCopy: { flex: 1, gap: 2 },
  lastUsedAccountLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 12 },
  lastUsedAccountValue: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 18, letterSpacing: 0.3 },
  lastUsedAccountAction: { color: Colors.gold, fontFamily: Font.bodyExtraBold, fontSize: 13 },

  codeLabel: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16, textAlign: 'center', marginBottom: 4 },

  codeInstructions: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 14, paddingHorizontal: 8 },

  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  callBtnText: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },

  infoBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,194,51,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.2)',
    padding: 14,
    marginBottom: 4,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  instructionCard: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(17,28,63,0.9)', borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  instructionStep: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 15, marginBottom: 3 },
  instructionText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, lineHeight: 19 },

  xbetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 22, marginTop: 6, marginBottom: 4, borderWidth: 1.5, borderColor: Colors.blueLight, backgroundColor: Colors.navy },
  xbetBtnText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16 },

  msgList: { padding: 16, gap: 6, paddingBottom: 8 },

  // panel rendered after the chat, shown on the left
  wideBody: { flex: 1, flexDirection: 'row-reverse' },
  wideChat: { flex: 1 },
  widePanel: { width: 340, padding: 20, gap: 16, borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: Colors.secondaryBg },
  widePanelTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 20 },
  actionColumn: { flexDirection: 'column', paddingHorizontal: 0 },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: 'rgba(8,16,44,0.96)' },

  actionCardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 24, minHeight: 82 },
  actionIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  actionCardTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 20, lineHeight: 24 },
  actionCardSub: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 12, lineHeight: 16 },
  errorText: { color: '#FF8A8A', fontFamily: Font.bodySemiBold, fontSize: 13, marginTop: 8, marginBottom: 12, textAlign: 'center' },
});
