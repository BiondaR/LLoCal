use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// Processos filhos em execução (transcritor, LLM, conversa...), para poder matar ao fechar
/// a janela. Pode haver mais de um: dá para conversar enquanto um artefato é gerado.
#[derive(Default)]
pub struct RunningChildren {
    children: Mutex<HashMap<u64, Child>>,
    next_id: AtomicU64,
}

impl RunningChildren {
    fn register(&self, child: Child) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.children.lock().unwrap().insert(id, child);
        id
    }

    /// Espera o processo terminar. Err se ele não está mais registrado, ou seja,
    /// foi morto porque o app está fechando.
    fn finish(&self, id: u64) -> Result<bool, String> {
        let child = self.children.lock().unwrap().remove(&id);
        match child {
            Some(mut child) => Ok(child.wait().map_err(|e| e.to_string())?.success()),
            None => Err("Processamento cancelado.".into()),
        }
    }

    pub fn kill_all(&self) {
        for (_, mut child) in self.children.lock().unwrap().drain() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[derive(Deserialize)]
pub struct FileItem {
    name: String,
    path: String,
}

/// Arquivo gerado que o usuário pode baixar (transcrição, resumo, mapa...).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    /// Tipo do arquivo; o rótulo exibido é traduzido no frontend
    kind: &'static str,
    /// Arquivo de origem, quando o artefato é de um arquivo só (transcrição)
    source: Option<String>,
    path: String,
    file_name: String,
}

impl Artifact {
    /// Artefato gravado na pasta do job; None se o arquivo não foi gerado.
    fn in_job(job_dir: &Path, kind: &'static str, file: &str, file_name: &str) -> Option<Self> {
        let path = job_dir.join(file);
        path.is_file().then(|| Artifact {
            kind,
            source: None,
            path: path.to_string_lossy().into_owned(),
            file_name: file_name.into(),
        })
    }
}

/// Artefato gerado sob demanda: o conteúdo para a interface e os arquivos para baixar.
#[derive(Serialize)]
pub struct Generated {
    data: serde_json::Value,
    artifacts: Vec<Artifact>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResult {
    summary: String,
    mindmap_svg: Option<String>,
    output_dir: String,
    artifacts: Vec<Artifact>,
}

#[derive(Serialize, Deserialize)]
pub struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Clone)]
struct Progress<'a> {
    name: &'a str,
    percent: u32,
}

/// Pasta do backend (transcritor C++ + llm_engine). Por enquanto aponta para a pasta do
/// projeto; LLOCAL_BACKEND_DIR permite trocar sem recompilar.
fn backend_dir() -> PathBuf {
    std::env::var_os("LLOCAL_BACKEND_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../backend"))
}

fn jobs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_cache_dir().map_err(|e| e.to_string())?.join("jobs"))
}

/// Garante que o caminho vindo do frontend aponta para dentro da pasta de jobs.
fn inside_jobs_dir(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let jobs = jobs_dir(app)?.canonicalize().map_err(|e| e.to_string())?;
    let path = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
    if !path.starts_with(&jobs) {
        return Err("Caminho fora da pasta de resultados.".into());
    }
    Ok(path)
}

/// Arquivo com as configurações salvas pela tela de configurações (modelo, idioma, prompts).
fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join("settings.json"))
}

/// Comando para um script do llm_engine. Com `app`, o script recebe as configurações salvas.
fn python_command(app: Option<&AppHandle>, script: &str) -> Result<Command, String> {
    let backend = backend_dir();
    let mut command = Command::new(backend.join("venv/bin/python"));
    command
        .arg(script)
        .current_dir(backend.join("llm_engine"))
        .env("PYTHONUNBUFFERED", "1");
    if let Some(app) = app {
        command.arg("--settings").arg(settings_path(app)?);
    }
    Ok(command)
}

