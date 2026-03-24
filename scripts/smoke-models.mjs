import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

loadDotEnv(path.join(cwd, '.env'));

const env = process.env;
const results = [];

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function logResult(provider, capability, status, detail) {
  results.push({ provider, capability, status, detail });
  const icon = status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL';
  console.log(`[${icon}] ${provider}/${capability}: ${detail}`);
}

function assertOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${response.statusText}`);
  }
}

function makeSilentWavBase64(seconds = 1, sampleRate = 16000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer.toString('base64');
}

async function runOpenAI() {
  const key = env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY;
  if (!key) {
    logResult('openai', 'all', 'SKIP', 'Missing VITE_OPENAI_API_KEY/OPENAI_API_KEY');
    return;
  }

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  try {
    const chatModel = env.SMOKE_OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    const chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: 'user', content: 'Say only: ok' }],
        temperature: 0,
      }),
    });
    assertOk(chatResp, 'OpenAI chat');
    const chatData = await chatResp.json();
    const text = chatData?.choices?.[0]?.message?.content || '';
    logResult('openai', 'chat', text ? 'PASS' : 'FAIL', text ? `Model ${chatModel} responded` : 'Empty response');
  } catch (err) {
    logResult('openai', 'chat', 'FAIL', String(err));
  }

  try {
    const ttsModel = env.SMOKE_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
    const ttsResp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ttsModel,
        voice: 'nova',
        input: 'Hello from smoke test.',
        response_format: 'mp3',
      }),
    });
    assertOk(ttsResp, 'OpenAI TTS');
    const arr = await ttsResp.arrayBuffer();
    logResult('openai', 'tts', arr.byteLength > 0 ? 'PASS' : 'FAIL', `bytes=${arr.byteLength}`);
  } catch (err) {
    logResult('openai', 'tts', 'FAIL', String(err));
  }

  try {
    const imageModel = env.SMOKE_OPENAI_IMAGE_MODEL || 'gpt-image-1-mini';
    const imageResp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: imageModel, prompt: 'A simple blue square icon', n: 1 }),
    });
    assertOk(imageResp, 'OpenAI image');
    const imageData = await imageResp.json();
    const ok = Boolean(imageData?.data?.[0]?.url || imageData?.data?.[0]?.b64_json);
    logResult('openai', 'image', ok ? 'PASS' : 'FAIL', ok ? `Model ${imageModel} returned image payload` : 'No image payload');
  } catch (err) {
    logResult('openai', 'image', 'FAIL', String(err));
  }

  try {
    const sttModel = env.SMOKE_OPENAI_STT_MODEL || 'whisper-1';
    const form = new FormData();
    const wav = Buffer.from(makeSilentWavBase64(), 'base64');
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'sample.wav');
    form.append('model', sttModel);
    form.append('language', 'en');

    const sttResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    assertOk(sttResp, 'OpenAI STT');
    const sttData = await sttResp.json();
    logResult('openai', 'stt', typeof sttData?.text === 'string' ? 'PASS' : 'FAIL', `textLen=${(sttData?.text || '').length}`);
  } catch (err) {
    logResult('openai', 'stt', 'FAIL', String(err));
  }
}

async function runGemini() {
  const key = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!key) {
    logResult('gemini', 'all', 'SKIP', 'Missing VITE_GEMINI_API_KEY/GEMINI_API_KEY');
    return;
  }

  try {
    const chatModel = env.SMOKE_GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say only: ok' }] }] }),
    });
    assertOk(resp, 'Gemini chat');
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    logResult('gemini', 'chat', text ? 'PASS' : 'FAIL', text ? `Model ${chatModel} responded` : 'Empty response');
  } catch (err) {
    logResult('gemini', 'chat', 'FAIL', String(err));
  }

  try {
    const ttsModel = env.SMOKE_GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: { parts: [{ text: 'Hello from smoke test.' }] },
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      }),
    });
    assertOk(resp, 'Gemini TTS');
    const data = await resp.json();
    const audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    logResult('gemini', 'tts', audio ? 'PASS' : 'FAIL', audio ? `audioLen=${audio.length}` : 'No audio payload');
  } catch (err) {
    logResult('gemini', 'tts', 'FAIL', String(err));
  }

  try {
    const imageModel = env.SMOKE_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'A simple blue square icon' }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    assertOk(resp, 'Gemini image');
    const data = await resp.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    logResult('gemini', 'image', Boolean(part) ? 'PASS' : 'FAIL', part ? 'Image payload received' : 'No image payload');
  } catch (err) {
    logResult('gemini', 'image', 'FAIL', String(err));
  }

  try {
    const sttModel = env.SMOKE_GEMINI_STT_MODEL || 'gemini-2.5-flash';
    const audioBase64 = makeSilentWavBase64();
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${sttModel}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: {
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
            { text: 'Transcribe exactly what was said in English. Output only the transcription text.' },
          ],
        },
      }),
    });
    assertOk(resp, 'Gemini STT');
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    logResult('gemini', 'stt', typeof text === 'string' ? 'PASS' : 'FAIL', `textLen=${text.length}`);
  } catch (err) {
    logResult('gemini', 'stt', 'FAIL', String(err));
  }
}

async function runGroq() {
  const key = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY;
  if (!key) {
    logResult('groq', 'all', 'SKIP', 'Missing VITE_GROQ_API_KEY/GROQ_API_KEY');
    return;
  }

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  try {
    const chatModel = env.SMOKE_GROQ_CHAT_MODEL || 'llama-3.1-8b-instant';
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: 'user', content: 'Say only: ok' }],
        temperature: 0,
      }),
    });
    assertOk(resp, 'Groq chat');
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';
    logResult('groq', 'chat', text ? 'PASS' : 'FAIL', text ? `Model ${chatModel} responded` : 'Empty response');
  } catch (err) {
    logResult('groq', 'chat', 'FAIL', String(err));
  }

  try {
    const ttsModel = env.SMOKE_GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
    const resp = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ttsModel,
        voice: 'hannah',
        input: 'Hello from smoke test.',
        response_format: 'wav',
      }),
    });
    assertOk(resp, 'Groq TTS');
    const arr = await resp.arrayBuffer();
    logResult('groq', 'tts', arr.byteLength > 0 ? 'PASS' : 'FAIL', `bytes=${arr.byteLength}`);
  } catch (err) {
    logResult('groq', 'tts', 'FAIL', String(err));
  }

  logResult('groq', 'image', 'SKIP', 'Not supported by Groq');

  try {
    const sttModel = env.SMOKE_GROQ_STT_MODEL || 'whisper-large-v3-turbo';
    const form = new FormData();
    const wav = Buffer.from(makeSilentWavBase64(), 'base64');
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'sample.wav');
    form.append('model', sttModel);
    form.append('language', 'en');

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    assertOk(resp, 'Groq STT');
    const data = await resp.json();
    logResult('groq', 'stt', typeof data?.text === 'string' ? 'PASS' : 'FAIL', `textLen=${(data?.text || '').length}`);
  } catch (err) {
    logResult('groq', 'stt', 'FAIL', String(err));
  }
}

async function main() {
  console.log('Running model smoke tests (REST)');
  await runOpenAI();
  await runGemini();
  await runGroq();

  const failed = results.filter((r) => r.status === 'FAIL');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`\nSummary: PASS=${passed} SKIP=${skipped} FAIL=${failed.length}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
