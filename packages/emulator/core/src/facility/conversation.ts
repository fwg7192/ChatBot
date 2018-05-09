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

import { EventEmitter } from 'events';
import { URLSearchParams } from 'url';
import * as http from 'http';
import * as HttpStatus from 'http-status-codes';
import updateIn from 'simple-update-in';

import { authentication as authenticationEndpoint } from '../authEndpoints';
import BotEmulator from '../botEmulator';
import BotEndpoint from './botEndpoint';
import createAPIException from '../utils/createResponse/apiException';
import createResourceResponse from '../utils/createResponse/resource';
import ErrorCodes from '../types/errorCodes';
import IActivity from '../types/activity/activity';
import IContactRelationUpdateActivity from '../types/activity/contactRelationUpdate';
import IConversationUpdateActivity from '../types/activity/conversationUpdate';
import IGenericActivity from '../types/activity/generic';
import IInvokeActivity from '../types/activity/invoke';
import IEventActivity from '../types/activity/event';
import IResourceResponse from '../types/response/resource';
import isLocalhostUrl from '../utils/isLocalhostUrl';
import ITranscriptRecord from '../types/transcriptRecord';
import IUser from '../types/user';
import PaymentEncoder from '../utils/paymentEncoder';
import OAuthClientEncoder from '../utils/oauthClientEncoder';
import uniqueId from '../utils/uniqueId';

import ICheckoutConversationSession from '../types/payment/checkoutConversationSession';
import IPaymentAddress from '../types/payment/address';
import IPaymentRequest from '../types/payment/request';
import IPaymentRequestComplete from '../types/payment/requestComplete';
import IPaymentRequestUpdate from '../types/payment/requestUpdate';
import PaymentOperations from '../types/payment/operations';
import { TokenCache } from '../userToken/tokenCache'
import IMessageActivity from '../types/activity/message';
import IAttachment from '../types/attachment'
import { textItem, externalLinkItem, appSettingsItem } from '../types/log/util';
import LogLevel from '../types/log/level';

// moment currently does not export callable function
const moment = require('moment');
const maxDataUrlLength = 1 << 22;

interface IActivityBucket {
  activity: IActivity,
  watermark: number
}

/**
 * Stores and propagates conversation messages.
 */
export default class Conversation extends EventEmitter {
  // private speechToken: ISpeechTokenInfo;

  private get conversationIsTranscript() { return this.conversationId.includes('transcript') };

  constructor(
    public botEmulator: BotEmulator,
    public botEndpoint: BotEndpoint,
    public conversationId: string,
    public user: IUser = {
      id: 'default-user',
      name: 'User'
    }
  ) {
    super();

    // We should consider hardcoding bot id because we don't really use it
    this.members.push({ id: botEndpoint && botEndpoint.botId || 'bot-1', name: 'Bot' });
    this.members.push({ id: user.id, name: user.name });
  }

  // the list of activities in this conversation
  private activities: IActivityBucket[] = [];
  public members: IUser[] = [];
  public nextWatermark = 0;
  private transcript: ITranscriptRecord[] = [];

  // flag indicating if the user has been shown the
  // "please don't use default Bot State API" warning message
  // when they try to write bot state data
  public stateApiDeprecationWarningShown: boolean = false;

  public codeVerifier: string = undefined;

  private postage(recipientId: string, activity: IActivity): IActivity {
    const date = moment();

    return {
      ...activity,
      channelId: 'emulator',
      conversation: activity.conversation || { id: this.conversationId },
      id: activity.id || uniqueId(),
      localTimestamp: date.format(),
      recipient: { id: recipientId },
      timestamp: date.toISOString()
    };
  }

  private addActivityToQueue(activity: IActivity) {
    this.activities = [...this.activities, { activity, watermark: this.nextWatermark++ }];
    this.emit('addactivity', { activity });

    const genericActivity = activity as IGenericActivity;

    genericActivity && this.botEmulator.facilities.logger.logActivity(this.conversationId, genericActivity, activity.recipient.role);
  }

