import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Comprehensive translations for all supported languages
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
      "close": "Close",
      "back": "Back",
      "next": "Next",
      "submit": "Submit",
      "clear": "Clear",
      "all": "All",
      "none": "None",
      "more": "More",
      "less": "Less",
      "yes": "Yes",
      "no": "No",
      "or": "or",
      "and": "and",
      
      // Navigation
      "nav.home": "Home",
      "nav.marketplace": "Marketplace",
      "nav.feed": "Feed",
      "nav.profile": "Profile",
      "nav.messages": "Messages",
      "nav.wallet": "Wallet",
      "nav.settings": "Settings",
      "nav.rentals": "Rentals",
      "nav.services": "Services",
      "nav.games": "Games",
      "nav.referrals": "Referrals",
      
      // Auth
      "auth.login": "Login",
      "auth.signup": "Sign Up",
      "auth.logout": "Logout",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.forgot_password": "Forgot Password?",
      "auth.create_account": "Create Account",
      "auth.already_have_account": "Already have an account?",
      "auth.dont_have_account": "Don't have an account?",
      "auth.welcome_back": "Welcome Back",
      "auth.get_started": "Get Started",
      
      // Landing Page
      "landing.hero_title": "Social, Shop, Play &",
      "landing.hero_highlight": "Earn Rewards",
      "landing.hero_subtitle": "Connect with friends, buy & sell items, find rentals, hire services, play games, and earn BL Coins — all in one app.",
      "landing.start_earning": "Start Earning Today",
      "landing.browse_marketplace": "Browse the Marketplace",
      "landing.super_app": "Your All-in-One Super App",
      "landing.recently_viewed": "Recently Viewed",
      "landing.clear_history": "Clear History",
      "landing.featured": "Featured",
      "landing.download_app": "Download the App",
      
      // Marketplace
      "marketplace.title": "Marketplace",
      "marketplace.browse": "Browse Items",
      "marketplace.sell": "Sell Item",
      "marketplace.buy_now": "Buy Now",
      "marketplace.add_to_cart": "Add to Cart",
      "marketplace.price": "Price",
      "marketplace.condition": "Condition",
      "marketplace.shipping": "Shipping",
      "marketplace.new": "New",
      "marketplace.used": "Used",
      "marketplace.like_new": "Like New",
      "marketplace.good": "Good",
      "marketplace.fair": "Fair",
      "marketplace.categories": "Categories",
      "marketplace.filters": "Filters",
      "marketplace.sort_by": "Sort By",
      "marketplace.no_items": "No items found",
      "marketplace.view_details": "View Details",
      "marketplace.seller": "Seller",
      "marketplace.contact_seller": "Contact Seller",
      "marketplace.share_listing": "Share Listing",
      "marketplace.report": "Report",
      
      // Cart & Checkout
      "cart.title": "Shopping Cart",
      "cart.empty": "Your cart is empty",
      "cart.subtotal": "Subtotal",
      "cart.shipping_cost": "Shipping",
      "cart.total": "Total",
      "cart.checkout": "Checkout",
      "cart.continue_shopping": "Continue Shopping",
      "cart.remove": "Remove",
      "cart.quantity": "Quantity",
      "checkout.title": "Checkout",
      "checkout.shipping_address": "Shipping Address",
      "checkout.payment": "Payment",
      "checkout.review": "Review Order",
      "checkout.place_order": "Place Order",
      "checkout.country": "Country",
      "checkout.state": "State/Province",
      "checkout.city": "City",
      "checkout.zip": "ZIP/Postal Code",
      "checkout.street": "Street Address",
      
      // Feed
      "feed.title": "Social Feed",
      "feed.new_post": "Create Post",
      "feed.like": "Like",
      "feed.comment": "Comment",
      "feed.share": "Share",
      "feed.whats_on_mind": "What's on your mind?",
      "feed.post": "Post",
      "feed.comments": "Comments",
      "feed.likes": "Likes",
      "feed.shares": "Shares",
      
      // Profile
      "profile.edit": "Edit Profile",
      "profile.followers": "Followers",
      "profile.following": "Following",
      "profile.posts": "Posts",
      "profile.listings": "Listings",
      "profile.about": "About",
      "profile.joined": "Joined",
      
      // Wallet & Earnings
      "wallet.balance": "Balance",
      "wallet.bl_coins": "BL Coins",
      "wallet.earnings": "Earnings",
      "wallet.withdraw": "Withdraw",
      "wallet.history": "Transaction History",
      "wallet.claim_daily": "Claim Daily Bonus",
      "wallet.referral_bonus": "Referral Bonus",
      
      // Seller Dashboard
      "seller.dashboard": "Seller Dashboard",
      "seller.my_listings": "My Listings",
      "seller.orders": "Orders",
      "seller.analytics": "Analytics",
      "seller.create_listing": "Create Listing",
      "seller.edit_listing": "Edit Listing",
      "seller.ai_create": "AI Create Listing",
      "seller.photo_editor": "Photo Editor",
      
      // Notifications
      "notifications.title": "Notifications",
      "notifications.empty": "No notifications",
      "notifications.mark_read": "Mark as Read",
      "notifications.clear_all": "Clear All",
      
      // Settings
      "settings.account": "Account",
      "settings.preferences": "Preferences",
      "settings.privacy": "Privacy & Security",
      "settings.notifications": "Notifications",
      "settings.dark_mode": "Dark Mode",
      "settings.language": "Language",
      "settings.help": "Help Center",
      "settings.about": "About",
      
      // Language selector
      "language.select": "Select Language",
      "language.auto_detected": "Auto-detected",
      "language.search": "Search languages...",
      
      // Errors & Messages
      "error.general": "Something went wrong",
      "error.network": "Network error. Please try again.",
      "error.not_found": "Not found",
      "error.unauthorized": "Please login to continue",
      "success.saved": "Saved successfully",
      "success.deleted": "Deleted successfully",
      "success.copied": "Copied to clipboard",
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
      "close": "Cerrar",
      "back": "Atrás",
      "next": "Siguiente",
      "submit": "Enviar",
      "clear": "Limpiar",
      "all": "Todo",
      "yes": "Sí",
      "no": "No",
      
      "nav.home": "Inicio",
      "nav.marketplace": "Mercado",
      "nav.feed": "Feed",
      "nav.profile": "Perfil",
      "nav.messages": "Mensajes",
      "nav.wallet": "Billetera",
      "nav.settings": "Configuración",
      
      "auth.login": "Iniciar Sesión",
      "auth.signup": "Registrarse",
      "auth.logout": "Cerrar Sesión",
      "auth.email": "Correo Electrónico",
      "auth.password": "Contraseña",
      "auth.forgot_password": "¿Olvidaste tu contraseña?",
      "auth.get_started": "Comenzar",
      
      "landing.hero_title": "Social, Compra, Juega y",
      "landing.hero_highlight": "Gana Recompensas",
      "landing.recently_viewed": "Vistos Recientemente",
      "landing.clear_history": "Limpiar Historial",
      "landing.browse_marketplace": "Explorar el Mercado",
      
      "marketplace.title": "Mercado",
      "marketplace.buy_now": "Comprar Ahora",
      "marketplace.add_to_cart": "Añadir al Carrito",
      "marketplace.price": "Precio",
      "marketplace.condition": "Condición",
      "marketplace.shipping": "Envío",
      "marketplace.new": "Nuevo",
      "marketplace.used": "Usado",
      
      "cart.title": "Carrito de Compras",
      "cart.empty": "Tu carrito está vacío",
      "cart.checkout": "Pagar",
      "checkout.title": "Pago",
      "checkout.place_order": "Realizar Pedido",
      
      "feed.title": "Feed Social",
      "feed.like": "Me Gusta",
      "feed.comment": "Comentar",
      "feed.share": "Compartir",
      
      "wallet.balance": "Saldo",
      "wallet.bl_coins": "Monedas BL",
      "wallet.claim_daily": "Reclamar Bono Diario",
      
      "settings.dark_mode": "Modo Oscuro",
      "settings.language": "Idioma",
      
      "language.select": "Seleccionar Idioma",
      "language.auto_detected": "Detectado automáticamente",
    }
  },
  fr: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Chargement...",
      "save": "Enregistrer",
      "cancel": "Annuler",
      "confirm": "Confirmer",
      "delete": "Supprimer",
      "edit": "Modifier",
      "view": "Voir",
      "search": "Rechercher",
      "settings": "Paramètres",
      "close": "Fermer",
      "back": "Retour",
      "next": "Suivant",
      
      "nav.home": "Accueil",
      "nav.marketplace": "Marché",
      "nav.feed": "Fil",
      "nav.profile": "Profil",
      "nav.messages": "Messages",
      "nav.wallet": "Portefeuille",
      
      "auth.login": "Connexion",
      "auth.signup": "S'inscrire",
      "auth.logout": "Déconnexion",
      "auth.email": "E-mail",
      "auth.password": "Mot de passe",
      "auth.get_started": "Commencer",
      
      "landing.hero_title": "Social, Shopping, Jeux &",
      "landing.hero_highlight": "Gagnez des Récompenses",
      "landing.recently_viewed": "Vus Récemment",
      "landing.clear_history": "Effacer l'Historique",
      "landing.browse_marketplace": "Parcourir le Marché",
      
      "marketplace.title": "Marché",
      "marketplace.buy_now": "Acheter Maintenant",
      "marketplace.add_to_cart": "Ajouter au Panier",
      "marketplace.price": "Prix",
      
      "cart.title": "Panier",
      "cart.empty": "Votre panier est vide",
      "cart.checkout": "Commander",
      
      "feed.title": "Fil d'Actualité",
      "feed.like": "J'aime",
      "feed.comment": "Commenter",
      "feed.share": "Partager",
      
      "wallet.balance": "Solde",
      "wallet.bl_coins": "Pièces BL",
      
      "settings.dark_mode": "Mode Sombre",
      "settings.language": "Langue",
      
      "language.select": "Choisir la Langue",
      "language.auto_detected": "Détecté automatiquement",
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
      "auth.get_started": "Loslegen",
      
      "landing.hero_title": "Sozial, Einkaufen, Spielen &",
      "landing.hero_highlight": "Belohnungen Verdienen",
      "landing.recently_viewed": "Kürzlich Angesehen",
      "landing.clear_history": "Verlauf Löschen",
      
      "marketplace.title": "Marktplatz",
      "marketplace.buy_now": "Jetzt Kaufen",
      "marketplace.add_to_cart": "In den Warenkorb",
      
      "cart.title": "Warenkorb",
      "cart.checkout": "Zur Kasse",
      
      "feed.like": "Gefällt mir",
      "feed.comment": "Kommentieren",
      "feed.share": "Teilen",
      
      "wallet.bl_coins": "BL Münzen",
      
      "settings.dark_mode": "Dunkler Modus",
      "settings.language": "Sprache",
      
      "language.select": "Sprache Wählen",
    }
  },
  ar: {
    translation: {
      "app_name": "بليندلينك",
      "loading": "جاري التحميل...",
      "save": "حفظ",
      "cancel": "إلغاء",
      "confirm": "تأكيد",
      "delete": "حذف",
      "edit": "تعديل",
      "view": "عرض",
      "search": "بحث",
      "settings": "الإعدادات",
      "close": "إغلاق",
      "back": "رجوع",
      "next": "التالي",
      
      "nav.home": "الرئيسية",
      "nav.marketplace": "السوق",
      "nav.feed": "الموجز",
      "nav.profile": "الملف الشخصي",
      "nav.messages": "الرسائل",
      "nav.wallet": "المحفظة",
      
      "auth.login": "تسجيل الدخول",
      "auth.signup": "إنشاء حساب",
      "auth.logout": "تسجيل الخروج",
      "auth.email": "البريد الإلكتروني",
      "auth.password": "كلمة المرور",
      "auth.get_started": "ابدأ الآن",
      
      "landing.hero_title": "تواصل، تسوق، العب و",
      "landing.hero_highlight": "اكسب المكافآت",
      "landing.recently_viewed": "شوهد مؤخراً",
      "landing.clear_history": "مسح السجل",
      "landing.browse_marketplace": "تصفح السوق",
      
      "marketplace.title": "السوق",
      "marketplace.buy_now": "اشتري الآن",
      "marketplace.add_to_cart": "أضف إلى السلة",
      "marketplace.price": "السعر",
      
      "cart.title": "سلة التسوق",
      "cart.empty": "سلتك فارغة",
      "cart.checkout": "الدفع",
      
      "feed.like": "إعجاب",
      "feed.comment": "تعليق",
      "feed.share": "مشاركة",
      
      "wallet.bl_coins": "عملات BL",
      
      "settings.dark_mode": "الوضع الداكن",
      "settings.language": "اللغة",
      
      "language.select": "اختر اللغة",
    }
  },
  "zh-CN": {
    translation: {
      "app_name": "Blendlink",
      "loading": "加载中...",
      "save": "保存",
      "cancel": "取消",
      "confirm": "确认",
      "delete": "删除",
      "edit": "编辑",
      "view": "查看",
      "search": "搜索",
      "settings": "设置",
      
      "nav.home": "首页",
      "nav.marketplace": "市场",
      "nav.feed": "动态",
      "nav.profile": "个人资料",
      "nav.messages": "消息",
      "nav.wallet": "钱包",
      
      "auth.login": "登录",
      "auth.signup": "注册",
      "auth.logout": "退出",
      "auth.get_started": "开始使用",
      
      "landing.hero_title": "社交、购物、游戏和",
      "landing.hero_highlight": "赚取奖励",
      "landing.recently_viewed": "最近浏览",
      "landing.clear_history": "清除历史",
      
      "marketplace.title": "市场",
      "marketplace.buy_now": "立即购买",
      "marketplace.add_to_cart": "加入购物车",
      
      "cart.title": "购物车",
      "cart.checkout": "结账",
      
      "feed.like": "点赞",
      "feed.comment": "评论",
      "feed.share": "分享",
      
      "wallet.bl_coins": "BL币",
      
      "settings.dark_mode": "深色模式",
      "settings.language": "语言",
      
      "language.select": "选择语言",
    }
  },
  ja: {
    translation: {
      "app_name": "Blendlink",
      "loading": "読み込み中...",
      "save": "保存",
      "cancel": "キャンセル",
      "confirm": "確認",
      "delete": "削除",
      "edit": "編集",
      "view": "表示",
      "search": "検索",
      "settings": "設定",
      
      "nav.home": "ホーム",
      "nav.marketplace": "マーケット",
      "nav.feed": "フィード",
      "nav.profile": "プロフィール",
      "nav.messages": "メッセージ",
      "nav.wallet": "ウォレット",
      
      "auth.login": "ログイン",
      "auth.signup": "新規登録",
      "auth.logout": "ログアウト",
      "auth.get_started": "始める",
      
      "landing.hero_title": "ソーシャル、ショッピング、ゲーム、",
      "landing.hero_highlight": "報酬を獲得",
      "landing.recently_viewed": "最近見た商品",
      "landing.clear_history": "履歴を消去",
      
      "marketplace.title": "マーケット",
      "marketplace.buy_now": "今すぐ購入",
      "marketplace.add_to_cart": "カートに追加",
      
      "cart.title": "ショッピングカート",
      "cart.checkout": "レジに進む",
      
      "feed.like": "いいね",
      "feed.comment": "コメント",
      "feed.share": "シェア",
      
      "wallet.bl_coins": "BLコイン",
      
      "settings.dark_mode": "ダークモード",
      "settings.language": "言語",
      
      "language.select": "言語を選択",
    }
  },
  ko: {
    translation: {
      "app_name": "Blendlink",
      "loading": "로딩 중...",
      "save": "저장",
      "cancel": "취소",
      "confirm": "확인",
      "delete": "삭제",
      "edit": "수정",
      "view": "보기",
      "search": "검색",
      "settings": "설정",
      
      "nav.home": "홈",
      "nav.marketplace": "마켓",
      "nav.feed": "피드",
      "nav.profile": "프로필",
      "nav.messages": "메시지",
      "nav.wallet": "지갑",
      
      "auth.login": "로그인",
      "auth.signup": "회원가입",
      "auth.logout": "로그아웃",
      "auth.get_started": "시작하기",
      
      "landing.hero_title": "소셜, 쇼핑, 게임 &",
      "landing.hero_highlight": "리워드 획득",
      "landing.recently_viewed": "최근 본 상품",
      "landing.clear_history": "기록 삭제",
      
      "marketplace.title": "마켓",
      "marketplace.buy_now": "지금 구매",
      "marketplace.add_to_cart": "장바구니에 담기",
      
      "cart.title": "장바구니",
      "cart.checkout": "결제하기",
      
      "feed.like": "좋아요",
      "feed.comment": "댓글",
      "feed.share": "공유",
      
      "wallet.bl_coins": "BL 코인",
      
      "settings.dark_mode": "다크 모드",
      "settings.language": "언어",
      
      "language.select": "언어 선택",
    }
  },
  ru: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Загрузка...",
      "save": "Сохранить",
      "cancel": "Отмена",
      "confirm": "Подтвердить",
      "delete": "Удалить",
      "edit": "Редактировать",
      "view": "Просмотр",
      "search": "Поиск",
      "settings": "Настройки",
      
      "nav.home": "Главная",
      "nav.marketplace": "Маркет",
      "nav.feed": "Лента",
      "nav.profile": "Профиль",
      "nav.messages": "Сообщения",
      "nav.wallet": "Кошелек",
      
      "auth.login": "Войти",
      "auth.signup": "Регистрация",
      "auth.logout": "Выйти",
      "auth.get_started": "Начать",
      
      "landing.hero_title": "Общение, Покупки, Игры и",
      "landing.hero_highlight": "Награды",
      "landing.recently_viewed": "Недавно просмотренные",
      "landing.clear_history": "Очистить историю",
      
      "marketplace.title": "Маркет",
      "marketplace.buy_now": "Купить сейчас",
      "marketplace.add_to_cart": "В корзину",
      
      "cart.title": "Корзина",
      "cart.checkout": "Оформить заказ",
      
      "feed.like": "Нравится",
      "feed.comment": "Комментарий",
      "feed.share": "Поделиться",
      
      "wallet.bl_coins": "BL монеты",
      
      "settings.dark_mode": "Тёмная тема",
      "settings.language": "Язык",
      
      "language.select": "Выбрать язык",
    }
  },
  pt: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Carregando...",
      "save": "Salvar",
      "cancel": "Cancelar",
      "confirm": "Confirmar",
      "delete": "Excluir",
      "edit": "Editar",
      "view": "Ver",
      "search": "Pesquisar",
      "settings": "Configurações",
      
      "nav.home": "Início",
      "nav.marketplace": "Mercado",
      "nav.feed": "Feed",
      "nav.profile": "Perfil",
      "nav.messages": "Mensagens",
      "nav.wallet": "Carteira",
      
      "auth.login": "Entrar",
      "auth.signup": "Cadastrar",
      "auth.logout": "Sair",
      "auth.get_started": "Começar",
      
      "landing.hero_title": "Social, Compras, Jogos e",
      "landing.hero_highlight": "Ganhe Recompensas",
      "landing.recently_viewed": "Vistos Recentemente",
      "landing.clear_history": "Limpar Histórico",
      
      "marketplace.title": "Mercado",
      "marketplace.buy_now": "Comprar Agora",
      "marketplace.add_to_cart": "Adicionar ao Carrinho",
      
      "cart.title": "Carrinho",
      "cart.checkout": "Finalizar Compra",
      
      "feed.like": "Curtir",
      "feed.comment": "Comentar",
      "feed.share": "Compartilhar",
      
      "wallet.bl_coins": "Moedas BL",
      
      "settings.dark_mode": "Modo Escuro",
      "settings.language": "Idioma",
      
      "language.select": "Selecionar Idioma",
    }
  },
  it: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Caricamento...",
      "save": "Salva",
      "cancel": "Annulla",
      "confirm": "Conferma",
      "delete": "Elimina",
      "edit": "Modifica",
      "view": "Visualizza",
      "search": "Cerca",
      "settings": "Impostazioni",
      
      "nav.home": "Home",
      "nav.marketplace": "Mercato",
      "nav.feed": "Feed",
      "nav.profile": "Profilo",
      "nav.messages": "Messaggi",
      "nav.wallet": "Portafoglio",
      
      "auth.login": "Accedi",
      "auth.signup": "Registrati",
      "auth.logout": "Esci",
      "auth.get_started": "Inizia",
      
      "landing.hero_title": "Social, Shopping, Giochi e",
      "landing.hero_highlight": "Guadagna Premi",
      "landing.recently_viewed": "Visti di Recente",
      "landing.clear_history": "Cancella Cronologia",
      
      "marketplace.title": "Mercato",
      "marketplace.buy_now": "Acquista Ora",
      "marketplace.add_to_cart": "Aggiungi al Carrello",
      
      "cart.title": "Carrello",
      "cart.checkout": "Procedi all'Acquisto",
      
      "feed.like": "Mi Piace",
      "feed.comment": "Commenta",
      "feed.share": "Condividi",
      
      "wallet.bl_coins": "Monete BL",
      
      "settings.dark_mode": "Modalità Scura",
      "settings.language": "Lingua",
      
      "language.select": "Seleziona Lingua",
    }
  },
  nl: {
    translation: {
      "app_name": "Blendlink",
      "loading": "Laden...",
      "save": "Opslaan",
      "cancel": "Annuleren",
      "confirm": "Bevestigen",
      "delete": "Verwijderen",
      "edit": "Bewerken",
      "view": "Bekijken",
      "search": "Zoeken",
      "settings": "Instellingen",
      
      "nav.home": "Home",
      "nav.marketplace": "Marktplaats",
      "nav.feed": "Feed",
      "nav.profile": "Profiel",
      "nav.messages": "Berichten",
      "nav.wallet": "Portemonnee",
      
      "auth.login": "Inloggen",
      "auth.signup": "Registreren",
      "auth.logout": "Uitloggen",
      "auth.get_started": "Aan de Slag",
      
      "landing.hero_title": "Sociaal, Winkelen, Spelen &",
      "landing.hero_highlight": "Verdien Beloningen",
      "landing.recently_viewed": "Recent Bekeken",
      "landing.clear_history": "Geschiedenis Wissen",
      
      "marketplace.title": "Marktplaats",
      "marketplace.buy_now": "Nu Kopen",
      "marketplace.add_to_cart": "In Winkelwagen",
      
      "cart.title": "Winkelwagen",
      "cart.checkout": "Afrekenen",
      
      "feed.like": "Vind ik leuk",
      "feed.comment": "Reageren",
      "feed.share": "Delen",
      
      "wallet.bl_coins": "BL Munten",
      
      "settings.dark_mode": "Donkere Modus",
      "settings.language": "Taal",
      
      "language.select": "Taal Selecteren",
    }
  },
  he: {
    translation: {
      "app_name": "בלנדלינק",
      "loading": "טוען...",
      "save": "שמור",
      "cancel": "ביטול",
      "confirm": "אשר",
      "delete": "מחק",
      "edit": "ערוך",
      "view": "צפה",
      "search": "חיפוש",
      "settings": "הגדרות",
      
      "nav.home": "בית",
      "nav.marketplace": "שוק",
      "nav.feed": "פיד",
      "nav.profile": "פרופיל",
      "nav.messages": "הודעות",
      "nav.wallet": "ארנק",
      
      "auth.login": "התחבר",
      "auth.signup": "הרשמה",
      "auth.logout": "התנתק",
      "auth.get_started": "התחל",
      
      "landing.hero_title": "חברתי, קניות, משחקים ו",
      "landing.hero_highlight": "הרווח פרסים",
      "landing.recently_viewed": "נצפו לאחרונה",
      "landing.clear_history": "נקה היסטוריה",
      
      "marketplace.title": "שוק",
      "marketplace.buy_now": "קנה עכשיו",
      "marketplace.add_to_cart": "הוסף לעגלה",
      
      "cart.title": "עגלת קניות",
      "cart.checkout": "לתשלום",
      
      "feed.like": "לייק",
      "feed.comment": "תגובה",
      "feed.share": "שתף",
      
      "wallet.bl_coins": "מטבעות BL",
      
      "settings.dark_mode": "מצב כהה",
      "settings.language": "שפה",
      
      "language.select": "בחר שפה",
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
