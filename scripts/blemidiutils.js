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

import { console_log_midi } from './consoleLogMidi.js';
console.log_midi = console_log_midi;

export class BLEMIDIUtils {
  constructor() {
    this.device_connected = false
    this.MIDI_UUID = this.SERVICE_UUID =
      '03b80e5a-ede8-4b33-a751-6ce34ec4c700'
    this.MIDI_CHARA_UUID = '7772e5db-3868-4112-a1a9-f2669d106bf3'
    this.connectedDevice = null
    this.timerId = 0
    this.characteristic = {}
    this.msgConcatMax = 3 // under than 3
    this.msgConcatMaxLength = 5 * this.msgConcatMax -2 // (5 * {messageCount} - 2)
    this.store = {
      sysex: []
    }
    this.debugMode = false
    this.splitByteLength = 16
    this.SYSMSG = {
      SYSEX_START: 0xf0,
      SYSEX_END: 0xf7,
      COMMON: [
        { status: 0xf1, len: 2 },
        { status: 0xf2, len: 3 },
        { status: 0xf3, len: 1 },
        { status: 0xf6, len: 1 },
      ],
      RTIME: [
        { status: 0xf8, len: 1 },
        { status: 0xfa, len: 1 },
        { status: 0xfb, len: 1 },
        { status: 0xfc, len: 1 },
        { status: 0xfe, len: 1 },
        { status: 0xff, len: 1 },
      ]
    }
  }

  getMsgConcatMaxLength() {
    return 5 * this.msgConcatMax -2
  }

