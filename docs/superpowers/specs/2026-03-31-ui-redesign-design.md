# SpeakLab UI Redesign Spec

## Visão Geral

Redesign completo da UI do SpeakLab para resolver 8 problemas: falta de cor, telas vagas, inconsistência entre páginas, navegação confusa, termos pouco claros, e bugs visuais. A abordagem é **fundação primeiro**: criar design system, reestruturar navegação, depois refatorar cada tela.

## Decisões de Design

### Personalidade Visual
- Estilo: Duolingo controlado - cores com propósito, cada modo com identidade própria
- Vibrante mas não gritante
- Cada modo de prática tem uma cor fixa usada em todo o app

### Paleta de Cores dos Modos

| Modo | Cor | Hex |
|------|-----|-----|
| Frases | Roxo | `#8b5cf6` |
| Textos | Azul | `#3b82f6` |
| Situações | Teal | `#14b8a6` |
| Scripts | Laranja | `#f97316` |
| Simulação ao Vivo | Verde | `#22c55e` |
| Entrevista | Âmbar/Dourado | `#f59e0b` |
| Desafio Visual | Roxo (tom diferente) | `#a855f7` |

### Estilo dos Cards/Opções (Template Hub)
- Lista horizontal com barra lateral colorida (border-left 4px sólido)
- Fundo com gradiente suave da cor do modo (15% opacidade → 5% opacidade, esquerda → direita)
- Ícone emoji + nome em negrito + descrição curta
- Seta "›" à direita indicando ação
- Badge para destaques (ex: Entrevista com "★ POPULAR")

## Navegação

### Sidebar (6 itens)
1. **Início** (`/`) - Progresso, streak, sugestões do dia
2. **Praticar** (`/practice`) - Hub com duas seções
3. **Biblioteca** (`/library`) - Cartões salvos, conteúdos, aba "Histórico"
4. **Revisão** (`/review`) - Revisão espaçada
5. **Erros** (`/errors`) - Pontos fracos com prática direcionada
6. **Configurações** (`/settings`) - Preferências do usuário

### O que sai do sidebar
- Trilhas → filtro dentro de Exercícios ("praticar por trilha")
- Scripts → modo dentro de Exercícios
- Histórico → aba dentro de Biblioteca
- Entrevista & Profissional → cenário dentro de Conversação (com destaque visual)

## Tela "Praticar" (Hub Principal)

### Seção "Exercícios" (label roxa)
Lista de 4 modos:
- **Frases** - Traduza e pratique frases do dia a dia
- **Textos** - Leia e responda sobre textos completos
- **Situações** - Responda a cenários reais em inglês
- **Scripts** - Escreva textos a partir de um contexto dado

### Seção "Conversação" (label verde)
Lista de 3 modos:
- **Simulação ao Vivo** - Converse em tempo real com a IA por voz
- **Entrevista** (com badge ★ POPULAR) - Pratique entrevistas em inglês com feedback
- **Desafio Visual** - Descreva imagens e pratique vocabulário visual

## Sistema de Templates

### Template 1: Hub (seleção de opções)
- Header com título + subtítulo
- Seções com label colorida (dot + texto uppercase)
- Lista de opções no estilo aprovado (barra lateral + gradiente + ícone + nome + descrição)
- Usado em: Praticar, seleção de tema dentro de cada modo

### Template 2: Exercício (prática ativa)
- Barra de progresso no topo
- Enunciado pergunta/contexto
- Área de input (texto, áudio, múltipla escolha)
- Botão de ação (enviar/próximo)
- Feedback inline (correto/incorreto + explicação)

### Template 3: Resultado (pós-exercício)
- Score principal + destaque visual
- Breakdown de acertos/erros
- Lista de itens praticados com status
- Botões: "Praticar de novo" / "Ver detalhes" / "Voltar"

## Tooltips (clareza dos modos)

Cada modo de prática terá tooltip/popover com:
- Nome do modo
- 1 frase explicando o que acontece
- 1 exemplo prático

Exemplos:
- **Frases**: "Traduza e pratique frases do dia a dia" · Exemplo: "Traduza 'I'd like to order coffee, please'"
- **Textos**: "Leia um texto e responda perguntas sobre ele" · Exemplo: "Leia um artigo sobre viagens e responda 5 perguntas"
- **Situações**: "Responda a um cenário real em inglês" · Exemplo: "Você está num restaurante. Como pede a conta?"
- **Scripts**: "Receba um contexto e escreva um texto completo" · Exemplo: "Escreva um email formal para um cliente"
- **Simulação ao Vivo**: "Converse em tempo real com a IA por voz" · Exemplo: "Simule uma conversa num café em Londres"
- **Entrevista**: "Pratique entrevistas de emprego em inglês" · Exemplo: "Responda 'Tell me about yourself' como num interview real"
- **Desafio Visual**: "Veja uma imagem e descreva o que acontece" · Exemplo: "Descreva a cena de uma foto de mercado"

## Regras de Consistência

1. Toda hub usa template hub
2. Todo exercício usa template exercício
3. Todo resultado usa template resultado
4. Cores dos modos são fixas e consistentes em todo o app
5. Botões de ação primária seguem o mesmo estilo em toda tela
6. Nenhum modo/função fica sem explicação (sempre tooltip disponível)
7. Sidebar sempre visível com os mesmos 6 itens

## Bug Fix

- **Desafio Visual**: Tela aparece em branco. Investigar e corrigir o componente ImageMode/ExerciseMode.

## Plano de Execução (Abordagem: Fundação Primeiro)

1. Criar design system: tokens de cor, componentes base de template
2. Criar componentes de tooltip/popover
3. Reestruturar sidebar (6 itens)
4. Reconstuir tela "Praticar" como hub com duas seções
5. Refatorar cada página para usar templates
6. Migrar "Trilhas" para filtro dentro de Exercícios
7. Migrar "Entrevista" para cenário dentro de Conversação
8. Mover "Histórico" para aba de Biblioteca
9. Corrigir bug do Desafio Visual
10. Remover telas/rotas obsoletas

## Arquivos Provavelmente Afetados

- `src/index.css` - tokens de cor CSS
- `src/components/layout/Sidebar.tsx` - reestruturação de navegação
- `src/components/layout/Navigation.tsx` - navegação mobile
- `src/components/practice/PracticeHubPage.tsx` - novo hub principal
- `src/components/practice/PracticePage.tsx` - refatoração
- `src/components/exercises/ExercisesPage.tsx` - refatoração
- `src/components/live-roleplay/` - simplificação (Entrevista vira cenário)
- `src/components/library/LibraryPage.tsx` - aba Histórico
- `src/components/errors/ErrorDashboard.tsx` - página própria
- `src/components/discovery/ExerciseMode.tsx` - fix + refatoração
- `src/components/discovery/ImageMode.tsx` - fix do bug
- `src/components/shared/` - novos componentes de template
- Rotas (App.tsx ou router)
- Possivelmente novos componentes: `HubTemplate.tsx`, `ExerciseTemplate.tsx`, `ResultTemplate.tsx`, `ModeTooltip.tsx`
