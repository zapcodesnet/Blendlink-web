import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Globe, Check, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { SUPPORTED_LANGUAGES } from '../i18n';

// Key translations to showcase during the tour
const TOUR_KEYS = [
  { key: 'nav.home', icon: '🏠', category: 'Navigation' },
  { key: 'nav.marketplace', icon: '🛒', category: 'Navigation' },
  { key: 'auth.login', icon: '🔐', category: 'Authentication' },
  { key: 'auth.signup', icon: '✨', category: 'Authentication' },
  { key: 'marketplace.buy_now', icon: '💳', category: 'Shopping' },
  { key: 'marketplace.add_to_cart', icon: '🛍️', category: 'Shopping' },
  { key: 'feed.like', icon: '❤️', category: 'Social' },
  { key: 'feed.comment', icon: '💬', category: 'Social' },
  { key: 'feed.share', icon: '📤', category: 'Social' },
  { key: 'wallet.bl_coins', icon: '🪙', category: 'Rewards' },
  { key: 'settings.dark_mode', icon: '🌙', category: 'Settings' },
];

export default function LanguageTour({ isOpen, onClose, newLanguage }) {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllTranslations, setShowAllTranslations] = useState(false);

  // Get language info
  const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === newLanguage) || { name: newLanguage, flag: '🌐' };
  const isRTL = langInfo.rtl;

  // Group translations by category
  const groupedTranslations = TOUR_KEYS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const handleComplete = () => {
    // Mark this language as toured
    const touredLanguages = JSON.parse(localStorage.getItem('blendlink_toured_languages') || '[]');
    if (!touredLanguages.includes(newLanguage)) {
      touredLanguages.push(newLanguage);
      localStorage.setItem('blendlink_toured_languages', JSON.stringify(touredLanguages));
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className={`bg-background rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl ${isRTL ? 'rtl' : 'ltr'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-background/50 hover:bg-background transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
              <span className="text-3xl">{langInfo.flag}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {t('language.select')}
              </h2>
              <p className="text-sm text-muted-foreground">
                Now using <span className="font-semibold text-foreground">{langInfo.name}</span>
              </p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Here's how key features look in your new language:
          </p>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {showAllTranslations ? (
            // Show all translations grouped
            <div className="space-y-4">
              {Object.entries(groupedTranslations).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {category}
                  </h3>
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <div 
                        key={item.key}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                      >
                        <span className="text-xl">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{t(item.key)}</p>
                          <p className="text-xs text-muted-foreground">{item.key}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Interactive step-by-step tour
            <div className="space-y-4">
              {/* Progress dots */}
              <div className="flex justify-center gap-1.5">
                {TOUR_KEYS.slice(0, 5).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentStep 
                        ? 'bg-primary w-6' 
                        : idx < currentStep 
                          ? 'bg-primary/50' 
                          : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              {/* Current translation card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center">
                <div className="absolute top-2 right-2 text-4xl opacity-20">
                  {TOUR_KEYS[currentStep]?.icon}
                </div>
                
                <span className="text-4xl mb-3 block">{TOUR_KEYS[currentStep]?.icon}</span>
                
                <p className="text-2xl font-bold mb-1">
                  {t(TOUR_KEYS[currentStep]?.key)}
                </p>
                
                <p className="text-sm text-muted-foreground">
                  {TOUR_KEYS[currentStep]?.category}
                </p>

                {/* Navigation arrows */}
                <div className="flex justify-between mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="opacity-70"
                  >
                    ← {t('back') || 'Back'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                    disabled={currentStep === 4}
                    className="opacity-70"
                  >
                    {t('next') || 'Next'} →
                  </Button>
                </div>
              </div>

              {/* Show all toggle */}
              <button
                onClick={() => setShowAllTranslations(true)}
                className="w-full text-sm text-primary hover:underline flex items-center justify-center gap-1"
              >
                View all translations <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <Button onClick={handleComplete} className="w-full" data-testid="language-tour-complete">
            <Check className="w-4 h-4 mr-2" />
            {t('confirm') || 'Got it!'}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            You can change your language anytime in Settings
          </p>
        </div>
      </div>
    </div>
  );
}

// Hook to check if tour should be shown
export function useLanguageTour() {
  const { i18n } = useTranslation();
  const [showTour, setShowTour] = useState(false);
  const [tourLanguage, setTourLanguage] = useState(null);

  useEffect(() => {
    const handleLanguageChange = (lng) => {
      const touredLanguages = JSON.parse(localStorage.getItem('blendlink_toured_languages') || '[]');
      
      // Don't show tour for English (default) or already toured languages
      if (lng !== 'en' && !touredLanguages.includes(lng)) {
        setTourLanguage(lng);
        setShowTour(true);
      }
    };

    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const closeTour = () => {
    setShowTour(false);
    setTourLanguage(null);
  };

  return { showTour, tourLanguage, closeTour };
}