  setDebugMode(mode=false) {
    if (typeof mode != 'boolean') {
     mode = false
    }
    this.debugMode = mode
    return this.debugMode
  }
  // set time of when Web started
  // this duration will be minused when sending message
  getCharacteristic() {
    return this.characteristic
  }
  setCharacteristic(characteristic={}) {
    //if (!(characteristic instanceof BluetoothRemoteGATTCharacteristic)) {
    if (!(characteristic instanceof Object)) {
      characteristic = {}
    }
    this.characteristic = characteristic
    return this.characteristic
  }
  getDeviceConnected() {
    return this.device_connected
  }
  setDeviceConnected(state=false) {
    if (typeof state != 'boolean') {
      state = false
    }
    this.device_connected = state
    return this.device_connected
  }
  async startBle () {
    let ble_options = {
      filters: [ { services: [ this.MIDI_UUID ] } ]
    }
    try {
      this.connectedDevice = await navigator.bluetooth.requestDevice(ble_options)
      let server = await this.connectedDevice.gatt.connect()
      let service = await server.getPrimaryService(this.SERVICE_UUID)
      await this.startBleMIDIService(service, this.MIDI_CHARA_UUID)
      this.connectedBleCallback()
    } catch(err) {
      console.log(`[Canceled] connect`)
      console.log(err)
    }
  }
  connectedBleCallback() {
    console.log("[Called] connected_ble_callback")
  }
  setConnectedBleCallback(callback = () => {}) {
    this.connectedBleCallback = callback
  }
  endBle() {
    if (this.connectedDevice === null
        || typeof this.connectedDevice.gatt.connected == "undefined") {
      console.log('[No devices are connected!]')
    } else {
      this.connectedDevice.gatt.disconnect()
      console.log('[Disconnected]')
      this.device_connected = false
      this.disconnectedBleCallback()
    }
  }
  disconnectedBleCallback() {
    console.log("[Called] disconnected_ble_callback")
  }
  setDisconnectedBleCallback(callback = () => {}) {
    this.disconnectedBleCallback = callback
  }
  async startBleMIDIService(service={uuid: null}, charUUID=null) {
    //if (!(service instanceof BluetoothRemoteGATTService) || charUUID==null) {
    if (typeof service != 'object' || charUUID==null) {
      return false
    }
    const characteristic = await service.getCharacteristic(charUUID)
    this.setCharacteristic(characteristic)
    await this.characteristic.startNotifications()
    this.device_connected = true
    console.log("[Connected] ", this.characteristic.uuid)
    const self = this
    this.characteristic.output = {
      send: async (arg00, arg01=0) => {
        const chara = self.getCharacteristic()
        if ((arg00[0] instanceof Array) === false) {
          arg00 = [ arg00 ]
        }
        //
        const ble_arg00 = []
        for (let i=0; i<arg00.length; i++) {
          const tmp_ble_arg00 = self.convMIDIMsgToBLEMIDIPacket(arg00[i])
          tmp_ble_arg00.forEach( message => {
            ble_arg00.push(message)
          })
        }
        /*
        for (let i=0; i<ble_arg00.length; i++) {
          console.log(ble_arg00[i])
          await chara.writeValueWithoutResponse(new Uint8Array(ble_arg00[i]))
        }
        */
        let multiple_ble_arg00 = []
        let arr_idx = 0
        for (let i=0; i<ble_arg00.length; i++) {
          const msg = ble_arg00[i]
          if (i==0 && msg[2] >= 0xf0) { // divided sysEx is not considered
            multiple_ble_arg00 = ble_arg00
            break
          } else
          if (msg[2] < 0xf0) {
            if (typeof multiple_ble_arg00[arr_idx] == 'undefined') {
              multiple_ble_arg00[arr_idx] = msg
            } else {
              multiple_ble_arg00[arr_idx] = multiple_ble_arg00[arr_idx].concat(msg.slice().splice(1))
            }
            if (multiple_ble_arg00[arr_idx].length > this.getMsgConcatMaxLength()) arr_idx += 1 // concat up to 8 msg
          } else {
            multiple_ble_arg00[arr_idx] = msg
            arr_idx += 1
          }
        }
        if (arg01 <= 0) {
          //for (let i=0; i<multiple_ble_arg00.length; i++) {
          // const msg = multiple_ble_arg00[i]
          for await (let msg of multiple_ble_arg00) {
            await chara.writeValueWithoutResponse(new Uint8Array(msg))
            console.log_midi(msg, 'midi', '[>>> blemidiutils.js] A ', this.debugMode)
          }
        } else {
          setTimeout( async () => {
            //for (let i=0; i<multiple_ble_arg00.length; i++) {
            //  const msg = multiple_ble_arg00[i]
            for await (let msg of multiple_ble_arg00) {
              await chara.writeValueWithoutResponse(new Uint8Array(msg))
              console.log_midi(msg, 'midi', '[>>> blemidiutils.js] B ', this.debugMode)
            }
          }, arg01)
        }
      }
    }
    this.characteristic.input = {
      onmidimessage: this.getMidiEventHandleCallback()
    }
    this.characteristic.addEventListener('characteristicvaluechanged', async (event) => {
      await this.onMIDIEvent.bind(this)(event)
    })
  }
  async onMIDIEvent(event) {
    const data = event.target.value
    let packet_blemidi = Array.from(new Uint8Array(data.buffer))
    const arr_packet_blemidi = []
    // vvv split if the message includes 0xf7 vvv
    let check0xf7Idx = -1
    // only pick up if extra bytes are added after 0xf7
    if (packet_blemidi.slice().pop()!=this.SYSMSG.SYSEX_END) {
      check0xf7Idx = packet_blemidi.indexOf(this.SYSMSG.SYSEX_END)
    }
    if (check0xf7Idx==-1) {
      arr_packet_blemidi.push(packet_blemidi)
    } else {
      const ts = this.generateTimeStamp()
      arr_packet_blemidi.push(packet_blemidi.slice().splice(0, check0xf7Idx+1))
      arr_packet_blemidi.push([ts.h_b, packet_blemidi[0], ...packet_blemidi.slice().splice(check0xf7Idx+1)])
      const _pbm = []
      arr_packet_blemidi[arr_packet_blemidi.length-1].forEach(msg => {
        _pbm.push(('00' + msg.toString(16)).substr(-2))
      })
      /* dispose system message */
      //console.log(check0xf7Idx, _pbm.join(', '))
    }
    // ^^^ split if the message includes 0xf7 ^^^
    // vvv debug vvv
    //if (packet_blemidi[2] != 0xfe) {
    /*
    const pbm = []
    packet_blemidi.forEach(msg => {
      pbm.push(('00' + msg.toString(16)).substr(-2))
    })
    console.log(`   %c[RAW] ${pbm.join(', ')}`, 'color: green')
    */
    //}
    //
    // ^^^ debug ^^^
    for (let i=0; i<arr_packet_blemidi.length; i++) {
      const midiMsg = await this.convBLEMIDIPacketToMIDIMsg.bind(this)(arr_packet_blemidi[i])
      midiMsg.forEach( msg => {
        if (msg[0]==this.SYSMSG.SYSEX_START) {
          if (msg.slice().pop()==this.SYSMSG.SYSEX_END) {
            if (this.isTimeStampByte(msg[0]) && msg[0] > 0) {
              console.log_midi(msg, 'midi', '[<<< blemidiutils.js] A ', this.debugMode)
              event.detail = msg
              this.onMidiEventHandleCallback.bind(this)(event)
            }
          }
        } else {
          if (this.isTimeStampByte(msg[0]) && msg[0] > 0) {
            console.log_midi(msg, 'midi', '[<<< blemidiutils.js] B ', this.debugMode)
            event.detail = msg
            this.onMidiEventHandleCallback.bind(this)(event)
          }
        }
      })
    }
  }

