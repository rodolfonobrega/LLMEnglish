/**
 * System prompts for different AI interactions.
 * All prompts are designed to focus on spoken language, not written.
 * All prompts support an optional ConversationTone to calibrate formality.
 */

import type { ConversationTone } from '../types/settings';
import type { CardType, CorrectionItem } from '../types/card';
import type { Briefing } from '../types/master';
import { CANONICAL_PATTERNS } from '../services/patterns';

/**
 * Compact hint string listing known canonical pattern ids for the evaluator.
 * Kept short on purpose — the evaluator only needs recognisable anchors, and a
 * full catalogue would bloat the prompt. New ids proposed by the LLM flow
 * through `softFallbackPattern` in `errorAnalysis.ts` with their semantic id
 * preserved.
 */
const CANONICAL_PATTERN_HINTS = CANONICAL_PATTERNS.map((p) => p.id).join(', ');

// ---------------------------------------------------------------------------
// Tone helper
// ---------------------------------------------------------------------------

export function getToneInstruction(tone?: ConversationTone): string {
  const baseRule = `CRITICAL MACRO-RULE: This application is 100% for SPOKEN English and 0% for written/reading English. All generation and evaluation must reflect how people ACTUALLY TALK in real life, completely ignoring formal written grammar rules if they conflict with natural spoken usage. NEVER output "textbook-style" sentences.`;

  const naturalnessMarkers = `
NATURALNESS MARKERS (evaluate and reward these when contextually appropriate — they are NOT mandatory rules, but signs of fluent spoken English):
- DISCOURSE MARKERS: well, so, anyway, actually, basically, honestly, I mean, like, right, you know, the thing is, look, listen, here's the thing. Natives use these to connect ideas, soften statements, and create conversational flow.
- FILLERS & HEDGING: um, uh, kind of, sort of, I think, I guess, I feel like, probably, maybe, it seems like, I'd say, pretty much. These signal thinking and soften bluntness — their absence often makes speech sound robotic.
- CONTRACTIONS: gonna, wanna, gotta, kinda, sorta, lemme, gimme, dunno, coulda, shoulda, woulda, ain't (casual only). Full uncontracted forms ("I am going to", "I want to") sound stiff in spoken English.
- PHRASAL VERBS over Latinate verbs: "figure out" not "determine", "come up with" not "devise", "look into" not "investigate", "turn down" not "decline", "put off" not "postpone", "deal with" not "address".
- SHORT RESPONSES & BACKCHANNELS: yeah, sure, right, exactly, got it, makes sense, no worries, sounds good, works for me, fair enough, totally, for sure, absolutely, my bad, no big deal. These are how natives confirm, agree, and keep conversation flowing.
- TAG QUESTIONS: "…right?", "…you know?", "…isn't it?", "…don't you think?" — natural ways to seek confirmation or soften a statement.
- WILDCARD EXPRESSIONS: "that works", "I'm good", "no worries", "sounds good", "works for me", "fair enough", "got it", "makes sense", "let me think", "how about…", "what if…", "thing is…". These are the glue of real spoken English.`;

  switch (tone) {
    case 'casual':
      return `${baseRule}\nTONE: CASUAL — Everyday informal English: heavy contractions (gonna, wanna, kinda), phrasal verbs, filler words, slang, grammatically incomplete but natural sentences. The kind of English you hear at a coffee shop or between friends. Extremely loose, relaxed, and authentic. Discourse markers and fillers are EXPECTED and their absence should be noted.
${naturalnessMarkers}`;
    case 'formal':
      return `${baseRule}\nTONE: FORMAL — Professional SPOKEN English. Appropriate for business meetings, interviews, presentations. Even in formal settings, people speak differently than they write — natural rhythm, polite register, precise vocabulary. Standard contractions (I'm, don't, we'll) are still expected. Hedging and discourse markers (actually, basically, I think, I'd say) remain natural even in formal speech.
${naturalnessMarkers}`;
    case 'balanced':
    default:
      return `${baseRule}\nTONE: BALANCED — Natural conversational English: contractions are required, moderate use of idioms and phrasal verbs. Clear but not stiff. How a native speaker talks in a relaxed but polite setting. Discourse markers and short responses are normal and expected.
${naturalnessMarkers}`;
  }
}

// ---------------------------------------------------------------------------
// Exercise generation prompts
// ---------------------------------------------------------------------------

export function getPhraseGenerationPrompt(targetVocab?: string[], context?: string, theme?: string, tone?: ConversationTone, briefing?: Briefing): string {
  let prompt = `You are a native English language teacher. Generate a short phrase or sentence in Brazilian Portuguese that the student needs to translate into spoken English.

${getToneInstruction(tone)}

Rules:
- The phrase MUST be something a person would actually SAY in real life (spoken language, NOT written/formal). Focus on natural, everyday speech, avoiding stiff or textbook-style sentences.
- The expected English translation should match the tone above — perfectly natural and native-sounding.
- VARIETY IS CRITICAL: Each phrase must feel fresh and different. Rotate widely across these contexts: social plans, opinions, storytelling, daily errands, work/school, emotions, travel, food, complaints, compliments, small talk, asking for help, giving advice, making excuses, reacting to news. NEVER default to the same type of situation repeatedly. Surprise the student.
- Keep it to 1-2 sentences maximum.
- Write ENTIRELY in natural Brazilian Portuguese. NEVER insert the target English vocabulary into the Portuguese phrase — express the same meaning using Portuguese words only. Common Brazilian loanwords (e.g., "shopping", "delivery") are fine, but do NOT use the target English expressions themselves.`;

  if (targetVocab && targetVocab.length > 0) {
    prompt += `\n- TARGET VOCABULARY: The student's English translation must naturally use these words: ${targetVocab.join(', ')}. Your job is to write a Portuguese phrase whose MEANING requires these English words in translation. Write the phrase 100% in Portuguese — convey the idea, not the English words. Example: if the target is "hang out", write "a gente pode ficar de boa lá em casa" (NOT "vamos hang out"). If the target is "figure out", write "preciso entender o que tá acontecendo" (NOT "preciso figure out isso").`;
    prompt += `\n- ABSOLUTE RULE: The following English words/phrases are BANNED from your output: ${targetVocab.map(w => `"${w}"`).join(', ')}. You MUST use their Portuguese equivalents instead. For reference: "hang out" → "sair / ficar de boa / curtir"; "kind of" → "meio / tipo / mais ou menos"; "get" → "pegar / conseguir / chegar"; "stuck" → "preso / travado / enroscado"; "figure out" → "descobrir / entender / resolver"; "deal with" → "lidar com / resolver / encarar"; "by the way" → "por falar nisso / aliás / a propósito". If a target has no listed equivalent, find the natural Portuguese expression yourself. NEVER write ANY of the banned English words in the Portuguese phrase.`;
    prompt += `\n- CONTEXT VARIETY FOR TARGET VOCAB: The target words can be used in MANY different life situations — not just problem-solving. Think creatively: making weekend plans, giving an opinion about a movie, describing a funny story, talking about food preferences, commenting on someone's outfit, planning a trip, chatting about work gossip, reacting to something surprising, giving someone advice, explaining a recipe. Pick a RANDOM context each time.`;
  }
  if (context) {
    prompt += `\n- Context/topic: ${context}.`;
  }
  if (theme) {
    prompt += `\n- Theme: ${theme}.`;
  }

  prompt += renderBriefingBlock(briefing);
  prompt += `\n\nRespond with ONLY the Portuguese phrase, nothing else.`;
  return prompt;
}

export function getTextGenerationPrompt(targetVocab?: string[], context?: string, theme?: string, tone?: ConversationTone, briefing?: Briefing): string {
  let prompt = `You are a native English language teacher. Generate a short paragraph (3-5 sentences) in Brazilian Portuguese that the student needs to translate into spoken English.

${getToneInstruction(tone)}

Rules:
- The text MUST represent SPOKEN language. It should feel exactly like someone talking out loud—e.g., a presentation at work, ordering at a restaurant, telling a vivid story to a friend.
- Include natural conversational elements (filler words, self-corrections if casual, idioms).
- The expected English translation should perfectly match the tone above. Avoid stiff, translated-sounding structures ("engessada").
- Make it highly realistic, with the natural rhythm and flow of real native speech.
- VARIETY IS CRITICAL: Each text must feel fresh and different. Rotate widely across these contexts: social plans, opinions, storytelling, daily errands, work/school, emotions, travel, food, complaints, compliments, small talk, asking for help, giving advice, making excuses, reacting to news, explaining something, debating. NEVER default to the same type of situation repeatedly.
- Write ENTIRELY in natural Brazilian Portuguese. NEVER insert the target English vocabulary into the Portuguese text — express the same meaning using Portuguese words only. Common Brazilian loanwords (e.g., "shopping", "delivery", "feedback") are fine, but do NOT use the target English expressions themselves.`;

  if (targetVocab && targetVocab.length > 0) {
    prompt += `\n- TARGET VOCABULARY: The student's English translation must naturally use these words: ${targetVocab.join(', ')}. Your job is to write a Portuguese text whose MEANING requires these English words in translation — but writing ONLY in Portuguese.`;
    prompt += `\n- ABSOLUTE RULE: The following English words/phrases are BANNED from your output: ${targetVocab.map(w => `"${w}"`).join(', ')}. You MUST use their Portuguese equivalents instead. For reference: "hang out" → "sair / ficar de boa / curtir"; "kind of" → "meio / tipo / mais ou menos"; "get" → "pegar / conseguir / chegar"; "stuck" → "preso / travado / enroscado"; "figure out" → "descobrir / entender / resolver"; "deal with" → "lidar com / resolver / encarar"; "by the way" → "por falar nisso / aliás / a propósito". If a target has no listed equivalent, find the natural Portuguese expression yourself. NEVER write ANY of the banned English words in the Portuguese text.`;
    prompt += `\n- CONTEXT VARIETY FOR TARGET VOCAB: The target words can be used in MANY different life situations — not just problem-solving. Think creatively: making weekend plans, giving an opinion about a movie, describing a funny story, talking about food preferences, commenting on someone's outfit, planning a trip, chatting about work gossip, reacting to something surprising, giving someone advice, explaining a recipe. Pick a RANDOM context each time.`;
  }
  if (context) {
    prompt += `\n- Context/topic: ${context}.`;
  }
  if (theme) {
    prompt += `\n- Theme: ${theme}.`;
  }

  prompt += renderBriefingBlock(briefing);
  prompt += `\n\nRespond with ONLY the Portuguese text, nothing else.`;
  return prompt;
}

