/// <reference types="react" />
import * as React from 'react';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { IBotConnection, ChannelAccount, DirectLineOptions, CardActionTypes } from '@bfemulator/custom-botframework-directlinejs';
import { ChatStore } from './Store';
import { SpeechOptions } from './SpeechOptions';
import { ActivityOrID, FormatOptions } from './Types';
export interface ChatProps {
    adaptiveCardsHostConfig: any;
    user: ChannelAccount;
    bot: ChannelAccount;
    botConnection?: IBotConnection;
    directLine?: DirectLineOptions;
    speechOptions?: SpeechOptions;
    locale?: string;
    selectedActivity?: BehaviorSubject<ActivityOrID>;
    sendTyping?: boolean;
    formatOptions?: FormatOptions;
    resize?: 'none' | 'window' | 'detect';
    store?: ChatStore;
    showShell?: boolean;
}
export declare class Chat extends React.Component<ChatProps, {}> {
    private store;
    private botConnection;
    private activitySubscription;
    private connectionStatusSubscription;
    private selectedActivitySubscription;
    private shellRef;
    private historyRef;
    private chatviewPanelRef;
    private resizeListener;
    private _handleCardAction;
    private _handleKeyDownCapture;
    private _saveChatviewPanelRef;
    private _saveHistoryRef;
    private _saveShellRef;
    constructor(props: ChatProps);
    private handleIncomingActivity(activity);
    private setSize();
    private handleCardAction();
    private handleKeyDownCapture(evt);
    private saveChatviewPanelRef(chatviewPanelRef);
    private saveHistoryRef(historyWrapper);
    private saveShellRef(shellWrapper);
    componentDidMount(): void;
    componentWillUnmount(): void;
    componentWillReceiveProps(nextProps: ChatProps): void;
    render(): JSX.Element;
}
export interface IDoCardAction {
    (type: CardActionTypes, value: string | object): void;
}
export declare const doCardAction: (botConnection: IBotConnection, from: ChannelAccount, locale: string, sendMessage: (value: string, user: ChannelAccount, locale: string) => void) => IDoCardAction;
export declare const sendPostBack: (botConnection: IBotConnection, text: string, value: object, from: ChannelAccount, locale: string) => void;
export declare const renderIfNonempty: (value: any, renderer: (value: any) => JSX.Element) => JSX.Element;
export declare const classList: (...args: (string | boolean)[]) => string;
