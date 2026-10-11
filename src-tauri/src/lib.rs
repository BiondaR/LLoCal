use tauri::{Emitter, Manager};

mod pipeline;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(pipeline::RunningChildren::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Só a janela principal pede confirmação; a de configurações fecha direto
                if window.label() == "main" {
                    // Previne o fechamento padrão
                    api.prevent_close();
                    // Emite um evento customizado para o frontend decidir
                    window.emit("close-requested", ()).unwrap();
                }
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            pipeline::process_files,
            pipeline::save_artifact,
            pipeline::chat,
            pipeline::generate_artifact,
            pipeline::get_settings,
            pipeline::save_settings,
            pipeline::load_config,
            pipeline::list_models,
            pipeline::pull_model
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                // Não deixa o Whisper/LLM rodando depois que o app fecha
                app.state::<pipeline::RunningChildren>().kill_all();
            }
        });
}