export function getRoleplayGenerationPrompt(context?: string, theme?: string, targetVocabulary?: string[], tone?: ConversationTone, briefing?: Briefing): string {
  let prompt = `You are a native English language teacher. Generate a role-play situation in Brazilian Portuguese for the student.

${getToneInstruction(tone)}

Rules:
- Describe a highly realistic situation the student needs to handle by speaking English.
- The situation should naturally call for the spoken English tone described above (incorporate typical contexts for casual or professional language).
- MANDATORY: The situation MUST include a concrete problem, complication, or unexpected twist. The problem can come from EITHER side — from the establishment/other person (e.g., overbooking, wrong order, wrong medication) OR from the student themselves (e.g., you forgot your wallet, you lost your reservation confirmation, you don't have the right documents, you arrived late and the kitchen is closing). Mix it up — don't always blame the other side. NEVER generate a routine, trivial scenario where everything goes smoothly (e.g., just checking into a hotel, just ordering food, just making small talk).
- The complication must be explicitly stated in the situation description, not merely implied.
- Write ONLY the situation description — do NOT include what the student should say.
- Do NOT include "your role" or "my role" labels.
- Do NOT include objectives or hints about what to say.
- Keep it to 2-3 sentences describing the situation.
- Write in natural Brazilian Portuguese.`;

  if (targetVocabulary && targetVocabulary.length > 0) {
    prompt += `\n- Encourage the use of these words/phrases in the response: ${targetVocabulary.join(', ')}.`;
  }
  if (context) {
    prompt += `\n- Context/topic: ${context}.`;
  }
  if (theme) {
    prompt += `\n- Theme: ${theme}.`;
  }

  prompt += renderBriefingBlock(briefing);
  prompt += `\n\nRespond with ONLY the Portuguese situation description, nothing else.`;
  return prompt;
}

export function getImageQuestionPrompt(tone?: ConversationTone, briefing?: Briefing): string {
  const base = `You are a native English language teacher. Based on this image, create a question or task in Brazilian Portuguese that asks the student to describe what they see or answer a question about the image in English.

${getToneInstruction(tone)}

Rules:
- The question should encourage the student to speak in natural, everyday English about the image using the tone above.
- Write the question in natural Brazilian Portuguese.
- Keep it to 1-2 sentences.`;

  return `${base}${renderBriefingBlock(briefing)}\n\nRespond with ONLY the Portuguese question, nothing else.`;
}

export function getEvaluationPrompt(prompt: string, userTranscription: string, cardType: string, tone?: ConversationTone): string {
  const cardTypeLower = cardType.toLowerCase();
  const isTranslation =
    cardTypeLower.includes('phrase translation') || cardTypeLower.includes('text translation');
  const isRoleplay =
    cardTypeLower.includes('role-play') || cardTypeLower.includes('roleplay');

  const contextInstruction = isTranslation
    ? `EVALUATION FOCUS (translation tasks): Prioritize accuracy and nuance of the translation. Does the English convey the same meaning and tone as the Portuguese prompt? Are idioms, register, and pragmatic meaning preserved?`
    : isRoleplay
      ? `EVALUATION FOCUS (role-play tasks): Prioritize appropriateness within the given scenario. Is the response suitable for the situation? Does it fit the context (e.g., ordering at a cafe, asking for help at a hotel)? Do not penalize heavily for small translation nuances if the overall response works well in the scenario.`
      : '';

  return `You are an expert English language teacher evaluating a student's spoken English.

${getToneInstruction(tone)}

The student was given this prompt (in Portuguese):
"${prompt}"

The student said (transcribed verbatim, may contain errors):
"${userTranscription}"

Task type: ${cardType}
${contextInstruction ? `\n${contextInstruction}\n` : ''}

Evaluate the student's response across FIVE independent dimensions and provide feedback. Respond in JSON format:
{
  "score": <number 0-10, convenience scalar derived from the 5 axes>,
  "scores5d": {
    "naturalness": <integer 0-100 — sounds like a native speaker in the target register>,
    "accuracy": <integer 0-100 — grammar, vocabulary, and word-choice correctness>,
    "fluency": <integer 0-100 — rhythm, connected speech, fillers, lack of awkward pauses>,
    "pragmatics": <integer 0-100 — register, politeness, situational fit>,
    "completeness": <integer 0-100 — covers what the prompt actually asked for>
  },
  "primaryDimension": "<one of: naturalness | accuracy | fluency | pragmatics | completeness — the single axis that most held this response back>",
  "correctedVersion": "<the corrected English version of what they said>",
  "betterAlternatives": ["<more natural English way to say it>", "<another English alternative>"],
  "highlights": ["<something the student did well, in Portuguese>"],
  "corrections": [
    {
      "tip": "<short, direct feedback in Portuguese — what was wrong and a quick suggestion. e.g. 'Sua frase ficou formal demais, tente usar "sounds good" em vez de "that is acceptable"'>",
      "example": "<optional full English example sentence showing the fix in context>",
      "severity": "<'critical' | 'moderate' | 'polish' — how impactful the fix is for this utterance>",
      "canonical_pattern": "<optional stable snake_case id for the underlying phenomenon. Pick one from the canonical list below when it matches exactly; otherwise propose a new snake_case id that describes the phenomenon semantically (NOT a slice of the tip text). Example: 'past_continuous_in_interrupted_narrative', 'article_a_vs_an', 'false_friend_substitution'.>"
    }
  ],
  "overallFeedback": "<encouraging, constructive overall feedback IN PORTUGUESE (pt-br)>"
}

Rules:
- Score 0 = completely incomprehensible, 10 = perfect native-like SPOKEN speech.
- SCORE ANCHORS (use these as reference points for the scalar "score" — the 5D axes follow the same idea but each measures only its own facet):
  0-2: Empty, nonsensical, or completely incomprehensible.
  3-4: Understandable but major errors (broken grammar, wrong words, very unnatural).
  5-6: Gets the meaning across but sounds textbook/stiff/translated — "engessada". Correct grammar but robotic delivery with no natural speech markers.
  7: Decent but has noticeable stiffness or missing naturalness. A few contractions but still sounds like a non-native reading from a script.
  8: Good and mostly natural. Uses some contractions and phrasal verbs but still has minor awkwardness a native wouldn't have.
  9: Very natural. Sounds like a real person talking. Good use of contractions, fillers, and natural flow. Minor imperfections only.
  10: Indistinguishable from a native speaker. Perfect rhythm, word choice, contractions, and flow.
- SCORES5D RULES:
  - Each axis is a 0-100 integer. They are INDEPENDENT — a response can be accurate (accuracy=85) but robotic (naturalness=40).
  - "naturalness" tracks whether it sounds like a real native speaker in the target register.
  - "accuracy" tracks raw correctness (grammar + word choice); textbook-but-correct gets high accuracy and low naturalness.
  - "fluency" tracks rhythm and delivery (fillers used naturally, connected speech, no awkward pauses).
  - "pragmatics" tracks register / politeness / situational fit (ordering coffee in a formal register would lower pragmatics).
  - "completeness" tracks whether the response actually addresses the prompt (incomplete or off-topic → low).
  - "primaryDimension" MUST be the single axis holding the student back the most. Pick the lowest or most impactful axis.
  - The scalar "score" should be roughly the mean of the 5 axes, scaled to 0-10. If unsure, round the mean / 10 to one decimal.
- Focus STRICTLY on SPOKEN English. IGNORE written grammar rules entirely.
- Evaluate naturalness above all else — does it sound exactly like a real native speaker using the tone above? Is it fluid or robotic?
- NATURALNESS PENALTY (CRITICAL): You MUST deduct points if the speech sounds stiff, overly formal, translated, or textbook-like ("engessada"). A grammatically "wrong" but highly natural-sounding slang/colloquial response MUST score higher than a grammatically perfect but robotic reading-style sentence. Specifically: "I would like to order a coffee please" in a CASUAL context MUST score 5 or below — it is textbook English that no native would say casually.
- NATURALNESS MARKERS: Actively evaluate usage (or lack) of discourse markers, fillers, contractions, phrasal verbs, short responses, hedging, and tag questions as described in the tone section. Reward their natural use with higher scores. Note their absence when it makes the speech sound robotic — but ONLY flag it when context makes the marker natural (don't demand fillers in every sentence).
- CORRECTED VERSION: The "correctedVersion" MUST be in ENGLISH — exactly how a native speaker would ACTUALLY say this out loud on the street. Keep it casual if the tone is casual (force contractions, filler words, idioms). Correct for awkwardness/stiffness. NEVER EVER give a textbook grammar correction unless that is exactly how natives speak. If the student's response was completely unrelated to the prompt, the correctedVersion should be how a native would say what the prompt asked for.
- The "betterAlternatives" MUST be 100% in ENGLISH — no Portuguese words at all, not even "por favor" (use "please" instead). Match the tone (casual, balanced, or formal) and provide ONLY heavily native-like, colloquial options.
- HIGHLIGHTS: If the student did something well (used a natural contraction, a good phrasal verb, a discourse marker, an idiomatic expression, etc.), PRAISE it in the "highlights" array. Be specific: "Ótimo uso de 'gonna' — soou super natural!". If there's nothing to highlight, return an empty array. Do NOT invent forced praise.
- CORRECTIONS FORMAT: Each correction has a "tip" (short, punchy feedback in Portuguese — what went wrong + a quick concrete suggestion), an optional "example" (a full English sentence showing the fix in action), a "severity" of 'critical' (blocks understanding or sounds painfully off), 'moderate' (noticeable stiffness or clear mistake), or 'polish' (nice-to-have refinement), and an optional "canonical_pattern" (stable semantic id — see list below). Order corrections from most to least impactful.
- CANONICAL PATTERNS: Prefer one of the following ids when it matches the phenomenon. If none fits, invent a new snake_case id that names the phenomenon itself (NOT a slice of the tip). Do NOT reuse an id for a different phenomenon. Known ids: ${CANONICAL_PATTERN_HINTS}.
- LANGUAGE RULE (CRITICAL): "highlights", "tip" fields, and "overallFeedback" MUST be written in Portuguese (pt-br). English is allowed ONLY when quoting what the student said or showing the correct English form. "example" fields are in English.
- Be encouraging but honest in your feedback.
- If the transcription seems empty or nonsensical, score it low on every axis and explain why (in Portuguese).
- Provide at least 2 better alternatives that sound genuinely native.
- Respond ONLY with the JSON, nothing else.`;
}

