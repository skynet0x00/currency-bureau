import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isEN = i18n.language === 'en';

  function toggle() {
    const next = isEN ? 'fr' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('bureau_lang', next);
  }

  return (
    <button
      onClick={toggle}
      className="h-10 px-3 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-sm font-semibold"
      aria-label="Switch language"
    >
      {isEN ? 'FR' : 'EN'}
    </button>
  );
}
