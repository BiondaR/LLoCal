#ifndef UTILS_H
#define UTILS_H

#include <string>

class Utils {
public:
    // Verifica se o arquivo existe e se é um arquivo de verdade (nao um diretorio)
    static bool fileExists(const std::string& filepath);
    
    // Apaga arquivos temporarios (como o .wav extraido)
    static void cleanup(const std::string& filepath);
};

#endif // UTILS_H