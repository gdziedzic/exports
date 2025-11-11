# 🛠️ Taskfile PowerShell Extensions

This repo contains **`TaskFileExtensions.ps1`**, a Windows-friendly wrapper for [Taskfile.dev](https://taskfile.dev).
It makes working with `Taskfile.yml` easier for **junior developers** and **non-technical teammates**.

---

## 🚀 Quick Start

1. Install [Task CLI](https://taskfile.dev/#/installation) (`task.exe`) if you don't have it.
2. Put `TaskFileExtensions.ps1` in your project root (next to `Taskfile.yml`).
3. Run commands like:

```powershell
.\TaskFileExtensions.ps1 list
.\TaskFileExtensions.ps1 add
.\TaskFileExtensions.ps1 preview run
```

---

## 📘 Commands

### 🔍 List all tasks
```powershell
.\TaskFileExtensions.ps1 list
```
Shows all available task names with numbered indexes for easy access.

---

### 🔎 Search tasks
```powershell
.\TaskFileExtensions.ps1 search build
```
Find tasks containing the word **build** (in name, description, or commands).

---

### 👀 Preview task(s)
```powershell
.\TaskFileExtensions.ps1 preview run
```
Shows full details of the `run` task.

Or preview all tasks:
```powershell
.\TaskFileExtensions.ps1 preview
```

---

### ➕ Add a new task
```powershell
.\TaskFileExtensions.ps1 add
```
Interactive prompts guide you through adding a new task safely:
```
Enter new task name: hello
Enter task description (optional): Say hello
Enter command to run for this task: echo Hello World
```

Appends:
```yaml
  hello:
    desc: 'Say hello'
    cmds:
      - 'echo Hello World'
```

---

### ▶️ Run a task
```powershell
.\TaskFileExtensions.ps1 run build
```
Runs the `build` task using the Task CLI.

You can also run tasks by index number:
```powershell
.\TaskFileExtensions.ps1 run 3
# Or simply:
.\TaskFileExtensions.ps1 3
```

---

### 🧪 Dry run (no execution)
```powershell
.\TaskFileExtensions.ps1 dryrun test
```
Shows the commands that *would* run.

---

### ✅ Validate Taskfile
```powershell
.\TaskFileExtensions.ps1 validate
```
Checks YAML syntax using `yq` (if installed) or a built-in validator.

---

### 📝 Edit a task
```powershell
.\TaskFileExtensions.ps1 edit deploy
```
Opens `Taskfile.yml` in your default editor and points you to the right spot.

---

### 📂 Init a new Taskfile
```powershell
.\TaskFileExtensions.ps1 init
```
Creates a new `Taskfile.yml` with schema and an example task.

---

### ❓ Help
```powershell
.\TaskFileExtensions.ps1 -h
```
Displays available subcommands.

---

## 💡 Tips

- **No need to touch YAML** → use `add`, `list`, `search`, `preview` for daily workflow.
- **Seniors can still use native `task` CLI** (e.g., `task build`).
- **Always run `validate` before committing changes** to avoid broken YAML.
- **Run by index** → use numbered indexes from the `list` command for faster task execution.

---

## 🧩 Example Workflow

```powershell
# Create a Taskfile
.\TaskFileExtensions.ps1 init

# See what's available
.\TaskFileExtensions.ps1 list

# Add a helper task
.\TaskFileExtensions.ps1 add

# Preview it
.\TaskFileExtensions.ps1 preview hello

# Run it by name
.\TaskFileExtensions.ps1 run hello

# Or run by index (e.g., task #1)
.\TaskFileExtensions.ps1 1
```

---

## 🛡️ Requirements
- Windows 10/11 with **PowerShell 5.1+** or **pwsh (PowerShell Core)**
- [Task CLI](https://taskfile.dev/#/installation)
- *(optional)* [`yq`](https://github.com/mikefarah/yq) for better YAML validation

---

## 🎯 Features

- **Index-based task execution**: Run tasks by their numbered position
- **Interactive task creation**: Safely add tasks without manual YAML editing
- **Task validation**: Built-in YAML syntax checking
- **Search capabilities**: Find tasks by keywords
- **Dry-run support**: Preview commands before execution
- **Editor integration**: Jump directly to task definitions

---
