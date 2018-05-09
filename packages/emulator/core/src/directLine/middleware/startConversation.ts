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

import * as HttpStatus from 'http-status-codes';
import * as Restify from 'restify';
import onErrorResumeNext from 'on-error-resume-next';

import BotEmulator from '../../botEmulator';
import BotEndpoint from '../../facility/botEndpoint';
import uniqueId from '../../utils/uniqueId';

export default function startConversation(botEmulator: BotEmulator) {
  return (req: Restify.Request, res: Restify.Response, next: Restify.Next): any => {
    const auth = req.header('Authorization');

    // TODO: We should not use token as conversation ID
    const tokenMatch = /Bearer\s+(.+)/.exec(auth);
    const botEndpoint: BotEndpoint = req['botEndpoint'];
    const conversationId = onErrorResumeNext(() => {
      const optionsJson = new Buffer(tokenMatch[1], 'base64').toString('utf8');

      return JSON.parse(optionsJson).conversationId;
    }) || uniqueId();

    const currentUser = botEmulator.facilities.users.usersById(botEmulator.facilities.users.currentUserId);

    let created = false;
    let conversation = botEmulator.facilities.conversations.conversationById(conversationId);

    if (!conversation) {
      conversation = botEmulator.facilities.conversations.newConversation(botEmulator, botEndpoint, currentUser, conversationId);
      // Send "bot added to conversation"
      conversation.sendConversationUpdate([{ id: botEndpoint.botId, name: 'Bot' }], undefined);
      // Send "user added to conversation"
      conversation.sendConversationUpdate([currentUser], undefined);
      created = true;
    } else {
      if (botEndpoint && conversation.members.findIndex(user => user.id === botEndpoint.botId) === -1) {
        // Sends "bot added to conversation"
        conversation.addMember(botEndpoint.botId, 'Bot');
      }

      if (conversation.members.findIndex(user => user.id === currentUser.id) === -1) {
        // Sends "user added to conversation"
        conversation.addMember(currentUser.id, currentUser.name);
      }
    }
    
    req['conversation'] = conversation;

    // TODO: We should issue a real token, rather than a conversation ID
    res.json(created ? HttpStatus.CREATED : HttpStatus.OK, {
      conversationId: conversation.conversationId,
      token: botEndpoint && botEndpoint.id,
      expires_in: (2 ^ 31) - 1,
      streamUrl: ''
    });

    res.end();
    
    next();
  };
}
