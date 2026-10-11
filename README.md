<div align="center">

# LLoCal

**LLoCal: a NotebookLM-style research notebook that runs on local LLMs**  
**LLoCal: um caderno de pesquisa no estilo NotebookLM que roda em LLMs locais**

[![Tauri](https://img.shields.io/badge/tauri-2-blue?logo=tauri)](https://tauri.app/)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue?logo=python)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/platform-linux-lightgrey?logo=linux)]()
[![License: AGPL v3+](https://img.shields.io/badge/license-AGPLv3%2B-green)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange)]()

</div>

---

Drop in lecture recordings, videos, PDFs and text files, and LLoCal turns them into study material — entirely on your own machine. Nothing is sent to a cloud service: transcription, reading, summarizing and speech all run locally.

> LLoCal is an independent project inspired by Google's NotebookLM. It is not affiliated with or endorsed by Google.

## What it does

Add MP4, MP3, PDF or TXT files, press **Process**, and you get:

- **Summary** — a didactic summary of everything you added.
- **Mind map** — a radial map of the main concepts, with zoom and pan.
- **Flashcards** — flip-through cards, exportable to Anki.
- **Quiz** — multiple-choice questions with explanations and a final score.
- **Audio summary** — a narrated overview, as an MP3.
- **Chat** — ask questions about your material.
- **Downloads** — transcripts, summary, mind map and everything else you generated.

Flashcards, quiz and audio are generated on demand, so you only wait for what you use.

## How it works

| Step | Tool |
| --- | --- |
| Speech to text | [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`large-v3`), with automatic language detection |
| PDFs | Digital text is read directly with PyMuPDF; scanned pages and figures are sent as images to a multimodal model |
| Summaries, mind map topics, flashcards, quiz, chat | A local model served by [Ollama](https://ollama.com) (default: `gemma3:12b`) |
| Mind map drawing | [Graphviz](https://graphviz.org) |
| Text to speech | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), with [Piper](https://github.com/OHF-Voice/piper1-gpl) as a fallback |
| Desktop app | [Tauri](https://tauri.app) + React |

The settings window lets you pick the model, download other open-weight models from the Ollama library, choose your preferred language and edit the prompt behind each artifact.

## Languages

The interface and everything LLoCal generates are available in:

| Language | Status |
| --- | --- |
| Portuguese (Brazil) | Used and checked by the author |
| English | Checked by the author |
| Spanish | Checked by the author |
| French | **Untested by a speaker** |
| German | **Untested by a speaker** |
| Italian | **Untested by a speaker** |

The French, German and Italian interface texts were machine-written and have not been reviewed by anyone fluent, and the quality of the generated content and voices in those languages has not been judged by a speaker either. Corrections are very welcome.

The language of the audio or video you add is detected automatically by Whisper and is independent of the language you choose for the results.

## Status

LLoCal is an early-stage personal project. Please expect rough edges:

- **It still needs deeper testing.** So far it has only been tried by the author on a handful of lectures, papers and PDFs. The accuracy and quality of what it generates — summaries, mind maps, flashcards, quizzes, audio and chat answers — have not been systematically evaluated, so check the results against your original material before relying on them.
- Developed and tested only on **Linux with an NVIDIA GPU** (RTX 5080, 16 GB VRAM). `backend/CMakeLists.txt` pins the CUDA architecture for RTX 40/50-series cards; other GPUs may need a different value. A CPU-only build is supposed to work but has not been tried.
- It runs in **development mode** (`npm run tauri dev`). There is no packaged installer yet: the app looks for the transcriber, the Python environment and the models inside the `backend/` folder of the source tree.
- Material that does not fit the model context (16k tokens) is first condensed into notes, section by section, so long sources take longer and lose some detail. Multi-hour recordings have not been stress-tested.
- Code comments and internal messages are mostly in Portuguese.

## Requirements

- Linux, plus the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your distribution
- [Rust](https://rustup.rs) and [Node.js](https://nodejs.org) 20 or newer
- CMake and a C++17 compiler; the CUDA toolkit for GPU transcription
- Python 3.10 or newer
- `ffmpeg` and `graphviz`
- [Ollama](https://ollama.com), running locally and up to date (older versions refuse to download current models)
- Roughly 15 GB of disk for the default models

## Setup

```bash
git clone --recurse-submodules https://github.com/BiondaR/LLoCal.git
cd LLoCal/backend

# 1. Build the transcriber
cmake -S . -B build-app -DCMAKE_BUILD_TYPE=Release
cmake --build build-app -j

# 2. Download the Whisper model (about 3 GB)
mkdir -p models
sh third_party/whisper.cpp/models/download-ggml-model.sh large-v3 models

# 3. Python environment
python3 -m venv venv
venv/bin/python -m pip install -r llm_engine/requirements.txt

# 4. Voices for the audio summary
mkdir -p models/kokoro models/piper
curl -L -o models/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o models/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
venv/bin/python -m piper.download_voices de_DE-thorsten-medium --data-dir models/piper   # German uses Piper

# 5. The default language model (about 8 GB)
ollama pull gemma3:12b

# 6. Run the app
cd ..
npm install
npm run tauri dev
```

## Project layout

```
src/                  React interface
src-tauri/            Tauri shell (Rust): runs the backend and reports progress
backend/src/          C++ transcriber built on whisper.cpp
backend/llm_engine/   Python: PDF reading, prompts, mind map, flashcards, quiz, audio, chat
```

Two environment variables are available for tinkering: `LLOCAL_BACKEND_DIR` (where the backend lives) and `LLOCAL_LLM_MODEL` (default model when none is saved in the settings).

## License

Copyright (C) 2026 Bionda Rozin (<bionda.rozin@unesp.br>)

LLoCal is free software, released under the [GNU Affero General Public License](LICENSE), version 3 or (at your option) any later version.

It depends on components with copyleft licenses of their own: PyMuPDF (AGPL-3.0), used to read PDFs, and Piper and phonemizer/espeak-ng (GPL-3.0), used for the audio summary. The language models and voices you download are covered by their own terms.

## Acknowledgements

LLoCal stands on whisper.cpp, Ollama, Gemma, Kokoro, Piper, Graphviz, PyMuPDF and Tauri.
