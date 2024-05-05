// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as si from './smart_indent';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext) {
  console.log('sv-improved is now activated');

  let serverModule = context.asAbsolutePath(path.join('out', 'server.js'));
  // Debug options for the server
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  let serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  let wsroot = vscode.workspace.rootPath;
  let urilist = [];
  let filelist = [];

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'sv' }],
    synchronize: {
      configurationSection: 'svlog',
      fileEvents: vscode.workspace.createFileSystemWatcher(
        '**/*.{v,sv,vh,svh,sva}',
      ),
    },
    initializationOptions: {
      wsroot,
      urilist,
      filelist,
    },
  };
  let com = vscode.commands;
  let reg = com.registerCommand;
  let sub = context.subscriptions;

  sub.push(reg('sv.smartIndent', si.smartIndent));
  sub.push(reg('sv.alignComment', si.alignLineComment));
  sub.push(reg('sv.alignOpenParen', si.alignOpenParen));
  sub.push(reg('sv.alignEqual', si.alignEqual));
  sub.push(reg('sv.alignRegExpWithInput', si.alignRegExpWithInput));
  sub.push(reg('sv.deleteTrailingWhiteSpaces', si.deleteTrailingWhiteSpaces));
  sub.push(reg('sv.convPortDeclToConn', si.convPortDeclToConn));
  sub.push(reg('sv.convPortDeclToConnImplicit', si.convPortDeclToConnImplicit));
  sub.push(reg('sv.convPortDeclToSignal', si.convPortDeclToSignal));
  sub.push(reg('sv.convPortDeclToNextSignal', si.convPortDeclToNextSignal));
  sub.push(reg('sv.convSignalDeclToReset', si.convSignalDeclToReset));
  sub.push(reg('sv.convSignalDeclToBReset', si.convSignalDeclToBReset));
  sub.push(reg('sv.convResetToUpdate', si.convResetToUpdate));
  sub.push(reg('sv.convResetToNext', si.convResetToNext));
  sub.push(reg('sv.incSelectedNumbers', si.incSelectedNumbers));
  sub.push(reg('sv.insSeqNumber', si.insSeqNumber));
  sub.push(reg('sv.swapPortDirection', si.swapPortDirection));
  sub.push(reg('sv.labelComment', si.labelComment));

  // Create the language client and start the client.
  let client = new LanguageClient(
    'svlog',
    'SystemVerilog-improved',
    serverOptions,
    clientOptions,
  );

  client.start();
}

// This method is called when your extension is deactivated
export function deactivate() {}
