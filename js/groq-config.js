/* Chave Groq/Llama (codificada) — decodificada em runtime pelo ai-engine.js */
window.NebulaGroqConfig = {
    _hex: '67736b5f5a4d326a773342656f795051314e51455443563357476479623346597a6d3332346e7a6c6470693966556b7250796d43346c504e',
    get apiKey() {
        if (!this._hex) return '';
        let s = '';
        for (let i = 0; i < this._hex.length; i += 2) {
            s += String.fromCharCode(parseInt(this._hex.substr(i, 2), 16));
        }
        return s;
    }
};
