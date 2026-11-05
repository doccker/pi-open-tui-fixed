import { basename } from "node:path";

// Matches official Pi's `π` title only. Distributions with a custom `piConfig.name` briefly show `π`
// when the setting is toggled, until Pi next updates the title.
const APP_TITLE = "π";

export interface TitleTerminal {
	setTitle(title: string): void;
}

export interface TitleHost {
	terminal: TitleTerminal;
}

export interface SessionTitleInfo {
	cwd: string;
	sessionId: string;
	sessionName?: string;
}

/** Same format as Pi's own terminal title: `π - [session name - ]<cwd basename>`. */
export function formatBaseTitle(info: Pick<SessionTitleInfo, "cwd" | "sessionName">): string {
	const cwdName = basename(info.cwd);
	return info.sessionName ? `${APP_TITLE} - ${info.sessionName} - ${cwdName}` : `${APP_TITLE} - ${cwdName}`;
}

/** Appends the suffix unless the title already ends with this exact pid/sid suffix. */
export function appendSessionIds(title: string, pid: number, sessionId: string): string {
	const suffix = ` · pid=${pid} sid=${sessionId}`;
	return title.endsWith(suffix) ? title : `${title}${suffix}`;
}

/**
 * Wraps `terminal.setTitle` on this instance so Pi's own title updates (session start, `/name`,
 * `/reload`) keep the pid/sid suffix. The session id is read on every call, never cached.
 * The returned function restores the original method and resets the title without the suffix.
 */
export function installTerminalTitle(
	terminal: TitleTerminal,
	getInfo: () => SessionTitleInfo | undefined,
): () => void {
	const original = terminal.setTitle;
	const hadOwnProperty = Object.hasOwn(terminal, "setTitle");
	let enabled = true;
	const wrapper = function (this: TitleTerminal, title: string): void {
		const sessionId = enabled ? getInfo()?.sessionId : undefined;
		original.call(this, sessionId === undefined ? title : appendSessionIds(title, process.pid, sessionId));
	};
	terminal.setTitle = wrapper;
	const initial = getInfo();
	if (initial) terminal.setTitle(formatBaseTitle(initial));

	return () => {
		if (!enabled) return;
		const info = getInfo();
		enabled = false;
		// A later wrapper may delegate to ours; leave it as a passthrough then.
		if (terminal.setTitle === wrapper) {
			if (hadOwnProperty) terminal.setTitle = original;
			else Reflect.deleteProperty(terminal, "setTitle");
		}
		if (info) terminal.setTitle(formatBaseTitle(info));
	};
}

export interface TerminalTitleOptions {
	getTui: () => TitleHost | undefined;
	getInfo: () => SessionTitleInfo | undefined;
}

/** Installs or removes the title wrapper to match the setting; safe to call repeatedly. */
export function createTerminalTitle(options: TerminalTitleOptions): { sync(enabled: boolean): void } {
	let stop: (() => void) | undefined;
	return {
		sync(enabled) {
			if (!enabled) {
				stop?.();
				stop = undefined;
				return;
			}
			if (stop) return;
			const tui = options.getTui();
			if (tui) stop = installTerminalTitle(tui.terminal, options.getInfo);
		},
	};
}
