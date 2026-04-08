// Supabase Edge Function: ai-proxy — thin router delegating to extracted modules
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getApiKey, saveApiKey, normalizeSource } from './api-keys.ts'
import { createRequestLogger } from './log.ts'
import * as openai from './providers/openai.ts'
import * as gemini from './providers/gemini.ts'
import * as groq from './providers/groq.ts'
import * as openrouter from './providers/openrouter.ts'
import * as vertex from './providers/vertex.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!
if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY environment variable not set')
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const key = (uid: string, src: string) => getApiKey(supabase, ENCRYPTION_KEY, uid, src)
const save = (uid: string, src: string, k: string) => saveApiKey(supabase, ENCRYPTION_KEY, uid, src, k)

async function resolveImage(url: string): Promise<{ data: string; mime: string }> {
  if (url.startsWith('data:')) { const m = url.match(/^data:([^;]+);base64,(.+)$/); if (!m) throw new Error('Invalid data URL'); return { mime: m[1], data: m[2] } }
  const r = await fetch(url); const b = await r.blob()
  return { mime: b.type || 'image/png', data: await b.arrayBuffer().then(buf => btoa(String.fromCharCode(...new Uint8Array(buf)))) }
}
const vertexCtx = (uid: string) => Promise.all([vertex.getAccessToken(), vertex.getConfig(supabase, uid)])
const isGlmLike = (s: string) => s === 'genai' || s === 'vertex'
const needKey = (apiKey: string | null, src: string) => { if (!apiKey) throw new Error(`No ${src} API key configured`) }

async function handleChat(body: Record<string, unknown>, uid: string): Promise<string> {
  const source = normalizeSource(body.source || body.provider, 'genai')
  const model = (body.model || (isGlmLike(source) ? 'gemini-2.5-flash' : 'gpt-4o-mini')) as string
  if (body.imageMode) {
    if (source === 'vertex') { const [at, cfg] = await vertexCtx(uid); const img = await resolveImage(body.imageUrl as string); return vertex.chatWithImage(at, cfg.projectId, cfg.region, model, body.systemPrompt as string, img.data, img.mime) }
    if (source === 'genai') {
      const ak = await key(uid, source); needKey(ak, source); const img = await resolveImage(body.imageUrl as string)
      const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.21.0')
      const resp = await new GoogleGenerativeAI({ apiKey: ak }).models.generateContent({ model, systemInstruction: body.systemPrompt as string, contents: [{ role: 'user', parts: [{ inlineData: { mimeType: img.mime, data: img.data } }, { text: 'Please create a question about this image as instructed.' }] }] })
      return resp.candidates[0].content.parts[0].text
    }
    const ak = await key(uid, source); needKey(ak, source)
    return source === 'openrouter' ? openrouter.chat(ak, model, body.systemPrompt as string, body.imageUrl as string) : openai.chat(ak, model, body.systemPrompt as string, body.imageUrl as string, body.temperature as number)
  }
  if (source === 'vertex') { const [at, cfg] = await vertexCtx(uid); return vertex.chat(at, cfg.projectId, cfg.region, model, body.systemPrompt as string, body.userMessage as string) }
  const ak = await key(uid, source); needKey(ak, source)
  const fn = { openai: openai.chat, genai: gemini.chat, groq: groq.chat, openrouter: openrouter.chat }[source] || gemini.chat
  return (source === 'openrouter' || source === 'openai') ? fn(ak, model, body.systemPrompt as string, body.userMessage as string, body.temperature as number) : fn(ak, model, body.systemPrompt as string, body.userMessage as string)
}

async function handleTts(body: Record<string, unknown>, uid: string): Promise<string> {
  const source = normalizeSource(body.source || body.provider, 'genai')
  const model = (body.model || (isGlmLike(source) ? 'gemini-2.5-flash-preview-tts' : 'tts-1')) as string
  const voice = (body.voice || (isGlmLike(source) ? 'Kore' : 'alloy')) as string
  if (source === 'vertex') { const [at, cfg] = await vertexCtx(uid); return vertex.tts(at, cfg.projectId, cfg.region, model, body.text as string, voice) }
  const ak = await key(uid, source); needKey(ak, source)
  return ({ openai: openai.tts, genai: gemini.tts, groq: groq.tts, openrouter: openrouter.tts }[source] || gemini.tts)(ak, body.text as string, voice, model)
}

async function handleStt(body: Record<string, unknown>, uid: string): Promise<string> {
  const source = normalizeSource(body.source || body.provider, 'genai')
  const model = (body.model || (isGlmLike(source) ? 'gemini-2.5-flash' : 'whisper-1')) as string
  if (source === 'vertex') { const [at, cfg] = await vertexCtx(uid); return vertex.stt(at, cfg.projectId, cfg.region, model, body.audio as string, body.mimeType as string) }
  const ak = await key(uid, source); needKey(ak, source)
  if (source === 'genai') return gemini.stt(ak, body.audio as string, body.mimeType as string)
  return ({ openai: openai.stt, groq: groq.stt, openrouter: openrouter.stt }[source] as any)(ak, body.audio as string, body.mimeType as string, model)
}

async function handleImage(body: Record<string, unknown>, uid: string): Promise<{ imageData?: string; imageUrl?: string }> {
  const source = normalizeSource(body.source || body.provider, 'genai')
  const model = (body.model || (isGlmLike(source) ? 'gemini-2.5-flash-image' : 'gpt-image-1')) as string
  const opts = { size: body.size, aspectRatio: body.aspectRatio, imageSize: body.imageSize, numberOfImages: body.numberOfImages }
  let result: string
  if (source === 'vertex') { const [at, cfg] = await vertexCtx(uid); result = await vertex.image(at, cfg.projectId, cfg.region, model, body.prompt as string, opts) }
  else { const ak = await key(uid, source); needKey(ak, source); const fn = ({ openai: openai.image, genai: gemini.image, openrouter: openrouter.image }[source] || gemini.image) as any; result = source === 'openrouter' ? await fn(ak, body.prompt as string, model) : await fn(ak, body.prompt as string, model, opts) }
  return result.startsWith('data:') ? { imageData: result } : { imageUrl: result }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const log = createRequestLogger()
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) throw new Error('Missing authorization header')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new Error('Invalid authentication')
    const body = await req.json(); const uid = user.id
    log.info(body.action, normalizeSource(body.source || body.provider, 'genai'), { action: body.action })
    switch (body.action) {
      case 'save_key': case 'save_keys': {
        if (body.action === 'save_key') { await save(uid, normalizeSource(body.source || body.provider), body.key) }
        else { for (const [s, k] of Object.entries(body.keys as Record<string, string>)) { if (k) await save(uid, normalizeSource(s), k) } }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders }) }
      case 'get_key': { const k = await key(uid, normalizeSource(body.source || body.provider)); return new Response(JSON.stringify({ key: k }), { headers: corsHeaders }) }
      case 'chat': { const content = await handleChat(body, uid); return new Response(JSON.stringify({ content }), { headers: corsHeaders }) }
      case 'tts': { const audio = await handleTts(body, uid); return new Response(JSON.stringify({ audio }), { headers: corsHeaders }) }
      case 'stt': { const text = await handleStt(body, uid); return new Response(JSON.stringify({ text }), { headers: corsHeaders }) }
      case 'image': { const r = await handleImage(body, uid); return new Response(JSON.stringify(r), { headers: corsHeaders }) }
      case 'get_vertex_live_token': { const [at, cfg] = await vertexCtx(uid); return new Response(JSON.stringify({ accessToken: at, projectId: cfg.projectId, region: cfg.region }), { headers: corsHeaders }) }
      default: throw new Error(`Unknown action: ${body.action}`)
    }
  } catch (error) {
    log.error('error', 'unknown', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})
