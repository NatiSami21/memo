# 🧠 Memo — Living Memory for AI-Assisted Development

> **Stop context compaction amnesia, eliminate repetitive debug loops, and keep your AI coding assistants aligned to your repository's core architecture.**

---

## 🌟 What is Memo?

Modern AI IDEs (Google Antigravity, Cursor, GitHub Copilot, Claude Code) operate in an ephemeral context window. As conversations stretch into dozens of turns:

1. **Context Compaction Drops Constraints**: The IDE truncates or summarizes earlier messages; the AI forgets critical architecture choices, API contracts, and prior decisions.
2. **Repetitive Debug Loops**: The agent forgets an attempt failed 10 turns ago and repeats the exact same broken fix.
3. **Architectural Drift**: The agent invents out-of-scope abstractions, bloats dependencies, or hallucinates non-existent libraries.

**Memo** turns the repository's file system into a persistent **"External Long-Term Memory" (ROM/Disk)** while treating the AI chat context as **"Working Memory" (RAM)**.

---

## ⚡ Key Features

- **🚀 Zero-Friction Scaffolding**: Auto-detects newly opened workspaces and initializes the living memory directory with a single click or command.
- **🛡️ Multi-Agent Rule Auto-Injector**: Automatically syncs governance directives into `.agents/rules/` (Antigravity), `.cursor/rules/` (Cursor), `.github/` (Copilot), `CLAUDE.md`, and `AGENTS.md`. **Your AI reads and obeys memory on Turn 1 without manual prompt pasting.**
- **📑 Compaction-Buster Context Digest**: Auto-generates a token-optimized `memory/context_snapshot.md` (< 200 words) that agents read first when starting a new session or recovering from chat compaction.
- **📊 GitHub-Style Sidebar Control Center**: A dark-mode IDE Activity Bar panel providing real-time milestone progress, interactive task toggles, Architectural Decision Records (ADRs), and live commit history.
- **📜 Automated Commit Bookkeeping (`[COMMIT-XXXX]`)**: Automatically assigns sequential IDs to memory modifications, records timestamps and diffs, and rotates older logs (> 20 entries) into `memory/archive/` to protect agent tokens.
- **🎯 3 Tiered Memory Profiles**: Choose the right level of ceremony:
  - **Minimal (3 files)**: Solo/hobby projects (`architecture.md`, `progress.md`, `changelog.md`).
  - **Standard (5 files — default)**: Team projects (`+ guidelines.md`, `decisions.md`).
  - **Enterprise (7+ files)**: Monorepos (`+ feasibility.md`, `validation.md`, `modules/`).

---

## 🏗️ Directory Architecture

```
Your Workspace/
├── .agents/rules/living_memory.md       <-- Antigravity / Gemini reads automatically
├── .cursor/rules/living_memory.mdc      <-- Cursor reads automatically
├── AGENTS.md                            <-- Universal agent fallback
└── memory/
    ├── context_snapshot.md              <-- Auto-generated token-optimized digest
    ├── architecture.md                  <-- Mission, tech stack, ecosystem, risk matrix
    ├── guidelines.md                    <-- Non-negotiable operating rules (Rules A-E)
    ├── progress.md                      <-- Active milestone checklists & phase progress
    ├── decisions.md                     <-- Architectural Decision Records (ADR-XXXX)
    ├── changelog.md                     <-- Commit-style audit trail [COMMIT-XXXX]
    └── archive/                         <-- Auto-rotated older commits
```

---

## 🛡️ Non-Negotiable Rules of Engagement

The injected governance directives enforce 5 non-negotiable software engineering rules:

| Rule       | Name                    | Directive                                                                                                                             |
| :--------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Rule A** | Anti-Hallucination      | Never assume an API, library, or framework capability exists without verifying exact versions and platform constraints.               |
| **Rule B** | Strict Drift Control    | Every feature, class, or service must tie directly to the core mission in `memory/architecture.md`.                                   |
| **Rule C** | 3-Step Anti-Debug Loop  | If an error occurs, never repeat the failed action. 1) Identify root cause, 2) Hypothesize alternative, 3) Document in `progress.md`. |
| **Rule D** | Radical Honesty         | Plainly state OS/hardware/economic boundaries. Always design tiered fallbacks (Tier 1 → Tier 2 → Tier 3).                             |
| **Rule E** | Mandatory Audit Logging | Every modification to `memory/` must append a `[COMMIT-XXXX]` entry in `changelog.md`.                                                |

---

## 🕹️ Extension Commands

| Command                 | Title             | Action                                                            |
| :---------------------- | :---------------- | :---------------------------------------------------------------- |
| `memo.init`             | Quick Initialize  | Scaffolds standard `memory/` directory and syncs agent rules      |
| `memo.initDetailed`     | Detailed Setup    | Interactive wizard prompting for project name, mission, and stack |
| `memo.openDashboard`    | Open Dashboard    | Focuses the Living Memory Control Center in the Activity Bar      |
| `memo.copyDigest`       | Copy Digest       | Copies `context_snapshot.md` to clipboard for instant pasting     |
| `memo.logDecision`      | Log Decision      | Quick dialog to record an Architectural Decision Record (ADR)     |
| `memo.syncRules`        | Sync Agent Rules  | Re-syncs governance files across all configured target platforms  |
| `memo.refreshDashboard` | Refresh Dashboard | Re-reads disk state and updates the UI                            |

---

## 📦 Installation

### From Open VSX Registry (Google Antigravity, Cursor, VSCodium)
- Search for `memo-living-memory` or `Memo` in the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
- Or install directly via terminal:
  ```bash
  code --install-extension natinaelsamuel.memo-living-memory
  ```
- 🔗 **Open VSX Page**: [open-vsx.org/extension/natinaelsamuel/memo-living-memory](https://open-vsx.org/extension/natinaelsamuel/memo-living-memory)

### From VS Code Marketplace
- 🔗 **VS Code Marketplace**: [marketplace.visualstudio.com/items?itemName=natinaelsamuel.memo-living-memory](https://marketplace.visualstudio.com/items?itemName=natinaelsamuel.memo-living-memory)

---

## 💻 Development & Building

```bash
# Install dependencies
npm install

# Build extension bundle with esbuild
npm run build

# Watch mode for rapid development
npm run watch

# Package into .vsix for distribution
npx @vscode/vsce package
```

---

## 👨‍💻 Author & Maintainer

**Natinael Samuel**  
*Senior Full Stack Software Engineer (BSc)*  
GitHub: [@NatiSami21](https://github.com/NatiSami21)

---

## 📄 License

MIT © 2026 Natinael Samuel
