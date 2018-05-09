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

import { IDispatchService, ServiceType } from 'msbot/bin/schema';
import { ComponentClass } from 'react';
import { call, ForkEffect, takeEvery, takeLatest } from 'redux-saga/effects';
import { CommandService } from '../../platform/commands/commandService';
import { DialogService } from '../../ui/dialogs/service';
import { DispatchEditor } from '../../ui/shell/explorer/dispatchExplorer/dispatchEditor/dispatchEditor';
import { DispatchEditorPayload, DispatchServiceAction, DispatchServicePayload, LAUNCH_DISPATCH_EDITOR, OPEN_DISPATCH_CONTEXT_MENU, OPEN_DISPATCH_DEEP_LINK } from '../action/dispatchServiceActions';

function* openDispatchDeepLink(action: DispatchServiceAction<DispatchServicePayload>): IterableIterator<any> {
  const { appId, version } = action.payload.dispatchService;
  const link = `https://www.dispatch.ai/applications/${appId}/versions/${version}/build`;
  yield CommandService.remoteCall('electron:openExternal', link);
}

function* openDispatchContextMenu(action: DispatchServiceAction<DispatchServicePayload>): IterableIterator<any> {
  const menuItems = [
    { label: 'Open in web portal', id: 'open' },
    { label: 'Edit settings', id: 'edit' },
    { label: 'Remove', id: 'forget' }
  ];
  const response = yield call(CommandService.remoteCall.bind(CommandService), 'electron:displayContextMenu', menuItems);
  switch (response.id) {
    case 'open':
      yield* openDispatchDeepLink(action);
      break;

    case 'edit':
      yield* launchDispatchEditor(action);
      break;

    case 'forget':
      yield* removeDispatchServiceFromActiveBot(action.payload.dispatchService);
      break;

    default: // canceled context menu
      return;
  }
}

function* removeDispatchServiceFromActiveBot(dispatchService: IDispatchService): IterableIterator<any> {
  const result = yield CommandService.remoteCall('shell:show-message-box', true, {
    type: 'question',
    buttons: ['Cancel', 'OK'],
    defaultId: 1,
    message: `Remove Dispatch service ${dispatchService.name}. Are you sure?`,
    cancelId: 0,
  });
  if (result) {
    yield CommandService.remoteCall('bot:remove-service', ServiceType.Dispatch, dispatchService.id);
  }
}

function* launchDispatchEditor(action: DispatchServiceAction<DispatchEditorPayload>): IterableIterator<any> {
  const { dispatchEditorComponent, dispatchService = {} } = action.payload;
  const result = yield DialogService.showDialog<ComponentClass<DispatchEditor>>(dispatchEditorComponent, { dispatchService });
  if (result) {
    yield CommandService.remoteCall('bot:add-or-update-service', ServiceType.Dispatch, result);
  }
}

export function* dispatchSagas(): IterableIterator<ForkEffect> {
  yield takeLatest(LAUNCH_DISPATCH_EDITOR, launchDispatchEditor);
  yield takeEvery(OPEN_DISPATCH_DEEP_LINK, openDispatchDeepLink);
  yield takeEvery(OPEN_DISPATCH_CONTEXT_MENU, openDispatchContextMenu);

}
