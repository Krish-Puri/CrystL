/**
 * Standalone Gemini API verification script.
 * Run: node test-gemini-api.js
 *
 * Tests:
 * 1. API key is present
 * 2. Model is reachable (200 OK)
 * 3. Generates a valid response
 */

require("dotenv").config({ path: ".env.local" });

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

async function testGemini() {
  console.log(`\n=== Gemini API Verification ===`);
  console.log(`Model: ${MODEL}`);
  console.log(`API Key: ${API_KEY ? API_KEY.slice(0, 10) + "..." : "MISSING"}\n`);

  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY is not set in environment");
    process.exit(1);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  // Test 1: List available models
  console.log("--- Test 1: List Models ---");
  let workingModel = null;
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    const listData = await listRes.json();
    if (listRes.ok) {
      const models = listData.models ?? [];
      console.log(`✅ Connected. ${models.length} models visible.`);

      // Check if requested model works
      const matching = models.filter((m) => m.name.includes(MODEL.split("-")[1]));
      if (matching.length > 0) {
        console.log(`   '${MODEL}' found in model list:`);
        matching.forEach((m) => console.log(`   - ${m.name} (version: ${m.version})`));
      } else {
        console.log(`   ⚠️  '${MODEL}' NOT in model list. Available:`);
        models.slice(0, 15).forEach((m) => console.log(`   - ${m.name}`));
      }

      // Find recommended flash models that are likely to work (prefer 2.0 which is stable/free-tier friendly)
      const flashModels = models
        .filter((m) => m.name.includes("flash"))
        .map((m) => m.name.replace("models/", ""))
        .filter((n) => !n.includes("preview-tts") && !n.includes("computer-use") && !n.includes("image"));

      // Prefer 2.0-flash as it's stable and free-tier friendly
      const sorted = flashModels.sort((a, b) => {
        if (a.includes("2.0-flash")) return -1;
        if (b.includes("2.0-flash")) return 1;
        return 0;
      });

      console.log(`\n   Recommended working models:`);
      sorted.forEach((m) => console.log(`   - ${m}`));
      workingModel = sorted[0] ?? null;
    } else {
      console.error(`❌ List models failed: ${listRes.status} ${listRes.statusText}`);
      console.error("   Response:", JSON.stringify(listData, null, 2));
    }
  } catch (err) {
    console.error(`❌ Network error listing models: ${err.message}`);
  }

  // Test 2: Try the target model
  console.log(`\n--- Test 2: Try ${MODEL} ---`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Say hello in one sentence." }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 50 },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no text)";
      console.log(`✅ ${res.status} - Generation succeeded`);
      console.log(`   Response: "${text}"`);
    } else {
      const text = await res.text();
      console.error(`❌ ${res.status} ${res.statusText}`);
      console.error("   Response:", text);
    }
  } catch (err) {
    console.error(`❌ Network error: ${err.message}`);
  }

  // Test 3: Try recommended model if target failed
  if (workingModel && workingModel !== MODEL) {
    console.log(`\n--- Test 3: Try recommended model: ${workingModel} ---`);
    const altUrl = `https://generativelanguage.googleapis.com/v1beta/models/${workingModel}:generateContent?key=${API_KEY}`;
    try {
      const res = await fetch(altUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in one sentence." }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 50 },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no text)";
        console.log(`✅ ${res.status} - Generation succeeded with ${workingModel}`);
        console.log(`   Response: "${text}"`);
        console.log(`\n💡 Update .env.local: GEMINI_MODEL=${workingModel}`);
      } else {
        const text = await res.text();
        console.error(`❌ ${res.status} ${res.statusText}`);
        console.error("   Response:", text);
      }
    } catch (err) {
      console.error(`❌ Network error: ${err.message}`);
    }
  }

  console.log("\n=== Done ===\n");
}

testGemini();
