#include "audio_extractor.h"
#include <iostream>
#include <cstdlib> // Para o system()
#include <filesystem>

namespace fs = std::filesystem;

std::string AudioExtractor::extractToWav(const std::string& videoPath) {
    // 1. Gera o nome do arquivo de saída (ex: aula.mp4 -> aula.wav)
    fs::path p(videoPath);
    std::string outputPath = p.replace_extension(".wav").string();

    // 2. Monta o comando FFmpeg otimizado:
    // -y: Sobrescreve se já existir
    // -i: Input
    // -vn: Desabilita vídeo (mais rápido)
    // -acodec pcm_s16le: Codec de áudio que o Whisper ama
    // -ar 16000: Sample rate de 16kHz
    // -ac 1: Mono (canal único)
    std::string command = "ffmpeg -y -i \"" + videoPath + "\" -vn -acodec pcm_s16le -ar 16000 -ac 1 \"" + outputPath + "\" > /dev/null 2>&1";

    std::cout << "[AudioExtractor] Executando FFmpeg...\n";
    
    // 3. Executa o comando no sistema
    int result = std::system(command.c_str());

    if (result == 0) {
        return outputPath;
    } else {
        std::cerr << "[AudioExtractor] Erro: FFmpeg falhou ou nao esta instalado no sistema.\n";
        return "";
    }
}