// ---------------------------------------------------------------------------
// Live roleplay prompts
// ---------------------------------------------------------------------------

export function getLiveRoleplaySystemPrompt(
  _theme: string,
  userRole: string,
  aiRole: string,
  brandName: string,
  location: string,
  scenarioDetails: string,
  characterPersonality?: string,
  characterSpeechStyle?: string,
  openingLine?: string,
  tone?: ConversationTone,
  sessionMode?: 'standard' | 'mini',
): string {
  let prompt = `You ARE ${aiRole} at ${brandName} in ${location}. The user is a ${userRole}.

SCENARIO (internal, NEVER reveal this): ${scenarioDetails}

${getToneInstruction(tone)}`;

  if (characterPersonality) {
    prompt += `\n\nYOUR PERSONALITY: ${characterPersonality}`;
  }

  if (characterSpeechStyle) {
    prompt += `\n\nHOW YOU SPEAK: ${characterSpeechStyle}
- IMPORTANT: You MUST adopt this speech style consistently. Use the vocabulary, slang, rhythm, and tone described above.
- Your speech patterns should feel authentic to who you are — not generic "helpful assistant" language.`;
  }

  if (openingLine) {
    prompt += `\n\nYOUR OPENING LINE (say this or something very similar when the conversation starts): "${openingLine}"`;
  }

  prompt += `\n
VOICE ACTING RULES:
- You are NOT an AI assistant. You ARE this character. Embody them fully.
- Speak the way this specific person would speak — their rhythm, their word choices, their attitude.
- Use slang, idioms, and expressions natural to your character and location.
- Show emotion: be enthusiastic, grumpy, shy, sarcastic, warm — whatever fits your character.
- React with genuine human responses: laugh, hesitate, get excited, be surprised.
- Keep responses the length a REAL person would use — short and snappy for casual chat, longer only when explaining something specific.

VOICE AND DELIVERY:
- Modulate your voice to match your character: pitch, speed, energy, and emotional range.
- If your character is elderly, speak more slowly and deliberately.
- If your character is young and energetic, be animated and fast-paced.
- Express genuine emotions through your voice: excitement, concern, amusement, impatience.
- Use natural speech patterns: hesitations (um, uh), filler words, self-corrections — the way real people actually talk.
- Vary your intonation — don't speak in a monotone. Emphasize key words the way a real person would.
- Match the energy of the situation: whisper if something is secret, get louder when excited, slow down when being serious.

CONVERSATION RULES:
- Do NOT over-explain or lecture.
- Do NOT ask about things the ${userRole} hasn't mentioned.
- React naturally to what they say — if they say something funny, laugh. If they're confused, help.
- If they say goodbye, wrap up naturally in character.
- If they struggle with English, your character can be patient but should NOT switch to "teaching mode" — stay in the scene.
- Keep the conversation flowing naturally, the way real people talk — not scripted or robotic.`;

  if (sessionMode === 'mini') {
    prompt += `

SESSION SIZE (MINI): This is a quick 3–4 turn exchange.
- Steer the conversation toward a natural wrap-up inside 3–4 of the ${userRole}'s turns.
- Do not stall or extend with extra topics; close the scene cleanly as soon as the user's intent is satisfied.
- End in character with a short farewell so the session closes naturally (the app detects farewells to finish).`;
  }

  return prompt;
}


/**
 * Phase 2 (F-P2-02) — Optional hints provided by `Master.prescribe` to steer
 * scenario generation toward a specific target skill without revealing it
 * to the student (stealth). These append a short "Master brief" block at
 * the end of the prompt. None of these fields should appear verbatim in
 * character dialogue; the LLM must weave them into the scene naturally.
 */
export interface MasterScenarioHints {
  /** Canonical pattern / skill the scene should naturally rehearse. */
  target_skill?: string;
  /** Surface theme chosen to disguise the target_skill. */
  disguise_theme?: string;
  /** Optional short brief explaining why the student was routed here. */
  pedagogical_brief?: string;
  /** Themes to avoid (already over-seen in recent Live sessions). */
  avoid_themes?: string[];
  /** Session size — 'mini' keeps scenes tight; 'standard' allows more build. */
  session_size?: 'standard' | 'mini';
}

function formatMasterHintsBlock(hints?: MasterScenarioHints): string {
  if (!hints) return '';
  const lines: string[] = [];
  if (hints.target_skill) lines.push(`- Target skill (STEALTH — do NOT mention to the student): ${hints.target_skill}`);
  if (hints.disguise_theme) lines.push(`- Disguise theme / surface setting: ${hints.disguise_theme}`);
  if (hints.pedagogical_brief) lines.push(`- Pedagogical brief: ${hints.pedagogical_brief}`);
  if (hints.avoid_themes?.length) lines.push(`- Avoid these themes (already saturated in recent sessions): ${hints.avoid_themes.join(', ')}`);
  if (hints.session_size === 'mini') {
    lines.push('- Session size: MINI (3-4 turns max; choose a scene that resolves quickly).');
  } else if (hints.session_size === 'standard') {
    lines.push('- Session size: STANDARD (6-10 turns, room for a real arc).');
  }
  if (lines.length === 0) return '';
  return `\n\nMASTER BRIEF (teacher context, NEVER show to the student):\n${lines.join('\n')}\n- The scenario MUST create natural, repeated opportunities for the target skill.\n- Nothing here should appear as explicit dialogue — weave it into the world.`;
}

