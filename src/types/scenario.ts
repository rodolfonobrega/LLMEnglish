export type ScenarioIntensity = 'normal' | 'adventurous' | 'wild' | 'skill';

/**
 * Session size controls the target length of a Live conversation:
 *   - `standard` (default): 10–30 turns, ~8–15 min. What Live has always been.
 *   - `mini`:                3–4 turns, ~2 min. Phase 2's default prescription
 *     when Prática Sugerida picks "live" and nothing pins a longer session.
 *     The AI partner is instructed to wrap the conversation after ~3–4 user
 *     turns.
 */
export type LiveSessionMode = 'standard' | 'mini';

export interface LiveScenario {
  id: string;
  theme: string;
  intensity: ScenarioIntensity;
  descriptionPt: string; // Portuguese description shown to user
  systemPrompt: string; // Internal prompt for AI (not shown)
  brandName?: string;
  location?: string;
  userRole: string; // e.g., "customer", "tourist"
  aiRole: string; // e.g., "waiter", "receptionist"
  characterPersonality?: string; // e.g., "gruff but warm ex-surfer"
  characterSpeechStyle?: string; // e.g., "uses surf slang, speaks slowly"
  suggestedVoice?: string; // Gemini voice name picked for this character
  sceneImageUrl?: string; // AI-generated scene illustration
  /**
   * Phase 2 — session size. Defaults to `'standard'` when absent (older
   * scenarios saved before this field existed stay valid). Mini-live
   * scenarios instruct the AI partner to auto-farewell after ~3–4 turns.
   */
  mode?: LiveSessionMode;
  /**
   * Phase 2 — when the scenario was generated from a Master briefing, the
   * briefing's `target_skill` (canonical pattern id) is stamped here so the
   * post-conversation evaluator can weight per-pattern evidence correctly
   * and `updateLearnerModel` can tag this as a directed exposure. Never
   * user-facing.
   */
  masterTargetSkill?: string;
  /**
   * Phase 2 — briefing-provided theme/scenario context that shaped this
   * scenario (if any). Lets us tag session_points and telemetry without
   * re-inferring the theme from prose. Never user-facing.
   */
  masterDisguiseTheme?: string;
}

export interface ConversationTurn {
  role: 'user' | 'ai';
  text: string;
  audioBlob?: string; // base64
  timestamp: number;
}

export interface ConversationAnalysis {
  improvements: string[];
  cleanDialogue: ConversationTurn[];
  overallFeedback: string;
  dialogueAudioUrl?: string;
}

export interface LiveSession {
  id: string;
  scenario: LiveScenario;
  turns: ConversationTurn[];
  analysis?: ConversationAnalysis;
  startedAt: string;
  endedAt?: string;
}

export interface RoleplayTrailStep {
  id: string;
  label: string;
  descriptionPt: string;
  scenarioContext: string;
}

export interface RoleplayTrail {
  id: string;
  label: string;
  description: string;
  steps: RoleplayTrailStep[];
}

export interface PathProgress {
  completedSteps: Record<string, string[]>;
}
