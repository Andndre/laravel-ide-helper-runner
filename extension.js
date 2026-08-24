const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let outputChannel;
let saveTimeout;
const activeProcesses = new Set();
let isGenerating = false;
let pendingTask = null;

// --- Process Management & Termination ---

function killProcessTree(proc) {
    if (!proc || proc.killed || !proc.pid) return;
    try {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${proc.pid} /T /F`, () => {});
        } else {
            proc.kill('SIGTERM');
        }
    } catch (_) {
        try { proc.kill(); } catch (_) {}
    }
}

function abortActiveExecutions(reason) {
    if (activeProcesses.size > 0) {
        if (reason && outputChannel) {
            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${reason}. Terminating ${activeProcesses.size} active process(es)...`);
        }
        for (const proc of activeProcesses) {
            killProcessTree(proc);
        }
        activeProcesses.clear();
    }
}

// --- Error & Path Matchers ---

function isDatabaseError(output) {
    if (!output) return false;
    const dbErrorPatterns = [
        /SQLSTATE\[/i,
        /No connection could be made/i,
        /Connection refused/i,
        /Connection timed out/i,
        /Host is down/i,
        /could not find driver/i,
        /Unknown database/i,
        /Access denied for user/i,
        /Login failed for user/i,
        /TCP Provider.*error/i
    ];
    return dbErrorPatterns.some(pattern => pattern.test(output));
}

function isModelFile(relPath) {
    const p = relPath.replace(/\\/g, '/').toLowerCase();
    return p.startsWith('app/models/') || 
           p.startsWith('database/migrations/') || 
           p.startsWith('database/schema/') ||
           /^app\/[^\/]+\.php$/.test(p);
}

function isFacadeFile(relPath) {
    const p = relPath.replace(/\\/g, '/').toLowerCase();
    return p.startsWith('config/') || 
           p.startsWith('app/providers/') || 
           p.endsWith('composer.json') ||
           p.endsWith('composer.lock');
}

function getWorkspaceCwd() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const cwd = folders[0].uri.fsPath;
    return fs.existsSync(path.join(cwd, 'artisan')) ? cwd : null;
}

// --- Extension Activation ---

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Laravel IDE Helper Runner');
    checkLaravelAndIdeHelper();

    // Command Palette actions
    const cmdAll = vscode.commands.registerCommand('laravelIdeHelperRunner.generateAll', () => {
        const cwd = getWorkspaceCwd();
        if (!cwd) return vscode.window.showWarningMessage('Laravel IDE Helper: No Laravel workspace detected (artisan not found).');
        const config = vscode.workspace.getConfiguration('laravelIdeHelperRunner');
        outputChannel.show(true);
        runIdeHelperGeneration(cwd, config, { forceFacades: true, forceModels: true });
    });

    const cmdModels = vscode.commands.registerCommand('laravelIdeHelperRunner.generateModels', () => {
        const cwd = getWorkspaceCwd();
        if (!cwd) return vscode.window.showWarningMessage('Laravel IDE Helper: No Laravel workspace detected (artisan not found).');
        const config = vscode.workspace.getConfiguration('laravelIdeHelperRunner');
        outputChannel.show(true);
        runIdeHelperGeneration(cwd, config, { forceFacades: false, forceModels: true });
    });

    const cmdFacades = vscode.commands.registerCommand('laravelIdeHelperRunner.generateFacades', () => {
        const cwd = getWorkspaceCwd();
        if (!cwd) return vscode.window.showWarningMessage('Laravel IDE Helper: No Laravel workspace detected (artisan not found).');
        const config = vscode.workspace.getConfiguration('laravelIdeHelperRunner');
        outputChannel.show(true);
        runIdeHelperGeneration(cwd, config, { forceFacades: true, forceModels: false });
    });

    context.subscriptions.push(cmdAll, cmdModels, cmdFacades);

    // Auto-run on save
    let onSaveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('laravelIdeHelperRunner');
        if (!config.get('runOnSave', true)) return;

        const cwd = getWorkspaceCwd();
        if (!cwd) return;

        const filterPaths = config.get('filterPaths', true);
        const relPath = path.relative(cwd, document.uri.fsPath);

        let runFacades = config.get('facades', true);
        let runModels = config.get('models', true);

        if (filterPaths) {
            const isModel = isModelFile(relPath);
            const isFacade = isFacadeFile(relPath);

            // Ignore unrelated files (controllers, middleware, views, tests, etc.)
            if (!isModel && !isFacade) return;

            runFacades = runFacades && isFacade;
            runModels = runModels && isModel;
        } else if (document.languageId !== 'php') {
            return;
        }

        if (!runFacades && !runModels) return;

        if (saveTimeout) clearTimeout(saveTimeout);
        const debounceDelay = config.get('debounceDelay', 1000);

        saveTimeout = setTimeout(() => {
            runIdeHelperGeneration(cwd, config, { forceFacades: runFacades, forceModels: runModels });
        }, debounceDelay);
    });

    context.subscriptions.push(onSaveDisposable, outputChannel);
}

