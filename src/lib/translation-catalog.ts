export type TranslationLanguage = {
  code: string;
  name: string;
  nativeName: string;
  group: string;
  dir?: "ltr" | "rtl";
};

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", group: "Indian languages" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", group: "Indian languages" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", group: "Indian languages" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", group: "Indian languages" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", group: "Indian languages" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", group: "Indian languages" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", group: "Indian languages" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", group: "Indian languages" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", group: "Indian languages" },
  { code: "ur", name: "Urdu", nativeName: "اردو", group: "Indian languages", dir: "rtl" },
  { code: "fr", name: "French", nativeName: "Français", group: "European languages" },
  { code: "de", name: "German", nativeName: "Deutsch", group: "European languages" },
  { code: "it", name: "Italian", nativeName: "Italiano", group: "European languages" },
  { code: "es", name: "Spanish", nativeName: "Español", group: "European languages" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português (Brasil)", group: "European languages" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", group: "European languages" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", group: "European languages" },
  { code: "ru", name: "Russian", nativeName: "Русский", group: "European languages" },
  { code: "zh-CN", name: "Mandarin Chinese", nativeName: "简体中文", group: "East Asian languages" },
  { code: "ja", name: "Japanese", nativeName: "日本語", group: "East Asian languages" },
  { code: "ko", name: "Korean", nativeName: "한국어", group: "East Asian languages" },
  { code: "ar", name: "Arabic", nativeName: "العربية", group: "Other languages", dir: "rtl" },
];

export const getTranslationLanguage = (code: string) =>
  TRANSLATION_LANGUAGES.find((language) => language.code === code);