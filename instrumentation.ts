export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { monitorScheduler } = await import("@/core/monitoring/scheduler");
    monitorScheduler.start();
  } catch {
    /* monitoring boot must never block server startup */
  }
}