  /**
   * Sends the activity to the conversation's bot.
   */
  async postActivityToBot(activity: IActivity, recordInConversation: boolean) {
    if (!this.botEndpoint) {
      return this.botEmulator.facilities.logger.logMessage(this.conversationId, textItem(LogLevel.Error, `This conversation does not have an endpoint, cannot post "${ activity && activity.type }" activity.`));
    }

    // Do not make a shallow copy here before modifying
    activity = this.postage(this.botEndpoint.botId, activity);
    activity.from = activity.from || this.user;

    if (!activity.recipient.name) {
      activity.recipient.name = 'Bot';
    }

    // Fill in role field, if missing
    if (!activity.recipient.role) {
      activity.recipient.role = 'bot';
    }

    activity.serviceUrl = this.botEmulator.getServiceUrl(this.botEndpoint.botUrl);

    if (!this.conversationIsTranscript && !isLocalhostUrl(this.botEndpoint.botUrl) && isLocalhostUrl(this.botEmulator.getServiceUrl(this.botEndpoint.botUrl))) {
      this.botEmulator.facilities.logger.logMessage(this.conversationId, textItem(LogLevel.Error, 'Error: The bot is remote, but the service URL is localhost. Without tunneling software you will not receive replies.'));
      this.botEmulator.facilities.logger.logMessage(this.conversationId, externalLinkItem('Connecting to bots hosted remotely', 'https://aka.ms/cnjvpo'));
      this.botEmulator.facilities.logger.logMessage(this.conversationId, appSettingsItem('Edit ngrok settings'));
    }

    const options = {
      body: JSON.stringify(activity),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    };

    if (recordInConversation) {
      this.addActivityToQueue({ ...activity });
    }

    this.transcript = [...this.transcript, { type: 'activity add', activity }];
    this.emit('transcriptupdate');

    let status = 200;
    let resp: any = {};

    // If a message to the bot was triggered from a transcript, don't actually send it.
    // This can happen when clicking a button in an adaptive card, for instance.
    if (!this.conversationIsTranscript) {
      resp = await this.botEndpoint.fetchWithAuth(this.botEndpoint.botUrl, options);
      status = resp.status;
    }

    return {
      activityId: activity.id,
      response: resp,
      statusCode: status
    };
  }

  async sendConversationUpdate(membersAdded: IUser[], membersRemoved: IUser[]) {
    const activity: IConversationUpdateActivity = {
      type: 'conversationUpdate',
      membersAdded,
      membersRemoved
    };

    try {
      await this.postActivityToBot(activity, false);
    } catch (err) {
      this.botEmulator.facilities.logger.logException(this.conversationId, err);
    }
  }

  /**
   * Queues activity for delivery to user.
   */
  public postActivityToUser(activity: IActivity): IResourceResponse {
    activity = this.processActivity(activity);
    activity = this.postage(this.user.id, activity);

    if (!activity.from.name) {
      activity.from.name = 'Bot';
    }

    // Fill in role field, if missing
    if (!activity.recipient.role) {
      activity.recipient.role = 'user';
    }

    this.addActivityToQueue(activity);
    this.transcript = [...this.transcript, { type: 'activity add', activity }];
    this.emit('transcriptupdate');

    if (activity.type === 'endOfConversation') {
      this.emit('end');
    }

    return createResourceResponse(activity.id);
  }

  // TODO: Payment modification is only useful for emulator, but not local mode
  //       This function turns all payment cardAction into openUrl to payment://
  public processActivity(activity: IActivity): IActivity {
    const visitors = [new PaymentEncoder(), new OAuthClientEncoder(activity)];

    activity = { ...activity };
    visitors.forEach(v => v.traverseActivity(activity));

    return activity;
  }

  //This function turns local contentUrls into dataUrls://
  public async processActivityForDataUrls(activity: IActivity): Promise<IActivity> {
    const visitor = new DataUrlEncoder(this.botEmulator);

    activity = { ...activity };
    await visitor.traverseActivity(activity);

    return activity;
  }

  // updateActivity with replacement
  public updateActivity(updatedActivity: IActivity): IResourceResponse {
    const { id } = updatedActivity;
    const index = this.activities.findIndex(entry => entry.activity.id === id);

    if (!~index) {
      // The activity may already flushed to the client, thus, not found anymore
      // TODO: Should we add a new activity with same ID, so the client will get the update?
      throw createAPIException(HttpStatus.NOT_FOUND, ErrorCodes.BadArgument, 'not a known activity id');
    }

    this.activities = updateIn(this.activities, [index, 'activity'], activity => ({ ...activity, ...updatedActivity }));
    updatedActivity = this.activities[index].activity;
    this.emit('activitychange', { activity: updatedActivity });

    this.transcript = [...this.transcript, { type: 'activity update', activity: updatedActivity }];
    this.emit('transcriptupdate');

    return createResourceResponse(id);
  }

