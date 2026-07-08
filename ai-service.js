/**
 * CONEXÃO CLUBES - SERVIÇO CENTRAL DE INTELIGÊNCIA ARTIFICIAL
 * Ficheiro: ai-service.js
 */

// Carregar chave de API do ambiente
import { carregarAmbiente } from './env-loader.js';

let GEMINI_API_KEY = "";
let GEMINI_ENDPOINT = "";

// Inicializar as variáveis ao carregar o módulo
(async () => {
    const env = await carregarAmbiente();
    GEMINI_API_KEY = env.GEMINI_API_KEY;
    GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
})();

/**
 * Função Base de Conexão com o Gemini.
 */
export async function enviarParaGemini(promptComando, textoUsuario) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("SUA_CHAVE")) {
        console.error("AI-Service: Chave de API do Gemini não configurada.");
        return "Erro: Configuração de IA pendente.";
    }

    try {
        const payload = {
            contents: [
                {
                    parts: [
                        { 
                            text: `${promptComando}\n\nTexto do Utilizador:\n"${textoUsuario}"` 
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.4
            }
        };

        const response = await fetch(GEMINI_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const erroData = await response.json().catch(() => ({}));
            console.error("Erro na API do Gemini:", response.status, erroData);
            throw new Error(`Resposta com status ${response.status}`);
        }

        const data = await response.json();

        // Extração de texto para a rota v1beta generateContent
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        } else {
            console.warn("Estrutura de resposta inesperada:", data);
            return "Não foi possível extrair a resposta da IA.";
        }

    } catch (error) {
        console.error("Falha na comunicação com o serviço de IA:", error);
        return "Lamentamos, mas o serviço de IA está temporariamente indisponível.";
    }
}