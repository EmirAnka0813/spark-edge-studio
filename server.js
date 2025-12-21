const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Ollama HTTP API: http://localhost:11434
async function ollamaChat({ model, messages }) {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false })
  });
  if (!res.ok) throw new Error("Ollama hata: HTTP " + res.status);
  const data = await res.json();
  return data?.message?.content ?? "";
}

function buildSystem({ theme, format, pack }) {
  const base = [
    "Türkçe yaz.",
    "Küfür yok.",
    "Net, kısa, satış odaklı ama komik olabilir.",
    "Çıktıyı düz metin ver, JSON verme."
  ];

  const themeMap = {
    influencer: "Hedef: Influencer/IG-TikTok dili. Enerjik, modern, genç.",
    oyun: "Hedef: Oyun reklamı. 13-14 yaş kitlesi. Komik, hype, kısa cümleler.",
    marka: "Hedef: Marka/ürün reklamı. Güven veren, profesyonel ama akıcı.",
    okul: "Hedef: Okul/kulüp duyurusu. Resmi, net, anlaşılır."
  };

  const formatMap = {
    ad: "Format: 1) 3 başlık 2) 1 açıklama 3) 1 CTA cümlesi",
    post: "Format: 1 post metni + 5 hashtag",
    script: "Format: 15 saniyelik kısa video metni + 3 sahne başlığı"
  };

  const packMap = {
    free: "Paket: Free (kısa tut, 1 varyasyon).",
    influencer: "Paket: Influencer (2 varyasyon üret).",
    pro: "Paket: Pro (3 varyasyon + ekstra 1 farklı ton)."
  };

  return [...base, themeMap[theme] || "", formatMap[format] || "", packMap[pack] || ""].join("\n");
}

app.post("/generate", async (req, res) => {
  try {
    const { prompt, theme = "influencer", format = "ad", pack = "free" } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt gerekli" });
    }

    const system = buildSystem({ theme, format, pack });

    const response = await ollamaChat({
      model: "llama3.1", // sende hangi model varsa onu yaz
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    });

    res.json({ response });
  } catch (e) {
    res.status(500).json({ error: e.message || "server error" });
  }
});

app.get("/", (_, res) => res.send("Spark Ad server OK"));

app.listen(3000, () => {
  console.log("SparkAd server running: http://localhost:3000");
});