  public deleteActivity(id: string) {
    // if we found the activity to reply to
    const activityIndex = this.activities.findIndex(entry => entry.activity.id === id);

    if (!~activityIndex) {
      // The activity may already flushed to the client
      // TODO: Should we add a new empty activity with same ID to let the client know about the recall?
      throw createAPIException(HttpStatus.NOT_FOUND, ErrorCodes.BadArgument, 'The activity id was not found');
    }

    const { activity } = this.activities[activityIndex];

    this.activities = updateIn(this.activities, [activityIndex]);
    this.emit('deleteactivity', { activity });

    this.transcript = [...this.transcript, { type: 'activity delete', activity: { id } }];
    this.emit('transcriptupdate');
  }

  public async addMember(id: string, name: string): Promise<IUser> {
    name = name || `user-${uniqueId()}`;
    id = id || uniqueId();

    const user = { name, id };

    this.members = [...this.members, user];
    this.emit('join', { user });

    // TODO: A conversation without endpoint is weird, think about it
    // Don't send "conversationUpdate" if we don't have an endpoint
    if (this.botEndpoint) {
      await this.sendConversationUpdate([user], undefined);
    }

    this.transcript = [...this.transcript, {
      type: 'member join', activity: {
        type: 'conversationUpdate',
        membersAdded: [user]
      } as IConversationUpdateActivity
    }];

    this.emit('transcriptupdate');

    return user;
  }

  public async removeMember(id: string) {
    const index = this.members.findIndex(val => val.id === id);

    if (~index) {
      const user = this.members[index];

      this.members = updateIn(this.members, [index]);
      this.emit('left', { user });
    }

    await this.sendConversationUpdate(undefined, [{ id, name: undefined }]);

    this.transcript = [...this.transcript, {
      type: 'member left', activity: {
        type: 'conversationUpdate',
        membersRemoved: [{ id }]
      } as IConversationUpdateActivity
    }];

    this.emit('transcriptupdate');
  }

  public async sendContactAdded() {
    const activity: IContactRelationUpdateActivity = {
      type: 'contactRelationUpdate',
      action: 'add'
    };

    try {
      await this.postActivityToBot(activity, false);
    } catch (err) {
      this.botEmulator.facilities.logger.logException(this.conversationId, err);
    }

    this.transcript = [...this.transcript, { type: 'contact update', activity }];
    this.emit('transcriptupdate');
  }

  public async sendContactRemoved() {
    const activity: IContactRelationUpdateActivity = {
      type: 'contactRelationUpdate',
      action: 'remove'
    };

    try {
      await this.postActivityToBot(activity, false);
    } catch (err) {
      this.botEmulator.facilities.logger.logException(this.conversationId, err);
    }

    this.transcript = [...this.transcript, { type: 'contact remove', activity }];
    this.emit('transcriptupdate');
  }

  public async sendTyping() {
    // TODO: Which side is sending the typing activity?
    const activity: IActivity = {
      type: 'typing'
    };

    try {
      await this.postActivityToBot(activity, false);
    } catch (err) {
      this.botEmulator.facilities.logger.logException(this.conversationId, err);
    }

    this.transcript = [...this.transcript, { type: 'typing', activity }];
    this.emit('transcriptupdate');
  }

  public async sendPing() {
    // TODO: Which side is sending the ping activity?
    const activity: IActivity = {
      type: 'ping'
    };

    try {
      await this.postActivityToBot(activity, false);
    } catch (err) {
      this.botEmulator.facilities.logger.logException(this.conversationId, err);
    }

    this.transcript = [...this.transcript, { type: 'ping', activity }];
    this.emit('transcriptupdate');
  }

  public async sendDeleteUserData() {
    const activity: IActivity = {
      type: 'deleteUserData'
    };

    try {
      await this.postActivityToBot(activity, false);
    } catch (err) {
      this.botEmulator.facilities.logger.logException(this.conversationId, err);
    }

    this.transcript = [...this.transcript, { type: 'user data delete', activity }];
    this.emit('transcriptupdate');
  }

  public async sendUpdateShippingAddressOperation(
    checkoutSession: ICheckoutConversationSession,
    request: IPaymentRequest,
    shippingAddress: IPaymentAddress,
    shippingOptionId: string
  ) {
    return await this.sendUpdateShippingOperation(
      checkoutSession,
      PaymentOperations.UpdateShippingAddressOperationName,
      request,
      shippingAddress,
      shippingOptionId,
    );
  }

