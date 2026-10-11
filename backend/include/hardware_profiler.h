#ifndef HARDWARE_PROFILER_H
#define HARDWARE_PROFILER_H

// Estrutura limpa para armazenar o perfil da máquina
struct HardwareProfile {
    unsigned int logicalCores;
    unsigned long long totalRamGB;
    bool hasNvidiaGPU;
    unsigned long long vramGB;
};

// Classe estática (não precisamos instanciar um objeto para checar o hardware)
class HardwareProfiler {
public:
    static HardwareProfile analyze();
    static void printSummary(const HardwareProfile& profile);
};

#endif // HARDWARE_PROFILER_H