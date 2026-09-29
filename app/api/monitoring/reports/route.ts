import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";
import { diagnosisFrequency, independentTTest, msToSeconds, summarise, type SummaryStats } from "@/core/monitoring/reporting";

function statsSeconds(values: Array<number | null>): SummaryStats {
  return summarise(values.filter((value): value is number => value !== null).map((value) => value / 1_000));
}

/**
 * Reporting module (proposal §3.2.2f, §3.5–3.7): summary statistics for
 * detection/diagnosis/recovery times, diagnosis frequency analysis, and the
 * independent samples t-test comparing prototype vs manual monitoring.
 */
export async function GET() {
  const [trials, faults] = await Promise.all([monitoringStore.listTrials(), monitoringStore.listFaults(500)]);

  const prototypeTrials = trials.filter((trial) => trial.monitor === "prototype");
  const manualTrials = trials.filter((trial) => trial.monitor === "manual");

  const detectionPrototype = statsSeconds(prototypeTrials.map((trial) => trial.detectionTimeMs));
  const detectionManual = statsSeconds(manualTrials.map((trial) => trial.detectionTimeMs));
  const diagnosisStats = statsSeconds(prototypeTrials.map((trial) => trial.diagnosisTimeMs));
  const recoveryStats = statsSeconds(faults.filter((fault) => fault.resolutionTimeMs !== null).map((fault) => fault.resolutionTimeMs));
  const responseStats = statsSeconds(prototypeTrials.map((trial) => (trial.avgResponseTimeMs ?? 0) > 0 ? trial.avgResponseTimeMs! * 1_000 : null));

  const tTest = independentTTest(
    prototypeTrials.map((trial) => (trial.detectionTimeMs ?? 0) / 1_000),
    manualTrials.map((trial) => (trial.detectionTimeMs ?? 0) / 1_000),
  );

  const frequency = diagnosisFrequency(prototypeTrials.map((trial) => ({ diagnosisAccuracy: trial.diagnosisAccuracy })));
  const manualFrequency = diagnosisFrequency(manualTrials.map((trial) => ({ diagnosisAccuracy: trial.diagnosisAccuracy })));

  const byScenario = new Map<string, { scenarioId: string; prototype: number[]; manual: number[] }>();
  for (const trial of trials) {
    if (trial.detectionTimeMs === null) continue;
    const entry = byScenario.get(trial.scenarioId) ?? { scenarioId: trial.scenarioId, prototype: [], manual: [] };
    const seconds = msToSeconds(trial.detectionTimeMs);
    if (trial.monitor === "prototype") entry.prototype.push(seconds);
    else entry.manual.push(seconds);
    byScenario.set(trial.scenarioId, entry);
  }
  const scenarios = [...byScenario.values()].map((entry) => ({
    scenarioId: entry.scenarioId,
    prototype: summarise(entry.prototype),
    manual: summarise(entry.manual),
  }));

  const faultTypeCounts = faults.reduce<Record<string, number>>((counts, fault) => {
    counts[fault.type] = (counts[fault.type] ?? 0) + 1;
    return counts;
  }, {});

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totals: { trials: trials.length, prototype: prototypeTrials.length, manual: manualTrials.length, faults: faults.length, faultTypeCounts },
    detectionTime: { prototype: detectionPrototype, manual: detectionManual },
    diagnosisTime: diagnosisStats,
    recoveryTime: recoveryStats,
    avgResponseTime: responseStats,
    diagnosisAccuracy: { prototype: frequency, manual: manualFrequency },
    tTest,
    byScenario: scenarios,
  });
}
