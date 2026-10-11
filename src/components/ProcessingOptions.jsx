import { Globe, Robot, BrainCircuit } from 'lucide-react';

export default function ProcessingOptions({ language, setLanguage, model, setModel, generateMindMap, setGenerateMindMap }) {
  
  // Estilo padrão para os selects/inputs
  const inputStyle = "w-full p-3 pl-11 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-100 focus:border-[#007bff] outline-none transition-all";
  const labelStyle = "block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2";
  const iconStyle = "absolute left-3.5 top-[39px] text-gray-400";

  return (
    <div className="flex flex-col gap-8">
      
      {/* SELEÇÃO DE IDIOMA */}
      <div className="relative">
        <label className={labelStyle}><Globe size={16} className="text-[#007bff]" /> Idioma</label>
        <Globe size={18} className={iconStyle} />
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputStyle}>
          <option value="pt-br">Português - BR</option>
          <option value="en-us">English - US</option>
        </select>
      </div>

      {/* SELEÇÃO DE MODELO LLM */}
      <div className="relative">
        <label className={labelStyle}><Robot size={16} className="text-[#007bff]" /> Modelo LLM</label>
        <Robot size={18} className={iconStyle} />
        <select value={model} onChange={(e) => setModel(e.target.value)} className={inputStyle}>
          <option value="llama3-8b">Llama 3 (8B) - Rápido</option>
          <option value="llama3-70b">Llama 3 (70B) - Preciso (5080 Required)</option>
          <option value="deepseek-v2">DeepSeek-V2</option>
        </select>
      </div>

      {/* TOGGLE DO MAPA MENTAL */}
      <div className="flex justify-between items-center p-4 bg-gray-50 border border-gray-100 rounded-xl mt-2">
        <div className="flex items-center gap-3">
          <BrainCircuit size={20} className="text-[#007bff]" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Gerar Mapa Mental?</p>
            <p className="text-xs text-gray-500">Cria um diagrama visual do resumo.</p>
          </div>
        </div>
        {/* Toggle Switch Simplezinho */}
        <button 
          onClick={() => setGenerateMindMap(!generateMindMap)}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${generateMindMap ? 'bg-[#007bff]' : 'bg-gray-300'}`}
        >
          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${generateMindMap ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>
    </div>
  );
}