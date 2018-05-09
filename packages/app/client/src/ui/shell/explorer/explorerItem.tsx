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
import { css } from 'glamor';
import { Colors } from '@bfemulator/ui-react';

const CSS = css({
  color: Colors.EXPLORER_FOREGROUND_DARK,
  cursor: 'pointer',
  display: 'block',
  whiteSpace: 'nowrap',
  lineHeight: '30px',
  height: '30px',
  paddingLeft: '16px',

  '&:hover': {
    backgroundColor: Colors.EXPLORER_ITEM_HOVER_BACKGROUND_DARK
  },

  '&.active-explorer-item': {
    backgroundColor: Colors.EXPLORER_ITEM_ACTIVE_BACKGROUND_DARK
  },

  '&:before': {
    content: '🗋',
    color: Colors.C5,
    fontSize: '16px',
    paddingRight: '6px',
  },

  '&:last-child': {
    paddingBottom: '4px',
  },
});

export interface Props {
  active: boolean;
  onClick?: any;
}

export default class ExplorerItem extends React.Component<Props> {
  constructor(props, context) {
    super(props, context);
  }

  render() {
    return (
      this.props.active ?
        <li className="active-explorer-item" { ...CSS } onClick={ this.props.onClick }>{ this.props.children }</li>
        :
        <li { ...CSS } onClick={ this.props.onClick }>{ this.props.children }</li>
    );
  }
}
