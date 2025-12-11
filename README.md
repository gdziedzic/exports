# Exports

A collection of developer tools, configurations, and productivity applications.

## Contents

| Component | Description | Platform |
|-----------|-------------|----------|
| **DevChef** | Developer productivity platform with 36+ built-in tools | All |
| **DAO** | Database Analysis & Ontology tool for SQL Server schema mapping | All |
| **TaskFile Extensions** | PowerShell wrapper for Taskfile CLI | Windows |
| **Dotfiles** | Git, PowerShell, and editor configurations | Windows |
| **SQL Speed Pack** | AutoHotkey script for SQL automation | Windows |

## Quick Start

```bash
# Clone the repository
git clone <repo-url> exports
cd exports

# List available items
python repo-installer.py list

# Install everything
python repo-installer.py install

# Or install specific groups
python repo-installer.py install @apps      # DevChef + DAO
python repo-installer.py install @configs   # Git + PowerShell configs
python repo-installer.py install @dev       # Development tools
python repo-installer.py install @minimal   # DevChef + Git config only
```

## Installation

### Prerequisites

- Python 3.7+ (for the installer)
- Additional requirements per component:
  - **DAO**: Python 3.9+, ODBC driver for SQL Server
  - **TaskFile Extensions**: PowerShell 5.1+, Task CLI
  - **SQL Speed Pack**: AutoHotkey v2.0

### Using Repo Installer Manager

```bash
# Check what's available
python repo-installer.py list

# Preview installation (dry run)
python repo-installer.py install --dry-run

# Install all components
python repo-installer.py install

# Install specific items
python repo-installer.py install devchef dao gitconfig

# Check installation status
python repo-installer.py status

# Update installed items
python repo-installer.py update

# Uninstall
python repo-installer.py uninstall devchef
python repo-installer.py uninstall --all
```

### Installation Groups

| Group | Components |
|-------|------------|
| `@all` | All available components |
| `@apps` | DevChef, DAO |
| `@configs` | Git config, PowerShell profile |
| `@dev` | DevChef, DAO, TaskFile Extensions |
| `@windows` | All Windows-compatible components |
| `@minimal` | DevChef, Git config |

## Components

### DevChef (v2.6.0)

An offline-first developer productivity platform with 36+ built-in tools.

**Features:**
- Smart clipboard detection (JSON, JWT, Base64, SQL, UUIDs)
- Tool chaining pipelines with visual builder
- Code snippet library with tagging/search
- Multi-panel workspaces

**Tools include:** JSON Formatter, Base64 Encoder, UUID Generator, SQL Formatter, Regex Tester, JWT Decoder, Color Picker, and 30+ more.

**Usage:**
```bash
# Install
python repo-installer.py install devchef

# Serve locally
python -m http.server 8000 -d ~/tools/DevChef

# Open in browser
open http://localhost:8000
```

See [experiments/DevChef/README.md](experiments/DevChef/README.md) for full documentation.

### DAO - Database Analysis & Ontology

A Python CLI tool for SQL Server schema extraction and relationship mapping.

**Features:**
- SQL Server metadata extraction
- Knowledge graph for table relationships
- Automatic JOIN path finding
- REST API server

**Usage:**
```bash
# Install
python repo-installer.py install dao

# CLI commands
cd experiments/dao
python -m dao scan           # Extract schema
python -m dao tables         # List tables
python -m dao path A B       # Find join path
python -m dao join A B C     # Generate JOIN SQL

# HTTP API
python -m dao serve --port 5000
```

See [experiments/dao/README.md](experiments/dao/README.md) for full documentation.

### TaskFile Extensions (Windows)

PowerShell wrapper for the Taskfile CLI with enhanced UX.

**Commands:** `list`, `search`, `preview`, `add`, `run`, `dryrun`, `validate`, `edit`, `init`

**Usage:**
```powershell
# Install
python repo-installer.py install taskfile-extensions

# Import module
Import-Module TaskFileExtensions

# Use commands
task list
task search build
task run mytask
```

### Configuration Files

**Git Config:**
```bash
python repo-installer.py install gitconfig
```

**PowerShell Profile:**
```bash
python repo-installer.py install powershell-profile powershell-config
```

## Directory Structure

```
exports/
├── repo-installer.json     # Installation manifest
├── experiments/
│   ├── DevChef/           # Developer productivity platform
│   └── dao/               # Database analysis tool
├── dotnotfiles/
│   ├── Git/               # Git configuration
│   └── powershell/        # PowerShell profiles
├── xg/
│   └── dev/
│       └── task_file_extensions/
├── _manual/
│   ├── SQL Speed Pack.ahk # AutoHotkey scripts
│   └── shortcuts.json     # PowerShell shortcuts
└── Taskfile.yml           # Task automation
```

## Default Installation Paths

| Variable | Windows | Linux/macOS |
|----------|---------|-------------|
| `TOOLS_DIR` | `%USERPROFILE%/tools` | `~/tools` |
| `CONFIG_DIR` | `%USERPROFILE%` | `~` |
| `POWERSHELL_DIR` | `Documents/WindowsPowerShell` | `~/.config/powershell` |

## Troubleshooting

**Symlink fails on Windows:**
- Run terminal as Administrator, or
- Enable Developer Mode in Windows Settings

**DAO installation fails:**
- Ensure Python 3.9+ is installed
- Install ODBC driver for SQL Server

**PowerShell profile not loading:**
- Check execution policy: `Get-ExecutionPolicy`
- Set if needed: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

## License

See individual component directories for licensing information.
