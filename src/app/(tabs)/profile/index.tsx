import { OrbitBackground } from '@/components/orbit';
import { Colors, Gradients, pick, theme, setThemePreference, CardShadow } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User as UserModel, UserRole } from '@/data_api/models/user.types';
import { userService } from '@/data_api/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { useFileUrl } from '@/hooks/useFileUrl';
import { InstallAppButton } from '@/components/InstallAppButton';
import { SocialLinks } from '@/components/SocialLinks';
import { authStorage } from '@/storage/authStorage';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import {
  Check,
  ChevronRight,
  Edit3,
  ImagePlus,
  LogOut,
  Mail,
  Phone,
  Trash2,
  User,
  X,
  Sun,
  Moon,
} from 'lucide-react-native';
import { InfoModal } from '@/components/infomodal';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

// Account deletion button hidden for now (the server route DELETE /users/me stays available).
const SHOW_DELETE_ACCOUNT = false;

// ─── Avatar initiales ────────────────────────────────────────────────────────
function AvatarInitials({
  prenom,
  nom,
  imageUri,
  onPress,
  disabled,
}: {
  prenom: string;
  nom: string;
  imageUri?: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
  return (
    <TouchableOpacity
      style={styles.avatarContainer}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Modifier la photo de profil"
      hitSlop={8}
    >
      <View style={styles.avatarRing}>
        <LinearGradient
          colors={Gradients.blue}
          style={styles.avatarGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {imageUri
            ? <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            : <Text style={styles.avatarText}>{initials}</Text>}
        </LinearGradient>
      </View>
      <View pointerEvents="none" style={styles.avatarEditButton}>
        <ImagePlus color={Colors.onGold} size={20} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Badge rôle ──────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#FF6B6B',
  VENDEUR: '#FFD93D',
  AFFILIER: '#6BCB77',
  USER: '#5AA2FF',
};

// Readable role names (the API sends codes).
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrateur', VENDEUR: 'Vendeur', AFFILIER: 'Affilié', USER: 'Client' };

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? Colors.primaryGreen;
  return (
    <View style={[styles.roleBadge, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <View style={[styles.roleDot, { backgroundColor: color }]} />
      <Text style={[styles.roleText, { color }]}>{ROLE_LABELS[role] ?? role}</Text>
    </View>
  );
}

// ─── Champ éditable ──────────────────────────────────────────────────────────
interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  editable: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  placeholder?: string;
}

function EditableField({
  label, value, onChange, icon, editable,
  keyboardType = 'default', autoCapitalize = 'words', placeholder,
}: EditableFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldWrapper, editable && styles.fieldWrapperActive]}>
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          keyboardType={keyboardType}
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          selectTextOnFocus={editable}
        />
        {editable && (
          <View style={styles.editingDot} />
        )}
      </View>
    </View>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const profileImageUri = useFileUrl('profiles', user?.image);
  const insets = useSafeAreaInsets();

    // const user = {
    //   nom:"John",
    //   prenom:"Doh",
    //   email:"johndoh@gmail.com",
    //   telephone:"+22890453454",
    //   role:UserRole.USER,
    //   active:true
    // } as UserModel
    // const logout = () => {}

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Account deletion from the app (App Store guideline 5.1.1(v)).
  const deleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await userService.deleteMyAccount();
      Toast.show({ type: 'success', text1: 'Compte supprimé', text2: 'Votre compte et vos données personnelles ont été supprimés.' });
      await logout();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Suppression impossible',
        text2: err?.response?.data?.message ?? 'Vérifiez votre connexion puis réessayez.',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const [prenom, setPrenom] = useState(user?.prenom ?? '');
  const [nom, setNom] = useState(user?.nom ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [telephone, setTelephone] = useState(user?.telephone ?? '');
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const hasChanges =
    prenom !== user?.prenom ||
    nom !== user?.nom ||
    email !== (user?.email ?? '') ||
    telephone !== (user?.telephone ?? '') ||
    pickedImage !== null;

  const handleCancel = () => {
    setPrenom(user?.prenom ?? '');
    setNom(user?.nom ?? '');
    setEmail(user?.email ?? '');
    setTelephone(user?.telephone ?? '');
    setPickedImage(null);
    setIsEditing(false);
  };

  const chooseProfileImage = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission requise', text2: 'Autorisez l’accès à la galerie pour choisir une photo.' });
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        return result.assets[0];
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible d’ouvrir la galerie de photos.' });
    }
    return null;
  };

  const saveProfileImage = async (image: ImagePicker.ImagePickerAsset) => {
    if (!user?.trackingId) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('data', JSON.stringify({}));
      formData.append('file', {
        uri: image.uri,
        name: image.fileName ?? image.uri.split('/').pop() ?? `profile_${Date.now()}.jpg`,
        type: image.mimeType ?? 'image/jpeg',
      } as any);
      const updatedUser = await userService.update(user.trackingId, formData);
      queryClient.setQueryData(['user'], updatedUser);
      await authStorage.setUser(updatedUser);
      Toast.show({ type: 'success', text1: 'Photo mise à jour', text2: 'Votre photo de profil a été enregistrée.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de mettre à jour la photo de profil.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPress = async () => {
    const image = await chooseProfileImage();
    if (!image) return;

    if (isEditing) {
      setPickedImage(image);
      return;
    }
    await saveProfileImage(image);
  };

  const handleSave = async () => {
    if (!user?.trackingId) return;
    // The account signs in with its email or its phone number: at least one must stay.
    const cleanEmail = email.trim();
    const phoneDigits = telephone.replace(/\D/g, '');
    if (!prenom && !nom) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Indiquez au moins votre prénom ou votre nom.' });
      return;
    }
    if (!cleanEmail && !phoneDigits) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Gardez au moins une adresse e-mail ou un numéro de téléphone.' });
      return;
    }
    if (cleanEmail && !cleanEmail.includes('@')) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Adresse email invalide.' });
      return;
    }
    if (phoneDigits && phoneDigits.length < 8) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Numéro de téléphone invalide.' });
      return;
    }
    // A number typed without its country code is a Togo number.
    const cleanPhone = !phoneDigits ? '' : telephone.trim().startsWith('+') ? `+${phoneDigits}` : phoneDigits.length === 8 ? `+228${phoneDigits}` : `+${phoneDigits}`;

    try {
      setLoading(true);
      const profileData = { prenom, nom, email: cleanEmail, telephone: cleanPhone };
      let updateData: FormData | typeof profileData = profileData;
      if (pickedImage) {
        const formData = new FormData();
        formData.append('data', JSON.stringify(profileData));
        const name = pickedImage.fileName ?? pickedImage.uri.split('/').pop() ?? `profile_${Date.now()}.jpg`;
        formData.append('file', {
          uri: pickedImage.uri,
          name,
          type: pickedImage.mimeType ?? 'image/jpeg',
        } as any);
        updateData = formData;
      }
      const updatedUser = await userService.update(user.trackingId, updateData);
      queryClient.setQueryData(['user'], updatedUser);
      await authStorage.setUser(updatedUser);
      setPickedImage(null);
      Toast.show({ type: 'success', text1: 'Profil mis à jour', text2: 'Vos informations ont été enregistrées.' });
      setEmail(updatedUser?.email ?? '');
      setTelephone(updatedUser?.telephone ?? '');
      setIsEditing(false);
    } catch (err: any) {
      // e.g. « Ce numéro de téléphone est déjà utilisé par un autre compte ».
      const message = err?.response?.data?.message;
      Toast.show({ type: 'error', text1: 'Erreur', text2: typeof message === 'string' ? message : 'Impossible de mettre à jour le profil.' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.goldText} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <OrbitBackground orbits={false} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <Text style={styles.pageTitle}>Mon profil</Text>

          {!isEditing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)} activeOpacity={0.8}>
              <Edit3 color={Colors.goldText} size={16} />
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
                <X color={Colors.textSecondary} size={16} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!hasChanges || loading) && styles.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={!hasChanges || loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.onGold} size="small" />
                  : <Check color={Colors.onGold} size={16} />
                }
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Avatar + identité ── */}
        <View style={styles.heroCard}>
          <AvatarInitials
            prenom={prenom}
            nom={nom}
            imageUri={isEditing ? pickedImage?.uri ?? profileImageUri : profileImageUri}
            onPress={() => void handleAvatarPress()}
            disabled={loading}
          />

          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{prenom} {nom}</Text>
            <Text style={styles.heroUsername}>@{user.username ?? user.email?.split('@')[0] ?? ''}</Text>
            <RoleBadge role={user.role} />
          </View>
        </View>

        {/* ── Statut compte ── */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, user.active ? styles.statusActive : styles.statusInactive]}>
            <View style={[styles.statusDot, { backgroundColor: user.active ? Colors.success : '#FF6B6B' }]} />
            <Text style={[styles.statusText, { color: user.active ? Colors.success : '#FF6B6B' }]}>
              {user.active ? 'Compte actif' : 'Compte inactif'}
            </Text>
          </View>
          <Text style={styles.memberSince}>
            Membre depuis {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* ── Section informations ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>

          <EditableField
            label="Prénom"
            value={prenom}
            onChange={setPrenom}
            icon={<User color={isEditing ? Colors.blueLight : Colors.textSecondary} size={17} />}
            editable={isEditing}
            autoCapitalize="words"
          />
          <EditableField
            label="Nom"
            value={nom}
            onChange={setNom}
            icon={<User color={isEditing ? Colors.blueLight : Colors.textSecondary} size={17} />}
            editable={isEditing}
            autoCapitalize="words"
          />
          <EditableField
            label="Email"
            value={email}
            onChange={setEmail}
            icon={<Mail color={isEditing ? Colors.blueLight : Colors.textSecondary} size={17} />}
            editable={isEditing}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={isEditing ? 'votre@email.com' : 'Non renseigné'}
          />
          <EditableField
            label="Téléphone"
            value={telephone}
            onChange={setTelephone}
            icon={<Phone color={isEditing ? Colors.blueLight : Colors.textSecondary} size={17} />}
            editable={isEditing}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder={isEditing ? '+228 90 00 00 00' : 'Non renseigné'}
          />
        </View>

        {/* ── Séparateur ── */}
        <View style={styles.separator} />

        {/* ── Apparence : thème clair (par défaut) ou sombre ── */}
        <View style={styles.themeCard}>
          <Text style={styles.themeTitle}>Apparence</Text>
          <View style={styles.themeSwitch}>
            {([
              { value: 'light', label: 'Clair', Icon: Sun },
              { value: 'dark', label: 'Sombre', Icon: Moon },
            ] as const).map(({ value, label, Icon }) => {
              const active = theme === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                  onPress={() => setThemePreference(value)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Icon color={active ? Colors.onGold : Colors.textSecondary} size={18} />
                  <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Site : installer l'application ── */}
        <InstallAppButton variant="row" style={{ marginBottom: 12 }} />

        {/* ── Déconnexion ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.75}>
          <LogOut color="#FF6B6B" size={18} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
          <ChevronRight color="#FF6B6B" size={16} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* ── Suppression du compte : masquée à la demande de JM Services (mettre SHOW_DELETE_ACCOUNT à true) ── */}
        {SHOW_DELETE_ACCOUNT && (
        <TouchableOpacity
          style={[styles.logoutBtn, styles.deleteAccountBtn]}
          onPress={() => setShowDeleteAccount(true)}
          disabled={deletingAccount}
          activeOpacity={0.75}
        >
          {deletingAccount ? <ActivityIndicator color="#FF6B6B" size="small" /> : <Trash2 color="#FF6B6B" size={18} />}
          <Text style={styles.logoutText}>Supprimer mon compte</Text>
          <ChevronRight color="#FF6B6B" size={16} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        )}
        <SocialLinks variant="contact" />
      </ScrollView>
      <InfoModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        type="warning"
        title="Supprimer votre compte ?"
        message="Votre nom, e-mail, téléphone et photo seront définitivement effacés de votre profil et vous ne pourrez plus vous connecter avec ce compte. L'historique de vos transactions (montants, numéros utilisés, références de paiement) est conservé pour nos obligations légales et comptables. Cette action est irréversible."
        confirmText="Supprimer définitivement"
        onConfirm={() => void deleteAccount()}
        secondaryText="Annuler"
        onSecondary={() => {}}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.night },
  scroll: { flexGrow: 1, paddingBottom: 48 },
  centered: { flex: 1, backgroundColor: Colors.night, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
  pageTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 30, textTransform: 'uppercase' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,194,51,0.1)', borderWidth: 1.5, borderColor: Colors.gold, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText: { color: Colors.goldText, fontFamily: Font.bodyBold, fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cancelBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.gold, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.onGold, fontFamily: Font.bodyExtraBold, fontSize: 14 },

  // Hero
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 18, marginHorizontal: 20, marginBottom: 16, backgroundColor: pick('rgba(17,28,63,0.92)', '#FFFFFF'), borderRadius: 28, borderWidth: 1, borderColor: 'rgba(90,162,255,0.3)', padding: 20 },
  avatarRing: { width: 76, height: 76, borderRadius: 24, padding: 3, backgroundColor: 'rgba(47,123,255,0.18)', borderWidth: 2, borderColor: 'rgba(90,162,255,0.45)' },
  avatarContainer: { position: 'relative' },
  avatarGradient: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 20 },
  avatarEditButton: { position: 'absolute', right: -8, bottom: -8, width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.gold, borderWidth: 3, borderColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.pureWhite, fontFamily: Font.title, fontSize: 26 },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 20 },
  heroUsername: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontFamily: Font.bodyBold, fontSize: 12 },

  // Status
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginBottom: 26 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusActive: { borderColor: 'rgba(61,220,151,0.35)', backgroundColor: 'rgba(61,220,151,0.12)' },
  statusInactive: { borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.1)' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: Font.bodyBold, fontSize: 13 },
  memberSince: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13 },

  // Section
  section: { marginHorizontal: 20, marginBottom: 8, backgroundColor: pick('rgba(17,28,63,0.92)', '#FFFFFF'), borderRadius: 28, borderWidth: 1, borderColor: Colors.border, padding: 18 },
  sectionTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 18, textTransform: 'uppercase', marginBottom: 14 },

  // Champs
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 13, marginBottom: 7 },
  fieldWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.night, borderRadius: 18, borderWidth: 1.5, borderColor: pick('rgba(120,150,230,0.18)', 'rgba(40,70,150,0.16)'), paddingHorizontal: 16 },
  fieldWrapperActive: { borderColor: Colors.blue },
  fieldIcon: { marginRight: 12 },
  fieldInput: { flex: 1, color: Colors.chrome, fontFamily: Font.bodyMedium, fontSize: 16, paddingVertical: 14, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  editingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.blueLight, marginLeft: 6 },

  // Séparateur
  separator: { height: 1, backgroundColor: 'transparent', marginVertical: 10 },

  // Logout
  themeCard: { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, ...CardShadow },
  themeTitle: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16, marginBottom: 12 },
  themeSwitch: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: 16, backgroundColor: Colors.night, borderWidth: 1, borderColor: Colors.border },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12 },
  themeOptionActive: { backgroundColor: Colors.gold },
  themeOptionText: { color: Colors.textSecondary, fontFamily: Font.bodyBold, fontSize: 15 },
  themeOptionTextActive: { color: Colors.onGold },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, backgroundColor: 'rgba(255,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.28)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16 },
  logoutText: { color: pick('#FF7B7B', '#D93A3F'), fontFamily: Font.bodyBold, fontSize: 16 },
  deleteAccountBtn: { marginTop: 12, backgroundColor: 'transparent' },
});
