import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, toLanguageCode } from '../i18n';

// Prompts editáveis: chave usada no backend -> nome exibido (o mesmo das abas)
const PROMPTS = [
  { kind: 'summary', label: 'tabs.resumo' },
  { kind: 'mindmap', label: 'tabs.mapa' },
  { kind: 'flashcards', label: 'tabs.flashcards' },
  { kind: 'quiz', label: 'tabs.quiz' },
  { kind: 'audio', label: 'tabs.audio' },
];

// Sugestões de modelos abertos que cabem em uma GPU de 16 GB (nome na biblioteca do Ollama).
// vision: aceita imagem, necessário para ler PDFs escaneados e figuras.
const SUGGESTED_MODELS = [
  { name: 'gemma3:4b', sizeGb: 3.4, vision: true },
  { name: 'gemma3:12b', sizeGb: 8.2, vision: true },
  { name: 'qwen3-vl:4b', sizeGb: 3.3, vision: true },
  { name: 'qwen3-vl:8b', sizeGb: 6.1, vision: true },
  { name: 'qwen2.5vl:7b', sizeGb: 6.0, vision: true },
  { name: 'minicpm-v:8b', sizeGb: 5.5, vision: true },
  { name: 'llama3.2-vision:11b', sizeGb: 7.8, vision: true },
  { name: 'llama3.1:8b', sizeGb: 4.9, vision: false },
  { name: 'mistral-nemo:12b', sizeGb: 7.1, vision: false },
  { name: 'phi4:14b', sizeGb: 9.1, vision: false },
];

const labelStyle = { fontSize: '14px', fontWeight: '600', margin: '0 0 8px' };
const hintStyle = { fontSize: '13px', color: '#BBD2DE', opacity: 0.7, margin: 0 };
const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'transparent',
  color: 'white',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '4px',
  padding: '6px 12px',
  outline: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  // Sem isso o WebKit desenha o controle nativo (cinza claro) e o texto branco some
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
};
const linkStyle = { background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0 };
const optionStyle = { background: '#382b38', color: 'white' };
const buttonStyle = {
  backgroundColor: '#FD9FFF', color: 'white', padding: '8px 25px', borderRadius: '6px',
  border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '16px',
};

