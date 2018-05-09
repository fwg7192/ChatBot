//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

import { getBotDisplayName, IBotInfo, IFrameworkSettings, newBot, newEndpoint } from '@bfemulator/app-shared';
import { Conversation } from '@bfemulator/emulator-core';
import { CommandRegistry as CommReg, IActivity, IBotConfigWithPath, uniqueId } from '@bfemulator/sdk-shared';
import * as Electron from 'electron';
import { app, Menu } from 'electron';
import * as Fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import { IConnectedService, IEndpointService, ServiceType } from 'msbot/bin/schema';
import * as Path from 'path';

import { AppMenuBuilder } from './appMenuBuilder';
import { getActiveBot, getBotInfoByPath, loadBotWithRetry, patchBotsJson, pathExistsInRecentBots, saveBot, toSavableBot } from './botHelpers';
import { BotProjectFileWatcher } from './botProjectFileWatcher';
import { Protocol } from './constants';
import * as BotActions from './data-v2/action/bot';
import { emulator } from './emulator';
import { ExtensionManager } from './extensions';
import { mainWindow, windowManager } from './main';
import { ProtocolHandler } from './protocolHandler';
import { ContextMenuService } from './services/contextMenuService';
import { LuisAuthWorkflowService } from './services/luisAuthWorkflowService';
import { dispatch, getSettings } from './settings';
import { getBotsFromDisk, readFileSync, showOpenDialog, showSaveDialog, writeFile } from './utils';
import shell = Electron.shell;
import { AppUpdater } from './appUpdater';

const sanitize = require("sanitize-filename");

//=============================================================================
export const CommandRegistry = new CommReg();

