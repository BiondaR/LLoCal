import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';

export default function Dropzone({ files, setFiles, onRemove }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);

  // Estado de reordenação via mouse
  const [dragIndex, setDragIndex] = useState(null);      // item sendo arrastado
  const [hoverIndex, setHoverIndex] = useState(null);    // posição alvo
  const isDraggingInternal = useRef(false);

  const allowedExtensions = ['mp4', 'mp3', 'pdf', 'txt'];
  const isProcessingDrop = useRef(false);

  // --- REORDENAÇÃO ---
  const handleMouseDown = (e, index) => {
    e.preventDefault();
    isDraggingInternal.current = true;
    setDragIndex(index);
    setHoverIndex(index);
  };

  const handleMouseEnter = (index) => {
    if (!isDraggingInternal.current) return;
    setHoverIndex(index);
  };

  const handleMouseUp = () => {
    if (!isDraggingInternal.current) return;
    isDraggingInternal.current = false;

    if (dragIndex !== null && hoverIndex !== null && dragIndex !== hoverIndex) {
      setFiles(prev => {
        const reordered = [...prev];
        const [moved] = reordered.splice(dragIndex, 1);
        reordered.splice(hoverIndex, 0, moved);
        return reordered;
      });
    }

    setDragIndex(null);
    setHoverIndex(null);
  };

  // MouseUp global — garante que soltar fora de um item também encerra
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragIndex, hoverIndex]);

  // --- ADIÇÃO DE ARQUIVOS ---
  const processFiles = useCallback((incomingList) => {
    let hasInvalid = false;
    const candidates = [];

    incomingList.forEach(file => {
      const fullPath = typeof file === 'string' ? file : file.name;
      const fileName = fullPath.replace(/^.*[\\/]/, '');
      const ext = fileName.split('.').pop().toLowerCase();

      if (allowedExtensions.includes(ext)) {
        candidates.push({ name: fileName, path: fullPath });
      } else {
        hasInvalid = true;
      }
    });

    if (hasInvalid) {
      setError(t('dropzone.unsupported'));
      setTimeout(() => setError(""), 4000);
    }

    if (candidates.length === 0) return;

    setFiles(prev => {
      let hasDuplicate = false;
      const newUniqueFiles = [];

      candidates.forEach(can => {
        const alreadyExists = prev.some(f => f.name === can.name);
        if (!alreadyExists) newUniqueFiles.push(can);
        else hasDuplicate = true;
      });

      if (hasDuplicate) {
        setTimeout(() => {
          setError(t('dropzone.duplicate'));
          setTimeout(() => setError(""), 3000);
        }, 0);
      }

      if (newUniqueFiles.length === 0) return prev;
      return [...prev, ...newUniqueFiles];
    });
  }, [setFiles, t]);

  // O <input type="file"> do webview só entrega o nome do arquivo; o diálogo nativo
  // devolve o caminho completo, que o backend precisa para ler o arquivo
  const browseFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'MP4, MP3, PDF, TXT', extensions: allowedExtensions }],
    });
    if (selected) processFiles(selected);
  };

  // --- LISTENER TAURI ---
  useEffect(() => {
    let unlisten;
    let cancelled = false;

    async function setupTauriListener() {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onDragDropEvent((event) => {
        if (cancelled) return;

        if (event.payload.type === 'over') {
          if (!isDraggingInternal.current) setIsDraggingWindow(true);
        } else if (event.payload.type === 'drop') {
          setIsDraggingWindow(false);
          if (isProcessingDrop.current || isDraggingInternal.current) return;

          isProcessingDrop.current = true;
          setTimeout(() => { isProcessingDrop.current = false; }, 300);
          processFiles(event.payload.paths);
        } else if (event.payload.type === 'cancel') {
          setIsDraggingWindow(false);
        }
      });
    }

    setupTauriListener();
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, [processFiles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', color: 'white' }}>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!isDraggingInternal.current) setIsDraggingWindow(true); }}
        onDragLeave={() => { if (!isDraggingInternal.current) setIsDraggingWindow(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDraggingWindow(false); }}
        style={{
          border: isDraggingWindow ? '2px dashed #FD9FFF' : '2px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: '12px',
          padding: files.length > 0 ? '20px' : '50px 40px',
          width: '100%',
          maxWidth: '500px',
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: files.length > 0 ? 'flex-start' : 'center',
          gap: '12px',
          backgroundColor: isDraggingWindow ? 'rgba(253, 159, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          transition: 'all 0.2s ease',
          userSelect: 'none', // evita seleção de texto ao arrastar
        }}
      >
        {files.length === 0 ? (
          <>
            <i className="bi bi-cloud-arrow-up-fill" style={{ color: '#FD9FFF', fontSize: '64px' }}></i>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>
              {isDraggingWindow ? t('dropzone.drop') : t('dropzone.drag')}
            </p>
            <p style={{ fontSize: '14px', opacity: 0.6, margin: 0 }}>{t('dropzone.or')}</p>
          </>
        ) : (
          <div
            className="custom-scrollbar"
            style={{ width: '100%', maxHeight: '220px', overflowY: 'auto', marginBottom: '10px' }}
          >
            {files.map((f, i) => (
              <div
                key={f.path || f.name}
                onMouseEnter={() => handleMouseEnter(i)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  borderBottom: '1px solid #444',
                  marginBottom: '4px',
                  borderRadius: '4px',
                  backgroundColor: hoverIndex === i && dragIndex !== null && dragIndex !== i
                    ? 'rgba(253, 159, 255, 0.2)'  // destaque: onde vai cair
                    : dragIndex === i
                    ? 'rgba(253, 159, 255, 0.08)' // item sendo arrastado
                    : 'rgba(255, 255, 255, 0.05)',
                  opacity: dragIndex === i ? 0.5 : 1,
                  transition: 'background-color 0.15s',
                  cursor: dragIndex !== null ? 'grabbing' : 'default',
                }}
              >
                {/* Handle de arrastar — só essa parte ativa o drag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i
                    className="bi bi-grip-vertical"
                    onMouseDown={(e) => handleMouseDown(e, i)}
                    style={{ opacity: 0.5, cursor: 'grab', padding: '4px' }}
                  ></i>
                  <i className="bi bi-file-earmark-text" style={{ color: '#FD9FFF' }}></i>
                  <span style={{ fontSize: '14px', color: '#BBD2DE' }}>{f.name}</span>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                  style={{ background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer' }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        <label onClick={browseFiles} style={{
          backgroundColor: '#FD9FFF', color: 'white', padding: '8px 25px', borderRadius: '6px',
          fontWeight: '600', cursor: 'pointer', fontSize: '16px',
        }}>
          {files.length > 0 ? t('dropzone.addMore') : t('dropzone.browse')}
        </label>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', padding: '8px 15px', borderRadius: '6px', marginTop: '10px', border: '1px solid #ff4d4d' }}>
          <p style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{error}</p>
        </div>
      )}

      <p style={{ marginTop: '15px', fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>
        {t('dropzone.supported')}
      </p>
    </div>
  );
}