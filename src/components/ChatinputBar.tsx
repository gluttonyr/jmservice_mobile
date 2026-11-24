import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { MessageType } from '@/data_api/models/message.types';
import { Sticker } from '@/data_api/models/sticker.types';
import * as ImagePicker from 'expo-image-picker';
import {
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Smile,
  StopCircle,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import EmojiPicker, { type EmojiType } from 'rn-emoji-keyboard';

import { StickerPicker } from './StickerPicker';
import { AudioHook } from '@/hooks/useAudioRecorder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  text: string;
  onChangeText: (v: string) => void;
  onSendText: () => void;
  onSendFile: (file: { uri: string; name: string; type: string }, type: MessageType) => Promise<void>;
  onSendSticker: (stickerImage: string) => void;
  sending: boolean;
  audio: AudioHook;
  /** Les stickers ne sont pour l'instant disponibles que côté admin. */
  allowStickers?: boolean;
  placeholder?: string;
  /** admin = turquoise theme of the admin space. */
  accent?: 'client' | 'admin';
};

export function ChatInputBar({
  text,
  onChangeText,
  onSendText,
  onSendFile,
  onSendSticker,
  sending,
  audio,
  allowStickers = true,
  placeholder = 'Message',
  accent = 'client',
}: Props) {
  const admin = accent === 'admin';
  const btnIcon = admin ? Colors.adminBg : Colors.pureWhite;
  const [showStickers, setShowStickers] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const insets = useSafeAreaInsets();

  const fmtDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const handlePickImage = () => {
  setShowAttachMenu(false);
  Alert.alert(
    'Envoyer une image',
    'Comment voulez-vous ajouter votre image ?',
    [
      { text: 'Prendre une photo', onPress: () => captureAndSendImage() },
      { text: 'Choisir dans la galerie', onPress: () => pickAndSendImageFromGallery() },
      { text: 'Annuler', style: 'cancel' },
    ],
  );
};

const captureAndSendImage = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Veuillez autoriser l'accès à la caméra.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const extension = mimeType.split('/')[1] ?? 'jpg';
    await onSendFile(
      {
        uri: asset.uri,
        name: asset.fileName ?? `img_${Date.now()}.${extension}`,
        type: mimeType,
      },
      MessageType.IMAGE,
    );
  } catch (e) {
    console.error('Camera capture error:', e);
    Alert.alert('Erreur', "Impossible de prendre la photo.");
  }
};

