export type ScenarioIntensity = 'normal' | 'adventurous' | 'wild' | 'skill';

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
  sceneImageUrl?: string; // AI-generated scene illustration
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
  scenarioContext: string;
}

export interface RoleplayTrail {
  id: string;
  label: string;
  description: string;
  steps: RoleplayTrailStep[];
}
