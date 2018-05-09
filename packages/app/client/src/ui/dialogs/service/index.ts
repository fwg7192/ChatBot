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

import * as React from 'react';
import { ComponentClass, StatelessComponent } from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import * as DialogActions from '../../../data/action/dialogActions';

import store from '../../../data/store';
import { IDialogService } from './IDialogService';

export const DialogService = new class implements IDialogService {
  private _hostElement: HTMLElement;
  private _dialogReturnValue: Promise<any>;
  private _resolve: (value?: any) => void;

  /** Returns a thenable that can return a value using hideDialog(value)
   *
   * Ex. DialogService.showDialog(PasswordPromptDialog).then(pw => // do something with password from dialog)
  */
  showDialog<T extends ComponentClass | StatelessComponent>(dialog: T, props: { [propName: string]: any} = {}): Promise<any> {
    if (!this._hostElement) {
      return new Promise((resolve, reject) => resolve(null));
    }
    const reactElement = React.createElement(Provider, { store }, React.createElement(dialog, props));
    ReactDOM.render(reactElement, this._hostElement);
    store.dispatch(DialogActions.setShowing(true));

    // set up the dialog to return a value from the dialog
    this._dialogReturnValue = new Promise((resolve, reject) => {
      this._resolve = resolve;
    });
    return this._dialogReturnValue;
  }

  hideDialog(dialogReturnValue?: any): void {
    if (!this._hostElement) {
      return;
    }

    ReactDOM.render(null, this._hostElement);
    store.dispatch(DialogActions.setShowing(false));

    this._resolve(dialogReturnValue);
  }

  setHost(hostElement: HTMLElement): void {
    this._hostElement = hostElement;
  }
};
