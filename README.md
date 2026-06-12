# Laravel IDE Helper Runner

A lightweight, zero-configuration-friendly VS Code extension that automatically runs the `barryvdh/laravel-ide-helper` generation commands whenever you save a PHP file. Keep your autocomplete and IDE signatures up-to-date in the background without manually running artisan commands!

## ✨ Features

- **Auto-run on Save**: Runs `ide-helper:generate`, `ide-helper:meta`, and `ide-helper:models --nowrite` in the background seamlessly.
- **Smart Laravel Detection**: Only runs if an `artisan` file is present in your workspace root.
- **Auto-Install Helper**: If it detects a Laravel project but `barryvdh/laravel-ide-helper` is not in `composer.json`, it prompts you to install it automatically.
- **Auto `.gitignore`**: Automatically adds the generated IDE helper files (`_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php`) to your `.gitignore` upon auto-install (can be disabled).
- **Environment Agnostic**: Works natively with your local PHP, or can be configured to run through Docker environments like `ddev` or Laravel `Sail`.

## ⚙️ Configuration Settings

You can customize the extension behavior by searching for **Laravel IDE Helper Runner** in your VS Code Settings:

| Setting | Default | Description |
|---|---|---|
| `laravelIdeHelperRunner.enable` | `true` | Quickly toggle the extension on or off. |
| `laravelIdeHelperRunner.phpCommand` | `php` | Command prefix to run PHP. E.g., `php`, `ddev exec php`, or `./vendor/bin/sail php`. |
| `laravelIdeHelperRunner.composerCommand` | `composer` | Command prefix to run Composer. E.g., `composer`, `ddev composer`, or `./vendor/bin/sail composer`. |
| `laravelIdeHelperRunner.commandArgs` | *see below* | The artisan arguments executed. Replaces `{php}` with your `phpCommand`. |
| `laravelIdeHelperRunner.showNotifications` | `false` | If true, shows a popup notification when generation completes. |
| `laravelIdeHelperRunner.addToGitignore` | `true` | Auto-adds generated files to `.gitignore` when the extension auto-installs the package. |

*Default `commandArgs`:*
```text
artisan ide-helper:generate && {php} artisan ide-helper:meta && {php} artisan ide-helper:models --nowrite
```

## 🚀 Usage
1. Open a Laravel project.
2. If `laravel-ide-helper` is missing, you'll be prompted to install it.
3. Start editing any `.php` file.
4. Save the file.
5. Watch the status bar for a `$(check) Laravel IDE Helper updated` message. Enjoy your fresh autocompletion!

## 📝 License
[MIT License](LICENSE.md)
