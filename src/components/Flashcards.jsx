import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const smallButtonStyle = {
  backgroundColor: '#FD9FFF', color: 'white', padding: '8px 25px', borderRadius: '6px',
  border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
};

export default function Flashcards({ cards }) {
  const { t } = useTranslation();
  const [deck, setDeck] = useState(cards); // cartões da rodada (todos, ou só os errados na revisão)
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]); // true = acertou, false = errou, por cartão da rodada
  const [showScore, setShowScore] = useState(false);

  const goTo = (next) => {
    setIndex((next + deck.length) % deck.length);
    setFlipped(false);
  };

  const mark = (correct) => {
    const next = [...results];
    next[index] = correct;
    setResults(next);

    // Vai para o próximo cartão ainda sem marcação; se não sobrou nenhum, mostra o placar
    const pending = deck.findIndex((_, i) => next[(index + 1 + i) % deck.length] === undefined);
    if (pending === -1) setShowScore(true);
    else goTo(index + 1 + pending);
  };

  const start = (newDeck) => {
    setDeck(newDeck);
    setIndex(0);
    setFlipped(false);
    setResults([]);
    setShowScore(false);
  };

  if (showScore) {
    const wrongCards = deck.filter((_, i) => results[i] === false);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <p style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>
          {t('quiz.score', { correct: deck.length - wrongCards.length, total: deck.length })}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {wrongCards.length > 0 && (
            <button onClick={() => start(wrongCards)} style={smallButtonStyle}>{t('flashcards.reviewWrong')}</button>
          )}
          <button onClick={() => start(cards)} style={smallButtonStyle}>{t('quiz.retry')}</button>
        </div>
      </div>
    );
  }

  const arrowStyle = { background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer', fontSize: '18px' };
  const result = results[index];

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
          {/* Marcação já feita neste cartão */}
          {result === true && <i className="bi bi-check-lg" style={{ color: '#FD9FFF', marginLeft: '8px' }}></i>}
          {result === false && <i className="bi bi-x-lg" style={{ color: '#ff4d4d', marginLeft: '8px' }}></i>}
        </span>
        <p style={{ margin: 'auto 0', fontSize: '18px', fontWeight: '500' }}>
          {flipped ? deck[index].back : deck[index].front}
        </p>
      </div>

      {/* Navegação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '35px' }}>
        <button onClick={() => goTo(index - 1)} style={arrowStyle}>
          <i className="bi bi-chevron-left"></i>
        </button>

        {flipped ? (
          // Com a resposta à mostra, a pessoa diz se acertou
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => mark(false)}
              style={{ ...smallButtonStyle, padding: '8px 16px', backgroundColor: 'rgba(255, 77, 77, 0.1)', border: '1px solid #ff4d4d', color: '#ff4d4d' }}
            >
              <i className="bi bi-x-lg"></i> {t('flashcards.wrong')}
            </button>
            <span style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>{index + 1} / {deck.length}</span>
            <button
              onClick={() => mark(true)}
              style={{ ...smallButtonStyle, padding: '8px 16px', border: '1px solid #FD9FFF' }}
            >
              <i className="bi bi-check-lg"></i> {t('flashcards.right')}
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>
            {index + 1} / {deck.length} · {t('flashcards.hint')}
          </span>
        )}

        <button onClick={() => goTo(index + 1)} style={arrowStyle}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </>
  );
}
