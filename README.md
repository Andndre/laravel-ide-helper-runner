# Laravel IDE Helper Runner

Automatically and intelligently runs [barryvdh/laravel-ide-helper](https://github.com/barryvdh/laravel-ide-helper) commands in your Laravel project. Keeps your autocompletion, PHPDocs, and IDE IntelliSense up-to-date in real time without manually running Artisan commands.

---

## Features

- **🎯 Smart Path Filtering:** Intelligently triggers only the relevant generator based on the file saved:
  - `app/Models/**` or `database/migrations/**` ➔ generates Models helper.
  - `config/**`, `app/Providers/**`, or `composer.json` ➔ generates Facades helper.
  - Middleware, Controllers, Views, Routes, and Tests are completely ignored (0% CPU overhead).
- **⚡ Instant Database Error Detection (Early Exit):** Detects unreachable database connections in ~1 second and aborts gracefully with a clear notification, preventing long hangs.
- **🛡️ Concurrency & Anti-Spam Protection:** Debounced save handling and execution locking ensure background `php` processes never pile up in Task Manager.
- **⌨️ Command Palette Integration:** Trigger full or targeted helper generation anytime from the Command Palette (`Ctrl + Shift + P`).
- **📦 Auto-Installation & Initial Run:** Detects if `barryvdh/laravel-ide-helper` is missing, prompts for 1-click installation via Composer, updates `.gitignore`, and immediately generates all helpers.
- **🚀 Parallel Execution:** Runs Facade and Model generators concurrently for maximum speed.
- **🐳 Environment Agnostic:** Seamlessly works with Native PHP, Laravel Sail, DDEV, Docker, or WSL.

---

## Command Palette Commands

Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS) and search for:

| Command | Identifier | Description |
|---|---|---|
| **Laravel IDE Helper: Generate All** | `laravelIdeHelperRunner.generateAll` | Force regenerates both Facades and Models helpers. |
| **Laravel IDE Helper: Generate Models PHPDoc** | `laravelIdeHelperRunner.generateModels` | Generates only `_ide_helper_models.php`. |
| **Laravel IDE Helper: Generate Facades PHPDoc** | `laravelIdeHelperRunner.generateFacades` | Generates only `_ide_helper.php`. |

---

## Configuration

Customize behavior in your VS Code / Antigravity `settings.json` or through the Settings UI. All settings are prefixed with `laravelIdeHelperRunner`.

| Setting | Default | Description |
|---|---|---|
| `laravelIdeHelperRunner.runOnSave` | `true` | Enable or disable automatic generation when saving files. |
| `laravelIdeHelperRunner.filterPaths` | `true` | When enabled, only saves in relevant directories (models, migrations, configs, providers) trigger generation. |
| `laravelIdeHelperRunner.facades` | `true` | Enable generating PHPDoc for facades (`artisan ide-helper:generate`). |
| `laravelIdeHelperRunner.models` | `true` | Enable generating PHPDoc for models (`artisan ide-helper:models --nowrite`). |
| `laravelIdeHelperRunner.parallelExecution` | `true` | Run generators in parallel for faster updates. |
| `laravelIdeHelperRunner.phpPath` | `"php"` | PHP command prefix (e.g. `"php"`, `"ddev exec php"`, `"./vendor/bin/sail php"`). |
| `laravelIdeHelperRunner.debounceDelay` | `1000` | Delay in milliseconds after saving before running commands. |
| `laravelIdeHelperRunner.timeout` | `15000` | Maximum execution time in milliseconds before automatically terminating hanging processes. |
| `laravelIdeHelperRunner.autoClearConsole` | `false` | Automatically clear the output console before each run. |
| `laravelIdeHelperRunner.composerCommand` | `"composer"` | Composer command prefix (e.g. `"composer"`, `"ddev composer"`). |
| `laravelIdeHelperRunner.addToGitignore` | `true` | Automatically add generated helper files to `.gitignore` upon auto-install. |
| `laravelIdeHelperRunner.showNotifications` | `false` | Show popup progress notifications when generating helpers. |

---

## Environment Setup (DDEV / Laravel Sail / Docker)

Set `laravelIdeHelperRunner.phpPath` and `laravelIdeHelperRunner.composerCommand` in your workspace `.vscode/settings.json`:

### Laravel Sail
```json
{
  "laravelIdeHelperRunner.phpPath": "./vendor/bin/sail php",
  "laravelIdeHelperRunner.composerCommand": "./vendor/bin/sail composer"
}
```

### DDEV
```json
{
  "laravelIdeHelperRunner.phpPath": "ddev exec php",
  "laravelIdeHelperRunner.composerCommand": "ddev composer"
}
```

---

## License

MIT License. Feel free to use and contribute!

