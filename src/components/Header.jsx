import React from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export default function Header({ language, setLanguage }) {
  const { t } = useTranslation();
  
  const openNativeConfigWindow = () => {
    // Chama o Tauri para abrir uma janela nativa do SO
    const configWindow = new WebviewWindow('config', {
      url: 'index.html',
      title: t('config.title'),
      width: 460,
      height: 600,
      resizable: false,
    });

    configWindow.once('tauri://error', function (e) {
      console.error('Erro ao abrir a janela nativa:', e);
    });
  };

  return (
    <header style={{ display: 'flex', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', padding: '24px 32px' }}>
      
      {/* Botão agora chama a função do Tauri */}
      <button 
        onClick={openNativeConfigWindow} 
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <i className="bi bi-gear-fill" style={{ color: '#FD9FFF', fontSize: '32px' }}></i>
      </button>

      <select 
        value={language} 
        onChange={(e) => setLanguage(e.target.value)}
        style={{ 
          background: 'transparent', 
          color: 'white', 
          border: '1px solid rgba(255, 255, 255, 0.4)', 
          borderRadius: '4px', 
          padding: '6px 12px',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          width: '130px',
          textAlign: 'center',
          fontSize: '16px'
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} style={{ background: '#382b38', color: 'white' }}>
            {lang.label}
          </option>
        ))}
      </select>
      
    </header>
  );
}