  extrudeSystemMessageBLEPacket(packet_blemidi=[]) {
    // vvv split if sysem common/realtime included vvv
    /*
     * (1) serach system common/realtime
     * (2) check timestamp (isStart==true idx=1 else idx=0)
     * (3) take those 2 byte out from stream
     */
    // ^^^ split if sysem common/realtime included ^^^
    const ts = this.generateTimeStamp()
    const ARR_SYSMSG = this.SYSMSG.COMMON.concat(this.SYSMSG.RTIME)
    const SYSMSG_MAP = {
      status: new Array(ARR_SYSMSG.length),
      len: new Array(ARR_SYSMSG.length)
    }
    ARR_SYSMSG.forEach( (item, idx) => {
      SYSMSG_MAP.status[idx] = item.status
      SYSMSG_MAP.len[idx] = item.len
    })
    let packet_system = []
    if (packet_blemidi.length > 0) {
      const tmp_packet_blemidi = packet_blemidi.slice()
      packet_blemidi = []
      for (let i=0; i<tmp_packet_blemidi.length; i++) {
        const byte = tmp_packet_blemidi[i]
        const sysmsg_idx = SYSMSG_MAP.status.indexOf(byte)

        // [memo] No SystemMessage and Next sibling byte is NOT SysEx End(0xf7)
        if ( sysmsg_idx>=1
          && (tmp_packet_blemidi[i+1]!=this.SYSMSG.SYSEX_START)
          && (tmp_packet_blemidi[i+1]<0x80)
          && (tmp_packet_blemidi[i+1]!=this.SYSMSG.SYSEX_END) ) {
        //if ( sysmsg_idx>=1 && (tmp_packet_blemidi[i+1]!=this.SYSMSG.SYSEX_END) ) {
          // one byte before system message status is timestamp low
          const tmp_ts = {
            l: packet_blemidi.pop(),
            h: tmp_packet_blemidi[0]
          }
          packet_system = packet_system.concat([tmp_ts.h, tmp_ts.l])
          // put timestamp high in index=0
          //   if packet_blemidi (output value) does not have timestamp high in index=0
          if (packet_blemidi.length==0) {
            packet_blemidi.push(( typeof tmp_ts.h!='undefined'? tmp_ts.h : ts.h_b))
          }
          for (let j=0; j<SYSMSG_MAP.len[sysmsg_idx]; j++) {
            packet_system.push(tmp_packet_blemidi[i+j])
          }
          i += SYSMSG_MAP.len[sysmsg_idx] - 1 // omit
        } else {
          packet_blemidi.push(byte)
        }
      }
      //console.log_midi(tmp_packet_blemidi, 'ble', '[ORG] ', true)
      //console.log_midi(packet_blemidi, 'ble', '[MSG] ', true)
      //console.log_midi(packet_system, 'ble', '[SYSTEM] ', true)
    }
    // if packet_blemidi only have one byte that is only one time stamp high so delete it
    if (packet_blemidi.length==1) {
      packet_blemidi.pop()
    }
    return {
      packet_blemidi: packet_blemidi,
      packet_system: packet_system
    }
  }

