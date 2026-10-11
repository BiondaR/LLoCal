#ifndef AUDIO_EXTRACTOR_H
#define AUDIO_EXTRACTOR_H

#include <string>

class AudioExtractor {
public:
    // Recebe o caminho do vídeo e retorna o caminho do .wav gerado
    static std::string extractToWav(const std::string& videoPath);
};

#endif