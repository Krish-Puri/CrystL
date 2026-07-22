/**
 * Standalone Groq API verification script.
 * Run: node test-groq.js
 */

require("dotenv").config({ path: ".env.local" });

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

async function testGroq() {
  console.log(`\n=== Groq API Verification ===`);
  console.log(`Model: ${MODEL}`);
  console.log(`API Key: ${GROQ_API_KEY ? GROQ_API_KEY.slice(0, 10) + "..." : "MISSING"}\n`);

  if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY is not set in .env.local");
    process.exit(1);
  }

  // Test: List models (Groq doesn't have a dedicated list endpoint via OpenAI compat,
  // but we can test a cheap completion)
  console.log("--- Test: Generate Content ---");
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Say hello in one sentence." }],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "(no text)";
      console.log(`✅ ${res.status} - Generation succeeded`);
      console.log(`   Response: "${text}"`);
      console.log(`   Tokens - prompt: ${data.usage?.prompt_tokens}, completion: ${data.usage?.completion_tokens}`);
    } else {
      const text = await res.text();
      console.error(`❌ ${res.status} ${res.statusText}`);
      console.error("   Response:", text);
    }
  } catch (err) {
    console.error(`❌ Network error: ${err.message}`);
  }

  // Test: JSON structured output (same pattern as orchestrator)
  console.log("\n--- Test: Structured JSON Output ---");
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: `Return valid JSON with this exact shape, no markdown:
{
  "response": "a short reply",
  "intent": "vent|reflect|advice|context",
  "phase": "explore|clarify|support"
}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 128,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "(no text)";
      console.log(`✅ ${res.status} - JSON structured output succeeded`);
      console.log(`   Raw response: ${text}`);
      try {
        const parsed = JSON.parse(text);
        console.log(`   Parsed successfully:`, parsed);
      } catch {
        console.error(`   ⚠️  Could not parse as JSON`);
      }
    } else {
      const text = await res.text();
      console.error(`❌ ${res.status} ${res.statusText}`);
      console.error("   Response:", text);
    }
  } catch (err) {
    console.error(`❌ Network error: ${err.message}`);
  }

  console.log("\n=== Done ===\n");
}

testGroq();
