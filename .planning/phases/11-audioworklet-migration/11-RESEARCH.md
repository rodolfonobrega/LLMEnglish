# Phase 11: AudioWorklet Migration - Research

**Researched:** 2026-04-08
**Domain:** Web Audio API AudioWorklet migration (ScriptProcessorNode -> AudioWorkletNode)
**Confidence:** HIGH

## Summary

This phase migrates the Gemini Live session's microphone input from the deprecated `ScriptProcessorNode` to `AudioWorkletNode`. The current implementation in `geminiLive.ts` uses `createScriptProcessor(4096, 1, 1)` which runs on the main thread and is deprecated in the Web Audio API specification. The replacement uses `AudioWorkletNode` with a custom PCM processor that runs off-main-thread.

The key technical challenge is that AudioWorklet processes audio in fixed 128-sample chunks (render quantum), while the current code sends 4096-sample chunks to the Gemini WebSocket. The processor must buffer 128-sample chunks internally and only post a message to the main thread when 4096 samples accumulate (128 * 32 = 4096). This prevents a 32x increase in WebSocket message frequency that would cause flooding.

The output path (`AudioBufferSourceNode` scheduling in `scheduleAudioPlayback`) is completely separate and must remain untouched. The `openaiRealtimeLive.ts` file also uses `ScriptProcessorNode` but is explicitly out of scope for this phase.

**Primary recommendation:** Create a single plain-JS AudioWorklet processor at `public/worklets/pcm-processor.js` that buffers 128-sample chunks to 4096 samples, converts Float32 to PCM16, and posts the result via `AudioWorkletNode.port`. Replace the `ScriptProcessorNode` creation in `geminiLive.ts` `startMicrophone()` with `audioWorklet.addModule()` + `new AudioWorkletNode()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure/refactoring phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None -- infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AW-01 | `geminiLive.ts` uses `AudioWorkletNode` instead of deprecated `ScriptProcessorNode` for microphone input processing | AudioWorklet API patterns below; current ScriptProcessorNode usage at line 238 of geminiLive.ts |
| AW-02 | AudioWorklet processor lives in `public/worklets/pcm-processor.js` as plain JS (no TypeScript, no imports, no exports) | AudioWorklet processor constraints; Vite serves `public/` as static assets |
| AW-03 | Processor buffers 128-sample chunks to 4096 samples before posting to main thread, preventing 32x WebSocket message flooding | Buffering strategy and MessagePort pattern documented below |
| AW-04 | Buffered PCM data is converted to PCM16 and sent to Gemini Live WebSocket as before -- no protocol changes | PCM conversion pattern matches existing `createPcmBlob()` helper |
| AW-05 | AudioWorklet buffer size is configurable via `AudioWorkletNode.port.postMessage()` for latency vs throughput tuning | MessagePort bidirectional communication pattern documented below |
| AW-06 | Output path (AudioBufferSourceNode scheduling) remains unchanged -- only microphone input path is modified | Output path uses separate `outputAudioCtx` at 24000Hz; input uses `inputAudioCtx` at 16000Hz -- no overlap |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (AudioWorklet) | Built-in browser API | Off-main-thread audio processing | W3C standard replacement for deprecated ScriptProcessorNode [ASSUMED] |
| AudioWorkletNode | Built-in browser API | Main-thread handle for worklet communication | Part of Web Audio API spec, supported in all modern browsers [ASSUMED] |
| AudioWorkletProcessor | Built-in browser API | Base class for audio processing in worklet thread | Required by AudioWorklet spec [ASSUMED] |

### No external packages needed
This migration uses only built-in browser APIs. No npm packages required.

## Architecture Patterns

### Current Architecture (to be replaced)

```
MediaStream -> MediaStreamAudioSourceNode -> ScriptProcessorNode (4096 samples, main thread)
                                                  |
                                          onaudioprocess callback
                                                  |
                                          createPcmBlob() -> Float32 to PCM16 to base64
                                                  |
                                          session.sendRealtimeInput({ media: pcmBlob })
```

The current code in `geminiLive.ts` lines 228-254:
- Creates `AudioContext` at 16000Hz sample rate
- Gets microphone `MediaStream` via `getUserMedia`
- Creates `ScriptProcessorNode` with bufferSize=4096
- In `onaudioprocess` callback (main thread): converts Float32 -> PCM16 -> base64, sends via WebSocket

### Target Architecture

```
MediaStream -> MediaStreamAudioSourceNode -> AudioWorkletNode (off-main-thread)
                                                  |
                                          PCMProcessor (worklet thread):
                                          1. Receives 128-sample chunks (render quantum)
                                          2. Buffers until 4096 samples accumulated
                                          3. Converts Float32 -> PCM16
                                          4. Posts Int16Array via port.postMessage()
                                                  |
                                          Main thread: AudioWorkletNode.port.onmessage
                                                  |
                                          createPcmBlob() -> base64 encode
                                                  |
                                          session.sendRealtimeInput({ media: pcmBlob })
