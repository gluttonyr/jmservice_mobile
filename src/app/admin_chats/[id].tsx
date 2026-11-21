import { ChatInputBar } from '@/components/ChatinputBar';
import { ChatMessage } from '@/components/ChatMessage';
import { DateSeparator } from '@/components/dateSeparator';
import { ImagePreviewModal } from '@/components/ImagePreviewModel';
import { ChatBackground } from '@/components/ChatBackground';
import { UserAvatar } from '@/components/UserAvatar';

import { Font } from '@/constants/fonts';
import { Colors } from '@/constants/colors';
import { MessageType } from '@/data_api/models/message.types';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useChat } from '@/hooks/useChat';
import { useChatSections } from '@/hooks/useChatSection';

import { useClientPresence } from '@/hooks/useClientPresence';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronLeft,
  HeadphonesIcon,
  History,
  Shield,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MessageCategory = 'deposit' | 'withdrawal' | 'support';

const CATEGORY_CONFIG: Record<
  MessageCategory,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  deposit: {
    label: 'Dépôt',
    color: Colors.gold,
    bg: 'rgba(255,194,51,0.14)',
    icon: <ArrowDownToLine color={Colors.gold} size={18} />,
  },
  withdrawal: {
    label: 'Retrait',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    icon: <ArrowUpFromLine color="#F59E0B" size={18} />,
  },
  support: {
    label: 'Support',
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.1)',
    icon: <HeadphonesIcon color="#38BDF8" size={18} />,
  },
};

const QUICK_REPLIES: Record<MessageCategory, string[]> = {
  deposit: [
    'Dépôt validé ✅',
    'Preuve reçue, en cours de traitement...',
    'Veuillez renvoyer la preuve de paiement',
  ],
  withdrawal: [
    'Retrait en cours de traitement',
    'Retrait validé, fonds envoyés ✅',
    'Informations incorrectes, merci de vérifier',
  ],
  support: [
    'Bonjour, comment puis-je vous aider ?',
    'Bonsoir, comment puis-je vous aider ?',
    'Votre problème a été résolu ✅',
    'Votre demande de rétrait a bien été reçu ✅',
    'Votre demande de Dépot a bien été reçu ✅',
  ],
};