/// Última linha do stderr do llm_engine, sem o prefixo "[!] ".
fn python_error(stderr: &str) -> String {
    let detail = last_lines(stderr, 1);
    detail.strip_prefix("[!] ").unwrap_or(&detail).to_string()
}

fn emit_progress_event(app: &AppHandle, event: &str, name: &str, percent: u32) {
    let _ = app.emit(event, Progress { name, percent });
}

fn emit_progress(app: &AppHandle, name: &str, percent: u32) {
    emit_progress_event(app, "process-progress", name, percent);
}

fn extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn last_lines(text: &str, n: usize) -> String {
    let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    lines[lines.len().saturating_sub(n)..].join("\n")
}

/// Extrai o N de uma linha "progress = N%".
fn parse_progress(line: &str) -> Option<u32> {
    let rest = line.split("progress =").nth(1)?;
    rest.trim().trim_end_matches('%').trim().parse().ok()
}

/// Roda o processo até o fim, entregando cada linha de `watched` (stdout ou stderr) ao
/// callback. Devolve (sucesso, saída completa do stream observado, saída do outro stream).
fn run_child(
    app: &AppHandle,
    mut command: Command,
    watch_stderr: bool,
    mut on_line: impl FnMut(&str),
) -> Result<(bool, String, String), String> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Não foi possível iniciar {:?}: {e}", command.get_program()))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let id = app.state::<RunningChildren>().register(child);

    let (watched, mut other): (Box<dyn Read + Send>, Box<dyn Read + Send>) = if watch_stderr {
        (Box::new(stderr), Box::new(stdout))
    } else {
        (Box::new(stdout), Box::new(stderr))
    };

    // O outro stream é drenado em paralelo para o processo não travar com o pipe cheio
    let other_reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = other.read_to_end(&mut buf);
        String::from_utf8_lossy(&buf).into_owned()
    });

    let mut watched_output = String::new();
    let mut reader = BufReader::new(watched);
    let mut buf = Vec::new();
    while reader.read_until(b'\n', &mut buf).map_err(|e| e.to_string())? > 0 {
        let line = String::from_utf8_lossy(&buf).into_owned();
        on_line(line.trim_end());
        watched_output.push_str(&line);
        buf.clear();
    }
    let other_output = other_reader.join().unwrap_or_default();

    let success = app.state::<RunningChildren>().finish(id)?;
    Ok((success, watched_output, other_output))
}

/// Transcreve um áudio/vídeo e devolve o caminho do .txt gerado dentro de `job_dir`.
fn transcribe(app: &AppHandle, job_dir: &Path, index: usize, file: &FileItem) -> Result<PathBuf, String> {
    let backend = backend_dir();
    let build = ["build-app", "build"]
        .iter()
        .map(|dir| backend.join(dir))
        .find(|dir| dir.join("maracutaia_test").is_file())
        .ok_or_else(|| format!("Transcritor não encontrado em {}", backend.display()))?;

    // O transcritor grava o .wav e o .txt ao lado do arquivo de entrada. Passando um link
    // dentro da pasta do job, nada é criado (nem sobrescrito) na pasta do usuário.
    let link = job_dir.join(format!("{index}.{}", extension(&file.path)));
    #[cfg(unix)]
    std::os::unix::fs::symlink(&file.path, &link).map_err(|e| e.to_string())?;
    #[cfg(not(unix))]
    fs::copy(&file.path, &link).map_err(|e| e.to_string())?;

    let whisper = build.join("third_party/whisper.cpp");
    let lib_path = std::env::join_paths(
        [whisper.join("src"), whisper.join("ggml/src"), whisper.join("ggml/src/ggml-cuda")]
            .into_iter()
            .chain(std::env::split_paths(&std::env::var_os("LD_LIBRARY_PATH").unwrap_or_default())),
    )
    .map_err(|e| e.to_string())?;

    let mut command = Command::new(build.join("maracutaia_test"));
    command
        .arg(&link)
        .current_dir(&backend) // o caminho do modelo (models/...) é relativo a essa pasta
        .env("LD_LIBRARY_PATH", lib_path);

    let (_, _stderr, stdout) = run_child(app, command, true, |line| {
        if let Some(percent) = parse_progress(line) {
            // 100% só depois de confirmar que a transcrição foi salva
            emit_progress(app, &file.name, percent.min(99));
        }
    })?;

    let transcript = job_dir.join(format!("{index}.wav.txt"));
    if !transcript.is_file() {
        return Err(format!("Falha ao transcrever {}:\n{}", file.name, last_lines(&stdout, 3)));
    }
    Ok(transcript)
}

