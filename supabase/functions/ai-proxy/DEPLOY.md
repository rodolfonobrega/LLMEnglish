# Post-edit deploy checklist for ai-proxy

Code changes in `index.ts` have landed locally but have **not** been deployed.
Run these from the repo root once you're ready to ship:

1. **Set the CORS allowlist secret** (once per environment):

   ```
   npx supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,https://<your-prod-domain>"
   ```

   - Comma-separated list, no spaces, no trailing slashes.
   - Include every origin from which the SPA calls the Edge Function
     (local dev, preview URLs, production).
   - When unset, the function falls back to `http://localhost:5173` only.

2. **Deploy the function**:

   ```
   npm run supabase:functions:deploy
   ```

   (Equivalent to `npx supabase functions deploy ai-proxy --no-verify-jwt`.)

3. **Smoke test from the app**: chat, TTS, STT, and image — each should
   return 200. Use a browser session already signed in so the auth header
   reaches the function.

4. **Verify CORS is locked down**:

   ```
   curl -I -X OPTIONS \
     -H "Origin: https://evil.example" \
     -H "Access-Control-Request-Method: POST" \
     https://<project>.supabase.co/functions/v1/ai-proxy
   ```

   The response should be **403** with **no** `Access-Control-Allow-Origin`
   header. Re-run with an allowlisted origin — that call should be 200 (or
   204) and echo the origin back.

5. **Verify image size cap** (optional): point `imageUrl` at a >10 MB asset
   in a chat-with-image request. The function should return an error
   mentioning "Image too large" rather than OOM-ing.

## What changed in this pass

- CORS is now allowlist-based (`ALLOWED_ORIGINS` env var).
- The four OpenAI-compatible chat handlers (OpenAI, Gemini, Groq, OpenRouter)
  were collapsed to declarative `ChatEndpoint` configs driven by `callChat`.
- User-supplied image URL fetches are capped at 10 MB and time out after
  10 seconds.

## Future work (not in this pass)

- Move fallback retry logic from `src/services/openai.ts` into the Edge
  Function so the client only sends `preferred_fallback`. Requires a
  coordinated client refactor. There is a `TODO` near `CHAT_ENDPOINTS`
  in `index.ts` marking the intended location.

## Server-side fallback (rolled out G1)

After deploying, verify server-side fallback works:

1. In Settings, set a fallback chat provider that you KNOW works (e.g.
   primary = Gemini, fallback = OpenAI).
2. Temporarily break primary by setting its key to an invalid value in
   Settings.
3. Trigger any chat (e.g. generate a phrase exercise). It should succeed via
   the fallback, with no client-side retry log.
4. Restore the real primary key.

If the deploy hasn't happened yet, the client-side retry in
`src/services/openai.ts` still handles fallback — users won't notice any
degradation.
