# Project Roadmap

## 1. User Progress & Insights

- [ ] Error evolution tracking to measure whether the user is improving on recurring mistakes.
- [ ] Use this data first as internal logic before exposing it in the UI.

## 2. Adaptive Learning

- [ ] Adjust review content dynamically based on the user's main error patterns.

## 3. Global Error Analysis

- [ ] Add a dashboard showing the user's most frequent or critical errors.
- [ ] Generate targeted speaking lessons from those error clusters.
- [ ] Improve tutor-style explanations so feedback becomes more contextual and gradual.
- [ ] Distinguish between resolved errors and currently active ones.

## 4. Visual Consistency

- [x] Standardize generated images around a consistent cartoon-like style.

## 5. Corrections and Evaluation Quality

- [ ] Keep all prompts focused on natural spoken English, not textbook phrasing.
- [ ] Make translation corrections evaluate nuance, not just grammar.
- [ ] Make roleplay corrections evaluate whether the response fit the situation.
- [ ] Penalize robotic phrasing even when grammatically correct.
- [ ] Improve `correctedVersion` so it sounds like a native speaker, not formal written English.

## 6. Session Reports

- [ ] Define clearly what counts as a session.
- [ ] Update user progress reports at the end of each session.

## 7. Performance and Cost

- [ ] Verify that cached audio is reused correctly to avoid redundant generation.

## 8. Provider Support

- [ ] Expand Groq support where it still makes sense.

## 9. Roleplay and Practice

- [x] Add a space where the user can simulate custom situations such as job interviews.
- [ ] Improve the roleplay trails so scenarios can be pre-structured or randomized by theme.

## 10. Pronunciation and Phonetics

- [x] Remove fake phoneme-level correction until a model can do it credibly.
- [x] Keep notes in code so the feature can return later.
- [x] Research phonetic transcription as a future alternative.

## 11. Prompt Review

- [ ] Revisit all prompts to ensure they sound conversational and native-like.
- [ ] Add examples of natural versus stiff phrasing where that improves output quality.
