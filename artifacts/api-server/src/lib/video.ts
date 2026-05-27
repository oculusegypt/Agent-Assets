import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { mediaDir } from "./media.js";

const execFileAsync = promisify(execFile);
const FFMPEG = "ffmpeg";
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// ── Audio duration detection ────────────────────────────────────────────────

export async function getAudioDurationSec(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", filePath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

// ── Scene extraction from storyboard/script text ───────────────────────────

export interface SceneSlide {
  label: string;   // e.g. "SCENE 1"
  sub: string;     // short description (max 40 chars)
  color: string;   // hex color for the accent bar
}

const SCENE_COLORS = [
  "0x4ADE80", "0x38BDF8", "0xA78BFA", "0xFB923C",
  "0xF472B6", "0xFACC15", "0x34D399", "0x60A5FA",
];

export function extractScenes(texts: Record<string, string>, totalDur: number): SceneSlide[] {
  const combined = Object.values(texts).join("\n");
  const scenes: SceneSlide[] = [];

  // Try to extract from storyboard/script
  const patterns = [
    /(?:مشهد|scene)\s*(\d+)[:\s–-]+([^\n]{5,60})/gi,
    /(?:shot|لقطة)\s*(\d+)[:\s–-]+([^\n]{5,60})/gi,
    /^(\d+)\.\s+([^\n]{10,60})/gm,
  ];

  for (const pat of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(combined)) !== null) {
      const num = parseInt(m[1]) || scenes.length + 1;
      const desc = m[2]?.trim().replace(/['"\\:]/g, "") || "";
      scenes.push({
        label: `SCENE ${num}`,
        sub: desc.slice(0, 40),
        color: SCENE_COLORS[(num - 1) % SCENE_COLORS.length],
      });
      if (scenes.length >= 8) break;
    }
    if (scenes.length >= 3) break;
  }

  // Fallback: divide into equal segments
  if (scenes.length < 2) {
    const count = Math.min(Math.max(Math.floor(totalDur / 15), 3), 6);
    for (let i = 1; i <= count; i++) {
      scenes.push({
        label: `SCENE ${i}`,
        sub: "",
        color: SCENE_COLORS[(i - 1) % SCENE_COLORS.length],
      });
    }
  }

  return scenes;
}

// ── ffmpeg drawtext escape ──────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[\\:']/g, "\\$&").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

// ── Main video compilation ──────────────────────────────────────────────────

export async function buildCompilationVideo(params: {
  jobId: string;
  projectTitle: string;
  totalDuration: number;
  scenes: SceneSlide[];
  audioFilename?: string;
}): Promise<string> {
  const { jobId, projectTitle, totalDuration, scenes, audioFilename } = params;

  const outputFile = `${jobId}-video.mp4`;
  const outputPath = path.join(mediaDir, outputFile);

  const audioPath = audioFilename ? path.join(mediaDir, audioFilename) : null;
  const hasAudio = !!(audioPath && fs.existsSync(audioPath));

  let audioDuration = 0;
  if (hasAudio && audioPath) {
    audioDuration = await getAudioDurationSec(audioPath);
  }
  const videoDur = Math.max(audioDuration > 0 ? audioDuration + 2 : 0, totalDuration, 20);

  // ── timing for each scene segment ──
  const introSec = 3;
  const outrSec = 3;
  const sceneTotalSec = videoDur - introSec - outrSec;
  const secPerScene = Math.max(sceneTotalSec / scenes.length, 3);

  // ── build drawtext filter chain ──
  const filters: string[] = [];

  // Watermark
  filters.push(
    `drawtext=fontfile=${FONT}:text='ACIS PRODUCTION':fontsize=14:` +
    `fontcolor=white@0.25:x=w-text_w-20:y=20`
  );

  // Intro title card
  const titleText = esc(projectTitle.slice(0, 35));
  filters.push(
    `drawtext=fontfile=${FONT}:text='${titleText}':fontsize=54:fontcolor=white:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-20:` +
    `box=1:boxcolor=black@0.5:boxborderw=16:` +
    `enable='between(t,0,${introSec})'`
  );
  filters.push(
    `drawtext=fontfile=${FONT}:text='CINEMATIC PRODUCTION':fontsize=13:fontcolor=0xFFD700@0.7:` +
    `x=(w-text_w)/2:y=h/2+42:` +
    `enable='between(t,0,${introSec})'`
  );

  // Scene cards
  scenes.forEach((scene, i) => {
    const t0 = introSec + i * secPerScene;
    const t1 = t0 + secPerScene;
    const color = scene.color;

    // Colored bar at bottom
    filters.push(
      `drawbox=x=0:y=h-8:w=w:h=8:color=${color}@0.9:t=fill:` +
      `enable='between(t,${t0},${t1})'`
    );
    // Scene label
    filters.push(
      `drawtext=fontfile=${FONT}:text='${esc(scene.label)}':fontsize=36:fontcolor=${color}:` +
      `x=(w-text_w)/2:y=h/2-28:` +
      `box=1:boxcolor=black@0.55:boxborderw=12:` +
      `enable='between(t,${t0},${t1})'`
    );
    // Sub-label (if any)
    if (scene.sub) {
      filters.push(
        `drawtext=fontfile=${FONT}:text='${esc(scene.sub)}':fontsize=17:fontcolor=white@0.75:` +
        `x=(w-text_w)/2:y=h/2+22:` +
        `enable='between(t,${t0 + 0.3},${t1})'`
      );
    }
    // Frame counter
    filters.push(
      `drawtext=fontfile=${FONT}:text='${i + 1}\\/${scenes.length}':fontsize=11:fontcolor=white@0.3:` +
      `x=20:y=h-25:enable='between(t,${t0},${t1})'`
    );
  });

  // Outro
  const outroStart = introSec + scenes.length * secPerScene;
  filters.push(
    `drawtext=fontfile=${FONT}:text='END OF PRODUCTION':fontsize=30:fontcolor=white@0.8:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `enable='between(t,${outroStart},${videoDur})'`
  );

  const vfStr = filters.join(",");

  // ── assemble ffmpeg args ──
  const args: string[] = ["-y",
    "-f", "lavfi",
    "-i", `color=c=0x0b0b14:size=1280x720:rate=25:duration=${videoDur}`,
  ];

  if (hasAudio && audioPath) {
    args.push("-i", audioPath);
  }

  args.push("-vf", vfStr);
  args.push("-c:v", "libx264", "-crf", "22", "-preset", "fast");

  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  }

  args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath);

  await execFileAsync(FFMPEG, args, {
    timeout: 300_000,
    maxBuffer: 200 * 1024 * 1024,
  });

  return outputFile;
}
