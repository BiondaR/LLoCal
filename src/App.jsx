import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import i18n, { toLanguageCode } from './i18n';

import Header from './components/Header';
import Dropzone from './components/Dropzone';
import ProcessButton from './components/ProcessButton';
import ProcessingView from './components/ProcessingView';
import ResultsView from './components/ResultsView';

export default function App() {
  const [files, setFiles] = useState([]);
  const [language, setLanguage] = useState('pt-br');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [progressData, setProgressData] = useState({});
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const [processError, setProcessError] = useState('');

  const isProcessingRef = useRef(isProcessing);

  // O idioma do cabeçalho vale para a interface e para os resultados gerados
  useEffect(() => {
    i18n.changeLanguage(toLanguageCode(language));
  }, [language]);

  // Idioma preferido das configurações: vale ao abrir o app e quando o usuário aplica
  useEffect(() => {
    let cancelled = false;
    let unlisten;

    const applySettings = (settings) => {
      if (!cancelled && settings?.language) setLanguage(settings.language);
    };

    invoke('get_settings').then(applySettings).catch(console.error);
    listen('settings-changed', ({ payload }) => applySettings(payload)).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, []);

  // Sincroniza o Ref para o listener do Tauri ver o valor real
  useEffect(() => {
    isProcessingRef.current = isProcessing && !isFinished;
  }, [isProcessing, isFinished]);

  useEffect(() => {
  const appWindow = getCurrentWindow();
  let unlisten;

  appWindow.listen('close-requested', async () => {
    console.log('close-requested recebido, isProcessing:', isProcessingRef.current);
    if (!isProcessingRef.current) {
      await appWindow.destroy();
      return;
    }

    const querSair = await ask(
      i18n.t('close.message'),
      { title: i18n.t('close.title'), kind: 'warning' }
    );

    if (querSair) {
      await appWindow.destroy();
    }
  }).then(fn => { unlisten = fn; });

  return () => { if (unlisten) unlisten(); };
}, []);

  // --- PROGRESSO REAL (eventos emitidos pelo backend) ---
  useEffect(() => {
    let cancelled = false;
    const unlisteners = [];

    const subscribe = (event, handler) => {
      listen(event, handler).then(fn => {
        if (cancelled) fn();
        else unlisteners.push(fn);
      });
    };

    subscribe('process-progress', ({ payload }) => {
      setProgressData(prev => ({ ...prev, [payload.name]: payload.percent }));
    });
    subscribe('process-stage', ({ payload }) => setStage(payload));

    return () => { cancelled = true; unlisteners.forEach(fn => fn()); };
  }, []);

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartProcess = async () => {
    if (files.length === 0) return;

    setProcessError('');
    setProgressData({});
    setStage('');
    setIsProcessing(true);

    try {
      setResult(await invoke('process_files', { files, language }));
      setIsFinished(true);
    } catch (e) {
      setProcessError(String(e));
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResult(null);
    setIsFinished(false);
    setIsProcessing(false);
  };

  return (
    <div className="h-screen w-screen bg-[#382b38] text-white flex flex-col font-sans overflow-hidden">
      <Header language={language} setLanguage={setLanguage} />

      <main className="flex-1 flex flex-col items-center justify-center px-8 pb-16">
        {!isProcessing ? (
          <div className="w-full max-w-xl flex flex-col items-center text-center">
            <Dropzone files={files} setFiles={setFiles} onRemove={removeFile} />
            <ProcessButton filesLength={files.length} onProcess={handleStartProcess} />
            {processError && (
              <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', padding: '8px 15px', borderRadius: '6px', marginTop: '16px', border: '1px solid #ff4d4d' }}>
                <p style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '13px', margin: 0, whiteSpace: 'pre-wrap' }}>{processError}</p>
              </div>
            )}
          </div>
        ) : !isFinished ? (
          <ProcessingView files={files} progressData={progressData} stage={stage} />
        ) : (
          <ResultsView result={result} language={language} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}