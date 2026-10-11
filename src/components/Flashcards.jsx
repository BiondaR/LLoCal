import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function Flashcards({ cards }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const goTo = (next) => {
    setIndex((next + cards.length) % cards.length);
    setFlipped(false);
  };

  const arrowStyle = { background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer', fontSize: '18px' };

  return (
    <>
      {/* Cartão */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: flipped ? '#564256' : '#2b2b2b',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.2s ease'
        }}
      >
        <span style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>
          {flipped ? t('flashcards.back') : t('flashcards.front')}
        </span>
        <p style={{ margin: 'auto 0', fontSize: '18px', fontWeight: '500' }}>
          {flipped ? cards[index].back : cards[index].front}
        </p>
      </div>

      {/* Navegação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => goTo(index - 1)} style={arrowStyle}>
          <i className="bi bi-chevron-left"></i>
        </button>
        <span style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>
          {index + 1} / {cards.length} · {t('flashcards.hint')}
        </span>
        <button onClick={() => goTo(index + 1)} style={arrowStyle}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </>
  );
}
