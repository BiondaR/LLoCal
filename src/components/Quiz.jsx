import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const smallButtonStyle = {
  backgroundColor: '#FD9FFF', color: 'white', padding: '8px 25px', borderRadius: '6px',
  border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
};

export default function Quiz({ questions }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // alternativa escolhida em cada questão
  const [showScore, setShowScore] = useState(false);

  const question = questions[index];
  const chosen = answers[index];
  const answered = chosen !== undefined;
  const isLast = index === questions.length - 1;

  const restart = () => {
    setIndex(0);
    setAnswers([]);
    setShowScore(false);
  };

  if (showScore) {
    const correct = questions.filter((q, i) => answers[i] === q.answer).length;

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <p style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>
          {t('quiz.score', { correct, total: questions.length })}
        </p>
        <button onClick={restart} style={smallButtonStyle}>{t('quiz.retry')}</button>
      </div>
    );
  }

  return (
    <>
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
        <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px' }}>{question.question}</p>

        {question.options.map((option, i) => {
          const isCorrect = answered && i === question.answer;
          const isWrong = answered && i === chosen && i !== question.answer;

          return (
            <div
              key={i}
              onClick={() => { if (!answered) setAnswers(prev => { const next = [...prev]; next[index] = i; return next; }); }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                marginBottom: '6px',
                borderRadius: '4px',
                border: `1px solid ${isCorrect ? '#FD9FFF' : isWrong ? '#ff4d4d' : 'transparent'}`,
                backgroundColor: isCorrect ? 'rgba(253, 159, 255, 0.2)' : isWrong ? 'rgba(255, 77, 77, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                cursor: answered ? 'default' : 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              <span style={{ fontSize: '14px', color: '#BBD2DE' }}>{option}</span>
              {isCorrect && <i className="bi bi-check-lg" style={{ color: '#FD9FFF' }}></i>}
              {isWrong && <i className="bi bi-x-lg" style={{ color: '#ff4d4d' }}></i>}
            </div>
          );
        })}

        {answered && question.explanation && (
          <p style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7, margin: '12px 0 0' }}>{question.explanation}</p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '35px' }}>
        <span style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>
          {index + 1} / {questions.length}
        </span>
        {answered && (
          <button onClick={() => (isLast ? setShowScore(true) : setIndex(index + 1))} style={smallButtonStyle}>
            {isLast ? t('quiz.finish') : t('quiz.next')}
          </button>
        )}
      </div>
    </>
  );
}
