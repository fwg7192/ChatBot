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

import { ipcMain, WebContents, Event } from 'electron';
import { IPC, IDisposable } from '@bfemulator/sdk-shared';

export class ElectronIPC extends IPC {
  get id(): number { return this._webContents.id; }

  constructor(private _webContents: WebContents) {
    super();
  }

  send(...args: any[]): void {
    this._webContents.send('ipc:message', ...args);
  }

  onMessage(event: Event, ...args: any[]): void {
    const channelName = args.shift();
    const channel = super.getChannel(channelName);
    if (channel) {
      channel.onMessage(...args);
    }
  }
}

export const ElectronIPCServer = new class {
  private _ipcs: { [id: number]: ElectronIPC } = {};

  constructor() {
    ipcMain.on('ipc:message', (event: Event, ...args) => {
      const ipc = this._ipcs[event.sender.id];
      if (ipc) {
        ipc.onMessage(event, ...args);
      }
    });
  }

  registerIPC(ipc: ElectronIPC): IDisposable {
    this._ipcs[ipc.id] = ipc;
    return {
      dispose: () => {
        delete this._ipcs[ipc.id];
      }
    }
  }
}
