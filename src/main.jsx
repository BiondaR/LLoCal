import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App.jsx';
import ConfigWindow from './components/ConfigWindow.jsx';
import './i18n';
import './index.css'; // SE ISSO AQUI FALTAR, A TELA FICA UM LIXO
import 'bootstrap-icons/font/bootstrap-icons.css';

// A janela de configurações carrega a mesma página; o rótulo da janela decide o que mostrar
const isConfigWindow = getCurrentWindow().label === 'config';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfigWindow ? <ConfigWindow /> : <App />}
  </React.StrictMode>,
);