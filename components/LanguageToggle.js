'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Globe } from 'lucide-react';

export default function LanguageToggle({ style }) {
  const { language, changeLanguage } = useAuth();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '999px',
        padding: '3px 4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        gap: '2px',
        ...style,
      }}
    >
      <Globe size={14} color="#6366f1" style={{ marginLeft: '8px', marginRight: '4px', flexShrink: 0 }} />
      <button
        type="button"
        onClick={() => changeLanguage('gu')}
        style={{
          padding: '5px 12px',
          borderRadius: '999px',
          border: 'none',
          fontSize: '0.78rem',
          fontWeight: '800',
          background: language === 'gu' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
          color: language === 'gu' ? '#ffffff' : 'var(--text-secondary, #64748b)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: language === 'gu' ? '0 2px 6px rgba(99,102,241,0.3)' : 'none',
        }}
      >
        🇮🇳 ગુજરાતી
      </button>

      <button
        type="button"
        onClick={() => changeLanguage('en')}
        style={{
          padding: '5px 12px',
          borderRadius: '999px',
          border: 'none',
          fontSize: '0.78rem',
          fontWeight: '800',
          background: language === 'en' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
          color: language === 'en' ? '#ffffff' : 'var(--text-secondary, #64748b)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: language === 'en' ? '0 2px 6px rgba(99,102,241,0.3)' : 'none',
        }}
      >
        🇬🇧 English
      </button>
    </div>
  );
}
