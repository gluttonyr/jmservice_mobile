import { ChatInputBar } from '@/components/ChatinputBar';
import { ChatMessage } from '@/components/ChatMessage';
import { DateSeparator } from '@/components/dateSeparator';
import { HistoryLoader } from '@/components/historyLoader';
import { ImagePreviewModal } from '@/components/ImagePreviewModel';
import { ConnectionErrorState } from '@/components/ui/ConnectionErrorState';
import { ChatBackground } from '@/components/ChatBackground';
import { ChatHeader } from '@/components/orbit';
import { Colors, Gradients, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import type { Discussion } from '@/data_api/models/discussion.types';
import { getApiErrorMessage } from '@/data_api/lib/logger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useChat } from '@/hooks/useChat';
import { useChatSections } from '@/hooks/useChatSection';
import {
  fetchForumDiscussionSummary,
  FORUM_DISCUSSION_QUERY_KEY,
  FORUM_HAS_NEW_QUERY_KEY,
} from '@/hooks/useForumHasNew';
import { forumStorage } from '@/storage/forumStorage';
import { Lock, Pin, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ForumScreen() {
  const queryClient = useQueryClient();
  const [discussionId, setDiscussionId] = useState<string | null>(null);
  const [discussionActiveInitial, setDiscussionActiveInitial] = useState(true);
  const [forumLoading, setForumLoading] = useState(true);
  const [forumError, setForumError] = useState('');

  const applyForumSummary = useCallback((forum: Discussion | null) => {
    if (!forum) {
      setForumError('Le forum est momentanément indisponible.');
      return;
    }
    setDiscussionId(forum.trackingId);
    setDiscussionActiveInitial(forum.active);
    void forumStorage.setLastSeenAt(new Date().toISOString()).catch(() => {});
    queryClient.setQueryData(FORUM_HAS_NEW_QUERY_KEY, false);
  }, [queryClient]);

  const loadForum = useCallback(() => {
    setForumError('');
    const cachedForum = queryClient.getQueryData<Discussion | null>(FORUM_DISCUSSION_QUERY_KEY);
    if (cachedForum) {
      applyForumSummary(cachedForum);
      setForumLoading(false);
    } else {
      setForumLoading(true);
    }

    queryClient.fetchQuery({
      queryKey: FORUM_DISCUSSION_QUERY_KEY,
      queryFn: fetchForumDiscussionSummary,
      staleTime: 20_000,
      retry: false,
    })
      .then((forum) => {
        if (forum) applyForumSummary(forum);
        else if (!cachedForum) setForumError('Le forum est momentanément indisponible.');
      })
      .catch((err) => {
        if (!cachedForum) setForumError(getApiErrorMessage(err));
      })
      .finally(() => setForumLoading(false));
  }, [applyForumSummary, queryClient]);

  useEffect(() => {
    loadForum();
  }, [loadForum]);

  const { messages, loading, sending, discussionActive, sendText, sendFile, sendSticker, currentUserId,loadMoreHistory,
    loadingMore,
    hasMoreHistory, } =
    useChat(discussionId ?? '', 40);

  const [text, setText] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const listRef = useRef<SectionList>(null);
  const audio = useAudioRecorder();

  const locked = (discussionActive ?? discussionActiveInitial) === false;
  const pinnedMessage = messages.find((m) => m.epingle && !m.isDeleted);

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
    if (!text.trim() || locked) return;
    sendText(text.trim());
    setText('');
    scrollToBottom();
  };



  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ChatBackground variant="forum" />
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <ChatHeader
        title="Forum"
        titleStyle="brand"
        subtitle="Discussion générale"
        avatar={(
          <LinearGradient colors={Gradients.blue} style={styles.headerIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Users color={Colors.pureWhite} size={24} />
          </LinearGradient>
        )}
      />

      {/* ── Pinned message ── */}
      {pinnedMessage && (
        <View style={styles.pinnedBar}>
          <Pin color="#FF9F1C" size={20} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedBarLabel}>Message épinglé</Text>
            <Text style={styles.pinnedBarText} numberOfLines={1}>{pinnedMessage.contenu}</Text>
          </View>
        </View>
      )}

      {/* ── Forum locked banner ── */}
      {locked && (
        <View style={styles.lockedBanner}>
          <Lock color="#F87171" size={14} />
          <Text style={styles.lockedText}>Forum verrouillé — Lecture seule</Text>
        </View>
      )}

      {/* ── Messages ── */}
      {forumError ? (
        <ConnectionErrorState onRetry={loadForum} fullscreen />
      ) : forumLoading || loading || !discussionId ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.goldText} size="large" />
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
      tintColor={Colors.primaryGreen}
      colors={[Colors.primaryGreen]}
      progressBackgroundColor={Colors.cardBg}
    />
  }
renderSectionHeader={({ section }) => <DateSeparator label={section.title} />}
          renderItem={({ item }) => (
            <ChatMessage item={item} currentUserId={currentUserId} onImagePress={setPreviewUri} />
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Aucun message. Soyez le premier à écrire !</Text>
            </View>
          )}
        />
      )}

      {/* ── Input ── */}
      {locked ? (
        <View style={styles.lockedInputRow}>
          <Lock color={Colors.textSecondary} size={14} />
          <Text style={styles.lockedInputText}>Le forum est verrouillé par un administrateur</Text>
        </View>
      ) : (
        <ChatInputBar
          text={text}
          onChangeText={setText}
          onSendText={handleSendText}
          onSendFile={sendFile}
          onSendSticker={sendSticker}
          sending={sending}
          audio={audio}
          allowStickers={false}
          placeholder="Message au forum"
        />
      )}

      <ImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },

  headerIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: pick('#1C1A1F', '#FFF6E5'),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,159,28,0.3)',
  },
  pinnedBarLabel: { color: pick('#FF9F1C', '#B86B00'), fontFamily: Font.bodyBold, fontSize: 13 },
  pinnedBarText: { color: Colors.chrome, fontFamily: Font.body, fontSize: 15, marginTop: 1 },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(248,113,113,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  lockedText: { color: pick('#FF8A8A', '#D93A3F'), fontFamily: Font.bodySemiBold, fontSize: 13 },

  msgList: { padding: 16, gap: 6, paddingBottom: 8 },

  lockedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: pick('rgba(8,16,44,0.96)', 'rgba(255,255,255,0.97)'),
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  lockedInputText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, fontStyle: 'italic' },
});
