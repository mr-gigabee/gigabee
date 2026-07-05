import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface GpuInfo {
  name: string;
  vramMb: number;
}

async function detectNvidia(): Promise<GpuInfo | null> {
  try {
    const { stdout } = await execAsync(
      "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits",
    );
    const line = stdout.trim().split("\n")[0] ?? "";
    const parts = line.split(",").map((s) => s.trim());
    const name = parts[0] ?? "NVIDIA GPU";
    const vramMb = parseInt(parts[1] ?? "0", 10);
    if (isNaN(vramMb) || vramMb === 0) return null;
    return { name, vramMb };
  } catch {
    return null;
  }
}

async function detectAppleSilicon(): Promise<GpuInfo | null> {
  try {
    const { stdout } = await execAsync(
      "system_profiler SPHardwareDataType -json 2>/dev/null",
    );
    const info = JSON.parse(stdout) as { SPHardwareDataType?: Array<{ physical_memory?: string }> };
    const hw = info.SPHardwareDataType?.[0];
    if (!hw) return null;
    // Apple Silicon shares RAM with GPU; use total RAM as VRAM approximation
    const mem = hw.physical_memory ?? "";
    const gb = parseFloat(mem);
    if (isNaN(gb)) return null;
    return { name: "Apple Silicon (unified memory)", vramMb: gb * 1024 };
  } catch {
    return null;
  }
}

export async function detectGpu(): Promise<GpuInfo | null> {
  const nvidia = await detectNvidia();
  if (nvidia) return nvidia;
  return detectAppleSilicon();
}

/** Minimum VRAM required to serve Bee Glide (native tier). */
export const MIN_VRAM_GB = 20;

export function vramGb(gpu: GpuInfo): number {
  return gpu.vramMb / 1024;
}
