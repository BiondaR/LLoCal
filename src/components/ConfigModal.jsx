import React from 'react';

export default function ConfigModal({ isOpen, onClose }) {
  // Se não estiver aberto, não renderiza nada
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2b2b2b] border border-[#FD9FFF] rounded-lg p-10 flex flex-col items-center relative shadow-2xl">
        
        {/* Botão de Fechar */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-4 text-[#FD9FFF] hover:text-white bg-transparent border-none text-xl font-bold cursor-pointer transition-colors"
        >
          X
        </button>
        
        <i className="bi bi-gear-fill text-[#FD9FFF] text-5xl mb-4"></i>
        <h2 className="text-2xl font-bold text-white tracking-wide">Configs em breve</h2>
        <p className="text-[#BBD2DE] mt-2 text-sm">Essa área está em construção.</p>
        
      </div>
    </div>
  );
}