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

import { IBotInfo, newEndpoint } from '@bfemulator/app-shared';
import { BotConfigWithPath, IBotConfigWithPath } from '@bfemulator/sdk-shared';
import { Column, MediumHeader, PrimaryButton, Row, TextInputField } from '@bfemulator/ui-react';
import { css } from 'glamor';
import { debounce } from 'lodash';
import { IEndpointService, ServiceType } from 'msbot/bin/schema';
import * as React from 'react';
import { connect } from 'react-redux';
import * as EditorActions from '../../../data/action/editorActions';
import { getBotInfoByPath } from '../../../data/botHelpers';
import store, { IRootState } from '../../../data/store';

import { CommandService } from '../../../platform/commands/commandService';
import { GenericDocument } from '../../layout';

const CSS = css({
  '& .bot-settings-header': {
    marginBottom: '16px'
  },

  '& .browse-path-button': {
    marginLeft: '8px',
    alignSelf: 'center'
  },

  '& .save-button': {
    marginLeft: 'auto'
  },

  '& .save-connect-button': {
    marginLeft: '8px'
  },

  '& .multiple-input-row': {
    '& > div': {
      marginLeft: '8px'
    },

    '& > div:first-child': {
      marginLeft: 0
    }
  },

  '& .button-row': {
    marginTop: '48px'
  },

  '& .locale-input': {
    flexShrink: 2,
    minWidth: '100px'
  }
});

interface BotSettingsEditorProps {
  bot?: IBotConfigWithPath;
  dirty?: boolean;
  documentId?: string;
}

interface BotSettingsEditorState {
  bot?: IBotConfigWithPath;
  endpoint?: IEndpointService;
  secret?: string;
}

// TODO: We need to deprecate this function as we move to multiple endpoints
function getFirstBotEndpointOrDefault(bot) {
  return (Array.isArray(bot.services) && bot.services.find(service => service.type === ServiceType.Endpoint) as IEndpointService) || newEndpoint();
}

class BotSettingsEditor extends React.Component<BotSettingsEditorProps, BotSettingsEditorState> {
  constructor(props: BotSettingsEditorProps, context) {
    super(props, context);

    const { bot } = props;
    const botInfo = getBotInfoByPath(bot.path);
    const endpoint = getFirstBotEndpointOrDefault(bot);

    this.state = {
      bot,
      endpoint,
      secret: (botInfo && botInfo.secret) || ''
    };
  }

  componentWillReceiveProps(newProps: BotSettingsEditorProps) {
    const { path: newBotPath } = newProps.bot;
    // handling a new bot
    if (newBotPath !== this.state.bot.path) {
      const newBotInfo: IBotInfo = getBotInfoByPath(newBotPath);

      this.setState({ endpoint: getFirstBotEndpointOrDefault(newProps.bot), secret: newBotInfo.secret });
      this.setDirtyFlag(false);
    }
  }

  private onChangeName = (e) => {
    const bot: IBotConfigWithPath = BotConfigWithPath.fromJSON({ ...this.state.bot, name: e.target.value });
    this.setState({ bot });
    this.setDirtyFlag(true);
  };

  private onChangeSecret = (e) => {
    this.setState({ secret: e.target.value });
    this.setDirtyFlag(true);
  };

  private onSave = async (e, connect = false) => {
    const { appId = '', appPassword = '', endpoint = '', type, name = '', id = '' } = this.state.endpoint;
    const endpointService: IEndpointService = {
      appId: appId.trim(),
      appPassword: appPassword.trim(),
      endpoint: endpoint.trim(),
      type: type,
      name: name.trim(),
      id: id.trim()
    };

    const { name: botName = '', description = '', path } = this.state.bot;
    const bot: IBotConfigWithPath = BotConfigWithPath.fromJSON({
      name: botName.trim(),
      description: description.trim(),
      secretKey: '',
      path: path.trim(),
      services: [endpointService]
    });

    // write the bot secret to bots.json
    let botInfo = getBotInfoByPath(path);

    botInfo.secret = this.state.secret;

    await CommandService.remoteCall('bot:list:patch', path, botInfo);
    await CommandService.remoteCall('bot:save', bot);

    this.setDirtyFlag(false);
    this.setState({ bot });

    connect && CommandService.call('livechat:new', endpointService);
  };

  private onSaveAndConnect = async e => {
    await this.onSave(e, connect);
  };

  private setDirtyFlag(dirty) {
    store.dispatch(EditorActions.setDirtyFlag(this.props.documentId, dirty));
  }

  render() {
    const disabled = !this.state.bot.name || !this.props.dirty;
    const error = !this.state.bot.name ? 'The bot name is required' : '';
    return (
      <GenericDocument style={ CSS }>
        <Column>
          <MediumHeader className="bot-settings-header">Bot Settings</MediumHeader>
          <TextInputField label="Bot name" value={ this.state.bot.name } required={ true } onChange={ this.onChangeName } error={ error }/>
          <TextInputField label="Bot secret" value={ this.state.secret } onChange={ this.onChangeSecret } type="password"/>
          <Row className="button-row">
            <PrimaryButton text="Save" onClick={ this.onSave } className="save-button" disabled={ disabled }/>
            <PrimaryButton text="Save & Connect" onClick={ this.onSaveAndConnect } className="save-connect-button" disabled={ disabled }/>
          </Row>
        </Column>
      </GenericDocument>
    );
  }
}

function mapStateToProps(state: IRootState, ownProps: object): BotSettingsEditorProps {
  return {
    bot: state.bot.activeBot
  };
}

export default connect(mapStateToProps)(BotSettingsEditor);