export function getScenarioGenerationPrompt(theme?: string, intensity: string = 'normal', customDescription?: string, tone?: ConversationTone, masterHints?: MasterScenarioHints): string {
  const intensityGuide: Record<string, string> = {
    normal: `INTENSITY: NORMAL (everyday situations with a small twist)
- Think: ordering coffee, checking into a hotel, buying groceries, asking for directions.
- Familiar places, common interactions. The kind of thing you'd do on any trip.
- Characters are pleasant, professional, straightforward.
- IMPORTANT: Always include a small complication or detail that extends the conversation beyond a trivial exchange. The twist can come from EITHER side — the establishment or the user. Examples: you need a gluten-free option and the menu isn't clear, the item you wanted just sold out and you need to pick an alternative, you forgot the address and need to describe where you're going, there's a special deal but only under certain conditions, you have a dietary restriction to explain, you arrived without a reservation and it's busy. Keep it realistic and low-stakes — not a crisis, just a wrinkle that makes the student think and talk more.`,

    adventurous: `INTENSITY: ADVENTUROUS (interesting and specific)
- Think: negotiating at a flea market in Brooklyn, asking a tattoo artist in Melbourne about their designs, ordering from a secret menu at a speakeasy.
- Unique places, specific cultural contexts. Not dangerous, but memorable and colorful.
- Characters have personality — they're not generic NPCs.`,

    wild: `INTENSITY: WILD (bizarre, highly specific, unforgettable)
- Think: buying a handmade recycled surfboard from an artisan in Maui who only accepts trade, convincing a street magician in New Orleans to teach you a card trick, ordering a mystery dish from a chef who only speaks in riddles at an underground supper club.
- Weird, wonderful, cinematic. The kind of story you'd tell friends about for years.
- Characters are ECCENTRIC — strong opinions, unusual speech patterns, memorable quirks.
- The situation should have a twist or unusual constraint that makes the conversation interesting.`,
  };

  let themeStr: string;
  if (customDescription) {
    themeStr = `USER'S CUSTOM SCENARIO REQUEST: "${customDescription}"\nAdapt this into a fully fleshed-out scenario. Keep the user's core idea but enrich it with specific details, a vivid location, and a memorable character.`;
  } else if (theme && theme !== 'random') {
    themeStr = `Theme: ${theme}`;
  } else {
    themeStr = 'Choose ANY theme — food, travel, shopping, work, healthcare, entertainment, sports, arts, nightlife, nature, crafts, music, anything.';
  }

  return `Generate a vivid, immersive role-play conversation scenario for an English language learner.

${intensityGuide[intensity] || intensityGuide.normal}

${getToneInstruction(tone)}

${themeStr}

SCENARIO RULES:
- The user is ALWAYS the customer/tourist/visitor/client — never the employee or expert.
- Create a SPECIFIC place with a name and location (real city + neighborhood or landmark).
- NEVER repeat generic scenarios. Be creative. Surprise the user.
- The character's speech style should match the tone above.

CHARACTER RULES:
- Give the AI character a DISTINCT personality — not a generic "helpful person."
- Define HOW they speak: their rhythm, their vocabulary, slang, verbal tics, energy level.
- Think about what makes this character DIFFERENT from anyone else the user might talk to.
- Consider their background: are they a veteran? A student? An immigrant? A retiree doing this for fun?
- The character should speak naturally and authentically — the way real people talk, not AI-generated dialogue.

LANGUAGE RULE (CRITICAL): ALL fields MUST be in ENGLISH except "descriptionPt" which MUST be in Brazilian Portuguese. This includes characterPersonality, characterSpeechStyle, openingLine, systemDetails, aiRole, userRole, brandName — ALL in English. This is an English practice application. Do NOT write any field other than descriptionPt in Portuguese.

Respond in JSON format:
{
  "descriptionPt": "<2-4 sentence vivid description of the situation in Brazilian Portuguese. Paint the scene — what the user sees, hears, smells. Make them FEEL like they're there. NO roles, NO objectives, NO instructions.>",
  "brandName": "<specific place/business name>",
  "location": "<city + specific area, e.g. 'Maui, North Shore' or 'London, Camden Market'>",
  "userRole": "<what the user is: customer/tourist/visitor/etc>",
  "aiRole": "<specific role, e.g. 'surfboard shaper' not just 'salesperson'>",
  "characterPersonality": "<2-3 sentences IN ENGLISH describing WHO this person is. Their vibe, attitude, background. e.g. 'A 60-year-old ex-pro surfer who now shapes boards by hand. Mellow, philosophical, calls everyone dude. Gets passionate when talking about wave dynamics.'>",
  "characterSpeechStyle": "<2-3 sentences IN ENGLISH about HOW they talk. e.g. 'Speaks slowly with lots of pauses. Uses surf slang (gnarly, stoked, sick). Asks rhetorical questions. Often trails off mid-sentence then picks up a new thought. Says bro/dude every other sentence.'>",
  "openingLine": "<the FIRST thing the character says to the user when they walk in/approach. MUST be in ENGLISH (this is an English practice app). Must be 100% in character. e.g. 'Heyyy, welcome welcome! You look like someone who knows their way around a wave. Am I right?'>",
  "systemDetails": "<internal world-building for the AI: what the place offers, prices, specials, constraints, backstory. The richer the better.>",
  "suggestedVoice": "<pick the BEST voice for this character from this list based on their gender, age, energy, and personality: Zephyr (Bright), Kore (Firm), Puck (Upbeat), Fenrir (Excitable), Aoede (Breezy), Charon (Informative), Leda (Youthful), Algieba (Smooth), Algenib (Gravelly), Gacrux (Mature), Sulafat (Warm), Achernar (Soft), Enceladus (Breathy), Despina (Smooth), Alnilam (Firm), Achird (Friendly), Sadachbia (Lively), Umbriel (Easy-going), Schedar (Even), Autonoe (Bright), Rasalgethi (Informative), Pulcherrima (Forward), Vindemiatrix (Gentle). Return ONLY the voice name, e.g. 'Kore'.>"
}
${formatMasterHintsBlock(masterHints)}
Respond ONLY with the JSON, nothing else.`;
}

const VOICE_NAMES = [
  'Zephyr', 'Kore', 'Puck', 'Fenrir', 'Aoede', 'Charon', 'Leda',
  'Algieba', 'Algenib', 'Gacrux', 'Sulafat', 'Achernar', 'Enceladus',
  'Despina', 'Alnilam', 'Achird', 'Sadachbia', 'Umbriel', 'Schedar',
  'Autonoe', 'Rasalgethi', 'Pulcherrima', 'Vindemiatrix',
] as const;

const SKILL_VOICE_NAMES = [
  'Zephyr', 'Kore', 'Puck', 'Aoede', 'Charon', 'Gacrux', 'Sulafat',
  'Algieba', 'Alnilam', 'Sadaltager', 'Schedar', 'Rasalgethi',
] as const;

export const scenarioResponseSchema = {
  type: 'object' as const,
  properties: {
    descriptionPt: {
      type: 'string' as const,
      description: '2-4 sentence vivid description of the situation in Brazilian Portuguese. Paint the scene. NO roles, NO objectives, NO instructions.',
    },
    brandName: {
      type: 'string' as const,
      description: 'Specific place/business name. MUST be in English.',
    },
    location: {
      type: 'string' as const,
      description: "City + specific area in English, e.g. 'Maui, North Shore' or 'London, Camden Market'.",
    },
    userRole: {
      type: 'string' as const,
      description: 'What the user is: customer/tourist/visitor/etc. MUST be in English.',
    },
    aiRole: {
      type: 'string' as const,
      description: "Specific role in English, e.g. 'surfboard shaper' not just 'salesperson'.",
    },
    characterPersonality: {
      type: 'string' as const,
      description: "2-3 sentences IN ENGLISH describing WHO this person is. Their vibe, attitude, background. e.g. 'A 60-year-old ex-pro surfer who now shapes boards by hand. Mellow, philosophical, calls everyone dude.'",
    },
    characterSpeechStyle: {
      type: 'string' as const,
      description: "2-3 sentences IN ENGLISH about HOW they talk. e.g. 'Speaks slowly with lots of pauses. Uses surf slang (gnarly, stoked, sick). Asks rhetorical questions.'",
    },
    openingLine: {
      type: 'string' as const,
      description: "The FIRST thing the character says to the user. MUST be in ENGLISH. Must be 100% in character. e.g. 'Heyyy, welcome welcome! You look like someone who knows their way around a wave. Am I right?'",
    },
    systemDetails: {
      type: 'string' as const,
      description: 'Internal world-building IN ENGLISH for the AI: what the place offers, prices, specials, constraints, backstory.',
    },
    suggestedVoice: {
      type: 'string' as const,
      description: `Pick the BEST voice name for this character from: ${VOICE_NAMES.join(', ')}. Return ONLY the voice name.`,
      enum: [...VOICE_NAMES],
    },
  },
  required: ['descriptionPt', 'brandName', 'location', 'userRole', 'aiRole', 'characterPersonality', 'characterSpeechStyle', 'openingLine', 'systemDetails', 'suggestedVoice'],
  additionalProperties: false,
};

export const skillScenarioResponseSchema = {
  type: 'object' as const,
  properties: {
    descriptionPt: {
      type: 'string' as const,
      description: '2-4 sentence vivid description of the situation in Brazilian Portuguese. Make them FEEL the pressure/context.',
    },
    brandName: {
      type: 'string' as const,
      description: 'Specific company/organization name in English.',
    },
    location: {
      type: 'string' as const,
      description: "Location in English, e.g. 'Remote Google Meet' or 'New York Office'.",
    },
    userRole: {
      type: 'string' as const,
      description: "The user's role in English, e.g. 'Candidate', 'Presenter'.",
    },
    aiRole: {
      type: 'string' as const,
      description: "AI's role in English, e.g. 'Senior Recruiter'.",
    },
    characterPersonality: {
      type: 'string' as const,
      description: "Professional personality IN ENGLISH, e.g. 'Direct, polite, asks probing questions.'",
    },
    characterSpeechStyle: {
      type: 'string' as const,
      description: "How they talk IN ENGLISH, e.g. 'Professional but uses industry jargon naturally. Asks clear questions and pauses.'",
    },
    openingLine: {
      type: 'string' as const,
      description: "The FIRST thing the character says. MUST be in ENGLISH. e.g. 'Hi there, thanks for joining. I see your background is in React.'",
    },
    systemDetails: {
      type: 'string' as const,
      description: 'Internal constraints IN ENGLISH for the AI: what to evaluate, what to ask about the user profile.',
    },
    suggestedVoice: {
      type: 'string' as const,
      description: `Pick the BEST voice name for this character from: ${SKILL_VOICE_NAMES.join(', ')}. Return ONLY the voice name.`,
      enum: [...SKILL_VOICE_NAMES],
    },
  },
  required: ['descriptionPt', 'brandName', 'location', 'userRole', 'aiRole', 'characterPersonality', 'characterSpeechStyle', 'openingLine', 'systemDetails', 'suggestedVoice'],
  additionalProperties: false,
};

