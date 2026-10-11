#include <iostream>
#include <string>
#include "hardware_profiler.h"
#include "audio_extractor.h"
#include "whisper_runner.h"
#include "utils.h"

int main(int argc, char* argv[]) {
    // 1. Checa se o usuário passou o arquivo de vídeo
    if (argc < 2) {
        std::cerr << "Uso: " << argv[0] << " <caminho_para_video.mp4>\n";
        return 1;
    }
    std::string video_path = argv[1];

    if (!Utils::fileExists(video_path)) {
        std::cerr << "Erro: Arquivo nao encontrado!\n";
        return 1;
    }

    std::cout << "[1/5] Iniciando a maracutaia...\n";

    // 2. Faz o Profiling de Hardware
    std::cout << "[2/5] Checando hardware...\n";
    HardwareProfile hw_profile = HardwareProfiler::analyze();
    HardwareProfiler::printSummary(hw_profile);

    // 3. Extrai o Áudio e converte para o formato do Whisper (16kHz, wav)
    std::cout << "[3/5] Extraindo audio do video...\n";
    std::string audio_path = AudioExtractor::extractToWav(video_path);
    if (audio_path.empty()) {
        std::cerr << "Erro na extracao de audio!\n";
        return 1;
    }

    // 4. Detecção de Idioma e Parametrização
    std::cout << "[4/5] Detectando idioma...\n";
    WhisperConfig config = WhisperRunner::autoConfigure(hw_profile);
    std::string language = WhisperRunner::detectLanguage(audio_path, config);
    std::cout << "Idioma: " << language << "\n";
    
    // Aqui sua interface futura poderia pausar e pedir confirmacao via console
    config.language = language;

    // 5. Roda a Transcrição (STT)
    std::cout << "[5/5] Transcrevendo aula (isso pode demorar)...\n";
    std::string transcript_output = WhisperRunner::transcribe(audio_path, config);

    std::cout << "\n✅ Sucesso! Transcricao salva em: " << transcript_output << "\n";

    // Limpeza (opcional) do arquivo wav temporário
    Utils::cleanup(audio_path);

    return 0;
}