  public async sendUpdateShippingOptionOperation(
    checkoutSession: ICheckoutConversationSession,
    request: IPaymentRequest,
    shippingAddress: IPaymentAddress,
    shippingOptionId: string
  ) {
    return await this.sendUpdateShippingOperation(
      checkoutSession,
      PaymentOperations.UpdateShippingOptionOperationName,
      request,
      shippingAddress,
      shippingOptionId
    );
  }

  private async sendUpdateShippingOperation(
    checkoutSession: ICheckoutConversationSession,
    operation: string,
    request: IPaymentRequest,
    shippingAddress: IPaymentAddress,
    shippingOptionId: string
  ) {
    if (!this.botEndpoint) {
      return this.botEmulator.facilities.logger.logMessage(this.conversationId, textItem(LogLevel.Error, 'Error: This conversation does not have an endpoint, cannot send update shipping activity.'));
    }

    const updateValue: IPaymentRequestUpdate = {
      id: request.id,
      shippingAddress: shippingAddress,
      shippingOption: shippingOptionId,
      details: request.details
    };

    const activity: IInvokeActivity = {
      type: 'invoke',
      name: operation,
      from: { id: checkoutSession.checkoutFromId },
      conversation: { id: checkoutSession.checkoutConversationId },
      relatesTo: {
        activityId: checkoutSession.paymentActivityId,
        bot: { id: this.botEndpoint.botId },
        channelId: 'emulator',
        conversation: { id: this.conversationId },
        serviceUrl: this.botEmulator.getServiceUrl(this.botEndpoint.botUrl),
        user: this.botEmulator.facilities.users.usersById(this.botEmulator.facilities.users.currentUserId)
      },
      value: updateValue
    };

    const { response } = await this.postActivityToBot(activity, false);

    // TODO: Should we record this in transcript? It looks like normal IInvokeActivity

    return response;
  }

  public async sendPaymentCompleteOperation(
    checkoutSession: ICheckoutConversationSession,
    request: IPaymentRequest,
    shippingAddress: IPaymentAddress,
    shippingOptionId: string,
    payerEmail: string,
    payerPhone: string
  ) {
    if (!this.botEndpoint) {
      return this.botEmulator.facilities.logger.logMessage(this.conversationId, textItem(LogLevel.Error, 'Error: This conversation does not have an endpoint, cannot send payment complete activity.'));
    }

    const paymentTokenHeader = {
      amount: request.details.total.amount,
      expiry: '1/1/2020',
      format: 2,
      merchantId: request.methodData[0].data.merchantId,
      paymentRequestId: request.id,
      timestamp: '4/27/2017'
    };

    const paymentTokenHeaderStr = JSON.stringify(paymentTokenHeader);
    const pthBytes = new Buffer(paymentTokenHeaderStr).toString('base64');

    const paymentTokenSource = 'tok_18yWDMKVgMv7trmwyE21VqO';
    const ptsBytes = new Buffer(paymentTokenSource).toString('base64');

    const ptsigBytes = new Buffer('Emulator').toString('base64');

    const updateValue: IPaymentRequestComplete = {
      id: request.id,
      paymentRequest: request,
      paymentResponse: {
        details: {
          paymentToken: pthBytes + '.' + ptsBytes + '.' + ptsigBytes
        },
        methodName: request.methodData[0].supportedMethods[0],
        payerEmail: payerEmail,
        payerPhone: payerPhone,
        shippingAddress: shippingAddress,
        shippingOption: shippingOptionId
      }
    };

    const activity: IInvokeActivity = {
      type: 'invoke',
      name: PaymentOperations.PaymentCompleteOperationName,
      from: { id: checkoutSession.checkoutFromId },
      conversation: { id: checkoutSession.checkoutConversationId },
      relatesTo: {
        activityId: checkoutSession.paymentActivityId,
        bot: { id: this.botEndpoint.botId },
        channelId: 'emulator',
        conversation: { id: this.conversationId },
        serviceUrl: this.botEmulator.getServiceUrl(this.botEndpoint.botUrl),
        user: this.botEmulator.facilities.users.usersById(this.botEmulator.facilities.users.currentUserId)
      },
      value: updateValue
    };

    const { response } = await this.postActivityToBot(activity, false);

    return response;
  }

