#include "whisper_runner.h"
#include "whisper.h" // A biblioteca real que clonamos
#include <iostream>
#include <vector>
#include <fstream>

// Função auxiliar interna para ler o WAV (PCM 16-bit) e converter para float
bool read_wav_pcm(const std::string & fname, std::vector<float> & pcmf) {
    std::ifstream file(fname, std::ios::binary);
    if (!file.is_open()) return false;

    // Pula o cabeçalho do WAV (44 bytes) - simplificação para PCM 16-bit 16kHz
    file.seekg(44);

    int16_t sample;
    while (file.read(reinterpret_cast<char*>(&sample), sizeof(sample))) {
        pcmf.push_back(static_cast<float>(sample) / 32768.0f);
    }
    return true;
}

std::string WhisperRunner::detectLanguage(const std::string& audioPath, const WhisperConfig& config) {
    std::cout << "[WhisperRunner] Detectando idioma automaticamente...\n";
    
    // "auto" faz o próprio Whisper detectar o idioma no começo da transcrição;
    // o idioma detectado é impresso em transcribe()
    return "auto";
}

WhisperConfig WhisperRunner::autoConfigure(const HardwareProfile& hw) {
    WhisperConfig config;
    config.threads = (hw.logicalCores > 4) ? hw.logicalCores - 2 : hw.logicalCores;
    config.useGpu = hw.hasNvidiaGPU;
    config.language = "auto"; // O Whisper detecta o idioma do áudio
    config.modelPath = "models/ggml-large-v3.bin";
    return config;
}

std::string WhisperRunner::transcribe(const std::string& audioPath, const WhisperConfig& config) {
    // 1. Inicializa o contexto do Whisper
    struct whisper_context_params cparams = whisper_context_default_params();
    cparams.use_gpu = config.useGpu;

    struct whisper_context * ctx = whisper_init_from_file_with_params(config.modelPath.c_str(), cparams);
    if (ctx == nullptr) {
        return "Erro ao inicializar modelo!";
    }

    // 2. Carrega o áudio extraído
    std::vector<float> pcmf;
    if (!read_wav_pcm(audioPath, pcmf)) {
        return "Erro ao ler arquivo WAV!";
    }

    // 3. Configura os parâmetros de execução (STT)
    whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    wparams.print_progress   = true;
    wparams.print_timestamps = true;
    wparams.language         = config.language.c_str();
    wparams.n_threads        = config.threads;

    // Nessa versão do whisper.cpp o print_progress sozinho não imprime nada,
    // então reportamos o progresso no stderr para a interface conseguir ler
    wparams.progress_callback = [](struct whisper_context *, struct whisper_state *, int progress, void *) {
        std::cerr << "progress = " << progress << "%" << std::endl;
    };

    // 4. Roda a inferência (A mágica acontece aqui!)
    if (whisper_full(ctx, wparams, pcmf.data(), pcmf.size()) != 0) {
        return "Erro durante a transcricao!";
    }

    std::cout << "[WhisperRunner] Idioma do audio: " << whisper_lang_str(whisper_full_lang_id(ctx)) << "\n";

    // 5. Coleta o resultado e salva num .txt
    std::string outputText = "";
    const int n_segments = whisper_full_n_segments(ctx);
    for (int i = 0; i < n_segments; ++i) {
        outputText += whisper_full_get_segment_text(ctx, i);
        outputText += "\n";
    }

    std::string outputFileName = audioPath + ".txt";
    std::ofstream fout(outputFileName);
    fout << outputText;
    fout.close();

    whisper_free(ctx);
    return outputFileName;
}