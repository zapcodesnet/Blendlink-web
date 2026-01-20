import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Define translations for all supported languages
const resources = {
  en: {
    translation: {
      // Common
      "app_name": "Blendlink",
      "loading": "Loading...",
      "save": "Save",
      "cancel": "Cancel",
      "confirm": "Confirm",
      "delete": "Delete",
      "edit": "Edit",
      "view": "View",
      "search": "Search",
      "settings": "Settings",
      
      // Navigation
      "nav.home": "Home",
      "nav.marketplace": "Marketplace",
      "nav.feed": "Feed",
      "nav.profile": "Profile",
      "nav.messages": "Messages",
      "nav.wallet": "Wallet",
      
      // Auth
      "auth.login": "Login",
      "auth.signup": "Sign Up",
      "auth.logout": "Logout",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.forgot_password": "Forgot Password?",
      
      // Marketplace
      "marketplace.title": "Marketplace",
      "marketplace.browse": "Browse Items",
      "marketplace.sell": "Sell Item",
      "marketplace.buy_now": "Buy Now",
      "marketplace.add_to_cart": "Add to Cart",
      "marketplace.price": "Price",
      "marketplace.condition": "Condition",
      "marketplace.shipping": "Shipping",
      
      // Feed
      "feed.title": "Social Feed",
      "feed.new_post": "Create Post",
      "feed.like": "Like",
      "feed.comment": "Comment",
      "feed.share": "Share",
      
      // Language selector
      "language.select": "Select Language",
      "language.auto_detected": "Auto-detected",
    }
  },
  es: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Cargando...",
      "save": "Guardar",
      "cancel": "Cancelar",
      "confirm": "Confirmar",
      "delete": "Eliminar",
      "edit": "Editar",
      "view": "Ver",
      "search": "Buscar",
      "settings": "Configuración",
      "nav.home": "Inicio",
      "nav.marketplace": "Mercado",
      "nav.feed": "Feed",
      "nav.profile": "Perfil",
      "nav.messages": "Mensajes",
      "nav.wallet": "Billetera",
      "auth.login": "Iniciar Sesión",
      "auth.signup": "Registrarse",
      "auth.logout": "Cerrar Sesión",
      "auth.email": "Correo",
      "auth.password": "Contraseña",
      "marketplace.title": "Mercado",
      "marketplace.browse": "Explorar",
      "marketplace.buy_now": "Comprar Ahora",
      "marketplace.add_to_cart": "Añadir al Carrito",
      "marketplace.price": "Precio",
      "feed.title": "Feed Social",
      "language.select": "Seleccionar Idioma",
    }
  },
  fr: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Chargement...",
      "save": "Sauvegarder",
      "cancel": "Annuler",
      "confirm": "Confirmer",
      "delete": "Supprimer",
      "edit": "Modifier",
      "view": "Voir",
      "search": "Rechercher",
      "settings": "Paramètres",
      "nav.home": "Accueil",
      "nav.marketplace": "Marché",
      "nav.feed": "Fil",
      "nav.profile": "Profil",
      "nav.messages": "Messages",
      "nav.wallet": "Portefeuille",
      "auth.login": "Connexion",
      "auth.signup": "S'inscrire",
      "auth.logout": "Déconnexion",
      "marketplace.title": "Marché",
      "marketplace.buy_now": "Acheter",
      "marketplace.add_to_cart": "Ajouter au Panier",
      "language.select": "Choisir la Langue",
    }
  },
  de: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Laden...",
      "save": "Speichern",
      "cancel": "Abbrechen",
      "confirm": "Bestätigen",
      "delete": "Löschen",
      "edit": "Bearbeiten",
      "view": "Ansehen",
      "search": "Suchen",
      "settings": "Einstellungen",
      "nav.home": "Startseite",
      "nav.marketplace": "Marktplatz",
      "nav.feed": "Feed",
      "nav.profile": "Profil",
      "nav.messages": "Nachrichten",
      "nav.wallet": "Brieftasche",
      "auth.login": "Anmelden",
      "auth.signup": "Registrieren",
      "auth.logout": "Abmelden",
      "marketplace.title": "Marktplatz",
      "marketplace.buy_now": "Jetzt Kaufen",
      "marketplace.add_to_cart": "In den Warenkorb",
      "language.select": "Sprache Wählen",
    }
  },
  nl: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Laden...",
      "save": "Opslaan",
      "cancel": "Annuleren",
      "nav.home": "Home",
      "nav.marketplace": "Marktplaats",
      "auth.login": "Inloggen",
      "auth.signup": "Registreren",
      "marketplace.buy_now": "Nu Kopen",
      "language.select": "Taal Selecteren",
    }
  },
  ar: {
    translation: {
      "app_name": "بليندلينك",
      "loading": "جاري التحميل...",
      "save": "حفظ",
      "cancel": "إلغاء",
      "nav.home": "الرئيسية",
      "nav.marketplace": "السوق",
      "auth.login": "تسجيل الدخول",
      "auth.signup": "إنشاء حساب",
      "marketplace.buy_now": "اشتري الآن",
      "language.select": "اختر اللغة",
    }
  },
  "zh-CN": {
    translation: {
      "app_name": "Blendlink",
      "loading": "加载中...",
      "save": "保存",
      "cancel": "取消",
      "nav.home": "首页",
      "nav.marketplace": "市场",
      "auth.login": "登录",
      "auth.signup": "注册",
      "marketplace.buy_now": "立即购买",
      "language.select": "选择语言",
    }
  },
  ja: {
    translation: {
      "app_name": "Blendlink",
      "loading": "読み込み中...",
      "save": "保存",
      "cancel": "キャンセル",
      "nav.home": "ホーム",
      "nav.marketplace": "マーケット",
      "auth.login": "ログイン",
      "auth.signup": "新規登録",
      "marketplace.buy_now": "今すぐ購入",
      "language.select": "言語を選択",
    }
  },
  ko: {
    translation: {
      "app_name": "Blendlink",
      "loading": "로딩 중...",
      "save": "저장",
      "cancel": "취소",
      "nav.home": "홈",
      "nav.marketplace": "마켓",
      "auth.login": "로그인",
      "auth.signup": "회원가입",
      "marketplace.buy_now": "지금 구매",
      "language.select": "언어 선택",
    }
  },
  ru: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Загрузка...",
      "save": "Сохранить",
      "cancel": "Отмена",
      "nav.home": "Главная",
      "nav.marketplace": "Маркет",
      "auth.login": "Войти",
      "auth.signup": "Регистрация",
      "marketplace.buy_now": "Купить",
      "language.select": "Выбрать Язык",
    }
  },
  pt: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Carregando...",
      "save": "Salvar",
      "cancel": "Cancelar",
      "nav.home": "Início",
      "nav.marketplace": "Mercado",
      "auth.login": "Entrar",
      "auth.signup": "Cadastrar",
      "marketplace.buy_now": "Comprar Agora",
      "language.select": "Selecionar Idioma",
    }
  },
  it: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Caricamento...",
      "save": "Salva",
      "cancel": "Annulla",
      "nav.home": "Home",
      "nav.marketplace": "Mercato",
      "auth.login": "Accedi",
      "auth.signup": "Registrati",
      "marketplace.buy_now": "Acquista Ora",
      "language.select": "Seleziona Lingua",
    }
  },
};

