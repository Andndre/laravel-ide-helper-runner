const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let outputChannel;
let saveTimeout;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Laravel IDE Helper Runner');
    
    // We can run the check when the extension activates (if they open a PHP file)
    checkLaravelAndIdeHelper();

    let disposable = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'php') {
            const config = vscode.workspace.getConfiguration('laravelIdeHelperRunner');
            
            if (!config.get('runOnSave')) {
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            const cwd = workspaceFolders[0].uri.fsPath;

            // Ensure it's a Laravel project before running commands on save
            if (!fs.existsSync(path.join(cwd, 'artisan'))) {
                return;
            }

            const debounceDelay = config.get('debounceDelay') || 1000;

            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }

            saveTimeout = setTimeout(() => {
                runIdeHelperGeneration(cwd, config);
            }, debounceDelay);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(outputChannel);
}

function checkLaravelAndIdeHelper() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const cwd = workspaceFolders[0].uri.fsPath;
    const artisanPath = path.join(cwd, 'artisan');
    const composerPath = path.join(cwd, 'composer.json');

    // Detect if this is a Laravel project
    if (fs.existsSync(artisanPath) && fs.existsSync(composerPath)) {
        try {
            const composerJson = fs.readFileSync(composerPath, 'utf8');
            const composerData = JSON.parse(composerJson);
            
            const requireDeps = composerData.require || {};
            const requireDevDeps = composerData['require-dev'] || {};

            const hasIdeHelper = requireDeps['barryvdh/laravel-ide-helper'] || requireDevDeps['barryvdh/laravel-ide-helper'];

            if (!hasIdeHelper) {
                vscode.window.showInformationMessage(
                    "Laravel project detected, but 'barryvdh/laravel-ide-helper' is not installed. Would you like to install it now?",
                    "Yes", "No"
                ).then(selection => {
                    if (selection === "Yes") {
                        installIdeHelper(cwd);
                    }
                });
            }
        } catch (e) {
            console.error("Failed to parse composer.json", e);
        }
    }
}

function installIdeHelper(cwd) {
    const config = vscode.workspace.getConfiguration('laravelIdeHelperRunner');
    const composerCommand = config.get('composerCommand') || 'composer';
    const installCmd = `${composerCommand} require --dev barryvdh/laravel-ide-helper`;

    outputChannel.show(true);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Installing package: ${installCmd}`);
    vscode.window.showInformationMessage('Installing Laravel IDE Helper in the background. Please wait...');

    exec(installCmd, { cwd }, (error, stdout, stderr) => {
        if (error) {
            outputChannel.appendLine(`[Error] ${error.message}`);
            vscode.window.showErrorMessage(`Failed to install IDE Helper. Check output channel.`);
            return;
        }
        
        if (stderr) outputChannel.appendLine(`[Stderr] ${stderr}`);
        if (stdout) outputChannel.appendLine(`[Stdout] ${stdout}`);

        vscode.window.showInformationMessage('Laravel IDE Helper installed successfully!');

        if (config.get('addToGitignore')) {
            addFilesToGitignore(cwd);
        }

        runIdeHelperGeneration(cwd, config);
    });
}

function addFilesToGitignore(cwd) {
    const gitignorePath = path.join(cwd, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return;

    try {
        let content = fs.readFileSync(gitignorePath, 'utf8');
        const entries = ['\n# Laravel IDE Helper', '_ide_helper.php', '_ide_helper_models.php', '.phpstorm.meta.php'];
        
        let hasChanges = false;
        entries.forEach(entry => {
            if (entry.startsWith('#')) return;
            if (!content.includes(entry)) {
                if (!hasChanges) {
                    content += '\n' + entries[0];
                }
                content += '\n' + entry;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            fs.writeFileSync(gitignorePath, content, 'utf8');
            vscode.window.showInformationMessage('Added IDE Helper files to .gitignore.');
        }
    } catch (e) {
        console.error("Failed to update .gitignore", e);
    }
}

function runIdeHelperGeneration(cwd, config) {
    const generateFacades = config.get('facades');
    const generateModels = config.get('models');
    
    if (!generateFacades && !generateModels) {
        return; // Nothing to run
    }

    const phpPath = config.get('phpPath') || 'php';
    const showNotifs = config.get('showNotifications');
    const autoClearConsole = config.get('autoClearConsole');
    const parallelExecution = config.get('parallelExecution');

    if (autoClearConsole) {
        outputChannel.clear();
    }

    let commands = [];
    if (generateFacades) commands.push(`${phpPath} artisan ide-helper:generate`);
    if (generateModels) commands.push(`${phpPath} artisan ide-helper:models --nowrite`);
    
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Running (${parallelExecution ? 'parallel' : 'sequential'}): ${commands.join(' | ')}`);

    const executeCommands = () => {
        return new Promise((resolve) => {
            if (parallelExecution) {
                let completed = 0;
                let hasError = false;
                commands.forEach(cmd => {
                    exec(cmd, { cwd }, (error, stdout, stderr) => {
                        completed++;
                        if (error) {
                            outputChannel.appendLine(`[Error] ${cmd}: ${error.message}`);
                            hasError = true;
                        }
                        if (stderr) outputChannel.appendLine(`[Stderr] ${cmd}: ${stderr}`);
                        if (stdout) outputChannel.appendLine(`[Stdout] ${cmd}: ${stdout}`);
                        
                        if (completed === commands.length) {
                            if (hasError) {
                                vscode.window.showErrorMessage('Laravel IDE Helper failed. Check output channel for details.');
                            } else {
                                vscode.window.setStatusBarMessage('$(check) Laravel IDE Helper updated', 3000);
                                if (showNotifs) {
                                    vscode.window.showInformationMessage('Laravel IDE Helper Runner: Successfully generated helpers!');
                                }
                            }
                            resolve();
                        }
                    });
                });
            } else {
                const fullCommand = commands.join(' && ');
                exec(fullCommand, { cwd }, (error, stdout, stderr) => {
                    if (error) {
                        outputChannel.appendLine(`[Error] ${error.message}`);
                        vscode.window.showErrorMessage('Laravel IDE Helper failed. Check output channel for details.');
                        resolve();
                        return;
                    }
                    
                    if (stderr) outputChannel.appendLine(`[Stderr] ${stderr}`);
                    if (stdout) outputChannel.appendLine(`[Stdout] ${stdout}`);

                    vscode.window.setStatusBarMessage('$(check) Laravel IDE Helper updated', 3000);
                    if (showNotifs) {
                        vscode.window.showInformationMessage('Laravel IDE Helper Runner: Successfully generated helpers!');
                    }
                    resolve();
                });
            }
        });
    };

    if (showNotifs) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Laravel IDE Helper Runner: Generating helpers...",
            cancellable: false
        }, () => {
            return executeCommands();
        });
    } else {
        executeCommands();
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
