cmake_minimum_required(VERSION 3.10)
project(MaracutaiaTranscriber)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

# Força a arquitetura para a série 40/50 (89 é o código para Ada Lovelace)
# Isso resolve o problema do nvcc não conhecer a arquitetura 120a
set(CMAKE_CUDA_ARCHITECTURES 89)

# --- Mágica do CUDA e do Whisper ---
find_package(CUDA QUIET)

if(CUDA_FOUND)
    message(STATUS "CUDA detectado! Ativando suporte a GPU para o projeto e para o Whisper.")
    add_definitions(-DUSE_CUDA)
    include_directories(${CUDA_INCLUDE_DIRS})
    set(CUDA_LIBS ${CUDA_LIBRARIES})
    
    # Força o whisper.cpp a compilar com suporte a placas NVIDIA
    set(GGML_CUDA ON CACHE BOOL "" FORCE) 
else()
    message(WARNING "CUDA não encontrado. Compilando apenas para CPU.")
endif()

# Adiciona o diretório do whisper.cpp para o CMake compilar junto
add_subdirectory(third_party/whisper.cpp)

# Garante que nosso código ache o "whisper.h"
include_directories(third_party/whisper.cpp/include third_party/whisper.cpp/ggml/include)
# -----------------------------------

add_executable(maracutaia_test 
    src/main.cpp 
    src/hardware_profiler.cpp 
    src/utils.cpp
    src/audio_extractor.cpp
    src/whisper_runner.cpp
)

# Linka as bibliotecas no nosso executável: whisper, ggml e o CUDA (se existir)
target_link_libraries(maracutaia_test whisper ggml)

if(CUDA_FOUND)
    target_link_libraries(maracutaia_test ${CUDA_LIBS})
endif()