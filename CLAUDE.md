# SpeakLab

## Subindo a aplicação

O app usa **Supabase remoto** (credenciais em `.env.local`). Não precisa de Docker local.

```bash
npx vite --port 5173 --host
```

- **Porta 5173** é obrigatória — é a configurada no `supabase/config.toml` (`site_url` e `additional_redirect_urls`).
- **`--host`** é necessário dentro de devcontainers para expor o servidor fora do container.
- Sem `--host`, o Vite escuta só em `localhost` interno e o browser do host não acessa.

## Dev mode (sem Supabase)

Em modo dev (`npx vite`), o app pula autenticação e mostra a UI direto. Não precisa de `.env.local` nem Supabase. Ideal para iterar em UI visual. Features que dependem do backend (auth, DB, AI) não funcionam nesse modo.
