from flask import Flask, render_template, request, jsonify
from datetime import datetime

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# Dados temporários (depois a gente troca por banco)
OBRAS = [
    {
        "id": 1,
        "titulo": "Guernica",
        "artista": "Pablo Picasso",
        "ano": "1937",
        "imagem": "https://upload.wikimedia.org/wikipedia/en/7/74/PicassoGuernica.jpg"
    },
    {
        "id": 2,
        "titulo": "A Noite Estrelada",
        "artista": "Van Gogh",
        "ano": "1889",
        "imagem": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Van_Gogh_-_Starry_Night.jpg"
    },
    {
        "id": 3,
        "titulo": "Mona Lisa",
        "artista": "Leonardo da Vinci",
        "ano": "1503",
        "imagem": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa.jpg"
    }
]

TAGS = []
USERS = []

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/obras")
def obras():
    return jsonify(OBRAS)

@app.route("/api/questionario", methods=["POST"])
def questionario():
    data = request.json
    USERS.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        **data
    })
    return jsonify({"msg": "Questionário salvo!"})

@app.route("/api/tags", methods=["POST"])
def tags():
    data = request.json
    TAGS.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        **data
    })
    return jsonify({"msg": "Tag salva!"})

if __name__ == "__main__":
    app.run()