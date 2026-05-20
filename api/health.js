export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const hasKey = !!process.env.GROQ_API_KEY;
    const keyPreview = hasKey ? process.env.GROQ_API_KEY.slice(0, 8) + '...' : 'NÃO ENCONTRADA';
    
    // Testar conexão real com a Groq
    let groqStatus = 'não testado';
    if (hasKey) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
            });
            if (response.ok) {
                groqStatus = 'CONECTADO COM SUCESSO ✅';
            } else {
                const errText = await response.text();
                groqStatus = `ERRO ${response.status}: ${errText.slice(0, 200)}`;
            }
        } catch (e) {
            groqStatus = `FALHA DE CONEXÃO: ${e.message}`;
        }
    }

    return res.status(200).json({
        status: 'online',
        groq_api_key: keyPreview,
        groq_connection: groqStatus,
        timestamp: new Date().toISOString(),
        node_version: process.version
    });
}
