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

import { FileInfo } from '@bfemulator/app-shared';
import { callbackToPromise } from '@fuselab/ui-shared/lib/asyncUtils';
import { FSWatcher, Stats, exists, readFile } from 'fs';
import * as Path from 'path';
import * as Chokidar from 'chokidar';
import { mainWindow } from './main';
import { loadBotWithRetry, getActiveBot, getBotInfoByPath } from './botHelpers';
import * as BotActions from './data-v2/action/bot';

interface IFileWatcher {
  watch: (botProjectDir: string) => void;
  dispose: () => void;
  onFileAdd: (file: string, fstats?: any) => void;
  onFileRemove: (file: string, fstats?: any) => void;
  onFileChange: (file: string, fstats?: any) => void;
}

async function findGitIgnore(directory: string): Promise<string> {
  const gitIgnore = '.gitignore';
  let curDir = directory;

  const filePath = Path.resolve(curDir, '.gitignore');
  const found = await callbackToPromise<boolean>(exists, filePath);
  if (found) {
    return filePath;
  }

  return null;
}

async function readGitIgnore(filePath: string): Promise<string[]> {
  if (!filePath) {
    return [];
  }

  const text = await callbackToPromise<string>(readFile, filePath, 'utf-8');

  return text.split(/[\n\r]/).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
}

/** Singleton class that will watch one bot project directory at a time */
export const BotProjectFileWatcher = new class FileWatcher implements IFileWatcher {
  private _botFilePath: string;
  private _fileWatcherInstance: FSWatcher;

  constructor() { }

  async watch(botFilePath: string): Promise<boolean> {
    // stop watching any other project directory
    this.dispose();

    if (botFilePath && botFilePath.length) {
      this._botFilePath = botFilePath;
      const botProjectDir = Path.dirname(botFilePath);

      const gitIgnoreFile = await findGitIgnore(botProjectDir);
      const ignoreGlobs = await readGitIgnore(gitIgnoreFile);

      this._fileWatcherInstance = Chokidar.watch(botProjectDir, {
        ignored: ignoreGlobs,
        followSymlinks: false
      });

      this._fileWatcherInstance
        .on('addDir', this.onFileAdd)
        .on('unlinkDir', this.onFileRemove)
        .on('add', this.onFileAdd)
        .on('unlink', this.onFileRemove)
        .on('change', this.onFileChange);
    }

    return true;
  }

  dispose(): void {
    if (this._fileWatcherInstance) {
      this._fileWatcherInstance.close();
      this._fileWatcherInstance = null;
      this._botFilePath = null;
    }
  }

  // TODO: Enable watching more extensions
  onFileAdd = (file: string, fstats?: Stats): void => {
    const fileInfo: FileInfo = {
      path: file,
      type: fstats.isDirectory() ? 'container' : 'leaf',
      name: Path.basename(file)
    };

    // only show .transcript files
    if (fileInfo.type === 'leaf' && Path.extname(file) !== '.transcript') {
      return;
    }

    mainWindow.commandService.remoteCall('file:add', fileInfo);
  }

  // TODO: Enable watching more extensions
  onFileRemove = (file: string, fstats?: Stats): void => {
    mainWindow.commandService.remoteCall('file:remove', file);
  }

  onFileChange = async (file: string, fstats?: Stats): Promise<void> => {
    if (file === this._botFilePath) {
      // the bot file changed, we should load it and push it to the store
      const activeBot = getActiveBot();
      if (activeBot) {
        const botInfo = getBotInfoByPath(this._botFilePath) || {};
        const bot = await loadBotWithRetry(this._botFilePath, botInfo.secret);
        if (!bot)
          // user dismissed the secret prompt dialog (if it was shown)
          throw new Error('No secret provided to decrypt encrypted bot.');

        // update store
        const botDir = Path.dirname(this._botFilePath);
        mainWindow.store.dispatch(BotActions.setActive(bot));
        mainWindow.commandService.remoteCall('bot:set-active', bot, botDir);
        mainWindow.commandService.call('bot:restart-endpoint-service');
      }
    }
  }
}
