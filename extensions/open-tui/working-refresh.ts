import type { WorkingRefreshMode } from "./config.ts";

export const REALTIME_WORKING_REFRESH_INTERVAL_MS = 250;

export function startWorkingRefresh(
	mode: WorkingRefreshMode,
	onRefresh: () => void,
	intervalMs = REALTIME_WORKING_REFRESH_INTERVAL_MS,
): () => void {
	onRefresh();
	if (mode === "event") return () => {};

	const timer = setInterval(onRefresh, intervalMs);
	timer.unref?.();
	return () => clearInterval(timer);
}
