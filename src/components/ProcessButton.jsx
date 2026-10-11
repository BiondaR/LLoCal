import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ProcessButton({ filesLength, onProcess }) {
  const { t } = useTranslation();
  const isDisabled = filesLength === 0;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '16px' }}>
      <button 
        disabled={isDisabled}
        onClick={onProcess} // Dispara a troca de tela no App.jsx
        style={{
          width: '100%',
          maxWidth: '250px',
          padding: '16px 0',
          fontSize: '22px',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '4px',
          textAlign: 'center',
          backgroundColor: isDisabled ? '#BA87BB' : '#FD9FFF',
          color: isDisabled ? '#BBD2DE' : '#FFFFFF',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s ease'
        }}
      >
        {t('process')}
      </button>
    </div>
  );
}