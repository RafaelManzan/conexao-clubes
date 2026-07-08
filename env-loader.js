/**
 * CONEXÃO CLUBES - SELETOR SEGURO DE VARIÁVEIS DE AMBIENTE
 * Ficheiro: ./env-loader.js
 */

function normalizarFirebaseConfig(valor) {
    if (!valor) return null;

    if (typeof valor === 'object' && valor !== null) {
        return valor;
    }

    if (typeof valor === 'string') {
        const texto = valor.trim();
        if (!texto) return null;

        if (texto.startsWith('{') || texto.startsWith('[')) {
            try {
                return JSON.parse(texto);
            } catch (err) {
                console.warn('env-loader: valor de FIREBASE_CONFIG_JSON inválido:', err.message);
            }
        }
    }

    return null;
}

export async function carregarAmbiente() {
    // 1. Detecta se está rodando localmente
    const isLocal = typeof window !== 'undefined' && 
                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    // 2. Se for local, usa a porta 3000. Se for no Render, usa a URL relativa do próprio servidor!
    const configUrl = isLocal ? 'http://127.0.0.1:3000/api/config' : '/api/config';

    try {
        console.debug(`env-loader: carregando configuração de ${configUrl}`);
        const response = await fetch(configUrl);

        if (!response.ok) {
            throw new Error(`Servidor retornou status ${response.status}`);
        }

        const config = await response.json();
        console.debug('env-loader: configuração carregada com sucesso');

        return {
            GEMINI_API_KEY: config?.GEMINI_API_KEY || "",
            FIREBASE_CONFIG_JSON: normalizarFirebaseConfig(config?.FIREBASE_CONFIG_JSON)
        };
    } catch (err) {
        console.warn(`⚠️ Erro ao carregar configuração: ${err.message}`);
        return null;
    }
}