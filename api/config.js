/**
 * CONEXÃO CLUBES - API DE CONFIGURAÇÃO (Vercel)
 * Ficheiro: ./api/config.js
 * 
 * Função serverless que retorna as variáveis de ambiente
 * de forma segura sem expor as chaves no código cliente
 */

module.exports = function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        try {
            let firebaseConfig = null;

            // Tenta parsear FIREBASE_CONFIG_JSON se estiver configurado
            if (process.env.FIREBASE_CONFIG_JSON) {
                try {
                    firebaseConfig = typeof process.env.FIREBASE_CONFIG_JSON === 'string'
                        ? JSON.parse(process.env.FIREBASE_CONFIG_JSON)
                        : process.env.FIREBASE_CONFIG_JSON;
                } catch (parseErr) {
                    console.error('Erro ao fazer parse de FIREBASE_CONFIG_JSON:', parseErr.message);
                    console.error('Valor recebido:', String(process.env.FIREBASE_CONFIG_JSON || '').substring(0, 100));
                }
            }

            const config = {
                GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
                FIREBASE_CONFIG_JSON: firebaseConfig
            };

            res.status(200).json(config);
        } catch (err) {
            console.error('Erro ao carregar configuração:', err);
            res.status(500).json({
                error: 'Erro ao carregar configuração',
                message: err.message
            });
        }
    } else {
        res.status(404).json({ error: 'Método não suportado' });
    }
};
