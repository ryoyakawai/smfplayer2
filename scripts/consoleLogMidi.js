/**
 * Copyright (c) 2021 Ryoya Kawai. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
"use strict";

/* type = {'midi', 'ble'} */
const console_log_midi = (midiMsg=[], type='ble', prefix='', debug=false) => {
  if (debug==false) return
  if ((midiMsg[0] instanceof Array)===false) {
    midiMsg = [midiMsg]
  }
  const arr_ret = []
  for(let i=0; i<midiMsg.length; i++) {
    const item = midiMsg[i]
    if(item.length>0) {
      const arrLog = midi_log(item, type)
      arr_ret.push(arrLog)
      console.log(arrLog[0], arrLog[1], arrLog[2], arrLog[3], arrLog[4])
    }
  }
  return arr_ret

  function midi_log(midiMsg, type='ble') {
    let msg = []
    let style = ''
    midiMsg.forEach( item => {
      if (typeof item != 'undefined') msg.push(('00' + item.toString(16)).substr(-2))
    })
    let checkIdx=2
    const color = {
      sysex: '#D81B60',
      system: '#FF0000',
      noteOff: '#5E35B1',
      noteOn: '#DCE775',
      normal: '#00838F'
    }
    if (type=='midi') checkIdx=0
    if (msg[checkIdx]=='f0') {
      style=`color: ${color.sysex}`
    } else {
      /*
      if (msg.length-1 < checkIdx) {
        // is this feasible case?
        // for splited sysex message
        checkIdx = 1
        style=`color: ${color.sysex}`
      }
      */
      if (msg[checkIdx].substr(0, 1)=='8') {
        style=`color: ${color.noteOff}`
      } else
      if (msg[checkIdx].substr(0, 1)=='9') {
        style=`color: ${color.noteOn}`
      } else
      if (msg[checkIdx].match(/^f(1|2|3|6|a|b|c|e|f)$/)!=null) {
        style=`color: ${color.system}`
      } else {
        style=`color: ${color.normal}`
      }
    }
    //console.log(`${prefix}%c■ %cSIZE=[${msg.length}] MIDI_MSG=[%c${msg.join(', ')}%c]`, style, '', style, '')
    return [
      `${prefix}%c■ %cSIZE=[${msg.length}] MIDI_MSG=[%c${msg.join(', ')}%c]`
      , style, '', style, '']
  }
}

export {
  console_log_midi
}
