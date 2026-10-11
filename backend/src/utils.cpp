#include "utils.h"
#include <filesystem>
#include <iostream>

// Criando um alias pra nao ter que digitar std::filesystem toda hora
namespace fs = std::filesystem;

bool Utils::fileExists(const std::string& filepath) {
    // Checa se o caminho existe e se é um arquivo regular
    return fs::exists(filepath) && fs::is_regular_file(filepath);
}

void Utils::cleanup(const std::string& filepath) {
    if (fs::exists(filepath)) {
        // Tenta remover o arquivo e avisa se deu certo ou errado
        if (fs::remove(filepath)) {
            std::cout << "[Utils] Limpeza: Arquivo temporario removido (" << filepath << ")\n";
        } else {
            std::cerr << "[Utils] Aviso: Nao foi possivel remover o arquivo (" << filepath << ")\n";
        }
    }
}