const express = require("express");

const app = express();
app.use(express.json());

// CORS (tarayıcı engellemesin)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "* ");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type ");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS ");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.post("/generate", async (req, res) => {
  try {
    const { model = "gemma3:4b", prompt = "" } = req.body || {};
    const r = await fetch("http://localhost:11434/api/generate", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ model, prompt, stream: false }),
    });

    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(3000, () => {
  console.log("SparkAd server running: http://localhost:3000 ");
});