# 依赖漏洞批量修复（2026-11-07）

作者：wwj
日期：2026-11-07
状态：已验收（总经理 2026-11-07 核交接报告与 osv-scanner 复扫；未修项复查日 2026-12-07，见 base-info vulns.yaml V18）

## 背景

驾驶舱漏洞扫描（11-02 扫描，收件箱「新增 10 条漏洞（其中 0 条可达/CRITICAL）」）在本仓库报出新增条目：GHSA-2m5v-pch6-74hx、GHSA-3g3m-2fjr-6pw4、GHSA-4qv8-2p9j-2685、GHSA-4w7w-5xrc-9h26、GHSA-55wc-3pg8-jfw6、GHSA-9fm3-97px-rjf6、GHSA-f72v-6w45-q472、GHSA-g3hv-75wg-m249、…
已知涉及：npm undici、glob、minimatch

## 要做

1. 先跑扫描拿完整清单（不要只看上面截断的 ID）：在仓库根 `osv-scanner scan source -r .`；有 go.mod 的目录跑 `govulncheck ./...`；有 Cargo.lock 的目录跑 `cargo audit`。
2. 按 `~/wwj/code/base-info/.codex/references/vuln-fixes.md` 的修法定点升级：npm 用 `npm update <包>` / `npm install <包>@<修复版>` 或 overrides（只动有漏洞的包，不全量升级）；Go 用 `go get <模块>@<修复版> && go mod tidy`（vendor 仓库再 `go mod vendor`）；Rust 用 `cargo update -p <包>`（同名多版本用 `-p 包@版本` 消歧），不全量 `cargo update`。
3. 主版本跨越（breaking）或上游未放开约束升不上去的：不硬升，在交接报告「未修」节写包、当前版本、修复版、原因、建议复查日。
4. 只有开发依赖（构建/测试工具）且不进产物的，照修，但在报告里标「dev-only」。

## 不做

- 不改业务代码，除非升级导致编译/类型错误需要最小适配（报告里列出）。
- 不打 tag、不 push、不发布、不重启线上或本机常驻服务。

## 验证

- 复跑第 1 步的扫描，贴「修前 / 修后」条目数对比。
- 跑本仓库 AGENTS.md「常用操作」里的构建与测试命令（先读 AGENTS 确认命令存在；没有测试就至少完整构建一次：`npm run build` / `go build ./... && go vet ./...` / `cargo build`）。

## 交付

- 在本仓库提交（`fix: 升级 <包> 修复 <ID…>`），只 add 改动的依赖文件。
- 交接报告写在本文件末尾：提交号、修复清单、未修清单（原因）、验证输出摘要；状态改为「待验收」。

## 交接报告

日期：2026-11-07

- 修前扫描：`osv-scanner scan source -r .` → `No issues found`（仅 package-lock.json，123 个包）。锁文件现状：undici 8.12.3、minimatch 11.0.3，glob 不在锁内，均已是修复后版本（0.5.1 发布前已更新）。
- 修后：无需改动，0 → 0。
- 改动文件：无（依赖文件未改，无提交号；仅追加本交接报告）。
- 验证：无依赖变更，未重跑 npm test / typecheck。
- 修复清单：无；未修清单：无（无 Go/Rust 文件）。
- 踩坑记录：无。
- 疑问：任务背景的 11-02 扫描结果似已过时（可能扫的是更早的锁文件），建议统筹核对驾驶舱条目是否需重扫关闭。工作区有预先存在的 .gitignore 改动（非本次所为），未纳入提交。