export default function AdminChatDetailScreen() {
  const { id, name, category, image } = useLocalSearchParams<{
    id: string;
    name: string;
    category: MessageCategory;
    image?: string;
  }>();

  const cat = (category as MessageCategory) || 'support';
  const catConf = CATEGORY_CONFIG[cat];

  const { messages, loading, sending, sendText, sendFile, sendSticker, currentUserId, deleteMessage, pinMessage, unpinMessage,loadMoreHistory,
    loadingMore,
    hasMoreHistory, } =
    useChat(id);

  const [text, setText] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const listRef = useRef<SectionList>(null);
  const audio = useAudioRecorder();
  const { online: clientOnline } = useClientPresence(id);

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
      } catch {}
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

  const handleSendText = () => {
    if (!text.trim()) return;
    sendText(text.trim());
    setText('');
    scrollToBottom();
  };

  const handleQuickReply = (reply: string) => {
    sendText(reply);
    setShowQuickReplies(false);
    scrollToBottom();
  };

  const handleSendFile = async (
    file: { uri: string; name: string; type: string },
    type: MessageType
  ) => {
    await sendFile(file, type);
    scrollToBottom();
  };

  const handleSendSticker = (stickerImage: string) => {
    sendSticker(stickerImage);
    scrollToBottom();
  };
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ChatBackground variant="admin" backgroundColor={Colors.adminBg} />
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Retour">
          <ChevronLeft color={Colors.chrome} size={28} />
        </TouchableOpacity>
        {/* The client's profile photo when there is one, otherwise the category icon. */}
        <UserAvatar
          image={image || null}
          size={48}
          fallback={(
            <View style={[styles.catIconWrap, { backgroundColor: catConf.bg }]}>
              {catConf.icon}
            </View>
          )}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">
            {name}
          </Text>
          <View style={styles.headerSubRow}>
            <View style={[styles.catPill, { backgroundColor: catConf.bg }]}>
              <Text style={[styles.catPillText, { color: catConf.color }]}>
                {catConf.label}
              </Text>
            </View>
            {/* <Text style={styles.headerStatus}>
              {loading ? '' : clientOnline ? 'En ligne' : 'Hors ligne'}
            </Text> */}
          </View>
        </View>
        {cat !== 'support' && (
          <TouchableOpacity
            style={styles.transactionsButton}
            accessibilityLabel="Voir les transactions de cet utilisateur"
            onPress={() => router.push({
              pathname: '/admin_transactions',
              params: { discussionId: id, clientName: name },
            })}
          >
            <History color={Colors.admin} size={24} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Messages ── */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.admin} size="large" />
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.trackingId}
          contentContainerStyle={styles.msgList}
          stickySectionHeadersEnabled
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          refreshControl={
    <RefreshControl
      refreshing={loadingMore}
      onRefresh={loadMoreHistory}
      tintColor={Colors.admin}
      colors={[Colors.admin]}
      progressBackgroundColor={Colors.adminCard}
    />
  }
          renderSectionHeader={({ section }) => <DateSeparator accent="admin" label={section.title} />}
          renderItem={({ item }) => (
            <ChatMessage
              accent="admin"
              item={item}
              currentUserId={currentUserId}
              onImagePress={setPreviewUri}
              allowModeration
              onDelete={deleteMessage}
              onPin={pinMessage}
              onUnpin={unpinMessage}
            />
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Aucun message pour le moment.</Text>
            </View>
          )}
        />
      )}

      {/* ── Réponses rapides (spécifique admin) ── */}
      {showQuickReplies && (
        <View style={styles.quickRepliesContainer}>
          <View style={styles.quickRepliesHeader}>
            <View style={styles.quickRepliesTitleRow}>
              <Shield color={Colors.admin} size={18} />
              <Text style={styles.quickRepliesTitle}>Réponses rapides</Text>
            </View>
            <TouchableOpacity onPress={() => setShowQuickReplies(false)} hitSlop={8}>
              <Text style={styles.quickRepliesHide}>Masquer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickRepliesRow}>
            {QUICK_REPLIES[cat].map((reply, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.quickReplyItem, reply.includes('✅') && styles.quickReplyItemFirst]}
                onPress={() => handleQuickReply(reply)}
              >
                <Text style={[styles.quickReplyText, reply.includes('✅') && styles.quickReplyTextFirst]}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Bouton toggle réponses rapides ── */}
      <View style={styles.quickToggleRow}>
        <TouchableOpacity
          style={[styles.quickToggleBtn, showQuickReplies && styles.quickToggleBtnActive]}
          onPress={() => setShowQuickReplies((v) => !v)}
        >
          <Shield color={showQuickReplies ? Colors.admin : Colors.textSecondary} size={14} />
          <Text
            style={[
              styles.quickToggleText,
              showQuickReplies && { color: Colors.admin },
            ]}
          >
            Réponses rapides
          </Text>
          <ChevronDown
            color={showQuickReplies ? Colors.admin : Colors.textSecondary}
            size={14}
            style={{ transform: [{ rotate: showQuickReplies ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>
      </View>

      {/* ── Input bar complet (texte, fichier, mic, sticker) ── */}
      <ChatInputBar
        accent="admin"
        text={text}
        onChangeText={setText}
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onSendSticker={handleSendSticker}
        sending={sending}
        audio={audio}
      />

      <ImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  quickRepliesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickRepliesHide: { fontFamily: Font.bodyMedium, color: Colors.textSecondary, fontSize: 14 },
  quickRepliesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickReplyItemFirst: { backgroundColor: 'rgba(61,220,151,0.1)', borderColor: 'rgba(61,220,151,0.45)' },
  quickReplyTextFirst: { color: Colors.success },
  container: { flex: 1, backgroundColor: Colors.adminBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontFamily: Font.body, color: Colors.textSecondary, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 14, paddingHorizontal: 14, backgroundColor: 'rgba(6,18,24,0.97)', borderBottomWidth: 1, borderBottomColor: Colors.adminBorder, gap: 10 },
  backBtn: { padding: 4 },
  catIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerName: { fontFamily: Font.bodyExtraBold, color: Colors.chrome, fontSize: 19 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  catPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  catPillText: { fontFamily: Font.bodyBold, fontSize: 13 },
  headerStatus: { fontFamily: Font.body, color: Colors.admin, fontSize: 11 },
  transactionsButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(25,211,197,0.1)', borderWidth: 1, borderColor: 'rgba(25,211,197,0.35)' },
  msgList: { padding: 16, gap: 6, paddingBottom: 8 },
  quickToggleRow: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: 'rgba(6,18,24,0.97)' },
  quickToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: Colors.adminBorder, backgroundColor: Colors.adminCard },
  quickToggleBtnActive: {
    borderColor: 'rgba(25,211,197,0.4)',
    backgroundColor: 'rgba(25,211,197,0.1)',
  },
  quickToggleText: { fontFamily: Font.bodySemiBold, color: Colors.textSecondary, fontSize: 13 },
  quickRepliesContainer: { backgroundColor: 'rgba(6,18,24,0.97)', borderTopWidth: 1, borderTopColor: Colors.adminBorder, padding: 14, gap: 10 },
  quickRepliesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickRepliesTitle: { fontFamily: Font.bodyBold, color: Colors.admin, fontSize: 16 },
  quickReplyItem: { backgroundColor: Colors.adminCard, borderWidth: 1.5, borderColor: 'rgba(25,211,197,0.28)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' },
  quickReplyText: { fontFamily: Font.bodySemiBold, color: Colors.chrome, fontSize: 14 },
});
