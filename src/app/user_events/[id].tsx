import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MapPin, Calendar, Share2, Trophy, Users } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import Share, { Social } from '@/components/Share';
import { OrbitStar } from '@/components/orbit';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWideWeb } from '@/hooks/useWideWeb';
import { Categorie } from '@/data_api/models/categorie.types';
import { Evenement } from '@/data_api/models/evenement.types';
import { getApiErrorMessage } from '@/data_api/lib/logger';
import { categorieService } from '@/data_api/services/categorieService';
import { evenementService } from '@/data_api/services/evenementService';
import { useFileUrl } from '@/hooks/useFileUrl';
import GreenButton from '@/components/ui/GreenButton';
import GlassCard from '@/components/ui/GlassCard';

function formatEventDate(dateDebut: string, dateFin: string): string {
  try {
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    if (start.toDateString() === end.toDateString()) return fmt(start);
    return `${fmt(start)} - ${fmt(end)}`;
  } catch {
    return '';
  }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Evenement | null>(null);
  const [category, setCategory] = useState<Categorie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);

  const heroUri = useFileUrl('events', event?.coverImage);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    evenementService
      .getById(id)
      .then((data) => {
        setEvent(data);
        if (data.categorieId) {
          categorieService.getById(data.categorieId).then(setCategory).catch(() => {});
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  /**
   * Télécharge l'image de couverture en local (WhatsApp exige un fichier
   * local, pas une URL http distante) puis ouvre WhatsApp avec l'image,
   * le titre et la description. Il ne reste plus qu'à choisir le contact.
   */
  const wide = useWideWeb();
  const insets = useSafeAreaInsets();

  const handleShareWhatsApp = async () => {
    if (!event) return;
    setSharing(true);
    try {
      const message = `${event.titre}\n\n${event.description}`;
      let localImageUri: string | undefined;

      if (heroUri && Platform.OS !== 'web') {
        const fileName = heroUri.split('/').pop() || `event_${event.trackingId}.jpg`;
        const dest = `${FileSystem.cacheDirectory}${fileName}`;
        const downloaded = await FileSystem.downloadAsync(heroUri, dest);
        localImageUri = downloaded.uri;
      }

      await Share.shareSingle({
        social: Social.Whatsapp,
        message,
        url: localImageUri, // image jointe (nécessite file:// local)
        title: event.titre,
        
      });
    } catch (err: any) {
      // Si WhatsApp n'est pas installé ou refuse l'appel, on prévient l'utilisateur
      if (err?.message?.includes('not installed') || err?.code === 'NOT_INSTALLED') {
        Alert.alert('WhatsApp introuvable', "WhatsApp n'est pas installé sur cet appareil.");
      } else {
        Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp pour le moment.");
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primaryGreen} size="large" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Événement introuvable.'}</Text>
        <TouchableOpacity style={styles.backBtnInline} onPress={() => router.back()}>
          <Text style={styles.backBtnInlineText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={wide && styles.wideRow}>
        {/* Hero Image */}
        <View style={[styles.heroContainer, wide && styles.heroWide]}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImage} />
          ) : (
            <LinearGradient colors={['#1F4FC4', '#0D1F5C']} style={[styles.heroImage, styles.heroFallback]}>
              <Trophy color="rgba(255,255,255,0.2)" size={140} strokeWidth={1.4} />
            </LinearGradient>
          )}
          <LinearGradient colors={['transparent', Colors.darkBg]} style={styles.heroGrad} />
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 14 }]} onPress={() => router.back()} accessibilityLabel="Retour">
            <ChevronLeft color={Colors.chrome} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.shareBtn, { top: insets.top + 14 }]} onPress={handleShareWhatsApp} disabled={sharing} accessibilityLabel="Partager">
            {sharing ? (
              <ActivityIndicator color={Colors.chrome} size="small" />
            ) : (
              <Share2 color={Colors.chrome} size={20} />
            )}
          </TouchableOpacity>
          <View style={styles.catBadge}>
            <Text style={styles.catText}>{category?.libelle ?? 'Sans catégorie'}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={[styles.content, wide && styles.contentWide]}>
          <Text style={styles.title}>{event.titre}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Calendar color={Colors.blueLight} size={20} />
              </View>
              <View style={styles.metaCopy}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{formatEventDate(event.dateDebut, event.dateFin)}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <MapPin color={Colors.blueLight} size={20} />
              </View>
              <View style={styles.metaCopy}>
                <Text style={styles.metaLabel}>Lieu</Text>
                <Text style={styles.metaValue}>{event.lieu ?? 'Non précisé'}</Text>
              </View>
            </View>
          </View>

          <GlassCard style={styles.descCard}>
            <Text style={styles.descTitle}>À propos de cet événement</Text>
            <Text style={styles.descText}>{event.description}</Text>
          </GlassCard>

          <GlassCard style={styles.infoCard} glow>
            <View style={styles.infoRow}>
              <OrbitStar size={18} />
              <Text style={styles.infoText}>Rejoignez la communauté JM Services</Text>
            </View>
            <View style={styles.infoDivider} />
            <Text style={styles.infoHighlight}>Places limitées — Inscrivez-vous maintenant !</Text>
          </GlassCard>

          <GreenButton
            title="Partager avec un ami"
            onPress={handleShareWhatsApp}
            size="lg"
            variant="outline"
            style={styles.shareOutlineBtn}
            loading={sharing}
          />
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  metaCopy: { flex: 1, minWidth: 0 },
  container: { flex: 1, backgroundColor: Colors.night },
  center: { flex: 1, backgroundColor: Colors.night, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, textAlign: 'center' },
  backBtnInline: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14, backgroundColor: 'rgba(255,194,51,0.1)', borderWidth: 1.5, borderColor: Colors.gold },
  backBtnInlineText: { color: Colors.gold, fontFamily: Font.bodyBold },
  heroContainer: { height: 320, position: 'relative' },
  // website on a computer: picture on the left, details on the right
  wideRow: { flexDirection: 'row', padding: 32, gap: 32, alignItems: 'flex-start' },
  heroWide: { width: '45%', height: 480, borderRadius: 20, overflow: 'hidden' },
  contentWide: { flex: 1, padding: 0, paddingTop: 8 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  backBtn: { position: 'absolute', top: 56, left: 20, width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(6,11,30,0.6)', borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { position: 'absolute', top: 56, right: 20, width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(6,11,30,0.6)', borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  catBadge: { position: 'absolute', bottom: 20, left: 20, backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  catText: { color: Colors.onGold, fontFamily: Font.bodyExtraBold, fontSize: 13 },
  content: { padding: 20, gap: 16 },
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 28, lineHeight: 34, textTransform: 'uppercase' },
  metaRow: { gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(17,28,63,0.9)', borderRadius: 20, padding: 12 },
  metaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(47,123,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  metaLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 12 },
  metaValue: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 15 },
  descCard: { gap: 10 },
  descTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 18, textTransform: 'uppercase', marginBottom: 4 },
  descText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, lineHeight: 23 },
  infoCard: { gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: Colors.chrome, fontFamily: Font.bodySemiBold, fontSize: 15, flex: 1 },
  infoDivider: { height: 1, backgroundColor: Colors.border },
  infoHighlight: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 15 },
  shareOutlineBtn: { width: '100%' },
});