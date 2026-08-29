import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

export class TranscodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscodeError";
  }
}

/**
 * Transcodes an arbitrary audio buffer to MP3 via the system `ffmpeg` binary.
 *
 * Why: Meta's Cloud API only documents support for aac/amr/mp3/mp4/ogg-opus.
 * Browser MediaRecorder output (webm/opus) and assorted phone recordings
 * (m4a, wav, ...) aren't guaranteed to be accepted as-is — sends were
 * observed failing silently (status: "failed" via the delivery webhook)
 * with no conversion step. Normalizing everything through ffmpeg removes
 * that guesswork.
 *
 * NOTE: WhatsApp only renders the native voice-note waveform bubble (mic
 * icon, play/pause, timer) for OGG/Opus — the exact format its own recorder
 * produces. OGG/Opus was tried here and verified correct at every layer
 * (valid Opus content, correct served Content-Type, unaffected by
 * user-agent) — Meta's Cloud API still rejected every send with a generic
 * "Media upload error" (code 131053) for this specific app/WABA, for
 * reasons outside what's diagnosable from our side. MP3 is the format
 * confirmed to actually deliver; it shows up on the recipient's side as a
 * plain audio-file attachment instead of a voice-note bubble.
 *
 * Requires ffmpeg installed on the host (`apt install ffmpeg` on Debian/
 * Ubuntu) — throws a clear TranscodeError if the binary is missing so the
 * failure surfaces through the existing error banner instead of a vague 500.
 */
export async function transcodeToMp3(input: Buffer): Promise<Buffer> {
  const id = crypto.randomUUID();
  const inPath = path.join(tmpdir(), `${id}-in`);
  const outPath = path.join(tmpdir(), `${id}-out.mp3`);

  try {
    await writeFile(inPath, input);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inPath,
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-vn",
      outPath,
    ]);
    return await readFile(outPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENOENT")) {
      throw new TranscodeError(
        "ffmpeg is not installed on the server. Run: sudo apt install -y ffmpeg"
      );
    }
    throw new TranscodeError(`Audio conversion failed: ${message}`);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

/**
 * Transcodes an arbitrary audio buffer to OGG/Opus via the system `ffmpeg`
 * binary — the exact format WhatsApp's own recorder produces, required for
 * the native voice-note waveform bubble (mic icon, play/pause, timer).
 *
 * Used together with the Media Upload API's upload-then-send-by-id flow
 * (`WhatsAppService.sendAudioMessage`) and the documented `voice: true`
 * flag, per Meta's own voice-message docs.
 */
export async function transcodeToOggOpus(input: Buffer): Promise<Buffer> {
  const id = crypto.randomUUID();
  const inPath = path.join(tmpdir(), `${id}-in`);
  const outPath = path.join(tmpdir(), `${id}-out.ogg`);

  try {
    await writeFile(inPath, input);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inPath,
      "-c:a", "libopus",
      "-b:a", "64k",
      "-ac", "1",
      "-ar", "48000",
      "-vn",
      outPath,
    ]);
    return await readFile(outPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENOENT")) {
      throw new TranscodeError(
        "ffmpeg is not installed on the server. Run: sudo apt install -y ffmpeg"
      );
    }
    throw new TranscodeError(`Audio conversion failed: ${message}`);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