  //isBitOn(byte) {
  isTimeStampByte(byte) {
    return (byte & (1 <<7)) > 0
  }

  convBLEMIDIPacketToMIDIMsg(packet_blemidi=[]) {
    return new Promise( (resolve) => {
      if (packet_blemidi.length<1) resolve([]) //return []
      const ex_packet_blemidi = this.extrudeSystemMessageBLEPacket.bind(this)(packet_blemidi)
      packet_blemidi = ex_packet_blemidi.packet_blemidi
      //const packet_system = ex_packet_blemidi.packet_system
      const packet_info = this.parseMIDIPacket.bind(this)(packet_blemidi)

      let returnVal = []
      packet_info.events.forEach( item => {
        if(typeof item != 'undefined') {
          if (item.type=='sysex') {
            if (item.isStart) {
              this.store.sysex = []
            }
            this.store.sysex = this.store.sysex.concat(item.data)
            if (item.isEnd
                || (item.data.slice().shift() == 0xf0 && item.data.slice().pop() == 0xf7)) {
              returnVal = [ this.store.sysex ]
              this.store.sysex = []
            }
          } else {
            packet_info.events.forEach( msg => {
              if (typeof msg != 'undefined') {
                returnVal.push(msg.data)
              }
            })
          }
        }
      })

      resolve(returnVal)
      //return returnVal
    })
  }

  getMidiEventHandleCallback() {
    return this.onMidiEventHandleCallback
  }
  setMidiEventHandleCallback(callback) {
    this.onMidiEventHandleCallback = callback
  }
  _onMidiEventHandleCallback() {
  }
  onMidiEventHandleCallback(event) {
    console.log(event)
  }
  parseMIDIPacket(packet_info) {
    return this.parseBLEMIDIPacket.bind(this)(packet_info)
  }
  /*
   * vvvv BLE MIDI PACKET PARSER vvvv ////////////////////////////////
   * https://github.com/skratchdot/ble-midi/blob/master/src/packets/parse-packet.js //
   */
  generateTimeStamp() {
    const timestamp = (new Date()).getTime() % Math.pow(2, 13)
    return {
      a: timestamp,
      h: generateTimestampHigh(timestamp),
      l: generateTimestampLow(timestamp),
      h_b: 0b10000000 + generateTimestampHigh(timestamp), // for ble header
      l_b: 0b10000000 + generateTimestampLow(timestamp)   // for ble header
    }

    function  generateTimestampHigh(timestamp) {
      return (timestamp >> 7)
    }
    function  generateTimestampLow(timestamp) {
      return (timestamp - ((timestamp >> 7) << 7))
    }
  }

  convMIDIMsgToBLEMIDIPacket(midiMsg) {
    const timestamp = this.generateTimeStamp()
    const packet_head = [timestamp.h + 0x80, timestamp.l + 0x80]
    let packet = []
    let ret_packet = []
    let splitBy = this.splitByteLength
    packet = packet.concat(packet_head)
    switch (midiMsg[0]) {
      case 0xf0: // sysex
        for(let i=0; i<midiMsg.length-1; i++) {
          packet.push(midiMsg[i])
        }
        packet = packet.concat([timestamp.l + 0x80, 0xf7])
        if (packet.length > splitBy ) {
          while(packet.length % splitBy <= 4) {
            splitBy -= 1
          }
          for (let i=0; i<Math.ceil(packet.length/splitBy); i++) {
            ret_packet[i] = packet.slice().splice(i * splitBy, splitBy)
            if (i>0) {
              ret_packet[i].unshift(timestamp.h_b)
            }
          }
          packet = ret_packet
        } else {
          packet = [packet]
        }
        break
      default:
        packet = [ packet.concat(midiMsg) ]
        break
    }
    return packet
  }

