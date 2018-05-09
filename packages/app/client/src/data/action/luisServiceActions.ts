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

import { ILuisService } from 'msbot/bin/schema';
import { ComponentClass } from 'react';
import { Action } from 'redux';
import { LuisEditor } from '../../ui/shell/explorer/luisExplorer/luisEditor/luisEditor';

export const OPEN_LUIS_DEEP_LINK = 'OPEN_LUIS_DEEP_LINK';
export const OPEN_LUIS_CONTEXT_MENU = 'OPEN_LUIS_CONTEXT_MENU';
export const LAUNCH_LUIS_EDITOR = 'LAUNCH_LUIS_EDITOR';
export const RETRIEVE_LUIS_MODELS = 'RETRIEVE_LUIS_MODELS';

export interface LuisServiceAction<T> extends Action {
  payload: T;
}

export interface LuisServicePayload {
  luisService: ILuisService;
}

export interface LuisEditorPayload extends LuisServicePayload {
  luisEditorComponent?: ComponentClass<LuisEditor>,
}

export function launchLuisEditor(luisEditorComponent: ComponentClass<LuisEditor>, luisService?: ILuisService): LuisServiceAction<LuisEditorPayload> {
  return {
    type: LAUNCH_LUIS_EDITOR,
    payload: { luisEditorComponent, luisService }
  };
}

export function openLuisDeepLink(luisService: ILuisService): LuisServiceAction<LuisServicePayload> {
  return {
    type: OPEN_LUIS_DEEP_LINK,
    payload: { luisService }
  };
}

export function openLuisExplorerContextMenu(luisEditorComponent: ComponentClass<LuisEditor>, luisService?: ILuisService): LuisServiceAction<LuisEditorPayload> {
  return {
    type: OPEN_LUIS_CONTEXT_MENU,
    payload: { luisEditorComponent, luisService }
  };
}

export function retrieveLuisModels(): Action {
  return {
    type: RETRIEVE_LUIS_MODELS
  };
}
