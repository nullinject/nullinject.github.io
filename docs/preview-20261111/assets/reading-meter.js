// Measures visible, focused time, not proof that a person is reading.
export function createReadingMeter({ thresholds = [30, 60, 180, 300], maxGapMs = 5000 } = {}) {
  let lastTime = null;
  let wasActive = false;
  let elapsedMs = 0;
  let furthestProgress = 0;
  let endReported = false;
  const reported = new Set();

  return {
    sample(now, { active, progress = 0 }) {
      if (lastTime !== null) {
        const gap = now - lastTime;
        // Long clock gaps can be suspension or sleep; do not count them as reading.
        if (wasActive && gap >= 0 && gap <= maxGapMs) elapsedMs += gap;
      }
      lastTime = now;
      wasActive = active;
      if (active) furthestProgress = Math.max(furthestProgress, Math.min(1, Math.max(0, progress)));
      const seconds = elapsedMs / 1000;
      const milestones = thresholds.filter(value => seconds >= value && !reported.has(value));
      for (const value of milestones) reported.add(value);
      const reachedEnd = !endReported && seconds >= 30 && furthestProgress >= 0.9;
      if (reachedEnd) endReported = true;
      return { seconds, milestones, reachedEnd };
    }
  };
}
