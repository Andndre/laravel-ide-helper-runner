# Laravel IDE Helper Runner

Automatically runs [barryvdh/laravel-ide-helper](https://github.com/barryvdh/laravel-ide-helper) commands every time you save a PHP file. This keeps your autocompletion and PHPDoc updated in real-time without having to run Artisan commands manually.

## Features

- **Auto-run on save:** Automatically runs `ide-helper:generate` and `ide-helper:models` when you save a `.php` file.
- **Smart detection:** Only activates if it detects `artisan` in your workspace.
- **Auto-installation prompt:** If you open a Laravel project that doesn't have `barryvdh/laravel-ide-helper` installed, it will prompt you and install it automatically.
- **Gitignore updates:** Optionally adds the generated helper files to your `.gitignore` upon installation.
- **Cross-environment support:** Works perfectly with native PHP, Laravel Sail, or DDEV by configuring the command prefix.
- **Parallel Execution:** Optionally runs the commands in parallel for faster updates.

## Configuration

You can customize the extension via your `settings.json` or the VS Code Settings UI. All settings are prefixed with `laravelIdeHelperRunner`.

| Setting | Default | Description |
|---|---|---|
| `laravelIdeHelperRunner.runOnSave` | `true` | Enable or disable running the extension on file save. |
| `laravelIdeHelperRunner.facades` | `true` | Generate PHPDoc for facades (`artisan ide-helper:generate`) |
| `laravelIdeHelperRunner.models` | `true` | Generate PHPDoc for models (`artisan ide-helper:models --nowrite`) |
| `laravelIdeHelperRunner.parallelExecution` | `true` | Run the generators in parallel instead of sequentially. |
| `laravelIdeHelperRunner.phpPath` | `"php"` | Command prefix for PHP. e.g., `"ddev exec php"`, `"./vendor/bin/sail php"` |
| `laravelIdeHelperRunner.debounceDelay` | `1000` | Delay in ms before running commands after saving. Prevents spamming. |
| `laravelIdeHelperRunner.autoClearConsole` | `false` | Automatically clear the output console before running. |
| `laravelIdeHelperRunner.composerCommand` | `"composer"` | Command prefix for Composer. e.g., `"ddev composer"` |
| `laravelIdeHelperRunner.addToGitignore` | `true` | Add generated files to `.gitignore` when auto-installing the package. |
| `laravelIdeHelperRunner.showNotifications` | `false` | Show popup notifications when generation starts and succeeds. |

## Usage with DDEV or Sail
Change `laravelIdeHelperRunner.phpPath` and `laravelIdeHelperRunner.composerCommand` to match your environment.

**DDEV:**
- `laravelIdeHelperRunner.phpPath`: `"ddev exec php"`
- `laravelIdeHelperRunner.composerCommand`: `"ddev composer"`

**Laravel Sail:**
- `laravelIdeHelperRunner.phpPath`: `"./vendor/bin/sail php"`
- `laravelIdeHelperRunner.composerCommand`: `"./vendor/bin/sail composer"`

## License

MIT
