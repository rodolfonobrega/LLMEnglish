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
- [ ] **Image Standardization**: Ensure all generated images follow a consistent style (specifically "cartoon" style) to maintain application identity.

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