const pickAndSendImageFromGallery = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const extension = mimeType.split('/')[1] ?? 'jpg';
    await onSendFile(
      {
        uri: asset.uri,
        name: asset.fileName ?? `img_${Date.now()}.${extension}`,
        type: mimeType,
      },
      MessageType.IMAGE,
    );
  } catch (e) {
    console.error('Image upload error:', e);
    Alert.alert('Erreur', "Impossible de charger l'image.");
  }
};

  const handleMicPress = async () => {
    if (!audio.isAvailable) {
      Alert.alert(
        'Module audio indisponible',
        "Lancez un prebuild Expo pour activer l'audio :\nnpx expo prebuild\nnpx expo run:android",
      );
      return;
    }
    if (audio.isRecording) {
      const result = await audio.stopRecording();
      if (!result) return;
      await onSendFile(
        { uri: result.uri, name: `audio_${Date.now()}.m4a`, type: 'audio/m4a' },
        MessageType.AUDIO,
      );
    } else {
      await audio.startRecording();
    }
  };

  const handleStickerSelect = (sticker: Sticker) => {
    if (!sticker.image) return;
    onSendSticker(sticker.image);
  };

  const handleEmojiSelected = (emojiObject: EmojiType) => {
    onChangeText(text + emojiObject.emoji);
  };

  return (
    <>
      {/* Recording bar */}
      {audio.isRecording && (
        <View style={st.recordingBar}>
          <View style={st.recordingDot} />
          <Text style={st.recordingText}>
            Enregistrement... {fmtDuration(audio.recordingDuration)}
          </Text>
          <TouchableOpacity onPress={audio.cancelRecording} style={{ padding: 4 }}>
            <X color={Colors.textSecondary} size={18} />
          </TouchableOpacity>
        </View>
      )}

      {/* Attach menu */}
      {showAttachMenu && (
        <View style={st.attachMenu}>
          <TouchableOpacity style={st.attachOption} onPress={handlePickImage}>
            <View style={st.attachIcon}>
              <ImageIcon color={Colors.blueLight} size={22} />
            </View>
            <Text style={st.attachLabel}>Image</Text>
          </TouchableOpacity>
          {allowStickers && (
            <TouchableOpacity
              style={st.attachOption}
              onPress={() => { setShowAttachMenu(false); setShowStickers(true); }}
            >
              <View style={st.attachIcon}>
                <Smile color="#f59e0b" size={22} />
              </View>
              <Text style={st.attachLabel}>Sticker</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input bar: emoji, text and attachment in one field; the round button records when empty, sends otherwise. */}
      <View style={[st.inputContainer, admin && st.inputContainerAdmin, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={[st.field, admin && st.fieldAdmin]}>
          <TouchableOpacity
            style={st.iconBtn}
            onPress={() => {
              setShowAttachMenu(false);
              setShowStickers(false);
              setShowEmojiPicker(true);
            }}
            accessibilityLabel="Emojis"
          >
            <Smile color={showEmojiPicker ? Colors.gold : Colors.textSecondary} size={22} />
          </TouchableOpacity>

          <TextInput
            style={st.textInput}
            placeholder={placeholder}
            placeholderTextColor={Colors.textSecondary}
            value={text}
            onChangeText={onChangeText}
            multiline
            // Web: a textarea defaults to two rows; one row keeps the text level with the icons.
            {...(Platform.OS === 'web' ? { numberOfLines: 1 } : {})}
            maxLength={2000}
            onFocus={() => {
              setShowAttachMenu(false);
              setShowStickers(false);
              setShowEmojiPicker(false);
            }}
          />

          <TouchableOpacity
            style={st.iconBtn}
            onPress={() => {
              setShowAttachMenu((v) => !v);
              setShowStickers(false);
              setShowEmojiPicker(false);
            }}
            accessibilityLabel="Joindre une image"
          >
            <Paperclip color={showAttachMenu ? Colors.gold : Colors.textSecondary} size={21} />
          </TouchableOpacity>
        </View>

        {sending ? (
          <View style={[st.roundBtn, admin && st.roundBtnAdmin]}>
            <ActivityIndicator color={btnIcon} size="small" />
          </View>
        ) : text.trim() ? (
          <TouchableOpacity style={[st.roundBtn, admin && st.roundBtnAdmin]} onPress={onSendText} accessibilityLabel="Envoyer">
            <Send color={btnIcon} size={20} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.roundBtn, admin && st.roundBtnAdmin, audio.isRecording && st.roundBtnRecording, !audio.isAvailable && st.roundBtnOff]}
            onPress={handleMicPress}
            accessibilityLabel={audio.isRecording ? 'Arrêter et envoyer le message vocal' : 'Message vocal'}
          >
            {audio.isRecording
              ? <StopCircle color={audio.isRecording ? Colors.pureWhite : btnIcon} size={24} />
              : <Mic color={btnIcon} size={22} />}
          </TouchableOpacity>
        )}
      </View>

      {/* Sticker picker (réservé à allowStickers, accessible via le trombone) */}
      {allowStickers && (
        <StickerPicker
          visible={showStickers}
          onSelect={handleStickerSelect}
          onClose={() => setShowStickers(false)}
        />
      )}

      {/* Emoji picker style WhatsApp, toujours dispo */}
      <EmojiPicker
        onEmojiSelected={handleEmojiSelected}
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
      />
    </>
  );
}

const st = StyleSheet.create({
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.secondaryBg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recordingText: { flex: 1, color: Colors.chrome, fontFamily: Font.bodyMedium, fontSize: 14 },

  attachMenu: {
    flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.secondaryBg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  attachOption: { alignItems: 'center', gap: 6 },
  attachIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  attachLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 12 },

 inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: pick('rgba(8,16,44,0.96)', 'rgba(255,255,255,0.97)'),
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: pick('#111C3F', '#FFFFFF'),
    borderWidth: 1,
    borderColor: pick('rgba(120,150,230,0.2)', 'rgba(40,70,150,0.16)'),
    paddingHorizontal: 6,
  },
  iconBtn: { padding: 10, justifyContent: 'center', alignItems: 'center' },
  textInput: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 15,
    paddingBottom: 15,
    color: Colors.chrome,
    fontFamily: Font.body,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 110,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  roundBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
  },
  roundBtnAdmin: { backgroundColor: Colors.admin },
  inputContainerAdmin: { backgroundColor: 'rgba(6,18,24,0.97)', borderTopColor: Colors.adminBorder },
  fieldAdmin: { backgroundColor: '#10262D', borderColor: 'rgba(120,210,215,0.2)' },
  roundBtnRecording: { backgroundColor: '#E5484D' },
  roundBtnOff: { opacity: 0.55 },
});
