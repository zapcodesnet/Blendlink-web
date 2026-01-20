import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check, Search } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../i18n';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function LanguageSelector({ className = "", compact = false }) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const dropdownRef = useRef(null);

  // Get current language info
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) 
    || SUPPORTED_LANGUAGES.find(l => l.code === 'en');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set RTL direction on initial load based on current language
  useEffect(() => {
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language);
    document.documentElement.dir = langInfo?.rtl ? 'rtl' : 'ltr';
  }, [i18n.language]);

  // Auto-detect language on first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem('blendlink_visited');
    if (!hasVisited) {
      detectLanguage();
      localStorage.setItem('blendlink_visited', 'true');
    }
  }, []);

  const detectLanguage = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/utils/detect-language`);
      const data = await response.json();
      
      if (data.detected_language) {
        setDetectedLanguage(data.detected_language);
        
        // Only auto-set if user hasn't manually chosen a language
        const storedLang = localStorage.getItem('blendlink_language');
        if (!storedLang) {
          const langExists = SUPPORTED_LANGUAGES.find(l => l.code === data.detected_language);
          if (langExists) {
            i18n.changeLanguage(data.detected_language);
          }
        }
      }
    } catch (err) {
      console.error('Language detection failed:', err);
    }
  };

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('blendlink_language', langCode);
    setIsOpen(false);
    setSearchQuery('');
    
    // Update document direction for RTL languages
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    document.documentElement.dir = langInfo?.rtl ? 'rtl' : 'ltr';
  };

  // Filter languages based on search
  const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (compact) {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="language-selector-compact"
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm">{currentLang?.flag}</span>
        </button>
        
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 max-h-80 overflow-y-auto bg-background border border-border rounded-xl shadow-xl z-50">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search language..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-lg border-0 focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-1">
              {filteredLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors ${
                    i18n.language === lang.code ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="flex-1 text-left">{lang.name}</span>
                  {i18n.language === lang.code && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        data-testid="language-selector"
      >
        <Globe className="w-4 h-4" />
        <span className="text-lg">{currentLang?.flag}</span>
        <span className="text-sm font-medium">{currentLang?.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 max-h-96 overflow-hidden bg-background border border-border rounded-xl shadow-xl z-50">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('language.select')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg border-0 focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            {detectedLanguage && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('language.auto_detected')}: {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage)?.name}
              </p>
            )}
          </div>
          
          {/* Language list */}
          <div className="overflow-y-auto max-h-64 p-2">
            {filteredLanguages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">No languages found</p>
            ) : (
              filteredLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-muted transition-colors ${
                    i18n.language === lang.code ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="flex-1 text-left font-medium">{lang.name}</span>
                  {i18n.language === lang.code && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
