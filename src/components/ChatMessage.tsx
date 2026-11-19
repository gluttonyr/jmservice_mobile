import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { MessageType } from '@/data_api/models/message.types';
import { resolveFileUrl } from '@/hooks/useFileUrl';
import { ArrowDown, ArrowUp, Ban, Check, CheckCheck, Copy, Pin, PinOff, Search, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Clipboard, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { AudioPlayer } from './Audioplayer';
import { ActionSheet, ActionSheetOption } from './actionSheet';
import { ShimmerImage } from './shimerImage';
import { useWideWeb } from '@/hooks/useWideWeb';

type Props = {
  item: any;
  currentUserId: string | undefined;
  onImagePress: (uri: string) => void;
  /** Épinglage/suppression réservés à la modération (ex: forum admin). */
  allowModeration?: boolean;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  /** admin = turquoise theme of the admin space. */
  accent?: 'client' | 'admin';
};

// Détecte les messages générés automatiquement (dépôt/retrait) au format
// "Label : Valeur" ligne par ligne, pour permettre de copier chaque valeur
// individuellement en tapant dessus.
type StructuredLine = { text: string; label?: string; value?: string; copyable: boolean };

// Each sender keeps the same name colour (forum); the team is always blue.
const SENDER_COLORS = ['#FFC233', '#3DDC97', '#FF9F6B', '#B49CFF', '#FF8FCB', '#5AA2FF'];
function senderColor(sender: any): string {
  if (sender?.role === 'ADMIN') return Colors.blueLight;
  const key = String(sender?.trackingId ?? sender?.username ?? '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

// "📤 *Demande de retrait*" → "Demande de retrait".
const requestTitle = (line: string) => line.replace(/[*📤📥]/gu, '').trim();

function parseStructuredLines(content: string): StructuredLine[] | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lines.length < 2) return null;

  const hasStructuredHeader = lines[0].includes('📥') || lines[0].includes('📤');
  const copyableField = /^(?:transaction|type|opérateur|montant|numéro(?: de téléphone)?|téléphone|compte 1xbet|code(?: de retrait| 1xbet)?|référence(?: confirmée| déclarée par le client)?|reference|date de demande|date de traitement)\s*:/i;
  const hasTransactionFields = lines.some((line) => copyableField.test(line.trim()));
  if (!hasStructuredHeader && !hasTransactionFields) return null;

  return lines.map((line, idx) => {
    if (idx === 0 && hasStructuredHeader) {
      return { text: line.replace(/\*/g, ''), copyable: false };
    }
    const match = line.match(/^(.+?)\s*:\s*(.+)$/);
    const shouldCopy = !!match && (hasStructuredHeader || copyableField.test(line.trim()));
    if (!match || !shouldCopy) {
      return { text: line, copyable: false };
    }
    const [, label, value] = match;
    return { text: line, label: label.trim(), value: value.trim(), copyable: true };
  });
}

export function ChatMessage({
  item,
  currentUserId,
  onImagePress,
  allowModeration = false,
  onDelete,
  onPin,
  onUnpin,
  accent = 'client',
}: Props) {
  const admin = accent === 'admin';
  const meBubble = admin ? st.bubbleMeAdmin : st.bubbleMe;
  const otherBubble = admin ? st.bubbleOtherAdmin : st.bubbleOther;
  // Options actuellement affichées dans la bottom-sheet (null = fermée).
  const [sheetOptions, setSheetOptions] = useState<ActionSheetOption[] | null>(null);

  const isMe = item.senderTrackingId === currentUserId;
  const wide = useWideWeb();
  const time = item.dateEnvoi
    ? new Date(item.dateEnvoi).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })
    : new Date(item.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });

  const handleCopy = (value: string) => {
    Clipboard.setString(value);
    Toast.show({ type: 'success', text1: 'Copié !', visibilityTime: 1200 });
  };

  // Modération admin (forum, chat admin...) : peut agir sur les messages des autres.
  const canModerate = allowModeration && !item.isDeleted && (onDelete || onPin || onUnpin);

  // Suppression de son propre message : disponible partout, même sans modération,
  // du moment qu'on a passé `onDelete`. On évite le doublon si `canModerate` gère déjà
  // la suppression (pour ne pas afficher deux fois "Supprimer" dans le menu).
  const canDeleteOwn = isMe && !item.isDeleted && !!onDelete && !canModerate;

  // Copier tout le message : dispo pour tous les messages texte, peu importe l'auteur.
  const canCopyWhole = !item.isDeleted && item.type === MessageType.TEXT && !!item.contenu;

  const canLongPress = canModerate || canDeleteOwn || canCopyWhole;

  const handleLongPress = () => {
    if (!canLongPress) return;
    const options: ActionSheetOption[] = [];

    if (canCopyWhole) {
      options.push({
        key: 'copy',
        text: 'Copier',
        icon: <Copy color={Colors.textSecondary} size={18} />,
        onPress: () => handleCopy(item.contenu),
      });
    }
    if (canModerate) {
      if (onPin && !item.epingle) {
        options.push({
          key: 'pin',
          text: 'Épingler',
          icon: <Pin color={Colors.primaryGreen} size={18} />,
          onPress: () => onPin(item.trackingId),
        });
      }
      if (onUnpin && item.epingle) {
        options.push({
          key: 'unpin',
          text: 'Désépingler',
          icon: <PinOff color={Colors.textSecondary} size={18} />,
          onPress: () => onUnpin(item.trackingId),
        });
      }
      if (onDelete) {
        options.push({
          key: 'delete',
          text: 'Supprimer',
          style: 'destructive',
          icon: <Trash2 color="#ef4444" size={18} />,
          onPress: () => onDelete(item.trackingId),
        });
      }
    } else if (canDeleteOwn) {
      options.push({
        key: 'delete',
        text: 'Supprimer',
        style: 'destructive',
        icon: <Trash2 color="#ef4444" size={18} />,
        onPress: () => onDelete!(item.trackingId),
      });
    }

    options.push({ key: 'cancel', text: 'Annuler', style: 'cancel' });
    setSheetOptions(options);
  };

  const pinBadge = item.epingle ? (
    <View style={st.pinBadge}>
      <Pin color="#F59E0B" size={10} />
      <Text style={st.pinBadgeText}>Épinglé</Text>
    </View>
  ) : null;

  // On construit le contenu propre à chaque type de message dans une variable,
  // puis on rend UNE SEULE fois le <ActionSheet> à la fin (commun à tous les types).
  let content: React.ReactNode;

  if (item.isDeleted) {
    // ── Message supprimé ──
    content = (
      <View style={[st.msgRow, wide && st.msgRowWide, isMe ? st.msgRowMe : st.msgRowOther]}>
        <View style={st.deletedPill}>
          <Ban color={Colors.textSecondary} size={16} />
          <Text style={st.deletedText}>Message supprimé</Text>
        </View>
      </View>
    );
  } else if (item.type === MessageType.STICKER) {
    // ── Sticker ── (contenu = nom de fichier du sticker, dossier "stickers", pas "messages")
    const stickerUri = resolveFileUrl('stickers', item.contenu);
    content = (
      <TouchableOpacity
        activeOpacity={canLongPress ? 0.7 : 1}
        onLongPress={handleLongPress}
        style={[st.msgRow, wide && st.msgRowWide, isMe ? st.msgRowMe : st.msgRowOther]}
      >
        {pinBadge}
        <Image source={{ uri: stickerUri }} style={st.stickerMsg} resizeMode="contain" />
        <Text style={[st.msgTime, isMe && st.msgTimeMe, { marginTop: 2 }]}>{time}</Text>
      </TouchableOpacity>
    );
  } else if (item.type === MessageType.IMAGE) {
    // ── Image ──
    const imageUri = resolveFileUrl('messages', item.file ?? item.contenu);
    content = (
      <View style={[st.msgRow, wide && st.msgRowWide, isMe ? st.msgRowMe : st.msgRowOther]}>
        {pinBadge}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onImagePress(imageUri)}
          onLongPress={handleLongPress}
        >
          <View style={[st.imgWrap, isMe ? st.imgWrapMe : st.imgWrapOther]}>
            <ShimmerImage source={{ uri: imageUri }} style={st.imageMsg} resizeMode="cover" />
            <View style={st.imgZoomHint}>
              <Search color="#fff" size={16} />
            </View>
          </View>
        </TouchableOpacity>
        <View style={[st.msgMeta, { alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 4 }]}>
          <Text style={[st.msgTime, isMe && st.msgTimeMe]}>{time}</Text>
          {isMe &&
            (item.lu ? (
              <CheckCheck color={Colors.blueLight} size={14} />
            ) : (
              <Check color={Colors.textSecondary} size={14} />
            ))}
        </View>
      </View>
    );
  } else if (item.type === MessageType.AUDIO) {
    // ── Audio ──
    const audioUri = resolveFileUrl('messages', item.file ?? item.contenu);
    content = (
      <TouchableOpacity
        activeOpacity={canLongPress ? 0.85 : 1}
        onLongPress={handleLongPress}
        style={[st.msgRow, wide && st.msgRowWide, isMe ? st.msgRowMe : st.msgRowOther]}
      >
        {pinBadge}
        <View style={[st.bubble, isMe ? meBubble : otherBubble]}>
          <AudioPlayer uri={audioUri} isMe={isMe} />
          <View style={st.msgMeta}>
            <Text style={[st.msgTime, isMe && st.msgTimeMe]}>{time}</Text>
            {isMe &&
              (item.lu ? (
                <CheckCheck color={Colors.pureWhite} size={14} />
              ) : (
                <Check color={Colors.textSecondary} size={14} />
              ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  } else {
    // ── Texte (défaut) ──
    const structured = parseStructuredLines(item.contenu);
    const isRequestCard = !!structured && /^\s*(📤|📥)/u.test(item.contenu);
    const readMark = isMe && (item.lu
      ? <CheckCheck color={isRequestCard ? Colors.blueLight : Colors.pureWhite} size={14} />
      : <Check color={isRequestCard ? Colors.textSecondary : 'rgba(255,255,255,0.7)'} size={14} />);

    if (structured && isRequestCard) {
      // Deposit / withdrawal request sent from the flow: a card with one copyable pill per field.
      const [header, ...fields] = structured;
      const withdrawal = item.contenu.includes('📤');
      content = (
        <TouchableOpacity
          activeOpacity={canLongPress ? 0.85 : 1}
          onLongPress={handleLongPress}
          style={[st.msgRow, st.msgRowCard, wide && st.msgRowWide, isMe ? st.msgRowMe : st.msgRowOther]}
        >
          {pinBadge}
          <View style={[st.requestCard, admin && st.requestCardAdmin]}>
            <View style={st.requestHeader}>
              <View style={st.requestIcon}>
                {withdrawal
                  ? <ArrowUp color={Colors.onGold} size={18} strokeWidth={2.6} />
                  : <ArrowDown color={Colors.onGold} size={18} strokeWidth={2.6} />}
              </View>
              <Text style={st.requestTitle} numberOfLines={1}>{requestTitle(header.text)}</Text>
            </View>
            <View style={st.requestBody}>
              {fields.map((line, idx) =>
                line.copyable ? (
                  <TouchableOpacity key={idx} onPress={() => handleCopy(line.value!)} activeOpacity={0.6} style={st.requestField}>
                    <Text style={st.requestLabel} numberOfLines={1}>{line.label}</Text>
                    <Text style={st.requestValue} numberOfLines={1}>{line.value}</Text>
                    <Copy color={Colors.blueLight} size={16} />
                  </TouchableOpacity>
                ) : line.text.trim() ? (
                  <Text key={idx} style={[st.msgText, st.msgTextOther]}>{line.text}</Text>
                ) : null,
              )}
              <View style={st.msgMeta}>
                <Text style={st.msgTime}>{time}</Text>
                {readMark}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    } else content = (
      <TouchableOpacity
        activeOpacity={canLongPress ? 0.85 : 1}
        onLongPress={handleLongPress}
        style={[st.msgRow, wide && st.msgRowWide, isMe ? st.msgRowMe : st.msgRowOther]}
      >
        {pinBadge}
        <View style={[st.bubble, isMe ? meBubble : otherBubble]}>
          {!isMe && item.sender?.username && (
            <Text style={[st.senderName, { color: senderColor(item.sender) }]}>{item.sender.nom} {item.sender.prenom}</Text>
          )}
          {structured ? (
            <View>
              {structured.map((line, idx) =>
                line.copyable ? (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleCopy(line.value!)}
                    activeOpacity={0.6}
                    style={st.fieldRow}
                  >
                    <Text style={[st.msgText, isMe ? st.msgTextMe : st.msgTextOther]}>
                      {line.text}
                    </Text>
                    <Copy
                      color={isMe ? 'rgba(255,255,255,0.75)' : Colors.textSecondary}
                      size={13}
                      style={{ marginLeft: 6, flexShrink: 0 }}
                    />
                  </TouchableOpacity>
                ) : (
                  <Text
                    key={idx}
                    style={[st.msgText, isMe ? st.msgTextMe : st.msgTextOther, st.msgTitleLine]}
                  >
                    {line.text}
                  </Text>
                )
              )}
            </View>
          ) : (
            <Text style={[st.msgText, isMe ? st.msgTextMe : st.msgTextOther]}>
              {item.contenu}
            </Text>
          )}
          <View style={st.msgMeta}>
            <Text style={[st.msgTime, isMe && st.msgTimeMe]}>{time}</Text>
            {readMark}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ActionSheet commun à TOUS les types de message ci-dessus.
  return (
    <>
      {content}
      <ActionSheet
        visible={!!sheetOptions}
        onClose={() => setSheetOptions(null)}
        title="Message"
        options={sheetOptions ?? []}
      />
    </>
  );
}

const st = StyleSheet.create({
  msgRow: { alignSelf: 'flex-start', maxWidth: '80%', marginBottom: 6 },
  // the request card is wider, as in the design
  msgRowCard: { maxWidth: '88%', minWidth: '72%' },
  // website on a computer: 80% of a wide chat is too long to read
  msgRowWide: { maxWidth: 560 },
  msgRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  senderName: { fontFamily: Font.bodyBold, fontSize: 13, lineHeight: 17, marginBottom: 3 },

  pinBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  pinBadgeText: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 11, lineHeight: 14, marginLeft: 3 },

  bubble: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10 },
  bubbleMe: { backgroundColor: Colors.blue, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: '#16224D', borderBottomLeftRadius: 6 },
  bubbleMeAdmin: { backgroundColor: '#0F7C83', borderBottomRightRadius: 6 },
  bubbleOtherAdmin: { backgroundColor: '#13262E', borderBottomLeftRadius: 6 },

  msgText: { fontFamily: Font.body, fontSize: 15, lineHeight: 21 },
  msgTextMe: { color: Colors.pureWhite },
  msgTextOther: { color: Colors.chrome },
  msgTitleLine: { fontFamily: Font.bodyBold, fontSize: 15, lineHeight: 22, marginBottom: 3 },

  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },

  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 5 },
  msgTime: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 11, lineHeight: 14 },
  msgTimeMe: { color: 'rgba(255,255,255,0.8)' },

  deletedPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#16224D', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  deletedText: { color: Colors.textSecondary, fontFamily: Font.body, fontStyle: 'italic', fontSize: 14 },

  requestCard: { width: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,194,51,0.45)', backgroundColor: '#111C3F' },
  requestCardAdmin: { backgroundColor: '#10262D' },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: 'rgba(255,194,51,0.1)' },
  requestIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  requestTitle: { flex: 1, color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 16 },
  requestBody: { padding: 12, gap: 8 },
  requestField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.night, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  requestLabel: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, flexShrink: 0, maxWidth: '45%' },
  requestValue: { flex: 1, color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 14, textAlign: 'right' },

  imgWrap: { borderRadius: 18, overflow: 'hidden', position: 'relative', borderWidth: 4 },
  imgWrapMe: { borderColor: Colors.blue },
  imgWrapOther: { borderColor: '#16224D' },
  imageMsg: { width: 220, height: 160 },
  imgZoomHint: {
    position: 'absolute', bottom: 8, right: 8, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(6,11,30,0.7)', alignItems: 'center', justifyContent: 'center',
  },

  stickerMsg: { width: 100, height: 100 },
});