fn run_pipeline(app: &AppHandle, files: &[FileItem], language: &str) -> Result<ProcessResult, String> {
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let job_dir = jobs_dir(app)?.join(stamp.to_string());
    fs::create_dir_all(&job_dir).map_err(|e| e.to_string())?;

    for file in files {
        if !Path::new(&file.path).is_file() {
            return Err(format!("Arquivo não encontrado: {}", file.path));
        }
        emit_progress(app, &file.name, 0);
    }

    // 1. Extração de texto: áudio/vídeo passam pelo Whisper, .txt entra direto,
    //    e os PDFs são lidos pelo próprio llm_engine no passo seguinte
    let mut texts: Vec<PathBuf> = Vec::new();
    let mut artifacts: Vec<Artifact> = Vec::new();
    let mut pdfs: HashMap<String, &str> = HashMap::new();
    for (index, file) in files.iter().enumerate() {
        match extension(&file.path).as_str() {
            "mp4" | "mp3" => {
                let transcript = transcribe(app, &job_dir, index, file)?;
                let stem = Path::new(&file.name).file_stem().unwrap_or_default().to_string_lossy();
                artifacts.push(Artifact {
                    kind: "transcript",
                    source: Some(file.name.clone()),
                    path: transcript.to_string_lossy().into_owned(),
                    file_name: format!("{stem}_transcricao.txt"),
                });
                texts.push(transcript);
                emit_progress(app, &file.name, 100);
            }
            "txt" => {
                texts.push(PathBuf::from(&file.path));
                emit_progress(app, &file.name, 100);
            }
            "pdf" => {
                pdfs.insert(file.path.clone(), &file.name);
            }
            other => return Err(format!("Formato não suportado: .{other}")),
        }
    }

    // 2. Resumo + mapa mental
    let mut command = python_command(Some(app), "summarizer.py")?;
    command.args(&texts);
    for file in files.iter().filter(|f| pdfs.contains_key(&f.path)) {
        command.arg("--pdf").arg(&file.path);
    }
    command.arg("--lang").arg(language).arg("--out-dir").arg(&job_dir);

    let (success, _stdout, stderr) = run_child(app, command, false, |line| {
        if let Some(path) = line.strip_prefix("@@pdf_done ") {
            if let Some(name) = pdfs.get(path) {
                emit_progress(app, name, 100);
            }
        } else if let Some(rest) = line.strip_prefix("@@pdf_progress ") {
            // "<percent> <caminho>"; o 100% fica para o pdf_done
            if let Some((percent, path)) = rest.split_once(' ') {
                if let (Ok(percent), Some(name)) = (percent.parse::<u32>(), pdfs.get(path)) {
                    emit_progress(app, name, percent.min(99));
                }
            }
        } else if let Some(stage) = line.strip_prefix("@@stage ") {
            let _ = app.emit("process-stage", stage);
        }
    })?;

    if !success {
        return Err(python_error(&stderr));
    }

    let summary = fs::read_to_string(job_dir.join("resumo.md"))
        .map_err(|e| format!("Resumo não foi gerado: {e}"))?;
    artifacts.extend(Artifact::in_job(&job_dir, "summary", "resumo.md", "resumo.md"));
    artifacts.extend(Artifact::in_job(&job_dir, "mindmap", "mapa.png", "mapa_mental.png"));

    Ok(ProcessResult {
        summary,
        mindmap_svg: fs::read_to_string(job_dir.join("mapa.svg")).ok(),
        output_dir: job_dir.to_string_lossy().into_owned(),
        artifacts,
    })
}