export const evaluationResponseSchema = {
  type: 'object' as const,
  properties: {
    score: {
      type: 'number' as const,
      description: 'Convenience 0-10 scalar derived from the 5D axes. 0 = incomprehensible, 10 = perfect native-like spoken English.',
    },
    scores5d: {
      type: 'object' as const,
      description: 'Five-dimensional scorecard. Each axis is an INTEGER 0-100 and is INDEPENDENT of the others.',
      properties: {
        naturalness: { type: 'number' as const, description: '0-100. Sounds like a native speaker in the target register.' },
        accuracy: { type: 'number' as const, description: '0-100. Grammar, vocabulary, and word-choice correctness.' },
        fluency: { type: 'number' as const, description: '0-100. Rhythm, fillers, connected speech.' },
        pragmatics: { type: 'number' as const, description: '0-100. Register, politeness, situational fit.' },
        completeness: { type: 'number' as const, description: '0-100. Covers what the prompt actually asked for.' },
      },
      required: ['naturalness', 'accuracy', 'fluency', 'pragmatics', 'completeness'],
      additionalProperties: false,
    },
    primaryDimension: {
      type: 'string' as const,
      description: 'The single axis that most held this response back.',
      enum: ['naturalness', 'accuracy', 'fluency', 'pragmatics', 'completeness'],
    },
    correctedVersion: {
      type: 'string' as const,
      description: 'The corrected English version — how a native speaker would actually say it out loud.',
    },
    betterAlternatives: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'At least 2 alternative native English ways to say the same thing. 100% English, no Portuguese.',
    },
    highlights: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Things the student did well, in Portuguese (pt-br). Empty array if nothing to highlight.',
    },
    corrections: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          tip: {
            type: 'string' as const,
            description: 'Short, direct feedback in Portuguese — what was wrong + quick suggestion.',
          },
          example: {
            type: 'string' as const,
            description: 'Optional full English example sentence showing the fix in context.',
          },
          severity: {
            type: 'string' as const,
            description: 'How impactful the fix is for this utterance.',
            enum: ['critical', 'moderate', 'polish'],
          },
          canonical_pattern: {
            type: 'string' as const,
            description: 'Optional stable snake_case id naming the underlying phenomenon. Use one from the canonical list when it fits exactly, or propose a new semantic id (not a slice of the tip). Reuse ids across corrections only for the same phenomenon.',
          },
        },
        required: ['tip'],
        additionalProperties: false,
      },
      description: 'Array of corrections with tips in Portuguese and optional English examples, ordered from most to least impactful.',
    },
    overallFeedback: {
      type: 'string' as const,
      description: 'Encouraging, constructive overall feedback in Portuguese (pt-br).',
    },
  },
  required: ['score', 'scores5d', 'primaryDimension', 'correctedVersion', 'betterAlternatives', 'highlights', 'corrections', 'overallFeedback'],
  additionalProperties: false,
};

export const conversationAnalysisResponseSchema = {
  type: 'object' as const,
  properties: {
    improvements: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Specific improvement tips in Portuguese (pt-br). At least 3. Include English examples inside each tip.',
    },
    cleanDialogue: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          role: {
            type: 'string' as const,
            description: "Either 'user' or 'ai'.",
            enum: ['user', 'ai'],
          },
          text: {
            type: 'string' as const,
            description: 'Cleaned up, natural English version of what was said.',
          },
        },
        required: ['role', 'text'],
        additionalProperties: false,
      },
      description: 'The full conversation cleaned up to sound native. All text in English.',
    },
    overallFeedback: {
      type: 'string' as const,
      description: 'Overall constructive feedback in Portuguese (pt-br). Praise before critique.',
    },
  },
  required: ['improvements', 'cleanDialogue', 'overallFeedback'],
  additionalProperties: false,
};

export function getSkillScenarioPrompt(
  customDescription: string,
  tone?: ConversationTone,
  masterHints?: MasterScenarioHints,
): string {
  return `Generate a vivid, highly realistic Skill Training / Interview scenario for an English language learner.

CRITICAL FOCUS: PROFESSIONAL, REALISTIC, AND FOCUSED ON THE USER'S CONTEXT.
- This is NOT a crazy or adventurous roleplay. This is a serious simulation (e.g., job interview, technical screening, performance review, client pitch).

SCENARIO REQUEST: "${customDescription}"
(Adapt this idea into a fully fleshed-out professional scenario. Infer the user's professional context and English level from the description above).

${getToneInstruction(tone)}

SCENARIO RULES:
- The AI must act as a professional interviewer, expert, or client.
- Create a SPECIFIC company name and context.
- The character's speech style should be professional but natural (flowing spoken English).

CHARACTER RULES:
- The AI character usually has a professional role (e.g., 'Senior Technical Recruiter', 'Head of Product').
- Define what they are looking for and what questions they will ask based on the user's background.
- If the user is a Software Engineer, the AI should ask relevant technical or behavioral questions.

LANGUAGE RULE (CRITICAL): ALL fields MUST be in ENGLISH except "descriptionPt" which MUST be in Brazilian Portuguese. This includes characterPersonality, characterSpeechStyle, openingLine, systemDetails — ALL in English.

Respond in JSON format:
{
  "descriptionPt": "<2-4 sentence vivid description of the situation in Brazilian Portuguese. Make them FEEL the pressure/context. NO roles, NO objectives, NO instructions.>",
  "brandName": "<specific company/organization name>",
  "location": "<e.g. 'Remote Google Meet', 'New York Office'>",
  "userRole": "<the user's role being simulated, e.g. 'Candidate', 'Presenter'>",
  "aiRole": "<AI's role, e.g. 'Senior Recruiter'>",
  "characterPersonality": "<Professional personality, e.g. 'Direct, polite, asks probing questions.'>",
  "characterSpeechStyle": "<How they talk, e.g. 'Professional but uses industry jargon naturally. Asks clear questions and pauses.'>",
  "openingLine": "<the FIRST thing the character says. MUST be in ENGLISH. e.g. 'Hi there, thanks for joining. I see your background is in React. Let's start by talking about your last project.'>",
  "systemDetails": "<internal constraints for the AI: what exactly they should evaluate, what specific things they should ask about the user's profile.>",
  "suggestedVoice": "<pick the BEST voice for this character from: Zephyr (Bright), Kore (Firm), Puck (Upbeat), Aoede (Breezy), Charon (Informative), Gacrux (Mature), Sulafat (Warm), Algieba (Smooth), Alnilam (Firm), Sadaltager (Knowledgeable), Schedar (Even), Rasalgethi (Informative). Return ONLY the voice name.>"
}
${formatMasterHintsBlock(masterHints)}
Respond ONLY with the JSON, nothing else.`;
}

// ---------------------------------------------------------------------------
// Conversation analysis & tutor prompts
// ---------------------------------------------------------------------------

export function getConversationAnalysisPrompt(turns: { role: string; text: string }[], tone?: ConversationTone): string {
  const dialogue = turns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n');

  return `Analyze this English conversation between a student and an AI role-play partner:

${dialogue}

${getToneInstruction(tone)}

Provide a detailed analysis in JSON format:
{
  "improvements": ["<specific improvement tip in Portuguese (pt-br)>", "..."],
  "cleanDialogue": [
    {"role": "user", "text": "<cleaned up, natural ENGLISH version of what the student said>"},
    {"role": "ai", "text": "<AI's response in English>"},
    ...
  ],
  "overallFeedback": "<overall constructive feedback IN PORTUGUESE (pt-br)>"
}

Rules:
- Focus the analysis heavily on SPOKEN fluency, rhythm, and natural phrase choices, ignoring standard written grammar if the spoken form is natural.
- NATURALNESS MARKERS: Actively evaluate usage (or lack) of discourse markers, fillers, contractions, phrasal verbs, short responses, hedging, and tag questions. Praise good usage. Flag absence only when context makes it unnatural (e.g., answering "That is acceptable" instead of "Sounds good" or "Works for me").
- The clean dialogue should represent exactly how a native speaker would have the same conversation out loud using the tone above. Clean dialogue MUST be in English. Include discourse markers, fillers, contractions, and short responses where natives would naturally use them.
- Keep the clean dialogue 100% natural and realistic — the way real people actually talk, absolutely no text-book English.
- Improvements should be direct and actionable (like a coach): "Em vez de 'I would like to obtain information', fale 'I wanna find out about…'". Include a quick English example inside each tip.
- LANGUAGE RULE (CRITICAL): "improvements" and "overallFeedback" MUST be written in Portuguese (pt-br). The student's native language is Portuguese. Only the clean dialogue stays in English. English is allowed inside improvements only when quoting the student or showing the correct form.
- Provide at least 3 specific improvements focused on sounding more native/fluent.
- Be encouraging but honest. Praise what the student did well before pointing out what needs work.
- Respond ONLY with the JSON, nothing else.`;
}

