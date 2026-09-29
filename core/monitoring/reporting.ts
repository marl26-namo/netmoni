/**
 * Reporting module statistics (proposal §3.6).
 *
 * Implements the descriptive statistics and the independent samples t-test
 * used to compare prototype vs manual fault detection times (α = 0.05).
 */

export type SummaryStats = {
  n: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
};

export type TTestResult = {
  tStatistic: number;
  degreesOfFreedom: number;
  significant: boolean;
  alpha: number;
  meanPrototype: number;
  meanManual: number;
  meanDifference: number;
};

export function summarise(values: number[]): SummaryStats {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return { n: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  const sorted = [...clean].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((total, value) => total + value, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = n > 1 ? sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / (n - 1) : 0;
  return { n, mean, median, stdDev: Math.sqrt(variance), min: sorted[0], max: sorted[n - 1] };
}

/**
 * Two-tailed independent samples t-test (Welch's approximation) comparing
 * prototype and manual detection times.
 */
export function independentTTest(prototype: number[], manual: number[], alpha = 0.05): TTestResult {
  const a = prototype.filter((value) => Number.isFinite(value));
  const b = manual.filter((value) => Number.isFinite(value));
  const statsA = summarise(a);
  const statsB = summarise(b);

  if (statsA.n < 2 || statsB.n < 2) {
    return { tStatistic: 0, degreesOfFreedom: 0, significant: false, alpha, meanPrototype: statsA.mean, meanManual: statsB.mean, meanDifference: statsA.mean - statsB.mean };
  }

  const varianceA = statsA.stdDev ** 2 / statsA.n;
  const varianceB = statsB.stdDev ** 2 / statsB.n;
  const standardError = Math.sqrt(varianceA + varianceB);
  const tStatistic = standardError === 0 ? 0 : (statsA.mean - statsB.mean) / standardError;
  const df = (varianceA + varianceB) ** 2 / ((varianceA ** 2 / (statsA.n - 1)) + (varianceB ** 2 / (statsB.n - 1)));

  return {
    tStatistic: Math.round(tStatistic * 1_000) / 1_000,
    degreesOfFreedom: Math.round(df * 100) / 100,
    significant: Math.abs(tStatistic) > criticalValue(df, alpha),
    alpha,
    meanPrototype: statsA.mean,
    meanManual: statsB.mean,
    meanDifference: statsA.mean - statsB.mean,
  };
}

/**
 * Approximate two-tailed critical value of Student's t via the normal
 * approximation refined for small df. Sufficient for α = 0.05 reporting.
 */
export function criticalValue(df: number, alpha = 0.05): number {
  if (!Number.isFinite(df) || df <= 0) return Number.POSITIVE_INFINITY;
  const z = normalQuantileTwoTailed(alpha);
  const correction = 1 + (z * z + 1) / (4 * df);
  return z * correction;
}

/** Two-tailed normal quantile for the given alpha (0.05 → 1.96). */
function normalQuantileTwoTailed(alpha: number): number {
  const p = 1 - alpha / 2;
  // Beasley-Springer-Moro rational approximation.
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pLow) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** Frequency analysis of diagnosis accuracy (proposal §3.6e). */
export function diagnosisFrequency(trials: Array<{ diagnosisAccuracy: boolean | null }>) {
  const scored = trials.filter((trial) => trial.diagnosisAccuracy !== null);
  const correct = scored.filter((trial) => trial.diagnosisAccuracy === true).length;
  return { total: scored.length, correct, accuracyPct: scored.length === 0 ? 0 : Math.round((correct / scored.length) * 1_000) / 10 };
}

/** Convert milliseconds to seconds rounded for report display. */
export function msToSeconds(ms: number): number {
  return Math.round((ms / 1_000) * 100) / 100;
}
