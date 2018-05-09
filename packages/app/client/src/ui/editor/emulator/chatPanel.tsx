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

import { css } from 'glamor';
import * as React from 'react';

import Chat from './parts/chat';
import { Colors } from '@bfemulator/ui-react';
import { EmulatorMode } from './index';
import { getFirstBotEndpoint } from '@bfemulator/app-shared';

const CSS = css({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',

  '& > header': {
    backgroundColor: Colors.SECTION_HEADER_BACKGROUND_DARK,
    color: Colors.SECTION_HEADER_FOREGROUND_DARK,
    lineHeight: '30px',
    minHeight: '30px',
    paddingLeft: '16px',
    textTransform: 'lowercase',
    userSelect: 'text',
    whiteSpace: 'nowrap'
  }
});

interface IChatPanelProps {
  document: any;
  mode?: EmulatorMode;
  onStartConversation?: () => any;
}

export default class ChatPanel extends React.Component<IChatPanelProps, {}> {
  constructor(props: IChatPanelProps, context) {
    super(props, context);
  }

  render() {
    const { botUrl } = this.props.document.endpoint || { botUrl: '' };

    return (
      <div className="chat-panel" { ...CSS }>
        <header>{ botUrl }</header>
        <Chat mode={ this.props.mode } document={ this.props.document } onStartConversation={ this.props.onStartConversation } key={ this.props.document.pingId } />
      </div>
    );
  }
}
