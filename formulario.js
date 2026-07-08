/**
 * CONEXÃO CLUBES - MÓDULO DE FORMULÁRIOS E SUGESTÕES
 * Ficheiro: js/formulario.js (Versão Protegida contra Erros de ID)
 */

import { enviarParaGemini } from './ai-service.js';

document.addEventListener("DOMContentLoaded", () => {
    const btnAprimorarIA = document.getElementById("btnAprimorarIA");
    const campoDescricao = document.getElementById("sugestaoDescricao");

    if (btnAprimorarIA && campoDescricao) {
        btnAprimorarIA.addEventListener("click", async () => {
            const textoOriginal = campoDescricao.value.trim();

            if (!textoOriginal) {
                alert("Por favor, escreva um breve rascunho ou ideia sobre o clube antes de aprimorar com a IA.");
                campoDescricao.focus();
                return;
            }

            // --- CAPTURA SEGURA DOS CAMPOS (Evita o ReferenceError se o ID não existir) ---
            const campoNome = document.getElementById("sugestaoNome") || 
                              document.getElementById("nomeClube") || 
                              document.getElementById("nome");
            
            const campoCategoria = document.getElementById("sugestaoCategoria") || 
                                  document.getElementById("categoriaClube") || 
                                  document.getElementById("categoria");

            // Se o campo existir, pega o valor. Se não existir, define um texto padrão estável.
            const nomeDoClubeDigitado = campoNome ? campoNome.value.trim() : "";
            const categoriaDoClubeSelecionada = campoCategoria ? campoCategoria.value : "Geral";

            const contextoNome = nomeDoClubeDigitado ? nomeDoClubeDigitado : "Não especificado ainda";
            // -------------------------------------------------------------------------------

            // Estado Visual de Carregamento
            const btnTexto = btnAprimorarIA.querySelector(".btn-ia-texto");
            const btnSpinner = btnAprimorarIA.querySelector(".btn-ia-spinner");

            btnAprimorarIA.disabled = true;
            if (btnTexto) btnTexto.style.display = "none";
            if (btnSpinner) btnSpinner.style.display = "inline";
            
            campoDescricao.placeholder = "A analisar os dados para gerar a justificativa perfeita...";

            // PROMPT RÍGIDO: Usamos as variáveis locais seguras criadas acima
            const promptComando = 
                "Atue como um coordenador pedagógico escolar. O teu objetivo é resumir e organizar a justificativa de um clube estudantil.\n\n" +
                "CONTEXTO DO CLUBE:\n" +
                `- Nome do Clube: "${contextoNome}"\n` +
                `- Categoria: "${categoriaDoClubeSelecionada}"\n\n` +
                "Regras Rígidas de Formatação:\n" +
                "1. O texto deve focar estritamente e especificamente nas atividades práticas do tema deste clube (por exemplo, se o nome for basquete, fale especificamente sobre jogar basquete, treinos e tabelas).\n" +
                "2. O texto deve ser extremamente breve, contendo no máximo 3 frases.\n" +
                "3. NUNCA mencione o nome 'Conexão Clubes' ou termos como 'vote na nossa plataforma'.\n" +
                "4. Retorne APENAS o texto polido final, sem títulos chamativos, sem aspas, sem introduções e sem explicações.";

            try {
                const resultadoIA = await enviarParaGemini(promptComando, textoOriginal);

                if (resultadoIA.startsWith("Erro:") || resultadoIA.startsWith("Lamentamos,")) {
                    alert(resultadoIA);
                } else {
                    campoDescricao.value = resultadoIA;
                }

            } catch (error) {
                console.error("Erro no fluxo do formulário com IA:", error);
            } finally {
                btnAprimorarIA.disabled = false;
                if (btnTexto) btnTexto.style.display = "inline";
                if (btnSpinner) btnSpinner.style.display = "none";
                campoDescricao.placeholder = "Explica resumidamente por que razão a escola devia ter este clube...";
            }
        });
    }
});