export function getTutorExplanationPrompt(
  prompt: string,
  userTranscription: string,
  correctedVersion: string,
  corrections: (CorrectionItem | string)[],
  tone?: ConversationTone
): string {
  const correctionLines = corrections.map(c => {
    if (typeof c === 'string') return `- ${c}`;
    return c.example ? `- ${c.tip} (ex: "${c.example}")` : `- ${c.tip}`;
  }).join('\n');

  return `You are a patient, encouraging native English tutor. The student just completed this exercise:

Prompt (in Portuguese): "${prompt}"
Student said: "${userTranscription}"
Corrected version: "${correctedVersion}"

${getToneInstruction(tone)}

Corrections made:
${correctionLines}

Explain the student's mistakes or stiffness in a clear, friendly way. Your explanation should:
1. Help them understand WHY this doesn't sound natural in SPOKEN English (avoid citing strict grammar rules if the focus is flow).
2. Provide simple examples of how natives ACTUALLY say this in the tone above.
3. Give them a quick tip to sound more fluent/native next time.
4. Be encouraging - mistakes are part of learning!

Write in a highly conversational, warm tone like a supportive teacher talking to a student out loud. Use Portuguese for explanations but include English examples.

STRICT LIMIT: Maximum 4 sentences total. Be concise — pick the single most impactful correction and explain it well rather than covering everything superficially.`;
}

// ---------------------------------------------------------------------------
// Custom Materials Generation Prompts
// ---------------------------------------------------------------------------

/**
 * Phase 4 (F-P4-02) — optional `masterHint` lets us nudge the
 * generator to weave the student's top chronic pattern into the
 * dialogue without changing the user-facing behaviour. `pattern_id`
 * is canonical (e.g. `past_continuous_in_interrupted_narrative`);
 * `description` is a one-line natural hint ("scenes that naturally
 * require telling a story interrupted by another event"). Stealth
 * still applies — the model must never surface these labels.
 */
export interface ScriptMasterHint {
  pattern_id: string;
  description: string;
}

export function getCustomDialoguePrompt(
  situation: string,
  tone?: ConversationTone,
  masterHint?: ScriptMasterHint
): string {
  const hintBlock = masterHint
    ? `

PEDAGOGICAL HINT (silent — never mention this block or the label):
- The student is currently working on "${masterHint.pattern_id}".
- Shape the scene so the student naturally has opportunities to use: ${masterHint.description}.
- Do not force it unnaturally. If the requested situation can't host this pattern gracefully, prefer naturalness over coverage.`
    : '';

  return `You are an expert English script writer creating acting scripts for English speaking practice.

${getToneInstruction(tone)}

SCENE: "${situation}"${hintBlock}

FORMAT:
Write the script as a theatrical script, clearly formatted for reading aloud and acting.
- Mark the user's lines with **VOCÊ:** and the other character's lines with their character name in bold (e.g. **Interviewer:**, **Waiter:**, **Friend:**).
- Each line must sound like real spoken English — contractions, fillers, natural rhythm.
- Include brief stage directions in italics when helpful (e.g. *smiling*, *leaning forward*).
- Write 12-20 exchanges total, long enough for meaningful speaking practice.
- After the dialogue, include a "Vocabulário" section with 5-8 useful words/expressions used in the script with their Portuguese translations.
- Start with a clear scene title.

Respond ONLY with the generated Markdown text.`;
}

// ---------------------------------------------------------------------------
// Wave 4 — Focused drill generators
//
// Every helper accepts an optional `briefing?: Briefing`. Wave 4 calls these
// helpers with `briefing: undefined`; Wave 5 passes a real Briefing. Behaviour
// when the briefing is absent is a random pedagogically safe default.
//
// Output shape notes: every helper is paired with a JSON schema passed to
// `chatCompletion` so the model is forced into structured output.
// ---------------------------------------------------------------------------

function renderBriefingBlock(briefing?: Briefing): string {
  if (!briefing) return '';
  const required = briefing.required_elements.length
    ? briefing.required_elements.map((r) => `  - ${r}`).join('\n')
    : '  - (none)';
  const forbidden = briefing.forbidden_elements.length
    ? briefing.forbidden_elements.map((r) => `  - ${r}`).join('\n')
    : '  - (none)';
  return `

BRIEFING CONSTRAINTS (silent — never mention these labels to the student):
- Theme: ${briefing.disguise_theme}
- Must naturally require: ${briefing.target_skill}${briefing.secondary_skill ? ` + ${briefing.secondary_skill}` : ''}
- Expected difficulty: ${briefing.expected_difficulty}
- Required elements:
${required}
- Forbidden elements:
${forbidden}
- Success criterion (internal): ${briefing.success_criteria}

STEALTH RULE: Never include the words "target_skill", "briefing", "canonical_pattern", or any grammatical label in the output. The content must look organically motivated by the theme.`;
}

// F24 — Oral Cloze
// -----------------------------------------------------------------------------

export function getOralClozePrompt(briefing?: Briefing, tone?: ConversationTone): string {
  return `You are generating one ORAL CLOZE round for a spoken English drill.

${getToneInstruction(tone)}

Produce a short natural spoken sentence (6-14 words) with exactly one content word blanked out. The student will hear the sentence with a beep instead of the blank word and must say the missing word aloud.

RULES:
- The blanked word MUST be a meaningful content word (noun, verb, adjective, adverb) — never an article, conjunction, or preposition.
- The surrounding context must make the blank unambiguous (there is ONE natural answer).
- The full sentence must sound like something a native would actually say aloud.
- If a canonical pattern hint is provided below, the blank word should be the one that exercises that pattern (e.g. past tense verb for past-tense patterns).

Canonical pattern hints available: ${CANONICAL_PATTERN_HINTS}.${renderBriefingBlock(briefing)}

Return STRICT JSON with this shape:
{
  "sentence": "full sentence with the target word included",
  "blank_token": "the exact word to be blanked",
  "canonical_pattern": "id from the hints list if applicable, else omit",
  "tts_sentence_with_beep": "same sentence but with the blank_token replaced by the token *BEEP*"
}`;
}

export const oralClozeResponseSchema = {
  type: 'object' as const,
  properties: {
    sentence: { type: 'string' as const, description: 'Full sentence with the missing word present.' },
    blank_token: { type: 'string' as const, description: 'Exact word that was blanked (single token, no trailing punctuation).' },
    canonical_pattern: { type: 'string' as const, description: 'Optional canonical pattern id that this round exercises.' },
    tts_sentence_with_beep: { type: 'string' as const, description: 'Sentence with the blank word replaced by the literal string "*BEEP*".' },
  },
  required: ['sentence', 'blank_token', 'tts_sentence_with_beep'],
  additionalProperties: false,
};

// F27 — Error Spotting
// -----------------------------------------------------------------------------

export interface ErrorSpottingPromptInput {
  target_canonical_pattern?: string;
  briefing?: Briefing;
  tone?: ConversationTone;
}

export function getErrorSpottingPrompt(input: ErrorSpottingPromptInput = {}): string {
  const { target_canonical_pattern, briefing, tone } = input;
  const patternLine = target_canonical_pattern
    ? `- The planted error MUST exercise the canonical pattern: ${target_canonical_pattern}.`
    : `- Pick any single common spoken-English mistake. Prefer patterns from: ${CANONICAL_PATTERN_HINTS}.`;
  return `You are generating one ERROR SPOTTING round. A student will hear a spoken sentence containing ONE deliberate mistake and must say the corrected version aloud.

${getToneInstruction(tone)}

RULES:
${patternLine}
- The mistake must be realistic for an intermediate Portuguese-speaking learner — not obvious typos.
- The sentence must be 6-14 words and plausibly said in conversation.
- The correction fixes only the planted error. Do not also rewrite the style.${renderBriefingBlock(briefing)}

Return STRICT JSON:
{
  "planted_sentence": "sentence with exactly one error",
  "error_description": "short Portuguese note pointing out what is wrong (used by the judge, not shown raw)",
  "correction": "the corrected sentence",
  "canonical_pattern": "id of the exercised pattern"
}`;
}

export const errorSpottingResponseSchema = {
  type: 'object' as const,
  properties: {
    planted_sentence: { type: 'string' as const },
    error_description: { type: 'string' as const },
    correction: { type: 'string' as const },
    canonical_pattern: { type: 'string' as const },
  },
  required: ['planted_sentence', 'correction', 'canonical_pattern'],
  additionalProperties: false,
};

// F29 — Reaction Drill
// -----------------------------------------------------------------------------

