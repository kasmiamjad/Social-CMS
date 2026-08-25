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
 * produces. Sending MP3 instead still delivers fine, but shows up on the
 * recipient's side as a plain audio-file attachment, not a voice-note bubble.
 * That trade-off was chosen deliberately here.
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