#[tauri::command]
pub async fn process_files(app: AppHandle, files: Vec<FileItem>, language: String) -> Result<ProcessResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_pipeline(&app, &files, &language))
        .await
        .map_err(|e| e.to_string())?
}

/// Copia um arquivo gerado para o destino escolhido pelo usuário no diálogo de salvar.
#[tauri::command]
pub fn save_artifact(app: AppHandle, source: String, dest: String) -> Result<(), String> {
    let source = inside_jobs_dir(&app, &source)?;
    fs::copy(source, dest).map(|_| ()).map_err(|e| e.to_string())
}

/// Conversa sobre o material do job. A resposta sai aos poucos pelo evento "chat-token"
/// e completa no retorno.
fn run_chat(app: &AppHandle, job_dir: &str, messages: &[ChatMessage], language: &str) -> Result<String, String> {
    let job_dir = inside_jobs_dir(app, job_dir)?;
    let mut child = python_command(Some(app), "chat.py")?
        .arg("--job-dir")
        .arg(&job_dir)
        .arg("--lang")
        .arg(language)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Não foi possível iniciar a conversa: {e}"))?;

    let history = serde_json::to_vec(messages).map_err(|e| e.to_string())?;
    // O stdin é fechado ao sair do escopo, sinalizando o fim do histórico
    child.stdin.take().unwrap().write_all(&history).map_err(|e| e.to_string())?;

    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let id = app.state::<RunningChildren>().register(child);

    let stderr_reader = std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stderr.read_to_string(&mut buf);
        buf
    });

    let mut answer = String::new();
    let mut pending: Vec<u8> = Vec::new();
    let mut buf = [0u8; 1024];
    loop {
        let read = stdout.read(&mut buf).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        pending.extend_from_slice(&buf[..read]);
        // Um caractere UTF-8 pode chegar partido entre duas leituras; só emite a parte completa
        let valid = match std::str::from_utf8(&pending) {
            Ok(_) => pending.len(),
            Err(e) => e.valid_up_to(),
        };
        if valid > 0 {
            let text = String::from_utf8_lossy(&pending[..valid]).into_owned();
            let _ = app.emit("chat-token", &text);
            answer.push_str(&text);
            pending.drain(..valid);
        }
    }
    let stderr = stderr_reader.join().unwrap_or_default();

    let success = app.state::<RunningChildren>().finish(id)?;
    if !success {
        return Err(python_error(&stderr));
    }
    Ok(answer)
}

#[tauri::command]
pub async fn chat(
    app: AppHandle,
    job_dir: String,
    messages: Vec<ChatMessage>,
    language: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_chat(&app, &job_dir, &messages, &language))
        .await
        .map_err(|e| e.to_string())?
}

