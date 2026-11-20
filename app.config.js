// Purpose strings shown by iOS before each permission (App Store guideline 5.1.1(ii)):
// each one says what the access is for and gives a concrete example.
const MICROPHONE_PERMISSION =
  "MatiStore utilise le micro uniquement quand vous enregistrez un message vocal dans un chat, par exemple pour expliquer au support un problème de dépôt.";
const CAMERA_PERMISSION =
  "MatiStore utilise l'appareil photo pour prendre une photo à envoyer dans un chat, par exemple le reçu de votre paiement Mobile Money envoyé au support.";
const PHOTOS_PERMISSION =
  "MatiStore accède à vos photos pour joindre une image à un message, par exemple la capture d'écran d'un paiement Mobile Money envoyée au support.";
const SAVE_PHOTOS_PERMISSION =
  "MatiStore enregistre dans vos photos les images que vous choisissez de télécharger depuis un chat, par exemple un reçu envoyé par le support.";

// iOS OAuth client (Google Cloud Console, type "iOS", bundle com.urbain-diligence.matistore-mobile).
// Until it is set, Google sign-in is hidden on iOS: the Google SDK crashes without it.
const GOOGLE_IOS_CLIENT_ID = null;
const googleIosUrlScheme = GOOGLE_IOS_CLIENT_ID
  ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(".apps.googleusercontent.com", "")}`
  : null;

export default ({ config }) => ({
    ...config,
    name: "matistore",
    slug: "matistore",
    icon: "./assets/jm-icon.png",
    // Web build = single-page app (no server pre-render, which would load native modules on the server).
    // Website: its own title and colours (the app name above is still Matistore's, to change with the branding).
    web: {
      ...config.web,
      output: "single",
      favicon: "./assets/jm-icon.png",
      name: "JM Services",
      shortName: "JM Services",
      description: "Dépôts et retraits de paris avec Mobile Money.",
      themeColor: "#060B1E",
      backgroundColor: "#060B1E",
    },


    android: {
      ...config.android,
      package: "com.urbain_diligence.matistore_mobile",
      versionCode: 3,
      permissions: [
        "android.permission.CALL_PHONE",
        "android.permission.READ_PHONE_STATE"
      ],
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/jm-adaptive-icon.png",
        backgroundColor: "#060B1E"
      },
      "googleServicesFile": "./google-services.json"
    },

    ios: {
      ...config.ios,
      icon: "./assets/jm-icon.png",
      bundleIdentifier: "com.urbain-diligence.matistore-mobile",
      googleServicesFile: "./GoogleService-Info.plist",
      appleTeamId: "98Y4TRJU7W",
      usesAppleSignIn: true,
      config: {
        ...config.ios?.config,
        usesNonExemptEncryption: false
      },
      // No LSApplicationQueriesSchemes ("xbet"): the "Ouvrir 1xBet" button is not shown on iOS.
      infoPlist: {
        ...config.ios?.infoPlist
      }
    },

    plugins: [
      "expo-router",
      "expo-asset",
      [
        "expo-audio",
        {
          microphonePermission: MICROPHONE_PERMISSION,
          // Voice messages only play while the app is open: no "audio" background mode (guideline 2.5.4).
          enableBackgroundPlayback: false
        }
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#060B1E",
          image: "./assets/jm-splash.png",
          imageWidth: 220,
          dark: {
            backgroundColor: "#060B1E",
            image: "./assets/jm-splash.png"
          }
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/matistore_push.png", // silhouette blanche sur fond transparent, PNG
          color: "#000000", // ta couleur primaryGreen, utilisée comme fond du badge
          // sounds: ["./assets/notification-sound.wav"], // optionnel
        }
      ],
      "expo-web-browser",
      // Face ID is never used: drop its permission string instead of shipping the English default.
      ["expo-secure-store", { faceIDPermission: false }],
      "expo-apple-authentication",

      googleIosUrlScheme
        ? ["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }]
        : "@react-native-google-signin/google-signin",
      [
        "./plugins/withExternalAppQueries",
        {
          schemes: ["xbet"],
          packages: ["org.xbet.client1"]
        }
      ],
      [
        "expo-media-library",
        {
          granularPermissions: [],
          photosPermission: PHOTOS_PERMISSION,
          savePhotosPermission: SAVE_PHOTOS_PERMISSION
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: PHOTOS_PERMISSION,
          cameraPermission: CAMERA_PERMISSION,
          // Same text as expo-audio: this plugin runs later and would otherwise reset it to the English default.
          microphonePermission: MICROPHONE_PERMISSION
        }
      ],
    ],

    extra: {
      ...config.extra,
      // JM_API_URL overrides it, e.g. JM_API_URL=http://localhost:3000 to work against the local backend.
      // TODO JM Services: replace the Matistore default once the JM Services domain is known.
      apiUrl: process.env.JM_API_URL || "https://admin.jmservices.io",
      // Client Web (type "Application Web" dans Google Cloud Console) : utilisé
      // uniquement sur la plateforme web (Platform.OS === 'web').
      // JM Services Google web client (project "JM Services" in Google Cloud). Also the audience the
      // backend checks (GOOGLE_CLIENT_ID) and the webClientId of the Android app.
      // JM_GOOGLE_WEB_CLIENT_ID overrides it; an empty value hides Google sign-in on the website.
      googleWebClientId: process.env.JM_GOOGLE_WEB_CLIENT_ID ??
        "353560751754-g2s0t3je705b04nk2iq9rfht85l6leb2.apps.googleusercontent.com",
      // Services ID Apple (developer.apple.com) : connexion Apple sur le web uniquement.
      // JM_APPLE_SERVICES_ID overrides it; an empty value hides Apple sign-in on the website.
      appleServicesId: process.env.JM_APPLE_SERVICES_ID ?? "tech.matistore.web",
      // Client Android (type "Android", lié au package + SHA-1 du keystore) :
      // pas référencé directement en JS — Google Play Services le retrouve tout
      // seul via le package + SHA-1 enregistrés côté Google Cloud Console.
      // Gardé ici pour documentation/référence.
      ...(GOOGLE_IOS_CLIENT_ID ? { googleIosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
      googleAndroidClientId:
        "75018713485-sifqq6legg6127vhuendp3a4lf8ot9bf.apps.googleusercontent.com",
      eas: {
        projectId: "79f54627-7516-406b-b03f-af2718d5b85b"
      }

    }
});
