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
import { Colors, Fonts } from '@bfemulator/ui-react';
import { Component } from 'react';
import { Answer } from '../Models/QnAMakerModels';

const QuestionColumnCSS = css({
  padding: '0px 47px 0px 20px',
  overflowY: 'auto',
  height: '100%',
  fontFamily: Fonts.FONT_FAMILY_DEFAULT,
  borderRight: 'solid 1px #333',

  '& input': {
    marginTop: '5px',
    marginBottom: '8px',
    background: 'transparent',
    width: '100%',
    borderRadius: '2px',
    border: 'solid 1px #777',
    padding: '4px 8px',
    color: 'white',
    boxSizing: 'border-box'
  },

  '& button': {
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
  },

  '& .plus-btn': {
    background: 'url("./media/ic_add_thin.svg") no-repeat 50% 50%',
    backgroundSize: '16px',
    height: '16px',
    width: '16px',
    position: 'relative',
    left: '12px',
    top: '2px',
  },

  '& .phrasing-block': {
    marginBottom: '8px',
    borderRadius: '2px',
    backgroundColor: 'white',
    padding: '4px 8px',
    color: '#4a4a4a',
    fontSize: '13px',

    '& .close-btn': {
      float: 'right',
      color: '#0e639c',
      background: 'url("./media/ic_cancel.svg") no-repeat 50% 50%',
      backgroundSize: '16px',
      height: '19px',
    }
  }
});

interface PhrasingsViewProps {
  phrasings: string[];
  addPhrasing: (phrase: string) => void;
  removePhrasing: (phrase: string) => void;
}

export default class PhrasingsView extends Component<PhrasingsViewProps, {}> {
  constructor(props: PhrasingsViewProps, context: any) {
    super(props, context);
  }

  render(): JSX.Element {
    let phrasingsElems: JSX.Element[] = this.props.phrasings.map(
      (phrasing, index) => this.renderPhrasing(phrasing, index !== 0)
    );
    return (
      <div {...QuestionColumnCSS} className="questions-column">
        <h3>Alternative phrasing</h3>
        {phrasingsElems}
        <input id="phrasing-input" placeholder="Add alternative here" onKeyPress={(e) => this.phraseInputKeyPress(e)}/>
        <button id="add-phrase-btn" className="plus-btn" onClick={() => this.handleAddPhraseClick()} />
      </div>
    );
  }

  private renderPhrasing(phrasing: string, allowRemove: boolean): JSX.Element {
    return (
      <div className="phrasing-block" key={phrasing}>
        {phrasing}
        {allowRemove ? <button className="close-btn" onClick={() => this.removePhrasing(phrasing)} /> : null}
      </div>
    );
  }

  private phraseInputKeyPress(e: any) {
    if (e.key === 'Enter') {
      this.handleAddPhraseClick();
    }
  }

  private handleAddPhraseClick() {
    let newPhrase = (document.getElementById('phrasing-input') as HTMLInputElement).value;
    if (newPhrase) {
      this.props.addPhrasing(newPhrase);
      (document.getElementById('phrasing-input') as HTMLInputElement).value = '';
    }
  }

  private removePhrasing(phrase: string) {
    this.props.removePhrasing(phrase);
  }
}