/// Gera flashcards, teste ou audioresumo a partir do material do job (study.py).
fn run_generate(app: &AppHandle, job_dir: &str, kind: &str, language: &str) -> Result<Generated, String> {
    let job_dir = inside_jobs_dir(app, job_dir)?;
    // (tipo do artefato, arquivo no job, nome sugerido ao baixar)
    let files: &[(&'static str, &str, &str)] = match kind {
        "flashcards" => &[("flashcards", "flashcards.tsv", "flashcards.tsv")],
        "quiz" => &[("quiz", "quiz.md", "quiz.md")],
        "audio" => &[
            ("audio", "audioresumo.mp3", "audioresumo.mp3"),
            ("audioScript", "audioresumo_roteiro.txt", "audioresumo_roteiro.txt"),
        ],
        other => return Err(format!("Tipo de artefato desconhecido: {other}")),
    };

    let mut command = python_command(Some(app), "study.py")?;
    command
        .arg("--job-dir")
        .arg(&job_dir)
        .args(["--kind", kind, "--lang", language]);
    let (success, _stdout, stderr) = run_child(app, command, false, |_| {})?;
    if !success {
        return Err(python_error(&stderr));
    }

    let json = fs::read_to_string(job_dir.join(format!("{kind}.json"))).map_err(|e| e.to_string())?;
    Ok(Generated {
        data: serde_json::from_str(&json).map_err(|e| e.to_string())?,
        artifacts: files
            .iter()
            .filter_map(|(kind, file, file_name)| Artifact::in_job(&job_dir, kind, file, file_name))
            .collect(),
    })
}

#[tauri::command]
pub async fn generate_artifact(
    app: AppHandle,
    job_dir: String,
    kind: String,
    language: String,
) -> Result<Generated, String> {
    tauri::async_runtime::spawn_blocking(move || run_generate(&app, &job_dir, &kind, &language))
        .await
        .map_err(|e| e.to_string())?
}

/// Configurações salvas; objeto vazio se o usuário ainda não salvou nada.
#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<serde_json::Value, String> {
    match fs::read_to_string(settings_path(&app)?) {
        Ok(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        Err(_) => Ok(serde_json::json!({})),
    }
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: serde_json::Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    // Avisa a janela principal (idioma preferido)
    let _ = app.emit("settings-changed", &settings);
    Ok(())
}

/// Tudo que a tela de configurações precisa: o que está salvo, os valores padrão
/// (modelo e prompts) e os modelos instalados no Ollama.
#[derive(Serialize)]
pub struct Config {
    settings: serde_json::Value,
    defaults: serde_json::Value,
    models: Vec<String>,
}

/// Modelos instalados no Ollama: primeira coluna de `ollama list`, sem o cabeçalho.
/// Se o Ollama não responder, devolve vazio e a tela mostra só o modelo atual.
#[tauri::command]
pub fn list_models() -> Vec<String> {
    Command::new("ollama")
        .arg("list")
        .output()
        .map(|out| {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .skip(1)
                .filter_map(|line| line.split_whitespace().next().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

/// Baixa um modelo da biblioteca do Ollama (models.py). O progresso sai pelo evento
/// "model-pull-progress".
fn run_pull(app: &AppHandle, name: &str) -> Result<(), String> {
    let valid = !name.is_empty()
        && !name.starts_with('-')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || "._-/:".contains(c));
    if !valid {
        return Err(format!("Nome de modelo inválido: {name}"));
    }

    let mut command = python_command(None, "models.py")?;
    command.args(["pull", name]);
    let (success, _stdout, stderr) = run_child(app, command, false, |line| {
        if let Some(percent) = line.strip_prefix("@@pull ").and_then(|p| p.parse::<u32>().ok()) {
            emit_progress_event(app, "model-pull-progress", name, percent);
        }
    })?;
    if !success {
        return Err(python_error(&stderr));
    }
    Ok(())
}

#[tauri::command]
pub async fn pull_model(app: AppHandle, name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || run_pull(&app, &name))
        .await
        .map_err(|e| e.to_string())?
}

fn read_config(app: &AppHandle) -> Result<Config, String> {
    let output = python_command(None, "defaults.py")?
        .output()
        .map_err(|e| format!("Não foi possível ler os valores padrão: {e}"))?;
    if !output.status.success() {
        return Err(last_lines(&String::from_utf8_lossy(&output.stderr), 1));
    }
    let defaults = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;

    Ok(Config { settings: get_settings(app.clone())?, defaults, models: list_models() })
}

#[tauri::command]
pub async fn load_config(app: AppHandle) -> Result<Config, String> {
    tauri::async_runtime::spawn_blocking(move || read_config(&app))
        .await
        .map_err(|e| e.to_string())?
}