  parseBLEMIDIPacket(packet=[]) {
    if (packet.length == 0) {
      return {
        events: []
      }
    }
    let packet_info = packetInfo(packet)
    if (packet_info.isHeaderValid) {
      if (packet.length >= 2 && !isBitOn(packet[packet_info.index], 7)) {
        /*
        // vv debug vv
        const pbm = []
        packet_info.packet.forEach(msg => {
          pbm.push(('00' + msg.toString(16)).substr(-2))
        })
        //console.log(`   (1) i=[${packet_info.index}] len=[${pbm.length}] isBitOn=[${isBitOn(packet[packet_info.index], 7)}] packet=[${pbm.join(', ')}]`)
        // ^^ debug ^^
        */
        let isSysexStart = false
        const check0xf0Idx = packet_info.packet.indexOf(this.SYSMSG.SYSEX_START)
        // check0xf0Idx!=packet_info.packet.length-2) is the time stamp
        if (check0xf0Idx!=-1 &&
            (check0xf0Idx!=packet_info.packet.length-2
          && packet_info.packet[check0xf0Idx+1]!=this.SYSMSG.SYSEX_END)) {
          isSysexStart = true
        }
        packet_info = parseSysex.bind(this)(packet_info, isSysexStart)
        //console.log(`    ┃  i=[${packet_info.index}] packet_info=[`, packet_info)
        //console.log_midi(this.store.sysex, 'midi', '    └ sysex:  ', this.debugMode)
      }
      while (packet_info.index < packet.length) {
        const byte1 = packet[packet_info.index]
        const byte2 = packet[packet_info.index + 1]
        const hasTimestamp = isBitOn(byte1, 7)
        const hasStatus = isBitOn(byte2, 7)
        // vv debug vv
        /*
        const pbm = []
        packet_info.packet.forEach(msg => {
          pbm.push(('00' + msg.toString(16)).substr(-2))
        })
        console.log(`   (2) i=[${packet_info.index}] len=[${pbm.length}] isBitOn=[${isBitOn(packet[packet_info.index], 7)}] hasTimestamp=[${hasTimestamp}] hasStatus=[${hasStatus}] byte1=[${byte1}] byte2=[${byte2}] packet=[${pbm.join(', ')}]`)
        console.log(`    ┃  i=[${packet_info.index}] packet_info=[`, packet_info)
        console.log_midi(this.store.sysex, 'midi', '    └ sysex:  ', this.debugMode)
        */
        // ^^ debug ^^
        if (hasTimestamp && hasStatus && byte2 === this.SYSMSG.SYSEX_START) {
          packet_info = parseSysex.bind(this)(packet_info, true)
        } else if (hasTimestamp && hasStatus) {
          packet_info = parseFullMidiMessage.bind(this)(packet_info)
        } else if (!hasStatus ) {
          const tmp_packet_info = parseRunningStatusMidiMessage.bind(this)(packet_info, hasTimestamp)
          if (tmp_packet_info!=false) {
            packet_info = tmp_packet_info
          }
          //packet_info.index = Number.MAX_SAFE_INTEGER
          packet_info.index = packet_info.packet.length + 2
        } else {
          packet_info.events.push(
            messageUnknown(packet_info.events)
          )
          packet_info.index = packet.length + 2
        }
      }
    }
    return packet_info

    function midiMessageSysEx(isStart, isEnd, data) {
      return {
        type: 'sysex',
        isStart: isStart,
        isEnd: isEnd,
        data: data
      }
    }

    function midiMessage(msg_type, timestamp, midiStatus, midiOne, midiTwo) {
      const  midi_data = [midiStatus, midiOne, midiTwo]
      if (typeof midiTwo == 'undefined') {
        midi_data.splice(2, 1)
      }
      if (typeof midiTwo == 'undefined') {
        midi_data.splice(1, 1)
      }

      return {
        type: msg_type,
        timestamp: timestamp,
        midiStatus: midiStatus,
        midiOne: typeof midiOne != 'undefined'? midiOne : null,
        midiTwo: typeof midiTwo != 'undefined'? midiOne : null,
        data: midi_data
      }
    }

    function messageUnknown (packet_info) {
      try {
        let tmp_message = midiMessage('unknown', null, null, null, null)
        tmp_message.skipIndex = packet_info.index
        if(typeof packet_info.packet != 'undefined') {
          if (packet_info.packet[0] instanceof Array) {
            const skipData = []
            packet_info.packet[0].forEach(packet_info => {
              skipData.concat(packet_info.data)
            })
            tmp_message.skipData = skipData
          } else {
            tmp_message.skipData = packet_info.packet.slice(packet_info.index)
          }
          return tmp_message
        }
      } catch(e) {
        console.error(packet_info, e)
      }
    }
    function parseRunningStatusMidiMessage(packet_info, hasTimestamp) {
      // timestamp
      if (hasTimestamp) {
        packet_info.timestampLow = convTimestampLow(packet_info.packet[packet_info.index++])
        packet_info.timestamp = convTimestamp(packet_info.timestampHigh, packet_info.timestampLow)
      }
      const midiOne = packet_info.packet[packet_info.index++]
      const midiTwo = packet_info.packet[packet_info.index++]
      if (midiOne == null && midiTwo == null) {
        return false
      }
      packet_info.events.push(
        midiMessage('runningMidiMessage', packet_info.timestamp, packet_info.midiStatus, midiOne, midiTwo)
      )
      return packet_info
    }

    function parseFullMidiMessage(packet_info) {
      // timestamp
      packet_info.timestampLow = convTimestampLow(packet_info.packet[packet_info.index++])
      packet_info.timestamp = convTimestamp(packet_info.timestampHigh, packet_info.timestampLow)
      // status
      packet_info.midiStatus = packet_info.packet[packet_info.index++]
      const midiOne = packet_info.packet[packet_info.index++]
      const midiTwo = packet_info.packet[packet_info.index++]
      packet_info.events.push(
        midiMessage('fullMidiMessage', packet_info.timestamp, packet_info.midiStatus, midiOne, midiTwo)
      )
      return packet_info
    }

    function parseSysex(packet_info, isStart) {
      let isEnd = false
      if (isStart) {
        packet_info.index += 2
      }
      let data = packet_info.packet.slice(packet_info.index)
      const len = data.length
      if (len >= 2 && isBitOn(data[len - 2], 7) && data[len - 1] === this.SYSMSG.SYSEX_END) {
        isEnd = true
        data = data.slice(0, len - 2)
      }
      if (isStart) data.unshift(this.SYSMSG.SYSEX_START)
      if (isEnd) data.push(this.SYSMSG.SYSEX_END)
      packet_info.events.push(midiMessageSysEx(isStart, isEnd, data))
      //packet_info.index = Number.MAX_SAFE_INTEGER
      packet_info.index = data.length + 2
      return packet_info
    }

    function isBitOn(byte, num) {
      return (byte & (1 << Number(num) )) > 0
      //return (byte & Math.pow(2, num)) > 0
    }

    function convTimestampHigh(byte) {
      //return 0x3f & byte
      return 0b111111 & byte
    }
    function convTimestampLow(byte) {
      //return 0x7f & byte
      return 0b1111111 & byte
    }

    function convTimestamp(high, low) {
      //return ((high-0x80)<<7) + low-0x80
      return ((high-0b10000000)<<7) + low-0b10000000
    }
    function packetInfo(packet) {
      const header = packet[0]
      return {
        packet: packet,
        events: [],
        isHeaderValid: isBitOn(header, 7),
        index: 1,
        timestampHigh: convTimestampHigh(header),
        timestampLow: -1,
        timestamp: -1,
        midiStatus: -1
      }
    }
  }
  // ^^^^ BLE MIDI PACKET PARSER ^^^^ ////////////////////////////////


}