  public async sendTokenResponse(
    connectionName: string,
    token: string,
    doNotCache?: boolean) {

    let userId = this.botEmulator.facilities.users.currentUserId;
    let botId = this.botEndpoint.botId;

    if(!doNotCache) {
      TokenCache.addTokenToCache(botId, userId, connectionName, token);
    }
    
    const activity: IEventActivity = {
        type: 'event',
        name: 'tokens/response',
        value: {
            connectionName: connectionName,
            token: token
        }
    };

    return await this.postActivityToBot(activity, false);
}


  /**
   * Returns activities since the watermark.
   */
  getActivitiesSince(watermark: number): { activities: IActivity[], watermark: number } {
    this.activities = watermark ? this.activities.filter(entry => entry.watermark >= watermark) : this.activities;

    return {
      activities: this.activities.map(entry => entry.activity),
      watermark: this.nextWatermark
    };
  }

  // TODO: This need to be redesigned
  public feedActivities(activities: IActivity[]) {
    /*
    * We need to fixup the activities to look like they're part of the current conversation.
    * This a limitation of the way the emulator was originally designed, and not a problem
    * with the transcript data. In the fullness of time, the emulator (and webchat control)
    * could be better adapted to loading transcripts.
    * */

    const { id: currUserId } = this.user;
    let origUserId = null;
    let origBotId = null;
    // Get original botId and userId
    // Fixup conversationId
    activities.forEach(activity => {
      if (!origBotId && activity.recipient.role === 'bot') {
        origBotId = activity.recipient.id;
      }

      if (!origUserId && activity.recipient.role === 'user') {
        origUserId = activity.recipient.id;
      }

      if (activity.conversation) {
        activity.conversation.id = this.conversationId;
      }
    });

    // Fixup recipient and from ids
    if (this.botEndpoint && origUserId && origBotId) {
      activities.forEach(activity => {
        if (activity.recipient.id === origBotId) {
          activity.recipient.id = this.botEndpoint.botId;
        }

        if (activity.from.id === origBotId) {
          activity.from.id = this.botEndpoint.botId;
        }

        if (activity.recipient.id === origUserId) {
          activity.recipient.id = currUserId;
        }

        if (activity.from.id === origUserId) {
          activity.from.id = currUserId;
        }
      });
    }

    // Add activities to the queue
    activities.forEach(activity => {
      if (activity.recipient.role === 'user') {
        activity = this.processActivity(activity);
      }

      this.addActivityToQueue(activity);
    });
  }

  public async getTranscript(): Promise<IActivity[]> {
    // Currently, we only export transcript of activities
    // TODO: Think about "member join/left", "typing", "activity update/delete", etc.
    const activities = this.transcript.filter(record => record.type === 'activity add').map(record => record.activity);
    for (let i = 0; i < activities.length; i++) {
      await this.processActivityForDataUrls(activities[i]);
    }
    return activities;
  }
}

class DataUrlEncoder  {

  constructor(
    public bot: BotEmulator
  )
  {
    // the constructor only exists so we can pass in the bot
  }

  public async traverseActivity(activity: IActivity) {
    let messageActivity = activity as IMessageActivity;
    if (messageActivity) {
        await this.traverseMessageActivity(messageActivity);
    }
  }

  public async traverseMessageActivity(messageActivity: IMessageActivity) {
    if (messageActivity && messageActivity.attachments) {

      for (var i = 0; i < messageActivity.attachments.length; i++) {
        await this.traverseAttachment(messageActivity.attachments[i]);
      }

    }
  }

  public async traverseAttachment(attachment: IAttachment) {
    if (attachment && attachment.contentUrl) {
      await this.visitContentUrl(attachment);
    }
  }
  
  protected async visitContentUrl(attachment: IAttachment)
  {
    if (this.shouldBeDataUrl(attachment.contentUrl)) {
      attachment.contentUrl = await this.makeDataUrl(attachment.contentUrl);
    }
  }
  protected async makeDataUrl(url: string) : Promise<string> {
    let resultUrl = url;
    const imported = await this.bot.options.fetch(url, {});
    if (parseInt(imported.headers.get('content-length')) < maxDataUrlLength) {
      const buffer = await imported.buffer();
      const encoded = Buffer.from(buffer).toString('base64');
      const typeString = imported.headers.get('content-type');
      resultUrl = 'data:' + typeString + ';base64,' + encoded;
     
    } 
    return resultUrl;
  }
  protected shouldBeDataUrl(url: string) : boolean {
    return (url && (isLocalhostUrl(url) || url.indexOf('ngrok') != -1));
  }
}