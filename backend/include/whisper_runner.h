#ifndef WHISPER_RUNNER_H
#define WHISPER_RUNNER_H

#include <string>
#include "hardware_profiler.h"

// Struct para guardar as decisões de como o modelo vai rodar
struct WhisperConfig {
    int threads;
    bool useGpu;
    std::string language;
    std::string modelPath;
};

class WhisperRunner {
public:
    // Passo 4: Parametrização baseada na máquina
    static WhisperConfig autoConfigure(const HardwareProfile& hw);
    
    // Passo 4.5: Detecção de idioma
    static std::string detectLanguage(const std::string& audioPath, const WhisperConfig& config);
    
    // Passo 5: Transcrição bruta
    static std::string transcribe(const std::string& audioPath, const WhisperConfig& config);
};

#endif // WHISPER_RUNNER_H