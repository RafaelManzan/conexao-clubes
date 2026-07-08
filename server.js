import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Inicializa o dotenv para carregar as variáveis do arquivo .env automaticamente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Permitir que o servidor entenda requisições no formato JSON
app.use(express.json());

// 🔥 A MÁGICA AQUI: Serve todos os arquivos estáticos da pasta raiz (HTML, CSS, JS)
// Agora você NÃO precisa de Live Server. O próprio Node entrega as suas páginas!
app.use(express.static(__dirname));

// 2. Rota de configuração que o seu 'env-loader.js' já espera receber
app.get('/api/config', (req, res) => {
    try {
        let firebaseConfig = null;
        
        // Verifica se a string do Firebase existe e faz o parse seguro para JSON
        if (process.env.FIREBASE_CONFIG_JSON) {
            firebaseConfig = typeof process.env.FIREBASE_CONFIG_JSON === 'string'
                ? JSON.parse(process.env.FIREBASE_CONFIG_JSON)
                : process.env.FIREBASE_CONFIG_JSON;
        }

        // Retorna as configurações para o frontend
        res.json({
            GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
            FIREBASE_CONFIG_JSON: firebaseConfig
        });
    } catch (err) {
        console.error('Erro ao processar as variáveis de ambiente:', err);
        res.status(500).json({ error: 'Erro interno no servidor de configuração' });
    }
});

// Inicializa o servidor na porta estipulada
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 CONEXÃO CLUBES RODANDO COM SUCESSO NO BACKEND!`);
    console.log(`👉 Acesse no seu navegador: http://localhost:${PORT}`);
    console.log(`==================================================\n`);
});