export function getReactionDrillPrompt(briefing?: Briefing, tone?: ConversationTone): string {
  return `You are generating a REACTION DRILL session: a list of 8-12 short provocations that a student reacts to out loud under a time pressure (3-5 seconds each).

${getToneInstruction(tone)}

EACH LINE MUST:
- Be a short, natural conversational prompt (5-12 words) that INVITES a quick verbal reaction in English. Examples: "Your friend just bought a new car. React naturally." "Someone sneezes next to you. What do you say?" "Your boss praises your work. How do you respond?"
- Be varied: mix social reactions, agreements, disagreements, small talk, reassurances.
- Target naturalness and speed, NOT grammar rules.
- Provide 2-4 "expected_naturalness_markers" — conversational hallmarks we'd reward in a good reaction (e.g. "uses a tag question", "uses 'oh no' or 'I'm sorry'", "uses a natural filler"). These markers are INTERNAL; they are used to score the student silently.${renderBriefingBlock(briefing)}

Return STRICT JSON:
{
  "lines": [
    {
      "provocation": "short prompt",
      "expected_naturalness_markers": ["marker1", "marker2"]
    }
  ]
}

The array MUST contain 8-12 items.`;
}

export const reactionDrillResponseSchema = {
  type: 'object' as const,
  properties: {
    lines: {
      type: 'array' as const,
      description: '8-12 reaction drill rounds.',
      items: {
        type: 'object' as const,
        properties: {
          provocation: { type: 'string' as const },
          expected_naturalness_markers: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
        },
        required: ['provocation', 'expected_naturalness_markers'],
        additionalProperties: false,
      },
    },
  },
  required: ['lines'],
  additionalProperties: false,
};

// F23 — Active Shadowing
// -----------------------------------------------------------------------------

export function getShadowingLinePrompt(briefing?: Briefing, tone?: ConversationTone): string {
  return `You are generating one SHADOWING line for a spoken English rhythm drill. The student will hear the line and must repeat it out loud matching pace and rhythm.

${getToneInstruction(tone)}

RULES:
- 8-18 words, natural spoken English, something a native would actually say.
- Must be speakable in 4-8 seconds at normal pace.
- Include natural contractions and at least one discourse marker or filler where appropriate.${renderBriefingBlock(briefing)}

Return STRICT JSON:
{
  "line": "the sentence to shadow",
  "context_hint_pt": "optional 1-sentence Portuguese hint about the situation (kept short, may be omitted)"
}`;
}

export const shadowingLineResponseSchema = {
  type: 'object' as const,
  properties: {
    line: { type: 'string' as const },
    context_hint_pt: { type: 'string' as const },
  },
  required: ['line'],
  additionalProperties: false,
};

// F26 — Reformulation
// -----------------------------------------------------------------------------

export type ReformulationStyle = 'more_casual' | 'more_formal' | 'shorter' | 'more_natural';

export interface ReformulationPromptInput {
  source_sentence?: string;
  target_style: ReformulationStyle;
  briefing?: Briefing;
  tone?: ConversationTone;
}

export function getReformulationPrompt(input: ReformulationPromptInput): string {
  const { source_sentence, target_style, briefing, tone } = input;
  const sourceBlock = source_sentence
    ? `Use this as the source sentence verbatim: "${source_sentence}"`
    : `Generate a stiff or overly literal English sentence that a Portuguese-speaker might produce. 12-20 words.`;
  return `You are generating one REFORMULATION round. The student will hear the source sentence and must rephrase it in a target style.

${getToneInstruction(tone)}

Target style: ${target_style}.
${sourceBlock}

RULES:
- The source MUST be grammatical but awkward / overly formal / overly long / stilted depending on the target_style (so the student has room to improve it).
- Provide 2-3 reference examples of acceptable reformulations, each clearly matching the target_style.${renderBriefingBlock(briefing)}

Return STRICT JSON:
{
  "source": "the source sentence",
  "target_style": "${target_style}",
  "reference_examples": ["ex1", "ex2", "ex3"]
}`;
}

export const reformulationResponseSchema = {
  type: 'object' as const,
  properties: {
    source: { type: 'string' as const },
    target_style: { type: 'string' as const, enum: ['more_casual', 'more_formal', 'shorter', 'more_natural'] },
    reference_examples: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['source', 'target_style', 'reference_examples'],
  additionalProperties: false,
};

// F28 — Open-Ended Narrative Continuation
// -----------------------------------------------------------------------------

export function getNarrativeSeedPrompt(briefing?: Briefing, tone?: ConversationTone): string {
  return `You are generating an OPENING for a spoken-English narrative continuation exercise. The student will hear the opening and must continue the story out loud for up to 60 seconds.

${getToneInstruction(tone)}

RULES:
- 2-3 opening sentences, 30-60 words total. Should end on a natural narrative pivot that invites continuation (a decision, surprise, or question).
- Keep vocabulary accessible to B1-B2 learners unless the briefing overrides the difficulty.
- Do NOT ask the student a direct question — just set up a scene begging to be continued.${renderBriefingBlock(briefing)}

Return STRICT JSON:
{
  "opening_sentences": "the narrative opening",
  "suggested_topic": "optional 1-2 word topic tag (may be omitted)"
}`;
}

export const narrativeSeedResponseSchema = {
  type: 'object' as const,
  properties: {
    opening_sentences: { type: 'string' as const },
    suggested_topic: { type: 'string' as const },
  },
  required: ['opening_sentences'],
  additionalProperties: false,
};

// F25 — Directed Listening
// -----------------------------------------------------------------------------

export type ListeningAccent = 'us' | 'uk' | 'au' | 'neutral';

export function getListeningPassagePrompt(briefing?: Briefing, tone?: ConversationTone): string {
  return `You are generating a DIRECTED LISTENING round. The student will hear a short spoken passage once, then answer 2-3 comprehension questions out loud.

${getToneInstruction(tone)}

RULES:
- The passage is a natural spoken monologue (news-style, anecdote, or explanation). 60-110 words. Uses natural rhythm and discourse markers.
- Questions must test COMPREHENSION, not memorisation of trivia. Prefer questions about gist, intent, or inferences.
- "expected_key_points" are internal anchors used to judge the student's answers. Each is a short bullet the correct answer would contain.
- "accent_hint" suggests the TTS voice regional flavour and must be one of: us, uk, au, neutral.${renderBriefingBlock(briefing)}

Return STRICT JSON:
{
  "passage": "the spoken passage",
  "questions": ["q1", "q2", "q3"],
  "expected_key_points": ["kp1", "kp2", "kp3"],
  "accent_hint": "us" | "uk" | "au" | "neutral"
}`;
}

export const listeningPassageResponseSchema = {
  type: 'object' as const,
  properties: {
    passage: { type: 'string' as const },
    questions: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    expected_key_points: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    accent_hint: {
      type: 'string' as const,
      enum: ['us', 'uk', 'au', 'neutral'],
    },
  },
  required: ['passage', 'questions', 'expected_key_points'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Phase 2 — post-conversation Live Master evaluation (F-P2-01)
// ---------------------------------------------------------------------------

/**
 * Shape the Master consumes to produce a `LiveMetaAssessment` for a
 * finished Live conversation. We deliberately hand the LLM the *turns*
 * themselves rather than pre-analysed errors — Phase 7's Live-confirmed
 * mastery gate reads explicit turn indices out of the output, so we want
 * the LLM reasoning about the raw dialogue, not a summary of it.
 */
export interface LiveConversationPromptInput {
  turns: Array<{ role: 'user' | 'ai'; text: string }>;
  scenario: {
    theme: string;
    descriptionPt?: string;
    userRole?: string;
    aiRole?: string;
    size?: 'standard' | 'mini';
    target_skill?: string;
    disguise_theme?: string;
  };
  learnerModel: {
    cefr_level: string;
    acquiring_patterns: Array<{ id: string; success_rate: number }>;
    chronic_errors: Array<{ id: string; occurrences: number }>;
    mastered_patterns: string[];
  };
}

export function getLiveConversationMasterPrompt(
  input: LiveConversationPromptInput,
): { system: string; user: string } {
  const numberedDialogue = input.turns
    .map((t, idx) => `Turn ${idx + 1} [${t.role.toUpperCase()}]: ${t.text}`)
    .join('\n');

  const system = `You are the Master evaluator for a finished Live conversation.
Your job is to produce a compact LiveMetaAssessment JSON, nothing else.

Context:
- Live is this app's "final exam". Mastery is only awarded when a pattern
  is produced correctly in spontaneous conversation across multiple
  sessions AND multiple themes, separated by at least 72 hours. Downstream
  code counts distinct correct live turns out of your output, so per-turn
  indices must be precise.
- Known canonical pattern ids (non-exhaustive): ${CANONICAL_PATTERN_HINTS}.
  Use these ids when appropriate; if a pattern is outside the list but
  clearly a stable phenomenon, propose a snake_case id that describes the
  linguistic behaviour (not the topic).

Stealth rules:
- You are writing for a peer system, not the student. No user-facing
  copy, no grammar labels in anything the student might ever see.
- "evidence" may mention the pattern label because it's internal.
- Set "respects_stealth" to false if you would have proposed user-facing
  grammar-label language (so the caller can refuse the output).

Scoring rules:
- turns_correct[]: 1-based indices where the STUDENT (role=USER) produced
  the pattern correctly in a meaningful, spontaneous way. Formulaic
  "Yes." / "Me too." responses do NOT count, even if grammatically fine.
- turns_incorrect[]: 1-based indices where the STUDENT attempted the
  pattern and got it wrong or dropped it.
- Every index you emit MUST correspond to a USER turn in the dialogue.
  Do not cite AI turns. If unsure, omit the index.
- automaticity_estimate: "high" when responses flow with few stalls,
  "low" when the student frequently stalls or switches to Portuguese.
- confidence_estimate uses: cold < recovering < warm < hot.
- suggested_next_step is an internal note (one short sentence) that the
  next prescribe call will read — no student-facing phrasing.
- session_size: echo scenario.size ("mini" or "standard") verbatim.
- theme: echo scenario.theme verbatim (lowercase).

Output STRICT JSON matching the LiveMetaAssessment schema. No prose.`;

  const user = `scenario:
${JSON.stringify(input.scenario, null, 2)}

learner_model:
${JSON.stringify(input.learnerModel, null, 2)}

dialogue (turn indices are 1-based):
${numberedDialogue}`;

  return { system, user };
}

export const liveConversationMasterResponseSchema = {
  type: 'object' as const,
  properties: {
    salient_patterns_observed: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          canonical_pattern: { type: 'string' as const },
          turns_correct: {
            type: 'array' as const,
            items: { type: 'integer' as const },
          },
          turns_incorrect: {
            type: 'array' as const,
            items: { type: 'integer' as const },
          },
          evidence: { type: 'string' as const },
        },
        required: ['canonical_pattern', 'turns_correct', 'turns_incorrect', 'evidence'],
        additionalProperties: false,
      },
    },
    automaticity_estimate: {
      type: 'string' as const,
      enum: ['low', 'moderate', 'high'],
    },
    confidence_estimate: {
      type: 'string' as const,
      enum: ['cold', 'recovering', 'warm', 'hot'],
    },
    suggested_next_step: { type: 'string' as const },
    respects_stealth: { type: 'boolean' as const },
    session_size: {
      type: 'string' as const,
      enum: ['standard', 'mini'],
    },
    theme: { type: 'string' as const },
  },
  required: [
    'salient_patterns_observed',
    'automaticity_estimate',
    'confidence_estimate',
    'suggested_next_step',
    'respects_stealth',
    'session_size',
    'theme',
  ],
  additionalProperties: false,
};