//=============================================================================
export function registerCommands() {
  //
  // TODO: Move related commands out to own files.
  //

  //---------------------------------------------------------------------------
  CommandRegistry.registerCommand('ping', () => {
    return 'pong';
  });

  //---------------------------------------------------------------------------
  // Create a bot
  CommandRegistry.registerCommand('bot:create', async (bot: IBotConfigWithPath, secret: string): Promise<IBotConfigWithPath> => {
    // create and add bot entry to bots.json
    const botsJsonEntry: IBotInfo = {
      path: bot.path,
      displayName: getBotDisplayName(bot),
      secret
    };
    await patchBotsJson(bot.path, botsJsonEntry);

    // save the bot
    try {
      await saveBot(bot);
    } catch (e) {
      // TODO: make sure these are surfaced on the client side and caught so we can act on them
      console.error(`bot:create: Error trying to save bot: ${e}`);
      throw e;
    }

    return bot;
  });

  //---------------------------------------------------------------------------
  // Save bot file and cause a bots list write
  CommandRegistry.registerCommand('bot:save', async (bot: IBotConfigWithPath) => {
    try {
      await saveBot(bot);
    } catch (e) {
      console.error(`bot:save: Error trying to save bot: ${e}`);
      throw e;
    }
  });

  //---------------------------------------------------------------------------
  // Open a bot project from a .bot path
  CommandRegistry.registerCommand('bot:load', async (botFilePath: string, secret?: string): Promise<IBotConfigWithPath> => {
    // try to get the bot secret from bots.json
    const botInfo = pathExistsInRecentBots(botFilePath) ? getBotInfoByPath(botFilePath) : null;
    if (botInfo && botInfo.secret) {
      secret = secret || botInfo.secret;
    }

    // load the bot (decrypt with secret if we were able to get it)
    const bot = await loadBotWithRetry(botFilePath, secret);
    if (!bot)
    // user failed to enter a valid secret for an encrypted bot
      throw new Error('No secret provided to decrypt encrypted bot.');

    // set up file watcher
    BotProjectFileWatcher.watch(botFilePath);

    // set bot as active
    const botDirectory = Path.dirname(botFilePath);
    mainWindow.store.dispatch(BotActions.setActive(bot));
    mainWindow.store.dispatch(BotActions.setDirectory(botDirectory));

    return mainWindow.commandService.remoteCall('bot:load', bot);
  });

  //---------------------------------------------------------------------------
  // Set active bot (called from client-side)
  CommandRegistry.registerCommand('bot:set-active', async (botPath: string): Promise<{ bot: IBotConfigWithPath, botDirectory: string } | void> => {
    // try to get the bot secret from bots.json
    let secret;
    const botInfo = pathExistsInRecentBots(botPath) ? getBotInfoByPath(botPath) : null;
    if (botInfo && botInfo.secret) {
      secret = botInfo.secret;
    }

    // load the bot (decrypt with secret if we were able to get it)
    let bot:IBotConfigWithPath;
    try {
      bot = await loadBotWithRetry(botPath, secret);
    } catch (e) {
      var errMessage = `Failed to open the bot with error: ${e.message}`;
      await Electron.dialog.showMessageBox(mainWindow.browserWindow,  {
          type: 'error',
          message: errMessage,
        });
      throw new Error(errMessage);
    }
    if (!bot) {
      // user couldn't provide correct secret, abort
      throw new Error('No secret provided to decrypt encrypted bot.');
    }

    // set up the file watcher
    BotProjectFileWatcher.watch(botPath);

    // set active bot and active directory
    const botDirectory = Path.dirname(botPath);
    mainWindow.store.dispatch(BotActions.setActive(bot));
    mainWindow.store.dispatch(BotActions.setDirectory(botDirectory));
    mainWindow.commandService.call('bot:restart-endpoint-service');

    // Workaround for a JSON serialization issue in bot.services where they're an array
    // on the Node side, but deserialize as a dictionary on the renderer side.
    return { bot, botDirectory };
  });

  //---------------------------------------------------------------------------
  // Restart emulator endpoint service
  CommandRegistry.registerCommand('bot:restart-endpoint-service', async () => {
    const bot = getActiveBot();

    emulator.framework.server.botEmulator.facilities.endpoints.reset();

    bot.services.filter(s => s.type === ServiceType.Endpoint).forEach(service => {
      const endpoint = service as IEndpointService;

      emulator.framework.server.botEmulator.facilities.endpoints.push(
        endpoint.id,
        {
          botId: endpoint.id,
          botUrl: endpoint.endpoint,
          msaAppId: endpoint.appId,
          msaPassword: endpoint.appPassword
        }
      );
    });
  });

  //---------------------------------------------------------------------------
  // Close active bot (called from client-side)
  CommandRegistry.registerCommand('bot:close', async (): Promise<void> => {
    BotProjectFileWatcher.dispose();
    mainWindow.store.dispatch(BotActions.close());
  });

  //---------------------------------------------------------------------------
  // Adds or updates an msbot service entry.
  CommandRegistry.registerCommand('bot:add-or-update-service', async (serviceType: ServiceType, service: IConnectedService) => {
    if (!service.id || !service.id.length)
      service.id = uniqueId();
    const activeBot = getActiveBot();
    const botInfo = activeBot && getBotInfoByPath(activeBot.path);
    if (botInfo) {
      const botConfig = toSavableBot(activeBot, botInfo.secret);
      const index = botConfig.services.findIndex(s => s.id === service.id && s.type === service.type);
      let existing = index >= 0 && botConfig.services[index];
      if (existing) {
        // Patch existing service
        existing = { ...existing, ...service };
        botConfig.services[index] = existing;
      } else {
        // Add new service
        if (service.type != serviceType)
          throw new Error('serviceType does not match');
        botConfig.connectService(service);
      }
      try {
        await botConfig.save(botInfo.path);
      } catch (e) {
        console.error(`bot:add-or-update-service: Error trying to save bot: ${e}`);
        throw e;
      }
    }
  });

  //---------------------------------------------------------------------------
  // Removes an msbot service entry.
  CommandRegistry.registerCommand('bot:remove-service', async (serviceType: ServiceType, serviceId: string) => {
    const activeBot = getActiveBot();
    const botInfo = activeBot && getBotInfoByPath(activeBot.path);
    if (botInfo) {
      const botConfig = toSavableBot(activeBot, botInfo.secret);
      botConfig.disconnectService(serviceType, serviceId);
      try {
        botConfig.save(botInfo.path);
      } catch (e) {
        console.error(`bot:remove-service: Error trying to save bot: ${e}`);
        throw e;
      }
    }
  });

  //---------------------------------------------------------------------------
  // Patches a bot record in bots.json
  CommandRegistry.registerCommand('bot:list:patch', async (botPath: string, bot: IBotInfo): Promise<void> => {
    // patch bots.json and update the store
    await patchBotsJson(botPath, bot);
  });

  //---------------------------------------------------------------------------
  // Show OS-native messsage box
  CommandRegistry.registerCommand('shell:show-message-box', (modal: boolean, options: Electron.MessageBoxOptions) => {
    options = {
      message: "",
      title: app.getName(),
      ...options
    };

    if (modal)
      return Electron.dialog.showMessageBox(mainWindow.browserWindow, options);
    else
      return Electron.dialog.showMessageBox(options);
  });

  //---------------------------------------------------------------------------
  // Read file
  CommandRegistry.registerCommand('file:read', (path: string): any => {
    try {
      const contents = readFileSync(path);
      return contents;
    } catch (e) {
      console.error(`Failure reading file at ${path}: `, e);
      throw e;
    }
  });

  //---------------------------------------------------------------------------
  // Write file
  CommandRegistry.registerCommand('file:write', (path: string, contents: object | string) => {
    try {
      writeFile(path, contents);
    } catch (e) {
      console.error(`Failure writing to file at ${path}: `, e);
      throw e;
    }
  });

  //---------------------------------------------------------------------------
  // Sanitize a string for file name usage
  CommandRegistry.registerCommand('file:sanitize-string', (path: string): string => {
    return sanitize(path);
  });

  //---------------------------------------------------------------------------
  // Client notifying us it's initialized and has rendered
  CommandRegistry.registerCommand('client:loaded', () => {
    // Load bots from disk and sync list with client
    const bots = getBotsFromDisk();
    mainWindow.store.dispatch(BotActions.load(bots));
    mainWindow.commandService.remoteCall('bot:list:sync', bots);
    // Reset the app title bar
    mainWindow.commandService.call('electron:set-title-bar');
    // Un-fullscreen the screen
    mainWindow.commandService.call('electron:set-fullscreen', false);
    // Send app settings to client
    mainWindow.commandService.remoteCall('receive-global-settings', {
      url: emulator.framework.serverUrl,
      cwd: __dirname
    });
    // Load extensions
    ExtensionManager.unloadExtensions();
    ExtensionManager.loadExtensions();
    // Parse command line args for a protocol url
    const args = process.argv.length ? process.argv.slice(1) : [];
    if (args.some(arg => arg.includes(Protocol))) {
      const protocolArg = args.find(arg => arg.includes(Protocol));
      ProtocolHandler.parseProtocolUrlAndDispatch(protocolArg);
    }
    // Parse command line args to see if we are opening a .bot or .transcript file
    if (args.some(arg => /(\.transcript)|(\.bot)$/.test(arg))) {
      const fileToBeOpened = args.find(arg => /(\.transcript)|(\.bot)$/.test(arg));
      if (Path.extname(fileToBeOpened) === '.bot') {
        mainWindow.commandService.call('bot:load', fileToBeOpened);
      } else if (Path.extname(fileToBeOpened) === '.transcript') {
        const transcript = readFileSync(fileToBeOpened);
        const conversationActivities = JSON.parse(transcript);
        if (!Array.isArray(conversationActivities))
          throw new Error('Invalid transcript file contents; should be an array of conversation activities.');

        // open a transcript on the client side and pass in some extra info to differentiate it from a transcript on disk
        mainWindow.commandService.remoteCall('transcript:open', 'deepLinkedTranscript', { activities: conversationActivities, deepLink: true });
      }
    }
  });

  //---------------------------------------------------------------------------
  // Saves global app settings
  CommandRegistry.registerCommand('app:settings:save', (settings: IFrameworkSettings): any => {
    dispatch({
      type: 'Framework_Set',
      state: settings
    });
  });

  //---------------------------------------------------------------------------
  // Get and return app settings from store
  CommandRegistry.registerCommand('app:settings:load', (...args: any[]): IFrameworkSettings => {
    return getSettings().framework;
  });

  //---------------------------------------------------------------------------
  // Shows an open dialog and returns a path
  CommandRegistry.registerCommand('shell:showOpenDialog', (dialogOptions: Electron.OpenDialogOptions = {}): string => {
    return showOpenDialog(mainWindow.browserWindow, dialogOptions);
  });

  //---------------------------------------------------------------------------
  // Shows a save dialog and returns a path + filename
  CommandRegistry.registerCommand('shell:showSaveDialog', (dialogOptions: Electron.SaveDialogOptions = {}): string => {
    return showSaveDialog(mainWindow.browserWindow, dialogOptions);
  });

  //---------------------------------------------------------------------------
  // Saves the conversation to a transcript file, with user interaction to set filename.
  CommandRegistry.registerCommand('emulator:save-transcript-to-file', async (conversationId: string): Promise<void> => {
    const activeBot: IBotConfigWithPath = getActiveBot();
    if (!activeBot) {
      throw new Error('save-transcript-to-file: No active bot.');
    }

    const conversation = emulator.framework.server.botEmulator.facilities.conversations.conversationById(conversationId);
    if (!conversation) {
      throw new Error(`save-transcript-to-file: Conversation ${conversationId} not found.`);
    }

    const path = Path.resolve(mainWindow.store.getState().bot.currentBotDirectory) || '';

    const filename = showSaveDialog(mainWindow.browserWindow, {
      filters: [
        {
          name: "Transcript Files",
          extensions: ['transcript']
        }
      ],
      defaultPath: path,
      showsTagField: false,
      title: "Save conversation transcript",
      buttonLabel: "Save"
    });

    // If there is no current bot directory, we should set the directory
    // that the transcript is saved in as the bot directory, copy the botfile over,
    // change the bots.json entry, and watch the directory.
    if (!path && filename && filename.length) {
      const bot = getActiveBot();
      let botInfo = getBotInfoByPath(bot.path);
      const saveableBot = toSavableBot(bot, botInfo.secret);
      const botDirectory = Path.dirname(filename);
      const botPath = Path.join(botDirectory, `${bot.name}.bot`);
      botInfo = { ...botInfo, path: botPath };

      await saveableBot.save(botPath);
      await patchBotsJson(botPath, botInfo);
      await BotProjectFileWatcher.watch(botPath);
      mainWindow.store.dispatch(BotActions.setDirectory(botDirectory));
    }

    if (filename && filename.length) {
      mkdirpSync(Path.dirname(filename));
      const transcripts = await conversation.getTranscript();
      writeFile(filename, transcripts);
    }
  });

  //---------------------------------------------------------------------------
  // Feeds a transcript from disk to a conversation
  CommandRegistry.registerCommand('emulator:feed-transcript:disk', (conversationId: string, filePath: string) => {
    const activeBot: IBotConfigWithPath = getActiveBot();
    if (!activeBot) {
      throw new Error('feed-transcript:disk: No active bot.');
    }

    const conversation = emulator.framework.server.botEmulator.facilities.conversations.conversationById(conversationId);
    if (!conversation) {
      throw new Error(`feed-transcript:disk: Conversation ${conversationId} not found.`);
    }

    const path = Path.resolve(filePath);
    const stat = Fs.statSync(path);
    if (!stat || !stat.isFile()) {
      throw new Error(`feed-transcript:disk: File ${filePath} not found.`);
    }

    const activities = JSON.parse(readFileSync(path));

    conversation.feedActivities(activities);

    const {name, ext} = Path.parse(path);
    const fileName = `${name}${ext}`;

    return {fileName, filePath};
  });

  //---------------------------------------------------------------------------
  // Feeds a deep-linked transcript (array of parsed activities) to a conversation
  CommandRegistry.registerCommand('emulator:feed-transcript:deep-link', (conversationId: string, activities: IActivity[]): void => {
    const activeBot: IBotConfigWithPath = getActiveBot();
    if (!activeBot) {
      throw new Error('emulator:feed-transcript:deep-link: No active bot.');
    }

    const conversation = emulator.framework.server.botEmulator.facilities.conversations.conversationById(conversationId);
    if (!conversation) {
      throw new Error(`emulator:feed-transcript:deep-link: Conversation ${conversationId} not found.`);
    }

    conversation.feedActivities(activities);
  });

  //---------------------------------------------------------------------------
  // Builds a new app menu to reflect the updated recent bots list
  CommandRegistry.registerCommand('menu:update-recent-bots', (): void => {
    // get previous app menu template
    let menu = AppMenuBuilder.menuTemplate;

    // get a file menu template with recent bots added
    const state = mainWindow.store.getState();
    const recentBots = state.bot && state.bot.botFiles ? state.bot.botFiles : [];
    const newFileMenu = AppMenuBuilder.getFileMenu(recentBots);

    // update the app menu to use the new file menu and build the template into a menu
    menu = AppMenuBuilder.setFileMenu(newFileMenu, menu);
    // update stored menu state
    AppMenuBuilder.menuTemplate = menu;
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  });

  //---------------------------------------------------------------------------
  // Get a speech token
  CommandRegistry.registerCommand('speech-token:get', (endpointId: string, refresh: boolean) => {
    const endpoint = emulator.framework.server.botEmulator.facilities.endpoints.get(endpointId);

    return endpoint && endpoint.getSpeechToken(refresh);
  });

  //---------------------------------------------------------------------------
  // Creates a new conversation object for transcript
  CommandRegistry.registerCommand('transcript:new', (conversationId: string): Conversation => {
    // get the active bot or mock one
    let bot: IBotConfigWithPath = getActiveBot();

    if (!bot) {
      bot = newBot();
      bot.services.push(newEndpoint());
      mainWindow.store.dispatch(BotActions.mockAndSetActive(bot));
    }

    // TODO: Move away from the .users state on legacy emulator settings, and towards per-conversation users
    const conversation = emulator.framework.server.botEmulator.facilities.conversations.newConversation(
      emulator.framework.server.botEmulator,
      null,
      { id: uniqueId(), name: 'User' },
      conversationId
    );

    return conversation;
  });

  //---------------------------------------------------------------------------
  // Toggles app fullscreen mode
  CommandRegistry.registerCommand('electron:set-fullscreen', (fullscreen: boolean): void => {
    mainWindow.browserWindow.setFullScreen(fullscreen);
    if (fullscreen) {
      Menu.setApplicationMenu(null);
    } else {
      Menu.setApplicationMenu(Menu.buildFromTemplate(AppMenuBuilder.menuTemplate));
    }
  });

  //---------------------------------------------------------------------------
  // Sets the app's title bar
  CommandRegistry.registerCommand('electron:set-title-bar', (text: string) => {
    if (text && text.length)
      mainWindow.browserWindow.setTitle(`${app.getName()} - ${text}`);
    else
      mainWindow.browserWindow.setTitle(app.getName());
  });

  //---------------------------------------------------------------------------
  // Retrieve the LUIS authoring key
  CommandRegistry.registerCommand('luis:retrieve-authoring-key', async () => {
    const workflow = LuisAuthWorkflowService.enterAuthWorkflow();
    const { dispatch } = mainWindow.store;
    const type = 'LUIS_AUTH_STATUS_CHANGED';
    dispatch({ type, luisAuthWorkflowStatus: 'inProgress' });
    let result = undefined;
    while (true) {
      const next = workflow.next(result);
      if (next.done) {
        dispatch({ type, luisAuthWorkflowStatus: 'ended' });
        if (!result) {
          dispatch({ type, luisAuthWorkflowStatus: 'canceled' });
        }
        break;
      }
      result = await next.value;
    }
    return result;
  });

  //---------------------------------------------------------------------------
  // Displays the context menu for a given element
  CommandRegistry.registerCommand('electron:displayContextMenu', ContextMenuService.showMenuAndWaitForInput);

  //---------------------------------------------------------------------------
  // Opens an external link
  CommandRegistry.registerCommand('electron:openExternal', shell.openExternal.bind(shell));

  //---------------------------------------------------------------------------
  // Sends an OAuth TokenResponse
  CommandRegistry.registerCommand('oauth:send-token-response', async (connectionName: string, conversationId: string, token: string) => {
    const conversation = emulator.framework.server.botEmulator.facilities.conversations.conversationById(conversationId);
    if (!conversation) {
      throw new Error(`emulator:feed-transcript:deep-link: Conversation ${conversationId} not found.`);
    }
    conversation.sendTokenResponse(connectionName, conversationId, false);
  });

  //---------------------------------------------------------------------------
  // Opens an OAuth login window
  CommandRegistry.registerCommand('oauth:create-oauth-window', async (url: string, conversationId: string) => {
    const conversation = emulator.framework.server.botEmulator.facilities.conversations.conversationById(conversationId);
    windowManager.createOAuthWindow(url, conversation.codeVerifier);
  });
}
