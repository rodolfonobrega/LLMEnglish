/**
 * PCM AudioWorklet Processor
 *
 * Buffers 128-sample render quantum chunks to a configurable target size
 * (default 4096) before posting PCM16 data to the main thread via
 * Transferable ArrayBuffer for zero-copy transfer.
 *
 * Required because AudioWorklet processes audio in fixed 128-sample chunks,
 * but sending every chunk to the main thread would cause 32x WebSocket
 * message flooding at the default 4096 buffer size.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(4096);
    this._writeIndex = 0;
    this._targetSize = 4096;

    this.port.onmessage = (event) => {
      if (event.data.type === 'configure' && typeof event.data.bufferSize === 'number') {
        this._targetSize = event.data.bufferSize;
        this._buffer = new Float32Array(this._targetSize);
        this._writeIndex = 0;
      }
    };
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._writeIndex++] = channelData[i];

      if (this._writeIndex >= this._targetSize) {
        // Convert Float32 to PCM16 with clamping for robustness (NaN, out-of-range)
        const pcm16 = new Int16Array(this._targetSize);
        for (let j = 0; j < this._targetSize; j++) {
          const s = Math.max(-1, Math.min(1, this._buffer[j]));
          pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Transfer ownership for zero-copy
        this.port.postMessage({ audio: pcm16.buffer }, [pcm16.buffer]);

        // Allocate new buffer (previous was transferred)
        this._buffer = new Float32Array(this._targetSize);
        this._writeIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
