import path from "node:path";
import fs from "node:fs";

// ── Media Directory Resolution ─────────────────────────────────────────────

export const mediaDir = (() => {
  let dir = path.resolve(".");
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.join(dir, "data", "media");
    }
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), "data", "media");
})();

if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

// ── WAV Header Builder ─────────────────────────────────────────────────────

export function buildWavBuffer(
  pcmData: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

// ── Save TTS Audio File ────────────────────────────────────────────────────

export function saveTtsAudio(jobId: string, audioData: string, mimeType: string): string {
  const pcm = Buffer.from(audioData, "base64");
  const isRawPcm = mimeType.includes("L16") || mimeType.includes("pcm") || !mimeType.includes("wav");
  const wavBuf = isRawPcm ? buildWavBuffer(pcm) : pcm;
  const filename = `${jobId}.wav`;
  fs.writeFileSync(path.join(mediaDir, filename), wavBuf);
  return filename;
}

// ── Save Image File ────────────────────────────────────────────────────────

export function saveImageFile(jobId: string, imageData: string, mimeType: string): string {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const filename = `${jobId}.${ext}`;
  const buf = Buffer.from(imageData, "base64");
  fs.writeFileSync(path.join(mediaDir, filename), buf);
  return filename;
}

// ── Extract TTS Script from AI Result ─────────────────────────────────────

export function extractTtsScript(aiResult: string, maxChars = 600): string {
  const patterns = [
    // Priority: character-only TTS block
    /\[TTS_CHARACTERS_ONLY_START\]\s*\n?([\s\S]+?)\[TTS_CHARACTERS_ONLY_END\]/i,
    // Character dialogue markers
    /حوار\s*(?:الشخصيات|التسجيل|الصوتي)[^:\n]*[:：]\s*\n?([\s\S]{30,}?)(?=\n\d+\.|توجيهات|مؤثرات|═|$)/i,
    /نص\s*(?:الشخصيات|الحوار)[^:\n]*[:：]\s*\n?([\s\S]{30,}?)(?=\n\d+\.|توجيهات|مؤثرات|═|$)/i,
    // Classic narration markers
    /نص التعليق الصوتي[^:\n]*[:：]\s*\n?([\s\S]{30,}?)(?=\n\d+\.|توجيهات|مؤثرات|$)/i,
    /نص التعليق[^:\n]*[:：]\s*\n?([\s\S]{30,}?)(?=\n\d+\.|توجيهات|مؤثرات|$)/i,
    /التعليق الصوتي[^:\n]*[:：]\s*\n?([\s\S]{30,}?)(?=\n\d+\.|توجيهات|مؤثرات|$)/i,
    /Voice[- ]?over[^:\n]*[:：]\s*\n?([\s\S]{30,}?)(?=\n\d+\.|SFX|Effects|$)/i,
  ];

  for (const pattern of patterns) {
    const match = aiResult.match(pattern);
    if (match?.[1]) {
      return match[1].trim().slice(0, maxChars);
    }
  }

  // Fallback: take the first substantial paragraph (max 3 lines)
  const paragraphs = aiResult
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 40 && !/^\d+\.|^[#═─]/.test(p));

  return (paragraphs[0] || aiResult.slice(0, maxChars)).slice(0, maxChars);
}