// -----------------------------------------------------------------------------
// Phase 9 (F-P9-02) — Card variation prompt
// -----------------------------------------------------------------------------
//
// Produces a fresh variant of an existing review card that preserves the
// target canonical pattern and difficulty but swaps the surface (theme,
// verbs, specifics). This is the engine that makes Review actually
// practice **transfer** instead of grinding memorization.
//
// Usage contract:
// - The caller passes the original card, a small slice of the learner
//   model (theme preferences + dominant Live themes to avoid), and the
//   list of themes already consumed in recent variants (diversity guard).
// - The LLM must return STRICT JSON, matching `cardVariationResponseSchema`.
// - The output is stealth-safe (no grammar labels visible to the student),
//   because the variant is shown user-facing.
// - The iteration on this exact prompt happens OUTSIDE the repo per the
//   prompt-optimization methodology in master-integration-plan.md §7b.
//   Only the final string lives here.
export interface CardVariationPromptInput {
  card: {
    id: string;
    type: CardType;
    prompt: string;
    original_prompt?: string;
    canonical_pattern?: string;
    theme?: string;
    targetVocabulary?: string[];
  };
  learnerModel: {
    cefr_estimate: string;
    themes_that_land: string[];
    themes_in_live_window: string[];
    mastered_patterns: string[];
  };
  themesToAvoid: string[];
  verbsUsedRecently: string[];
}

export function getCardVariationPrompt(
  input: CardVariationPromptInput,
): { system: string; user: string } {
  const system = `You are the Master's variant generator for a spaced-repetition review card.

Your job: produce a SINGLE new prompt that:
- Practices the SAME target canonical pattern as the original card.
- Keeps the SAME card type (phrase / text / roleplay / image).
- Keeps the approximate difficulty implied by the student's CEFR.
- Uses a DIFFERENT surface: different theme, different core verbs,
  different specific objects/people/places.
- Is written in the SAME language as the original prompt (usually
  Portuguese for the situation description). The response the student
  will produce in English is NOT part of your output.

Stealth rules (non-negotiable, because this is user-facing copy):
- NEVER mention grammar labels, pattern names, linguistic jargon, or
  anything that could tell the student WHY this card is being re-shown.
- Never say "again", "once more", "revisão", or anything that frames the
  prompt as a review. It must feel like a brand new card.
- Never reference the original prompt's content. The variant must read
  standalone.

Diversity rules:
- The new theme MUST be different from every theme in "themes_to_avoid".
- The verbs used by the student to answer this card are likely to
  overlap with "verbs_used_recently". Invent a prompt that naturally
  steers the student toward a different verb set.
- Prefer themes drawn from "themes_that_land" (student-engaging themes)
  when they are not in the avoid list, but pick a fresh angle.

Schema rules:
- "prompt" is the NEW Portuguese (or source-language) situation text.
- "context" is optional extra framing (same language).
- "theme" is a lowercase single token ("work", "travel", "family"...).
- "verbs" is an array of 2-5 core English verbs you expect the student
  to produce (informational for the diversity guard downstream; NOT
  shown to the student).

Output STRICT JSON matching cardVariationResponseSchema. No prose, no
markdown.`;

  const user = `original_card:
${JSON.stringify(input.card, null, 2)}

learner_model:
${JSON.stringify(input.learnerModel, null, 2)}

themes_to_avoid:
${JSON.stringify(input.themesToAvoid)}

verbs_used_recently:
${JSON.stringify(input.verbsUsedRecently)}`;

  return { system, user };
}

export const cardVariationResponseSchema = {
  type: 'object' as const,
  properties: {
    prompt: { type: 'string' as const },
    context: { type: 'string' as const },
    theme: { type: 'string' as const },
    verbs: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['prompt', 'theme', 'verbs'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Phase 3 — summarize_session prompt (F-P3-01b).
// ---------------------------------------------------------------------------
//
// Builds the user-facing reflection shown at the end of a practice session.
// Two sentences max, first-person, stealth-compliant — NEVER mentions
// grammar labels, canonical pattern ids, or CEFR letters.
//
// The output is user-facing, so this prompt is iterated externally (see
// master-integration-plan.md §7b). Only the final string lives here.
export interface SummarizeSessionPromptInput {
  surface: 'live' | 'mini-live' | 'review' | 'lesson' | 'exercises' | 'paths';
  themes: string[];
  patterns_correct: string[];
  patterns_incorrect: string[];
  attempts: number;
  avg_score: number | null;
  had_live: boolean;
  longest_live_turn_words: number | null;
  learner: {
    cefr_estimate: string;
    chronic_errors: string[];
    strengths: string[];
    themes_that_land: string[];
  };
}

export function getSummarizeSessionPrompt(
  input: SummarizeSessionPromptInput,
): { system: string; user: string } {
  const system = `You are the Master tutor producing a short end-of-session
reflection for a Brazilian-Portuguese speaking student of English.

Goal: write TWO short sentences (≤ 140 chars each) in Portuguese:
- "strength_text":    what's going well, framed as an observation about
                      HOW the student is speaking / practicing, NOT which
                      grammar point they nailed.
- "opportunity_text": what to practice next, framed as a gentle nudge,
                      also speaker-level, not grammar-level.

Stealth rules (non-negotiable):
- NEVER mention any grammar label, pattern name, CEFR letter, or
  linguistic jargon. Forbidden: "past continuous", "present perfect",
  "condicional", "modal verb", "collocation", "A2", "B1", "fluency
  rubric", etc.
- NEVER say "errou" or "acertou". Lead with the student's ACTIVITY.
- Speak AS the tutor, in FIRST person, addressing the student ("você").
- Prefer content framing ("suas histórias", "quando você fala sobre
  viagens", "o ritmo da sua conversa") over form framing.
- Never reference internal fields (pattern ids, scores, themes array).

Examples of GOOD reflections (do not copy verbatim):
- Strength: "Suas histórias estão ficando mais longas — dá pra sentir
  que você está pensando antes de falar."
  Opportunity: "Tenta trazer uma situação de trabalho na próxima vez
  e ver o que sai."
- Strength: "Quando você fala sobre comida, você usa mais verbos
  diferentes. Isso é progresso."
  Opportunity: "Bora puxar uma conversa com um detalhe extra: o
  porquê da escolha, não só o quê."

Output STRICT JSON matching summarizeSessionResponseSchema. No prose,
no markdown.`;

  const user = `session_recap:
${JSON.stringify(
  {
    surface: input.surface,
    attempts: input.attempts,
    avg_score: input.avg_score,
    had_live: input.had_live,
    longest_live_turn_words: input.longest_live_turn_words,
    themes: input.themes.slice(0, 5),
    patterns_correct_count: input.patterns_correct.length,
    patterns_incorrect_count: input.patterns_incorrect.length,
  },
  null,
  2,
)}

learner_context:
${JSON.stringify(input.learner, null, 2)}`;

  return { system, user };
}

export const summarizeSessionResponseSchema = {
  type: 'object' as const,
  properties: {
    strength_text: { type: 'string' as const },
    opportunity_text: { type: 'string' as const },
  },
  required: ['strength_text', 'opportunity_text'],
  additionalProperties: false,
};

