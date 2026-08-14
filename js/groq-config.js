/* Chave Groq/Llama (codificada) — decodificada em runtime pelo ai-engine.js */
window.NebulaGroqConfig = {
    _hex: '67736b5f665a31774974344b654863705261447155394a4a5747647962334659504b664f30356a69446f716f673152344172753731506b75',
    get apiKey() {
        if (!this._hex) return '';
        let s = '';
        for (let i = 0; i < this._hex.length; i += 2) {
            s += String.fromCharCode(parseInt(this._hex.substr(i, 2), 16));
        }
        return s;
    }
};
