import { describe, it, expect } from "vitest";
import { remainingMs, formatMmSs } from "./timerStore";
import type { TimerSnapshot } from "../lib/events";

function snap(extra: Partial<TimerSnapshot>): TimerSnapshot {
  return {
    stato: "idle",
    durationSec: 300,
    targetEndAt: null,
    pausedRemainingMs: 0,
    ...extra,
  };
}

describe("remainingMs", () => {
  it("idle → durata piena", () => {
    expect(remainingMs(snap({ stato: "idle", durationSec: 300 }))).toBe(300_000);
  });

  it("running → differenza tra fine e now (non negativa)", () => {
    const now = 10_000;
    expect(remainingMs(snap({ stato: "running", targetEndAt: 15_000 }), now)).toBe(5_000);
    // già scaduto: clamp a 0
    expect(remainingMs(snap({ stato: "running", targetEndAt: 5_000 }), now)).toBe(0);
  });

  it("paused → ms residui memorizzati", () => {
    expect(remainingMs(snap({ stato: "paused", pausedRemainingMs: 42_000 }))).toBe(42_000);
  });

  it("ended → 0", () => {
    expect(remainingMs(snap({ stato: "ended" }))).toBe(0);
  });
});

describe("formatMmSs", () => {
  it("formatta mm:ss con zero padding", () => {
    expect(formatMmSs(0)).toBe("00:00");
    expect(formatMmSs(5_000)).toBe("00:05");
    expect(formatMmSs(65_000)).toBe("01:05");
    expect(formatMmSs(600_000)).toBe("10:00");
  });

  it("arrotonda per eccesso i secondi parziali", () => {
    expect(formatMmSs(4_200)).toBe("00:05"); // 4.2s → 5s (ceil)
  });

  it("non va sotto 00:00 con input negativo", () => {
    expect(formatMmSs(-1_000)).toBe("00:00");
  });
});
