const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---- Ayarlar ----
const PROJECT_ROOT = path.resolve(__dirname, ".."); // Spark Ad klasörü
const TARGET_FILES = ["sparkad.html", "server.js"]; // otomatik güncellenecek dosyalar
const OLLAMA_MODEL = "gemma3:4b"; // sende çalışan model

function readFileSafe(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function backupFile(filePath) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(PROJECT_ROOT, ".backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const base = path.basename(filePath);
  const backupPath = path.join(backupDir, `${base}.${ts}.bak`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

async function ollamaChat(system, user) {
  const payload = {
    model: OLLAMA_MODEL,
    prompt: `${system}\n\nKULLANICI İSTEĞİ:\n${user}\n`,
    stream: false
  };

  const r = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const data = await r.json();
  return data.response || "";
}

function extractJson(text) {
  // Sadece JSON dönmesini isteyeceğiz ama yine de güvenli çekelim
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

function applyEdits(edits) {
  // edits: [{file, content}]
  for (const e of edits) {
    const fp = path.join(PROJECT_ROOT, e.file);
    if (!TARGET_FILES.includes(e.file)) {
      console.log(`⛔ İzin verilmeyen dosya: ${e.file} (atlandı)`);
      continue;
    }
    if (!fs.existsSync(fp)) {
      console.log(`⛔ Dosya bulunamadı: ${e.file} (atlandı)`);
      continue;
    }
    const backup = backupFile(fp);
    fs.writeFileSync(fp, e.content, "utf8");
    console.log(`✅ Güncellendi: ${e.file} (yedek: ${path.basename(backup)})`);
  }
}

async function main() {
  console.log("⚡ SparkAd Auto-Agent (Ollama) başladı");
  console.log("Yaz: örn. 'Kopyala butonu ekle' veya 'UI'yi modern yap'");
  console.log("Çıkış: exit\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const system = `
SEN BİR FULL-STACK DEVELOPER AJANSIN.
Amaç: SparkAd Studio projesini otomatik geliştirmek.

KURALLAR:
- SADECE JSON döndür.
- JSON formatı:
{
  "edits": [
    {"file":"sparkad.html","content":"...tam dosya içeriği..."},
    {"file":"server.js","content":"...tam dosya içeriği..."}
  ],
  "notes": "kısa not"
}
- "content" alanı DOSYANIN TAM HALİ olmalı (patch değil).
- Sadece bu iki dosyaya dokun: sparkad.html, server.js
- Mevcut çalışır özellikleri bozma.
- Türkçe arayüz metinlerini koru.

PROJE DOSYALARI:
`;

  while (true) {
    const user = await new Promise((res) => rl.question("🛠️ İstek > ", res));
    if (!user) continue;
    if (user.trim().toLowerCase() === "exit") break;

    // Dosyaları modele ver
    let context = "";
    for (const f of TARGET_FILES) {
      const fp = path.join(PROJECT_ROOT, f);
      const content = readFileSafe(fp);
      context += `\n\n--- ${f} ---\n${content}\n`;
    }

    try {
      console.log("⏳ Ollama düşünüyor...");
      const resp = await ollamaChat(system + context, user);
      const json = extractJson(resp);

      if (!json || !Array.isArray(json.edits)) {
        console.log("❌ Model geçerli JSON döndürmedi. Çıktı:\n", resp);
        continue;
      }

      // uygula
      applyEdits(json.edits);

      if (json.notes) console.log("📝 Not:", json.notes);
      console.log("✅ Bitti. (Gerekirse server'ı yeniden başlat)\n");
    } catch (e) {
      console.log("❌ Hata:", e.message);
    }
  }

  rl.close();
  console.log("👋 Agent kapandı");
}

main();
