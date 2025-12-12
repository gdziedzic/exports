# Generate Repo Installer Manager Configuration

You are tasked with analyzing this repository and generating a `repo-installer.json` configuration file for Repo Installer Manager v2.0.

## Instructions

1. **Explore the repository** to identify all installable components:
   - Applications (web apps, CLI tools, services)
   - Configuration files (dotfiles, editor configs, shell profiles)
   - Scripts (setup scripts, automation tools)
   - Libraries/modules that need to be linked or installed

2. **For each component, determine:**
   - The appropriate item type (`symlink`, `copy`, `script`, or `app`)
   - Source path (relative to repo root)
   - Target path (use variables for cross-platform support)
   - Platform restrictions if any (`linux`, `darwin`, `windows`)
   - Dependencies on other items
   - Pre/post install hooks if needed

3. **Create logical groups** for batch installation (e.g., `@all`, `@dev`, `@configs`, `@minimal`)

4. **Define variables** for common paths with platform-specific values

## Item Type Selection Guide

| Use Case | Type | When to Use |
|----------|------|-------------|
| Tools that auto-update with repo | `symlink` | Link to tools directory, configs that stay in sync |
| Files that may be customized locally | `copy` | User configs, templates (use `backup: true`) |
| One-time setup routines | `script` | Initialization scripts, environment setup |
| Multi-step installations | `app` | npm/pip installs, builds, complex setups |

## Output Format

Generate a valid JSON file with this structure:

```json
{
  "version": "2",
  "description": "<Brief description of what this repo contains>",
  "vars": {
    "TOOLS_DIR": {
      "windows": "%USERPROFILE%/tools",
      "linux": "~/tools",
      "darwin": "~/tools"
    },
    "CONFIG_DIR": {
      "windows": "%USERPROFILE%",
      "linux": "~",
      "darwin": "~"
    }
  },
  "groups": {
    "all": ["<all-item-names>"],
    "minimal": ["<essential-items>"]
  },
  "items": {
    "<item-name>": {
      "type": "<symlink|copy|script|app>",
      "description": "<What this item does>",
      "source": "<path/relative/to/repo>",
      "target": "${VAR}/<target-path>"
    }
  }
}
```

## Item Examples

**Symlink (for tools):**
```json
"my-tool": {
  "type": "symlink",
  "description": "My development tool",
  "source": "tools/my-tool",
  "target": "${TOOLS_DIR}/my-tool"
}
```

**Copy with backup (for configs):**
```json
"gitconfig": {
  "type": "copy",
  "description": "Git configuration",
  "source": "dotfiles/.gitconfig",
  "target": "${CONFIG_DIR}/.gitconfig",
  "backup": true
}
```

**App with build steps:**
```json
"my-app": {
  "type": "app",
  "description": "Node.js application",
  "source": "apps/my-app",
  "install": {
    "steps": [
      { "run": "npm ci", "cwd": "apps/my-app" },
      { "run": "npm run build", "cwd": "apps/my-app" }
    ]
  }
}
```

**Platform-specific item:**
```json
"linux-tool": {
  "type": "symlink",
  "source": "scripts/linux-tool.sh",
  "target": "~/bin/linux-tool",
  "platforms": ["linux"]
}
```

**Item with dependencies:**
```json
"app-config": {
  "type": "copy",
  "depends_on": ["base-app"],
  "source": "config.json",
  "target": "~/.config/app/config.json"
}
```

## Requirements

1. Output ONLY the JSON configuration - no explanations or markdown
2. Use descriptive item names (kebab-case)
3. Include helpful descriptions for each item
4. Use variables for paths that differ across platforms
5. Group related items logically
6. Add `backup: true` for copy items that might have user customizations
7. Use `depends_on` when installation order matters
8. Add platform filters for OS-specific items
9. Include post_install hooks with helpful messages where appropriate

## Now analyze this repository and generate the configuration:
