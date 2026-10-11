import React, { useState, useEffect, useRef } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

// Mapa mental com zoom (roda do mouse ou botões) e arraste para mover
export default function MindmapViewer({ src, alt }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null); // posição do mouse e do mapa no início do arraste
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Mantém o mapa cobrindo a área visível (sem deixar arrastar para fora)
  const clamp = (zoom, x, y) => {
    const { width, height } = containerRef.current.getBoundingClientRect();
    return {
      zoom,
      x: Math.min(0, Math.max(width * (1 - zoom), x)),
      y: Math.min(0, Math.max(height * (1 - zoom), y)),
    };
  };

  // Aplica o zoom mantendo fixo o ponto (px, py) da área visível
  const zoomAt = (factor, px, py) => {
    setView(prev => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const ratio = zoom / prev.zoom;
      return clamp(zoom, px - (px - prev.x) * ratio, py - (py - prev.y) * ratio);
    });
  };

  const zoomAtCenter = (factor) => {
    const { width, height } = containerRef.current.getBoundingClientRect();
    zoomAt(factor, width / 2, height / 2);
  };

  const handleWheel = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { mouseX: e.clientX, mouseY: e.clientY, x: view.x, y: view.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const start = dragRef.current;
      setView(prev => clamp(prev.zoom, start.x + e.clientX - start.mouseX, start.y + e.clientY - start.mouseY));
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const buttonStyle = { background: 'none', border: 'none', color: '#FD9FFF', cursor: 'pointer', fontSize: '16px', padding: '4px 6px' };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '8px',
        backgroundColor: '#FAFAFA', // mesmo fundo do mapa
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* A imagem cresce de verdade (e não por transform) para o SVG continuar nítido no zoom */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          position: 'absolute',
          left: `${view.x}px`,
          top: `${view.y}px`,
          width: `${view.zoom * 100}%`,
          height: `${view.zoom * 100}%`,
          objectFit: 'contain',
        }}
      />

      {/* Controles */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', right: '8px', bottom: '8px', display: 'flex', backgroundColor: '#2b2b2b', borderRadius: '20px', padding: '2px 6px', cursor: 'default' }}
      >
        <button onClick={() => zoomAtCenter(1 / 1.5)} style={buttonStyle}><i className="bi bi-zoom-out"></i></button>
        <button onClick={() => setView({ zoom: 1, x: 0, y: 0 })} style={buttonStyle}><i className="bi bi-arrows-angle-contract"></i></button>
        <button onClick={() => zoomAtCenter(1.5)} style={buttonStyle}><i className="bi bi-zoom-in"></i></button>
      </div>
    </div>
  );
}
