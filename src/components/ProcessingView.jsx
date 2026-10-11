import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ProcessingView({ files, progressData, stage }) {
  const { t } = useTranslation();
  // "leitura 2/4" -> etapa "leitura", detalhe "2/4"
  const [stageName, stageDetail = ''] = (stage || '').split(' ');

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
      
      {/* Container da Lista com Scroll */}
      <div 
        className="custom-scrollbar" 
        style={{ 
          width: '100%', 
          maxHeight: '350px', 
          overflowY: 'auto', 
          paddingRight: '15px', 
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {files.map((file, index) => {
          const progress = progressData[file.name] || 0;

          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', width: '100%' }}>
              
              {/* Nome do Arquivo */}
              <div style={{
                backgroundColor: '#2b2b2b', 
                padding: '10px 15px',
                borderRadius: '20px',
                minWidth: '160px', 
                maxWidth: '160px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {file.name}
              </div>

              {/* Barra de Progresso Trilha */}
              <div style={{
                flex: 1,
                backgroundColor: '#564256',
                height: '24px',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center'
              }}>
                {/* Preenchimento Rosa */}
                <div style={{
                  backgroundColor: '#FD9FFF',
                  height: '100%',
                  width: `${progress}%`,
                  borderRadius: '12px',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>

              {/* Porcentagem */}
              <div style={{ minWidth: '60px', textAlign: 'right', fontSize: '22px', fontWeight: 'bold' }}>
                {progress}%
              </div>

            </div>
          );
        })}
      </div>

      {/* Etapa do LLM (vale para todos os arquivos juntos) */}
      <p style={{ marginTop: '15px', minHeight: '18px', fontSize: '13px', color: '#BBD2DE', opacity: 0.7 }}>
        {stageName ? `${t(`stage.${stageName}`, { defaultValue: '' })} ${stageDetail}` : ''}
      </p>

    </div>
  );
}