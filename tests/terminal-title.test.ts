import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_CONFIG, loadConfig } from "../extensions/open-tui/config.ts";
import { preserveEnvironment, temporaryDirectory } from "./fixtures/test-helpers.ts";
import {
	appendSessionIds,
	createTerminalTitle,
	formatBaseTitle,
	installTerminalTitle,
	type SessionTitleInfo,
	type TitleTerminal,
} from "../extensions/open-tui/terminal-title.ts";

class FakeTerminal implements TitleTerminal {
	titles: string[] = [];
	setTitle(title: string): void {
		this.titles.push(title);
	}
	get last(): string | undefined {
		return this.titles.at(-1);
	}
}

function session(overrides: Partial<SessionTitleInfo> = {}): SessionTitleInfo {
	return { cwd: "/work/base-info", sessionId: "sid-1", ...overrides };
}

const suffix = (sid: string) => ` · pid=${process.pid} sid=${sid}`;

test("formats the base title like Pi", () => {
	assert.equal(formatBaseTitle(session()), "π - base-info");
	assert.equal(formatBaseTitle(session({ sessionName: "测试" })), "π - 测试 - base-info");
	assert.equal(formatBaseTitle(session({ cwd: "/work/中文目录" })), "π - 中文目录");
});

test("appends pid and sid immediately and on later Pi title updates", () => {
	const terminal = new FakeTerminal();
	const info = session();
	installTerminalTitle(terminal, () => info);
	assert.equal(terminal.last, `π - base-info${suffix("sid-1")}`);

	// Pi writes a new title for /name or /reload.
	terminal.setTitle("π - 测试 - base-info");
	assert.equal(terminal.last, `π - 测试 - base-info${suffix("sid-1")}`);
});

test("reads the current session id on every call", () => {
	const terminal = new FakeTerminal();
	let info = session();
	installTerminalTitle(terminal, () => info);
	info = session({ sessionId: "sid-2" });
	terminal.setTitle("π - base-info");
	assert.equal(terminal.last, `π - base-info${suffix("sid-2")}`);
});

test("does not stack suffixes", () => {
	const terminal = new FakeTerminal();
	installTerminalTitle(terminal, () => session());
	terminal.setTitle(`π - base-info${suffix("sid-1")}`);
	assert.equal(terminal.last, `π - base-info${suffix("sid-1")}`);
	assert.equal(appendSessionIds(appendSessionIds("t", 1, "a"), 1, "b"), "t · pid=1 sid=b");
});

test("leaves titles untouched when there is no session", () => {
	const terminal = new FakeTerminal();
	installTerminalTitle(terminal, () => undefined);
	terminal.setTitle("π - base-info");
	assert.deepEqual(terminal.titles, ["π - base-info"]);
});

test("restores the prototype method and resets the title without the suffix", () => {
	const terminal = new FakeTerminal();
	const stop = installTerminalTitle(terminal, () => session());
	assert.equal(Object.hasOwn(terminal, "setTitle"), true);

	stop();
	assert.equal(Object.hasOwn(terminal, "setTitle"), false);
	assert.equal(terminal.last, "π - base-info");
	terminal.setTitle("π - 测试 - base-info");
	assert.equal(terminal.last, "π - 测试 - base-info");
});

test("restores an own-property setTitle", () => {
	const titles: string[] = [];
	const own = (title: string) => void titles.push(title);
	const terminal: TitleTerminal = { setTitle: own };
	const stop = installTerminalTitle(terminal, () => session());
	stop();
	assert.equal(terminal.setTitle, own);
	assert.equal(titles.at(-1), "π - base-info");
});

test("stops appending after a second uninstall call", () => {
	const terminal = new FakeTerminal();
	const stop = installTerminalTitle(terminal, () => session());
	stop();
	const count = terminal.titles.length;
	stop();
	assert.equal(terminal.titles.length, count);
});

test("uninstall does not break a wrapper installed after ours", () => {
	const terminal = new FakeTerminal();
	const stop = installTerminalTitle(terminal, () => session());
	const ours = terminal.setTitle;
	const theirs = function (this: TitleTerminal, title: string): void {
		ours.call(this, `[x] ${title}`);
	};
	terminal.setTitle = theirs;
	const before = terminal.titles.length;

	stop();
	// Their wrapper stays installed and still reaches the terminal, now without our suffix.
	assert.equal(terminal.setTitle, theirs);
	assert.equal(terminal.last, "[x] π - base-info");
	terminal.setTitle("π - 测试 - base-info");
	assert.equal(terminal.last, "[x] π - 测试 - base-info");
	assert.ok(terminal.titles.slice(before).every((title) => !title.includes("pid=")));
});

test("controller follows the setting and the mounted TUI", () => {
	const terminal = new FakeTerminal();
	let tui: { terminal: TitleTerminal } | undefined;
	const controller = createTerminalTitle({ getTui: () => tui, getInfo: () => session() });

	controller.sync(true);
	assert.deepEqual(terminal.titles, [], "waits until a TUI is mounted");

	tui = { terminal };
	controller.sync(true);
	assert.equal(terminal.last, `π - base-info${suffix("sid-1")}`);
	const count = terminal.titles.length;
	controller.sync(true);
	assert.equal(terminal.titles.length, count, "repeated sync does not wrap twice");

	controller.sync(false);
	assert.equal(terminal.last, "π - base-info");
	terminal.setTitle("π - base-info");
	assert.equal(terminal.last, "π - base-info");

	controller.sync(true);
	assert.equal(terminal.last, `π - base-info${suffix("sid-1")}`);
});

test("terminalTitle.sessionIds defaults to off and falls back on invalid values", (t) => {
	assert.equal(DEFAULT_CONFIG.terminalTitle.sessionIds, false);
	const agentDir = temporaryDirectory(t, "pi-open-tui-");
	preserveEnvironment(t, ["PI_CODING_AGENT_DIR"]);
	process.env.PI_CODING_AGENT_DIR = agentDir;
	const load = (terminalTitle: unknown) => {
		writeFileSync(join(agentDir, "open-tui.json"), JSON.stringify({ terminalTitle }), "utf8");
		return loadConfig().terminalTitle.sessionIds;
	};
	assert.equal(load(undefined), false);
	assert.equal(load("yes"), false);
	assert.equal(load(true), false);
	assert.equal(load([true]), false);
	assert.equal(load({ sessionIds: "yes" }), false);
	assert.equal(load({ sessionIds: 1 }), false);
	assert.equal(load({ sessionIds: true }), true);
});
