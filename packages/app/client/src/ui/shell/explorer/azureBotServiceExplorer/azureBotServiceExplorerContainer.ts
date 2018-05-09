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

import { IAzureBotService, ServiceType } from 'msbot/bin/schema';
import { ComponentClass } from 'react';
import { connect } from 'react-redux';
import { launchAzureBotServiceEditor, openAzureBotServiceDeepLink, openAzureBotServiceExplorerContextMenu } from '../../../../data/action/azureBotServiceActions';
import { IRootState } from '../../../../data/store';
import { AzureBotServiceEditor } from './azureBotServiceEditor/azureBotServiceEditor';
import { AzureBotServiceExplorer } from './azureBotServiceExplorer';

const mapStateToProps = (state: IRootState) => {
  const { services } = state.bot.activeBot;
  return {
    azureBotServices: services.filter(service => service.type === ServiceType.AzureBotService),
    window
  };
};

const mapDispatchToProps = dispatch => {
  return {
    launchAzureBotServiceEditor: (azureBotServiceEditor: ComponentClass<AzureBotServiceEditor>, azureBotService: IAzureBotService) => dispatch(launchAzureBotServiceEditor(azureBotServiceEditor, azureBotService)),
    openAzureBotServiceDeepLink: (azureBotService: IAzureBotService) => dispatch(openAzureBotServiceDeepLink(azureBotService)),
    openContextMenu: (azureBotService: IAzureBotService, azureBotServiceEditor: ComponentClass<AzureBotServiceEditor>) => dispatch(openAzureBotServiceExplorerContextMenu(azureBotServiceEditor, azureBotService)),
  };
};

export const AzureBotServiceExplorerContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(AzureBotServiceExplorer) as any;
