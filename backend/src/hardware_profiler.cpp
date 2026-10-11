#include "hardware_profiler.h"
#include <iostream>
#include <thread>

// Inclusão de bibliotecas nativas de acordo com o Sistema Operacional
#if defined(_WIN32)
    #include <windows.h>
#elif defined(__linux__)
    #include <sys/sysinfo.h>
#elif defined(__APPLE__)
    #include <sys/types.h>
    #include <sys/sysctl.h>
#endif

// Inclusão do CUDA apenas se a flag de compilação for ativada
#ifdef USE_CUDA
    #include <cuda_runtime.h>
#endif

HardwareProfile HardwareProfiler::analyze() {
    HardwareProfile profile = {0, 0, false, 0};

    // 1. Checagem de CPU (Multiplataforma nativo do C++11)
    // Retorna o número de threads lógicas (ex: um processador de 8 núcleos e 16 threads retorna 16)
    profile.logicalCores = std::thread::hardware_concurrency();

    // 2. Checagem de RAM (Específico por SO para ser preciso)
    #if defined(_WIN32)
        MEMORYSTATUSEX statex;
        statex.dwLength = sizeof(statex);
        GlobalMemoryStatusEx(&statex);
        profile.totalRamGB = statex.ullTotalPhys / (1024 * 1024 * 1024);
    #elif defined(__linux__)
        struct sysinfo info;
        sysinfo(&info);
        profile.totalRamGB = (info.totalram * info.mem_unit) / (1024 * 1024 * 1024);
    #elif defined(__APPLE__)
        int mib[2] = { CTL_HW, HW_MEMSIZE };
        uint64_t physical_memory = 0;
        size_t length = sizeof(physical_memory);
        sysctl(mib, 2, &physical_memory, &length, NULL, 0);
        profile.totalRamGB = physical_memory / (1024 * 1024 * 1024);
    #else
        profile.totalRamGB = 0; // Fallback se for um SO alienígena
    #endif

    // 3. Checagem de GPU (Focado na API do CUDA)
    #ifdef USE_CUDA
        int deviceCount = 0;
        cudaError_t error = cudaGetDeviceCount(&deviceCount);
        if (error == cudaSuccess && deviceCount > 0) {
            profile.hasNvidiaGPU = true;
            cudaDeviceProp prop;
            cudaGetDeviceProperties(&prop, 0); // Pega os dados da GPU primária (índice 0)
            profile.vramGB = prop.totalGlobalMem / (1024 * 1024 * 1024);
        }
    #else
        profile.hasNvidiaGPU = false;
        profile.vramGB = 0;
    #endif

    return profile;
}

void HardwareProfiler::printSummary(const HardwareProfile& profile) {
    std::cout << "\n--- [ Hardware Profile ] ---\n";
    std::cout << "Processador : " << profile.logicalCores << " threads disponiveis\n";
    std::cout << "Memoria RAM : " << profile.totalRamGB << " GB\n";
    
    if (profile.hasNvidiaGPU) {
        std::cout << "Acelerador  : GPU NVIDIA com " << profile.vramGB << " GB de VRAM\n";
    } else {
        std::cout << "Acelerador  : Nenhum detectado. Usando modo CPU estrito.\n";
    }
    std::cout << "----------------------------\n\n";
}