// List of all supported languages with names
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "ar", name: "العربية", flag: "🇸🇦", rtl: true },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "no", name: "Norsk", flag: "🇳🇴" },
  { code: "da", name: "Dansk", flag: "🇩🇰" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
  { code: "cs", name: "Čeština", flag: "🇨🇿" },
  { code: "el", name: "Ελληνικά", flag: "🇬🇷" },
  { code: "hu", name: "Magyar", flag: "🇭🇺" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "sr", name: "Српски", flag: "🇷🇸" },
  { code: "bg", name: "Български", flag: "🇧🇬" },
  { code: "hr", name: "Hrvatski", flag: "🇭🇷" },
  { code: "sk", name: "Slovenčina", flag: "🇸🇰" },
  { code: "lt", name: "Lietuvių", flag: "🇱🇹" },
  { code: "lv", name: "Latviešu", flag: "🇱🇻" },
  { code: "et", name: "Eesti", flag: "🇪🇪" },
  { code: "sl", name: "Slovenščina", flag: "🇸🇮" },
  { code: "fi", name: "Suomi", flag: "🇫🇮" },
  { code: "lb", name: "Lëtzebuergesch", flag: "🇱🇺" },
  { code: "mt", name: "Malti", flag: "🇲🇹" },
  { code: "is", name: "Íslenska", flag: "🇮🇸" },
  { code: "sq", name: "Shqip", flag: "🇦🇱" },
  { code: "mk", name: "Македонски", flag: "🇲🇰" },
  { code: "bs", name: "Bosanski", flag: "🇧🇦" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "zh-CN", name: "中文 (简体)", flag: "🇨🇳" },
  { code: "zh-HK", name: "中文 (粵語)", flag: "🇭🇰" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "tl", name: "Filipino", flag: "🇵🇭" },
  { code: "ms", name: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "he", name: "עברית", flag: "🇮🇱", rtl: true },
  { code: "ur", name: "اردو", flag: "🇵🇰", rtl: true },
  { code: "bn", name: "বাংলা", flag: "🇧🇩" },
  { code: "mn", name: "Монгол", flag: "🇲🇳" },
  { code: "ne", name: "नेपाली", flag: "🇳🇵" },
  { code: "si", name: "සිංහල", flag: "🇱🇰" },
  { code: "af", name: "Afrikaans", flag: "🇿🇦" },
];

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'blendlink_language',
    },
    
    interpolation: {
      escapeValue: false
    },
    
    react: {
      useSuspense: false
    }
  });

export default i18n;
