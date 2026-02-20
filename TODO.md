# Project TODO List

## 1. User Progress & Insights (Internal)
- [ ] **Error Evolution Tracking**: Implement intelligence to track whether the user is improving on their main errors over time.
    - This should be a form of internal report.
    - Dates and timestamps are crucial for this analysis.
- [ ] **Visibility**: Initially, this data does not need to be exposed to the user, but should drive internal logic.

## 2. Adaptive Learning & Smart Review (Cards)
- [ ] **Adaptive Content (Smart Review)**: When reviewing cards/lessons, dynamically adjust the content to focus specifically on the user's identified main errors, rather than just repeating the same exercise.

## 3. Global Error Analysis & Tutor Mode
- [ ] **Global Error Dashboard**: Create a view to show the user their most frequent/critical errors.
- [ ] **Targeted Speaking Lessons**: Future feature to generate speaking-focused lessons based on these specific errors.
- [ ] **LLM Private Tutor**: The LLM should act as a private tutor, explaining mistakes gradually and contextually.
- [ ] **Error Currency**: Implement logic to distinguish between "old" errors (that the user has stopped making) and "new" or "persistent" errors.

## 4. Consistent Visual Style
- [x] **Image Standardization**: Ensure all generated images follow a consistent style (specifically "cartoon" style) to maintain application identity.

## 5. Coherent Corrections & Evaluation
- [ ] **Natural Language Focus (Prompts)**: Ensure all generated scenarios, phrases, and dialogues prioritize **natural, everyday speech** over formal or textbook language. The goal is to learn how people actually speak.
- [ ] **Context-Aware Correction**:
    - **Translation**: Corrections must evaluate the accuracy and nuance of the translation.
    - **Roleplay**: Corrections must evaluate the appropriateness of the response within the given situation/scenario.
    - **Score & Naturalness**: The evaluation score must heavily penalize unnatural or robotic speech, even if grammatically correct.
    - **Fixing "Corrected Version"**: The `correctedVersion` output often sounds too formal or textbook-like. It must be adjusted to provide the **natural, native-like** way to say the phrase, correcting for awkwardness/stiffness ("engessada"), not just grammar.

## 6. Session Progress Reports
- [ ] **Session Definition**: Define clearly what constitutes a "session" (e.g., a set of exercises, a time period, a completed roleplay).
- [ ] **Progress Updates**: At the end of each defined session, update the user's progress in a comprehensive report format.

## 7. Performance & Cost Optimization
- [ ] **Audio Caching Verification**: Verify that generated audios are being correctly cached and reused to prevent redundant API calls and reduce costs.

## 8. Infrastructure & Multi-Provider Support
- [ ] **Groq API Integration**: Add support for Groq API. Since it is OpenAI-compatible, investigate reusing the OpenAI service logic by simply switching the `base_url`.

## 9. Treino de habilidades
- [x] Queria que tivesse uma área que a pessoa pudesse simplesmente simular situações. Ex: Uma entrevista de emprego. Mas a pessoa poderia colocar 'simular entrevista com o google'. Ai seria legal melhorar o prompt pra pedir pro LLM já pensar nas melhores questões e coisas do tipo, sabe?

## 10 Melhorar Roleplay
- [ ] No roleplay seria legal se tivessem "trilhas". Ex: Pra viagem, poderia ter uma trilha pré programada, como reservar hotel, essas coisas. Mas poderia ter um "random" de viagem também. Mesmo se a pessoa escolher "bookar hotel", o llm que teria que gerar na hora a situação.

## 11 Remover Análise de Fonema (Temporário)
- [x] **Remover feedback de pronúncia/fonemas**: Os modelos atuais não são eficazes para análise fonêmica e estão "fingindo" correções.
- [x] Manter anotações no código para reativar quando um modelo adequado for encontrado.
- [x] Arquivos para atualizar:
  - `src/utils/prompts.ts` - Remover análise de fonema do prompt de avaliação
  - `src/types/card.ts` - Revisar tipo EvaluationResult
  - `src/components/shared/EvaluationResults.tsx` - Ocultar/remover display de fonemas
- [x] Adicionar comentários explicando por que foi removido e o que seria necessário para reativar.

## 12 Gerador de Diálogos Personalizados com PDF
- [x] **Contexto do usuário**: Criar área para salvar contexto pessoal (perfil, interessos, objetivos, nível atual).
- [x] **Persistência**: Usar LocalStorage para salvar o contexto do usuário.
- [x] **Gerador de diálogos**: Pedir pro LLM gerar diálogo baseado no contexto do usuário + situação específica solicitada.
- [x] **Exportar PDF**: Gerar PDF do diálogo para treino em voz alto sozinho.
- [x] Considerações:
  - Biblioteca PDF (react-pdf ou jsPDF)
  - Nova rota/página: `/practice` ou `/materials`
  - UI para input/atualização do contexto pessoal

## 13 Pesquisar Transcrição Fonética (Alternativa a Fonemas)
- [x] Validar se é viável escrever transcrições fonéticas (IPA) em vez de palavras regulares nos diálogos gerados.
- [x] Pesquisa:
  - LLMs conseguem produzir transcrições IPA precisas?
  - Qual sistema fonético usar? (IPA, ARPAbet, etc.)
  - Junto com o texto ou substituindo?
  - Usuários entendem IPA? Seria necessário um guia de pronúncia?
- [x] Testar com modelos atuais para ver qualidade da saída IPA.
- [x] Esta poderia ser uma alternativa ao recurso de análise de fonema removido.

## 14 Revisão Global de Prompts - Foco em Fala Natural
- [ ] **Revisar TODOS os prompts** do sistema (`src/utils/prompts.ts`) para garantir:
  - Ênfase em **fala natural**, não formal/textual
  - Evitar frases "engessadas" ou robotizadas
  - Foco em como **nativos falam** (não escrevem)
  - Incluir gírias apropriadas, contrações, expressões cotidianas
  - Contexto de conversação real, não academia
- [ ] Arquivos de prompts para revisar:
  - `getPhraseGenerationPrompt()` - Geração de frases
  - `getTextGenerationPrompt()` - Geração de textos
  - `getRoleplayGenerationPrompt()` - Geração de roleplay
  - `getEvaluationPrompt()` - Avaliação (corrigir versão deve ser natural)
  - `getImageQuestionPrompt()` - Perguntas sobre imagens
  - Prompts do Live Roleplay (se aplicável)
- [ ] Testar saídas para garantir que soam como conversa real, não livro didático.
- [ ] Adicionar exemplos de "fala natural" vs "fala engessada" nos prompts se necessário.