export default function ConfigWindow() {
  const { t, i18n } = useTranslation();
  const [defaults, setDefaults] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [language, setLanguage] = useState('pt-br');
  const [prompts, setPrompts] = useState({}); // só os que o usuário editou
  const [editing, setEditing] = useState(null); // prompt aberto no editor
  const [error, setError] = useState('');

  // Download de modelos
  const [showModels, setShowModels] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [pulling, setPulling] = useState(null); // { name, percent } do modelo sendo baixado
  const [pullError, setPullError] = useState('');

  useEffect(() => {
    invoke('load_config')
      .then((config) => {
        const currentModel = config.settings.model || config.defaults.model;
        setDefaults(config.defaults);
        setModels(config.models.includes(currentModel) ? config.models : [currentModel, ...config.models]);
        setModel(currentModel);
        setLanguage(config.settings.language || 'pt-br');
        setPrompts(config.settings.prompts || {});
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    i18n.changeLanguage(toLanguageCode(language));
  }, [language, i18n]);

  useEffect(() => {
    let cancelled = false;
    let unlisten;

    listen('model-pull-progress', ({ payload }) => {
      setPulling(prev => (prev && prev.name === payload.name ? { ...prev, percent: payload.percent } : prev));
    }).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, []);

  const pullModel = async (name) => {
    if (!name || pulling) return;
    setPullError('');
    setPulling({ name, percent: 0 });

    try {
      await invoke('pull_model', { name });
      setModels(await invoke('list_models'));
      setModel(name);
      setCustomModel('');
    } catch (e) {
      setPullError(String(e));
    } finally {
      setPulling(null);
    }
  };

  const editPrompt = (kind, text) => {
    setPrompts(prev => {
      const next = { ...prev };
      // Igual ao padrão não precisa ser salvo: assim o prompt acompanha mudanças futuras do padrão
      if (text.trim() && text !== defaults.prompts[kind]) next[kind] = text;
      else delete next[kind];
      return next;
    });
  };

  const apply = async () => {
    setError('');
    try {
      await invoke('save_settings', { settings: { model, language, prompts } });
      await getCurrentWindow().close();
    } catch (e) {
      setError(String(e));
    }
  };

  const containerStyle = {
    height: '100vh',
    boxSizing: 'border-box',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    color: 'white',
  };

  if (!defaults) {
    return (
      <div style={containerStyle}>
        {error && <p style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{error}</p>}
      </div>
    );
  }

  // --- Editor de um prompt ---
  if (editing) {
    const { kind, label } = editing;

    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setEditing(null)}
            style={{ background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer', fontSize: '18px', padding: 0 }}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <p style={{ ...labelStyle, margin: 0 }}>{t(label)}</p>
        </div>

        <textarea
          className="custom-scrollbar"
          value={prompts[kind] ?? defaults.prompts[kind]}
          onChange={(e) => editPrompt(kind, e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '6px',
            padding: '10px 12px',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        />

        <p style={hintStyle}>{t('config.promptNote')}</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => editPrompt(kind, '')}
            style={linkStyle}
          >
            {t('config.restore')}
          </button>
          <button onClick={() => setEditing(null)} style={buttonStyle}>{t('config.ok')}</button>
        </div>
      </div>
    );
  }

  // --- Download de modelos ---
  if (showModels) {
    const canPullCustom = customModel.trim() && !pulling;

    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowModels(false)}
            style={{ background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer', fontSize: '18px', padding: 0 }}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <p style={{ ...labelStyle, margin: 0 }}>{t('config.modelsTitle')}</p>
        </div>

        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
          {SUGGESTED_MODELS.map((suggestion) => (
            <div
              key={suggestion.name}
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
              <div>
                <span style={{ fontSize: '14px', color: '#BBD2DE' }}>{suggestion.name}</span>
                <p style={hintStyle}>
                  {suggestion.sizeGb} GB · {suggestion.vision ? t('config.vision') : t('config.textOnly')}
                </p>
              </div>

              {models.includes(suggestion.name) ? (
                <i className="bi bi-check-lg" style={{ color: '#FD9FFF', padding: '0 6px' }}></i>
              ) : (
                <button
                  onClick={() => pullModel(suggestion.name)}
                  disabled={!!pulling}
                  style={{ background: 'none', border: 'none', color: pulling ? '#BA87BB' : '#FD9FFF', cursor: pulling ? 'not-allowed' : 'pointer' }}
                >
                  <i className="bi bi-download"></i>
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') pullModel(customModel.trim()); }}
            placeholder={t('config.otherModel')}
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
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
            onClick={() => pullModel(customModel.trim())}
            disabled={!canPullCustom}
            style={{
              backgroundColor: canPullCustom ? '#FD9FFF' : '#BA87BB',
              color: canPullCustom ? '#FFFFFF' : '#BBD2DE',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: canPullCustom ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s ease'
            }}
          >
            <i className="bi bi-download"></i>
          </button>
        </div>

        {/* Progresso do download (mesma barra da tela de processamento) */}
        <div style={{ minHeight: '44px' }}>
          {pulling && (
            <>
              <p style={{ ...hintStyle, margin: '0 0 8px' }}>{t('config.downloading', pulling)}</p>
              <div style={{ backgroundColor: '#564256', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#FD9FFF', height: '100%', width: `${pulling.percent}%`, borderRadius: '6px', transition: 'width 0.3s ease' }}></div>
              </div>
            </>
          )}
          {pullError && <p style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{pullError}</p>}
        </div>
      </div>
    );
  }

  // --- Tela principal ---
  return (
    <div style={containerStyle}>
      <div>
        <p style={labelStyle}>{t('config.model')}</p>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
          {models.map((name) => (
            <option key={name} value={name} style={optionStyle}>{name}</option>
          ))}
        </select>
        <button onClick={() => setShowModels(true)} style={{ ...linkStyle, marginTop: '8px' }}>
          {t('config.downloadModels')}
        </button>
      </div>

      <div>
        <p style={labelStyle}>{t('config.language')}</p>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} style={optionStyle}>{lang.label}</option>
          ))}
        </select>
      </div>

      <div>
        <p style={{ ...labelStyle, margin: '0 0 4px' }}>{t('config.prompts')}</p>
        <p style={{ ...hintStyle, margin: '0 0 10px' }}>{t('config.promptsHint')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {PROMPTS.map((prompt) => (
            <button
              key={prompt.kind}
              onClick={() => setEditing(prompt)}
              style={{
                backgroundColor: '#2b2b2b',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '20px',
                // Contorno rosa marca os prompts que foram editados
                border: `1px solid ${prompts[prompt.kind] ? '#FD9FFF' : 'transparent'}`,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {t(prompt.label)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <p style={{ ...hintStyle, color: error ? '#ff4d4d' : hintStyle.color, opacity: error ? 1 : hintStyle.opacity }}>
          {error}
        </p>
        <button onClick={apply} style={buttonStyle}>{t('config.apply')}</button>
      </div>
    </div>
  );
}