// --- Installation & Setup Helpers ---

function checkLaravelAndIdeHelper() {
    const cwd = getWorkspaceCwd();
    if (!cwd) return;

    const composerPath = path.join(cwd, 'composer.json');
    if (!fs.existsSync(composerPath)) return;

    try {
        const composerData = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
        const requireDeps = composerData.require || {};
        const requireDevDeps = composerData['require-dev'] || {};
        const hasIdeHelper = requireDeps['barryvdh/laravel-ide-helper'] || requireDevDeps['barryvdh/laravel-ide-helper'];

        if (!hasIdeHelper) {
            vscode.window.showInformationMessage(
                "Laravel project detected, but 'barryvdh/laravel-ide-helper' is not installed. Would you like to install it now?",
                "Yes", "No"
            ).then(selection => {
                if (selection === "Yes") installIdeHelper(cwd);
            });
        }
    } catch (e) {
        console.error("Failed to parse composer.json", e);
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
            return vscode.window.showErrorMessage(`Failed to install IDE Helper. Check output channel.`);
        }
        
        if (stderr) outputChannel.appendLine(`[Stderr] ${stderr}`);
        if (stdout) outputChannel.appendLine(`[Stdout] ${stdout}`);

        vscode.window.showInformationMessage('Laravel IDE Helper installed successfully!');

        if (config.get('addToGitignore', true)) {
            addFilesToGitignore(cwd);
        }

        runIdeHelperGeneration(cwd, config, { forceFacades: true, forceModels: true });
    });
}

