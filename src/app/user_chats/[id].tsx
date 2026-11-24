import { ChatInputBar } from '@/components/ChatinputBar';
import { ChatMessage } from '@/components/ChatMessage';
import { DateSeparator } from '@/components/dateSeparator';
import { HistoryLoader } from '@/components/historyLoader';
import { ImagePreviewModal } from '@/components/ImagePreviewModel';
import { ChatBackground } from '@/components/ChatBackground';

import { ChatHeader } from '@/components/orbit';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useChat } from '@/hooks/useChat';
import { useChatSections } from '@/hooks/useChatSection';

import { useDiscussionPresence } from '@/hooks/useDiscussionPresence';
import { router, useLocalSearchParams } from 'expo-router';
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

export default function ChatDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { messages, loading, sending, sendText, sendFile, sendSticker, currentUserId, deleteMessage,loadMoreHistory,
    loadingMore,
    hasMoreHistory, } = useChat(id);

  const [text, setText] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const listRef = useRef<SectionList>(null);
  const audio = useAudioRecorder();
  const adminPresent = useDiscussionPresence(id);

  // Messages groupés par jour : [{ title: "Aujourd'hui", data: [...] }, ...]
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
      } catch {
        // liste pas encore mesurée / vide : on ignore silencieusement
      }
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
  const insets = useSafeAreaInsets();



  return (
    <KeyboardAvoidingView
      style={st.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ChatBackground variant="default" />
      {/* Header */}
      {/* Presence ("en ligne") stays hidden, as in Matistore. */}
      <ChatHeader
        title={name || 'Support'}
        subtitle="Équipe JM Services"
        subtitleColor={Colors.success}
        onBack={() => router.back()}
        avatar={<View style={st.avatar}><JMLogo size={36} /></View>}
      />

      {/* Messages */}
      {loading ? (
        <View style={st.loader}>
          <ActivityIndicator color={Colors.goldText} size="large" />
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
              <Text style={st.emptyText}>Aucun message. Commencez la conversation !</Text>
            </View>
          )}
        />
      )}

      {/* Input bar (avec attach, mic, sticker, send) */}
      <ChatInputBar
        text={text}
        onChangeText={setText}
        onSendText={handleSendText}
        onSendFile={sendFile}
        onSendSticker={sendSticker}
        sending={sending}
        audio={audio}
        allowStickers={false}
      />

      {/* Image preview modal */}
      <ImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} />
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.navy, borderWidth: 2,
    borderColor: 'rgba(90,162,255,0.4)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },

  msgList: { padding: 16, gap: 6, paddingBottom: 8 },
});
