import * as vscode from "vscode";

const CHAT_OPEN_COMMANDS = [
  "workbench.action.chat.open",
  "workbench.action.quickchat.toggle",
  "aichat.newchataction",
];

async function openChatIfPossible(): Promise<boolean> {
  for (const id of CHAT_OPEN_COMMANDS) {
    try {
      await vscode.commands.executeCommand(id);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export function activate(context: vscode.ExtensionContext): void {
  const run = vscode.commands.registerCommand("crowdflare.crowdsource", async () => {
    const cfg = vscode.workspace.getConfiguration("crowdflare");
    const prompt = cfg.get<string>("crowdsourcePrompt") ?? "";

    const opened = await openChatIfPossible();
    if (!opened) {
      vscode.window.showWarningMessage(
        "Crowdflare: could not open Chat from this build — use Command Palette → Crowdflare: Crowdsource still runs your prompt."
      );
    }

    if (prompt.length > 0) {
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(
        "Crowdflare: Crowdsource prompt copied to clipboard — paste into Chat (⌘V)."
      );
    } else {
      vscode.window.showInformationMessage(
        "Crowdflare: Crowdsource — set crowdflare.crowdsourcePrompt in Settings to auto-copy a prompt."
      );
    }
  });

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.name = "Crowdflare Crowdsource";
  status.text = "$(broadcast) Crowdsource";
  status.tooltip = "Crowdflare: Crowdsource (opens Chat, copies prompt if configured)";
  status.command = "crowdflare.crowdsource";
  status.show();

  context.subscriptions.push(run, status);
}

export function deactivate(): void {}