function addFilesToGitignore(cwd) {
    const gitignorePath = path.join(cwd, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return;

    try {
        let content = fs.readFileSync(gitignorePath, 'utf8');
        const entries = ['_ide_helper.php', '_ide_helper_models.php', '.phpstorm.meta.php'];
        let hasChanges = false;

        entries.forEach(entry => {
            if (!content.includes(entry)) {
                if (!hasChanges) content += '\n\n# Laravel IDE Helper';
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

// --- Generator Execution Engine ---

function runIdeHelperGeneration(cwd, config, options = {}) {
    const generateFacades = options.forceFacades !== undefined ? options.forceFacades : config.get('facades', true);
    const generateModels = options.forceModels !== undefined ? options.forceModels : config.get('models', true);
    
    if (!generateFacades && !generateModels) return;

    // Concurrency Lock: queue next run instead of piling processes
    if (isGenerating) {
        pendingTask = { cwd, config, options };
        return;
    }

    isGenerating = true;

    const phpPath = config.get('phpPath') || 'php';
    const showNotifs = config.get('showNotifications', false);
    const autoClearConsole = config.get('autoClearConsole', false);
    const parallelExecution = config.get('parallelExecution', true);
    const timeoutMs = config.get('timeout', 15000);

    if (autoClearConsole) outputChannel.clear();

    const commands = [];
    if (generateFacades) commands.push(`${phpPath} artisan ide-helper:generate`);
    if (generateModels) commands.push(`${phpPath} artisan ide-helper:models --nowrite`);
    
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Running (${parallelExecution ? 'parallel' : 'sequential'}): ${commands.join(' | ')}`);

    const executeCommands = (cancellationToken) => {
        return new Promise((resolve) => {
            let userCancelled = false;
            let isResolved = false;

            const safeResolve = () => {
                if (!isResolved) {
                    isResolved = true;
                    resolve();
                }
            };

            if (cancellationToken) {
                cancellationToken.onCancellationRequested(() => {
                    userCancelled = true;
                    abortActiveExecutions('Cancelled by user');
                    safeResolve();
                });
            }

            if (parallelExecution) {
                let completed = 0;
                let hasError = false;
                let dbErrorDetected = false;
                let timedOut = false;

                commands.forEach(cmd => {
                    let timer = null;
                    let cmdDbError = false;

                    const proc = exec(cmd, { cwd }, (error, stdout, stderr) => {
                        if (timer) clearTimeout(timer);
                        activeProcesses.delete(proc);
                        completed++;

                        const outText = (stdout || '') + (stderr || '');
                        if (cmdDbError || isDatabaseError(outText)) dbErrorDetected = true;

                        if (error && !cmdDbError && !userCancelled) {
                            outputChannel.appendLine(`[Error] ${cmd}: ${error.message}`);
                            hasError = true;
                        }
                        if (stderr) outputChannel.appendLine(`[Stderr] ${cmd}: ${stderr}`);
                        if (stdout) outputChannel.appendLine(`[Stdout] ${cmd}: ${stdout}`);

                        if (completed === commands.length) {
                            if (userCancelled) {
                                outputChannel.appendLine(`[Laravel IDE Helper] Run cancelled.`);
                            } else if (timedOut) {
                                vscode.window.showErrorMessage(`Laravel IDE Helper: Execution timed out (${timeoutMs / 1000}s). Check output channel.`);
                            } else if (dbErrorDetected) {
                                vscode.window.showWarningMessage('Laravel IDE Helper: Database connection error. Check if your database is running.');
                            } else if (hasError) {
                                vscode.window.showErrorMessage('Laravel IDE Helper failed. Check output channel for details.');
                            } else {
                                vscode.window.setStatusBarMessage('$(check) Laravel IDE Helper updated', 3000);
                            }
                            safeResolve();
                        }
                    });

                    // Real-time Stream Interception for Database Error (Early Exit)
                    const handleStreamData = (chunk) => {
                        const text = chunk ? chunk.toString() : '';
                        if (!cmdDbError && isDatabaseError(text)) {
                            cmdDbError = true;
                            dbErrorDetected = true;
                            outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [Early Exit] Database error detected on '${cmd}'. Terminating immediately.`);
                            killProcessTree(proc);
                        }
                    };

                    if (proc.stdout) proc.stdout.on('data', handleStreamData);
                    if (proc.stderr) proc.stderr.on('data', handleStreamData);

                    activeProcesses.add(proc);

                    timer = setTimeout(() => {
                        if (activeProcesses.has(proc)) {
                            timedOut = true;
                            outputChannel.appendLine(`[Timeout] ${cmd} exceeded ${timeoutMs}ms limit. Terminating.`);
                            killProcessTree(proc);
                        }
                    }, timeoutMs);
                });
            } else {
                const fullCommand = commands.join(' && ');
                let timer = null;
                let timedOut = false;
                let cmdDbError = false;
                let dbErrorDetected = false;

                const proc = exec(fullCommand, { cwd }, (error, stdout, stderr) => {
                    if (timer) clearTimeout(timer);
                    activeProcesses.delete(proc);

                    const outText = (stdout || '') + (stderr || '');
                    if (cmdDbError || isDatabaseError(outText)) dbErrorDetected = true;

                    if (stderr) outputChannel.appendLine(`[Stderr] ${stderr}`);
                    if (stdout) outputChannel.appendLine(`[Stdout] ${stdout}`);

                    if (userCancelled) {
                        outputChannel.appendLine(`[Laravel IDE Helper] Run cancelled.`);
                    } else if (timedOut) {
                        vscode.window.showErrorMessage(`Laravel IDE Helper: Execution timed out (${timeoutMs / 1000}s). Check output channel.`);
                    } else if (dbErrorDetected) {
                        vscode.window.showWarningMessage('Laravel IDE Helper: Database connection error. Check if your database is running.');
                    } else if (error && !cmdDbError) {
                        outputChannel.appendLine(`[Error] ${error.message}`);
                        vscode.window.showErrorMessage('Laravel IDE Helper failed. Check output channel for details.');
                    } else {
                        vscode.window.setStatusBarMessage('$(check) Laravel IDE Helper updated', 3000);
                    }
                    safeResolve();
                });

                const handleStreamData = (chunk) => {
                    const text = chunk ? chunk.toString() : '';
                    if (!cmdDbError && isDatabaseError(text)) {
                        cmdDbError = true;
                        dbErrorDetected = true;
                        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [Early Exit] Database error detected. Terminating immediately.`);
                        killProcessTree(proc);
                    }
                };

                if (proc.stdout) proc.stdout.on('data', handleStreamData);
                if (proc.stderr) proc.stderr.on('data', handleStreamData);

                activeProcesses.add(proc);

                timer = setTimeout(() => {
                    if (activeProcesses.has(proc)) {
                        timedOut = true;
                        outputChannel.appendLine(`[Timeout] Command exceeded ${timeoutMs}ms limit. Terminating.`);
                        killProcessTree(proc);
                    }
                }, timeoutMs);
            }
        });
    };

    const onFinished = () => {
        isGenerating = false;
        if (pendingTask) {
            const next = pendingTask;
            pendingTask = null;
            runIdeHelperGeneration(next.cwd, next.config, next.options);
        }
    };

    if (showNotifs) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Laravel IDE Helper Runner: Generating helpers...",
            cancellable: true
        }, (progress, token) => {
            return executeCommands(token);
        }).then(onFinished, onFinished);
    } else {
        executeCommands(null).then(onFinished, onFinished);
    }
}

function deactivate() {
    isGenerating = false;
    pendingTask = null;
    abortActiveExecutions('Extension deactivated');
}

module.exports = {
    activate,
    deactivate
}
