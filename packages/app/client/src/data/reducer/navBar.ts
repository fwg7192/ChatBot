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

import * as constants from '../../constants';
import * as NavBarActions from '../action/navBarActions';

type NavBarAction = {
  type: 'NAVBAR/SELECT',
  payload: {
    selection: string
  }
} | {
  type: 'NAVBAR/SELECT_OR_TOGGLE',
  payload: {
    selection: string
  }
};

export interface INavBarState {
  selection: string;
  expanded: boolean;
}

const DEFAULT_STATE: INavBarState = {
  selection: constants.NavBar_Bot_Explorer,
  expanded: false
};

export default function navBar(state: INavBarState = DEFAULT_STATE, action: NavBarAction): INavBarState {
  switch (action.type) {
    case NavBarActions.SELECT_OR_TOGGLE: {
      if (state.selection === action.payload.selection) {
        state = { ...state, expanded: !state.expanded };
      } else {
        state = { ...state, expanded: true, selection: action.payload.selection };
      }
      break;
    }

    case NavBarActions.SELECT: {
      state = { ...state, expanded: true, selection: action.payload.selection };
      break;
    }

    default: break;
  }

  return state;
}
