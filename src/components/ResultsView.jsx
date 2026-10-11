import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import Flashcards from './Flashcards';
import MindmapViewer from './MindmapViewer';
import Quiz from './Quiz';

const TABS = ['resumo', 'mapa', 'flashcards', 'quiz', 'audio', 'conversa', 'baixar'];

export default function ResultsView({ result, language, onReset }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('resumo');

  // Artefatos gerados sob demanda (flashcards, quiz, audio): { [tipo]: dados }
  const [generated, setGenerated] = useState({});
  const [generating, setGenerating] = useState({});
  const [generateError, setGenerateError] = useState({});
  const [artifacts, setArtifacts] = useState(result.artifacts);

  // Conversa
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const chatEndRef = useRef(null);

  // Downloads
  const [savedPath, setSavedPath] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const mindmapSrc = result.mindmapSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.mindmapSvg)}`
    : null;

  // A resposta chega em pedaços; cada um é acrescentado à última mensagem (a do modelo)
  useEffect(() => {
    let cancelled = false;
    let unlisten;

    listen('chat-token', ({ payload }) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        return [...prev.slice(0, -1), { ...last, content: last.content + payload }];
      });
    }).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, tab]);

  const sendQuestion = async () => {
    const text = question.trim();
    if (!text || isAnswering) return;

    const history = [...messages.filter(m => !m.error), { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setQuestion('');
    setIsAnswering(true);

    try {
      const answer = await invoke('chat', { jobDir: result.outputDir, messages: history, language });
      setMessages([...history, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages([...history, { role: 'assistant', content: String(e), error: true }]);
    } finally {
      setIsAnswering(false);
    }
  };

  const generate = async (kind) => {
    setGenerating(prev => ({ ...prev, [kind]: true }));
    setGenerateError(prev => ({ ...prev, [kind]: '' }));

    try {
      const { data, artifacts: files } = await invoke('generate_artifact', { jobDir: result.outputDir, kind, language });
      setGenerated(prev => ({ ...prev, [kind]: data }));
      setArtifacts(prev => [...prev.filter(a => !files.some(f => f.path === a.path)), ...files]);
    } catch (e) {
      setGenerateError(prev => ({ ...prev, [kind]: String(e) }));
    } finally {
      setGenerating(prev => ({ ...prev, [kind]: false }));
    }
  };

  // Botão de gerar (ou o aviso de que está gerando) das abas sob demanda
  const renderGenerate = (kind) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      {generating[kind] ? (
        <p style={{ fontSize: '13px', color: '#BBD2DE', opacity: 0.7, margin: 0 }}>{t(`generating.${kind}`)}</p>
      ) : (
        <button
          onClick={() => generate(kind)}
          style={{
            backgroundColor: '#FD9FFF', color: 'white', padding: '8px 25px', borderRadius: '6px',
            border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '16px',
          }}
        >
          {t(`generate.${kind}`)}
        </button>
      )}

      {generateError[kind] && (
        <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', padding: '8px 15px', borderRadius: '6px', border: '1px solid #ff4d4d' }}>
          <p style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '13px', margin: 0, whiteSpace: 'pre-wrap' }}>{generateError[kind]}</p>
        </div>
      )}
    </div>
  );

  const downloadArtifact = async (artifact) => {
    setSavedPath('');
    setDownloadError('');

    try {
      const dest = await save({ defaultPath: artifact.fileName });
      if (!dest) return;
      await invoke('save_artifact', { source: artifact.path, dest });
      setSavedPath(dest);
    } catch (e) {
      setDownloadError(String(e));
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      margin: '0 auto',
      width: '100%',
      maxWidth: '650px',
      color: 'white'
    }}>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {TABS.map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              backgroundColor: tab === id ? '#FD9FFF' : '#2b2b2b',
              color: 'white',
              padding: '10px 16px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{
        width: '100%',
        height: '380px',
        boxSizing: 'border-box',
        padding: '20px',
        border: '2px dashed rgba(255, 255, 255, 0.3)',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>

        {tab === 'resumo' && (
          <div className="custom-scrollbar markdown-body" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            <Markdown>{result.summary}</Markdown>
          </div>
        )}

        {tab === 'mapa' && (
          mindmapSrc ? (
            <MindmapViewer src={mindmapSrc} alt={t('tabs.mapa')} />
          ) : (
            <p style={{ fontSize: '14px', color: '#BBD2DE', textAlign: 'center', margin: '40px 0' }}>
              {t('mindmapFailed')}
            </p>
          )
        )}

        {tab === 'flashcards' && (
          generated.flashcards ? <Flashcards cards={generated.flashcards.cards} /> : renderGenerate('flashcards')
        )}

        {tab === 'quiz' && (
          generated.quiz ? <Quiz questions={generated.quiz.questions} /> : renderGenerate('quiz')
        )}

        {tab === 'audio' && (
          generated.audio ? (
            <>
              <audio controls src={`data:audio/mpeg;base64,${generated.audio.audio}`} style={{ width: '100%' }}></audio>
              <div className="custom-scrollbar markdown-body" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', whiteSpace: 'pre-wrap' }}>
                {generated.audio.script}
              </div>
            </>
          ) : renderGenerate('audio')
        )}

        {tab === 'conversa' && (
          <>
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {messages.length === 0 && (
                <p style={{ fontSize: '14px', color: '#BBD2DE', opacity: 0.7, textAlign: 'center', margin: 'auto 0' }}>
                  {t('chat.empty')}
                </p>
              )}

              {messages.map((message, i) => (
                <div
                  key={i}
                  className={message.role === 'assistant' && !message.error ? 'markdown-body' : undefined}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: message.role === 'user' ? '#564256' : '#2b2b2b',
                    color: message.error ? '#ff4d4d' : undefined,
                    padding: '10px 15px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    whiteSpace: message.role === 'user' || message.error ? 'pre-wrap' : undefined,
                  }}
                >
                  {message.role === 'user' || message.error
                    ? message.content
                    : message.content
                      ? <Markdown>{message.content}</Markdown>
                      : '...'}
                </div>
              ))}
              <div ref={chatEndRef}></div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendQuestion(); }}
                placeholder={t('chat.placeholder')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={sendQuestion}
                disabled={isAnswering || !question.trim()}
                style={{
                  backgroundColor: isAnswering || !question.trim() ? '#BA87BB' : '#FD9FFF',
                  color: isAnswering || !question.trim() ? '#BBD2DE' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: isAnswering || !question.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <i className="bi bi-send-fill"></i>
              </button>
            </div>
          </>
        )}

        {tab === 'baixar' && (
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            {artifacts.map((artifact) => (
              <div
                key={artifact.path}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  borderBottom: '1px solid #444',
                  marginBottom: '4px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <i className="bi bi-file-earmark-text" style={{ color: '#FD9FFF' }}></i>
                  <span style={{ fontSize: '14px', color: '#BBD2DE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t(`artifact.${artifact.kind}`)}{artifact.source ? `: ${artifact.source}` : ''}
                  </span>
                </div>

                <button
                  onClick={() => downloadArtifact(artifact)}
                  style={{ background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer' }}
                >
                  <i className="bi bi-download"></i>
                </button>
              </div>
            ))}

            {savedPath && (
              <p style={{ marginTop: '15px', fontSize: '13px', color: '#BBD2DE', opacity: 0.7, wordBreak: 'break-all' }}>
                {t('savedIn', { path: savedPath })}
              </p>
            )}

            {downloadError && (
              <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', padding: '8px 15px', borderRadius: '6px', marginTop: '10px', border: '1px solid #ff4d4d' }}>
                <p style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{downloadError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onReset}
        style={{
          backgroundColor: '#FD9FFF', color: 'white', padding: '8px 25px', borderRadius: '6px',
          border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '16px', marginTop: '16px',
        }}
      >
        {t('newSummary')}
      </button>

    </div>
  );
}