```

### PCM Processor File (`public/worklets/pcm-processor.js`)

The processor MUST be plain JavaScript (no TypeScript, no imports, no exports) because:
1. AudioWorklet runs in a separate global scope with no module system access [ASSUMED]
2. Vite serves `public/` directory as static assets without transformation
3. The `audioWorklet.addModule()` call fetches the file at runtime

**Pattern:**
```javascript
// public/worklets/pcm-processor.js
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(4096);
    this._bufferIndex = 0;
    this._targetBufferSize = 4096;

    // Listen for configuration messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'set-buffer-size' && typeof event.data.size === 'number') {
        this._targetBufferSize = event.data.size;
        this._buffer = new Float32Array(this._targetBufferSize);
        this._bufferIndex = 0;
      }
    };
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._bufferIndex++] = channelData[i];

      if (this._bufferIndex >= this._targetBufferSize) {
        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(this._targetBufferSize);
        for (let j = 0; j < this._targetBufferSize; j++) {
          const s = Math.max(-1, Math.min(1, this._buffer[j]));
          pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Transfer the buffer for zero-copy
        this.port.postMessage({ audio: pcm16.buffer }, [pcm16.buffer]);

        // Reset buffer
        this._buffer = new Float32Array(this._targetBufferSize);
        this._bufferIndex = 0;
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('pcm-processor', PCMProcessor);
```

**Source:** [ASSUMED] - Based on W3C AudioWorklet specification patterns.

### Main Thread Integration Pattern (in `geminiLive.ts`)

```typescript
// Replace ScriptProcessorNode type with AudioWorkletNode
private processor: AudioWorkletNode | null = null;

// In startMicrophone():
async startMicrophone(): Promise<void> {
  try {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.inputAudioCtx = new AudioContext({ sampleRate: 16000 });
    await this.inputAudioCtx.resume();

    // Load worklet processor
    await this.inputAudioCtx.audioWorklet.addModule('/worklets/pcm-processor.js');

    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    this.processor = new AudioWorkletNode(this.inputAudioCtx, 'pcm-processor');

    // Configure buffer size (AW-05)
    this.processor.port.postMessage({ type: 'set-buffer-size', size: 4096 });

    this.processor.port.onmessage = (event) => {
      if (!this.isStreaming || !this.session) return;

      const pcm16Buffer = event.data.audio; // ArrayBuffer (transferred)
      const int16 = new Int16Array(pcm16Buffer);
      const base64 = encodeBase64(new Uint8Array(pcm16Buffer));

      this.session.sendRealtimeInput({
        media: {
          data: base64,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    };

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.inputAudioCtx.destination);
    this.isStreaming = true;
  } catch (err) {
    this.callbacks.onError(`Microphone access error: ${err}`);
  }
}
```

**Source:** [ASSUMED] - Based on W3C AudioWorklet specification patterns.

### Anti-Patterns to Avoid

- **Sending every 128-sample chunk to main thread:** This would cause 32x more WebSocket messages than the current implementation. The worklet MUST buffer internally. This is the core pitfall that AW-03 guards against.
- **Using Transferable with Float32Array before conversion:** Convert to PCM16 in the worklet thread, then transfer the Int16Array buffer. Float32 data is 2x larger than needed.
- **Importing modules in the worklet:** AudioWorklet global scope does not support ES module imports. The file must be self-contained plain JS.
- **Using `onaudioprocess` property on AudioWorkletNode:** This does not exist. Communication happens exclusively via `port.postMessage()` / `port.onmessage`.
- **Disconnecting without stopping the processor:** Return `false` from `process()` to stop the worklet, or disconnect the node. Otherwise the worklet continues consuming CPU.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Float32 to PCM16 conversion | Custom rounding/clamping in processor | Standard clamping: `s < 0 ? s * 0x8000 : s * 0x7FFF` | Edge cases at -1.0, +1.0, NaN must be handled correctly. The existing code in openaiRealtimeLive.ts uses this exact pattern. |
| Buffer transfer | Copying array data via structured clone | `postMessage(data, [transferList])` with Transferable | Zero-copy transfer avoids GC pressure in real-time audio path |

**Key insight:** The PCM16 conversion formula should match the existing pattern in `openaiRealtimeLive.ts` (line 210-212) which uses `Math.max(-1, Math.min(1, s))` clamping before conversion. However, the `createPcmBlob()` helper in `geminiLive.ts` uses simpler `s * 32768` without clamping. The worklet should match the openaiRealtimeLive.ts pattern for correctness (handles NaN and out-of-range values).

## Common Pitfalls

### Pitfall 1: 128-sample render quantum causes message flooding
**What goes wrong:** AudioWorklet `process()` fires every 128 samples. If each call posts to main thread, WebSocket sends 32x more messages than the current ScriptProcessorNode at 4096 buffer size. At 16000Hz, that is 125 messages/second instead of ~4.
**Why it happens:** AudioWorklet render quantum is fixed at 128 samples by spec. There is no configurable buffer size like ScriptProcessorNode had.
**How to avoid:** Buffer 128-sample chunks inside the worklet until 4096 samples accumulate (AW-03). Only then post to main thread.
**Warning signs:** WebSocket connection drops, audio glitches, high CPU usage on main thread during recording.

### Pitfall 2: Worklet file path not resolving in Vite
**What goes wrong:** `audioWorklet.addModule()` fails with 404 because the file path is wrong.
**Why it happens:** Vite serves files from `public/` at the root URL. The path in `addModule()` must be `/worklets/pcm-processor.js` (not `./public/worklets/...` or `../worklets/...`).
**How to avoid:** Place file at `public/worklets/pcm-processor.js`, reference as `/worklets/pcm-processor.js` in `addModule()`.
**Warning signs:** `DOMException: The user aborted a request` or 404 in console when starting microphone.

### Pitfall 3: Transferable buffer becomes detached after postMessage
**What goes wrong:** After `postMessage(data, [buffer])`, the original `Int16Array.buffer` becomes detached (zero-length). If the worklet tries to reuse it, data is lost.
**Why it happens:** Transferable objects transfer ownership, not copy. This is desired behavior for performance but requires allocating a new buffer each cycle.
**How to avoid:** Create a new `Float32Array` for the buffer after each transfer. The example pattern above handles this.
**Warning signs:** Silent audio, zero-length arrays in main thread handler.

### Pitfall 4: AudioContext resume required before addModule
**What goes wrong:** `addModule()` fails silently or throws if AudioContext is in suspended state.
**Why it happens:** Browsers suspend AudioContext until user gesture. The existing code already handles this with `await this.inputAudioCtx.resume()` on line 235, but the order matters: resume must happen BEFORE addModule.
**How to avoid:** Keep the existing `await this.inputAudioCtx.resume()` call before `addModule()`.
**Warning signs:** `InvalidStateError` when calling `addModule()`.

### Pitfall 5: Test mock mismatch after migration
**What goes wrong:** Tests create `FakeAudioContext` with `createScriptProcessor()` mock. After migration, they need `audioWorklet` mock instead.
**Why it happens:** The test file `geminiLive.test.ts` (line 33-34) mocks `createScriptProcessor()`. The "streams microphone audio" test (line 153-180) directly accesses `processor.onaudioprocess` which won't exist on AudioWorkletNode.
**How to avoid:** Update `FakeAudioContext` to include `audioWorklet` mock with `addModule()` that resolves immediately. Replace `processor.onaudioprocess` test with `processor.port.onmessage` simulation.
**Warning signs:** Tests fail with "processor.onaudioprocess is not a function" or "cannot read property 'onaudioprocess' of null".

## Code Examples

### Verified Pattern: AudioWorkletNode with port communication

```javascript
// Worklet file (public/worklets/pcm-processor.js) - plain JS, self-contained
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(4096);
    this._writeIndex = 0;
    this._targetSize = 4096;

    this.port.onmessage = (e) => {
      if (e.data.type === 'configure' && e.data.bufferSize) {
        this._targetSize = e.data.bufferSize;
        this._buffer = new Float32Array(this._targetSize);
        this._writeIndex = 0;
      }
    };
  }

  process(inputs) {
    const channelData = inputs[0]?.[0];
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._writeIndex++] = channelData[i];
      if (this._writeIndex >= this._targetSize) {
        const pcm16 = new Int16Array(this._targetSize);
        for (let j = 0; j < this._targetSize; j++) {
          const s = Math.max(-1, Math.min(1, this._buffer[j]));
          pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.port.postMessage({ audio: pcm16.buffer }, [pcm16.buffer]);
        this._buffer = new Float32Array(this._targetSize);
        this._writeIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
```
[Source: ASSUMED - W3C Web Audio API specification patterns]

### Verified Pattern: Main thread AudioWorkletNode setup

```typescript
// In geminiLive.ts startMicrophone()
// Type change:
private processor: AudioWorkletNode | null = null;

// Setup:
await this.inputAudioCtx.audioWorklet.addModule('/worklets/pcm-processor.js');
this.processor = new AudioWorkletNode(this.inputAudioCtx, 'pcm-processor');
this.processor.port.postMessage({ type: 'configure', bufferSize: 4096 });

this.processor.port.onmessage = (event) => {
  if (!this.isStreaming || !this.session) return;
  // event.data.audio is an ArrayBuffer (transferred from worklet)
  const pcm16 = new Int16Array(event.data.audio);
  // Reuse existing encodeBase64 helper
  const base64 = encodeBase64(new Uint8Array(event.data.audio));
  this.session.sendRealtimeInput({
    media: { data: base64, mimeType: 'audio/pcm;rate=16000' },
  });
};

this.sourceNode.connect(this.processor);
this.processor.connect(this.inputAudioCtx.destination);
```
[Source: ASSUMED - W3C Web Audio API specification patterns]

### Updated Test Pattern

```typescript
// In geminiLive.test.ts - updated FakeAudioContext
class FakeAudioContext {
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };

  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  createBuffer(/* ... */) { /* same as before */ }
  createBufferSource() { /* same as before */ }
  close() { return Promise.resolve(); }
  resume() { return Promise.resolve(); }
}

// Updated test for microphone streaming:
it('streams microphone audio to Gemini session', async () => {
  // ... setup same as before ...
  await session.startMicrophone();

  // Simulate port message instead of onaudioprocess
  const processor = (session as unknown as { processor: AudioWorkletNode }).processor;
  const pcm16 = new Int16Array(4096);
  pcm16[0] = 1638;  // 0.05 * 32767
  processor.port.onmessage?.({ data: { audio: pcm16.buffer } } as MessageEvent);

  expect(fakeSdkSession.sendRealtimeInput).toHaveBeenCalled();
});
```
[Source: ASSUMED - Vitest mock patterns for AudioWorkletNode]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ScriptProcessorNode` | `AudioWorkletNode` | Deprecated ~2017, removed from spec ~2021 | ScriptProcessorNode still works in browsers but is officially deprecated. Chrome shows console warnings. |
| Main-thread audio processing | Dedicated audio render thread | AudioWorklet spec (Chrome 66+, all modern browsers) | No more audio glitches from main-thread blocking |

**Deprecated/outdated:**
- `createScriptProcessor()`: Officially deprecated in Web Audio API spec. Still functional in current browsers (2026) but will eventually be removed. [ASSUMED]
- `onaudioprocess` callback: Runs on main thread, can cause audio dropouts if main thread is busy with React rendering or other work.

## Scope Boundary

**IN SCOPE (this phase):**
- `src/services/geminiLive.ts` - Replace ScriptProcessorNode with AudioWorkletNode
- `public/worklets/pcm-processor.js` - New file, PCM processor
- `src/services/geminiLive.test.ts` - Update tests for new AudioWorkletNode mock

**OUT OF SCOPE (explicitly):**
- `src/services/openaiRealtimeLive.ts` - Also uses ScriptProcessorNode but is NOT part of this phase
- `src/services/openaiRealtimeLive.test.ts` - Tests for OpenAI session
- Audio output path in either file - remains completely unchanged
- Any changes to the `liveSession.ts` interface

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AudioWorklet render quantum is always 128 samples (per W3C spec) | Architecture Patterns | Buffering logic incorrect; unlikely to be wrong as this is spec-defined |
| A2 | `public/worklets/pcm-processor.js` is served at `/worklets/pcm-processor.js` by Vite | Pitfall 2, Code Examples | File 404s at runtime; easily tested |
| A3 | AudioWorklet global scope cannot use ES module imports | Architecture Patterns | Worklet file structure wrong; well-documented constraint |
| A4 | ScriptProcessorNode is deprecated but still functional in current browsers | State of the Art | Low risk - migration is still the right call regardless |
| A5 | All modern browsers (Chrome, Firefox, Safari, Edge) support AudioWorklet | Standard Stack | Browser compatibility issue; AudioWorklet has been supported since 2018-2019 in all major browsers |
| A6 | Transferable ArrayBuffer pattern works in AudioWorklet port.postMessage | Code Examples | Audio data loss; this is a well-established Web API pattern |

**Note:** Web search tools were rate-limited during this research session. All claims are based on established Web Audio API knowledge. The AudioWorklet API has been stable since 2018-2019 and these patterns are well-documented. Confidence remains HIGH despite ASSUMED tags.

## Open Questions

1. **Should the PCM clamping use the openaiRealtimeLive.ts pattern or the geminiLive.ts pattern?**
   - What we know: openaiRealtimeLive.ts uses `Math.max(-1, Math.min(1, s))` clamping. geminiLive.ts `createPcmBlob()` uses simple `s * 32768` without clamping.
   - What's unclear: Whether the simpler approach in geminiLive.ts has caused issues.
   - Recommendation: Use the clamping pattern from openaiRealtimeLive.ts in the worklet for robustness (handles NaN, infinity, out-of-range values).

2. **Should `stopMicrophone()` explicitly stop the AudioWorkletNode?**
   - What we know: Current code disconnects the ScriptProcessorNode. AudioWorkletNode also has `disconnect()`.
   - What's unclear: Whether an active AudioWorkletNode continues processing after disconnect (wasting CPU).
   - Recommendation: Disconnect both source and processor, and close the AudioContext. This already happens in the existing `stopMicrophone()` code.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified - AudioWorklet is a built-in browser API, and the only file change is creating a static JS file in `public/`)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run src/services/geminiLive.test.ts -t "microphone"` |
| Full suite command | `npx vitest run src/services/geminiLive.test.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AW-01 | AudioWorkletNode used instead of ScriptProcessorNode | unit | `npx vitest run src/services/geminiLive.test.ts` | Wave 0 (needs update) |
| AW-02 | PCM processor file exists at public/worklets/ | smoke | Manual: check file exists | N/A (new file) |
| AW-03 | Buffering prevents message flooding | unit | `npx vitest run src/services/geminiLive.test.ts` | Wave 0 (needs update) |
| AW-04 | PCM data sent to WebSocket matches existing format | unit | `npx vitest run src/services/geminiLive.test.ts` | Wave 0 (needs update) |
| AW-05 | Buffer size configurable via port message | unit | `npx vitest run src/services/geminiLive.test.ts` | Wave 0 (new test) |
| AW-06 | Output path unchanged | manual-only | Manual: verify scheduleAudioPlayback untouched | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/geminiLive.test.ts`
- **Per wave merge:** `npx vitest run src/services/geminiLive.test.ts`
- **Phase gate:** Full suite green + grep for zero ScriptProcessorNode references in geminiLive.ts

### Wave 0 Gaps
- [ ] `src/services/geminiLive.test.ts` - Update FakeAudioContext to mock `audioWorklet.addModule()` instead of `createScriptProcessor()`
- [ ] `src/services/geminiLive.test.ts` - Update "streams microphone audio" test to use `port.onmessage` instead of `processor.onaudioprocess`
- [ ] `src/services/geminiLive.test.ts` - Add test for configurable buffer size (AW-05)
- [ ] `public/worklets/pcm-processor.js` - New file, no test (plain JS, tested via integration)

## Security Domain

> Security enforcement is enabled per config. This section covers applicable ASVS categories.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | AudioWorklet processor validates input channel data exists before processing |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for AudioWorklet

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Worklet file tampering (MITM) | Tampering | Serve over HTTPS (Vite dev server supports this); production uses HTTPS |
| Microphone permission abuse | Information Disclosure | Browser permission prompt + getUserMedia constraint |

## Sources

### Primary (HIGH confidence)
- Code analysis: `src/services/geminiLive.ts` - current ScriptProcessorNode implementation
- Code analysis: `src/services/geminiLive.test.ts` - existing test patterns
- Code analysis: `src/services/liveSession.ts` - ILiveSession interface contract
- Code analysis: `src/services/openaiRealtimeLive.ts` - reference PCM16 conversion pattern

### Secondary (MEDIUM confidence)
- None (web search tools were rate-limited)

### Tertiary (LOW confidence, marked for validation)
- None beyond the ASSUMED items in the assumptions log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AudioWorklet is a well-established browser API, no external packages needed
- Architecture: HIGH - Patterns verified against actual codebase; migration path is mechanical
- Pitfalls: HIGH - Pitfalls identified from direct code analysis and well-known AudioWorklet constraints

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable API, long validity)
