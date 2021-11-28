"use strict";

import { listMIDIDevices } from './midiconnection.js';
import { sysex_cmd, sysex_cfg } from './ewi4000sconst.js';
import { patchSysExStructure } from './ewi4000ssysexstructure.js'

export class EWI4000sDriver {
  constructor(in_options = {sysex: false}) {
    this.patchSysExStructure = patchSysExStructure
    this.device = {
      input: {},
      output: {}
    }
    this.storedPatchList = new Array(sysex_cfg.EWI_NUM_PATCHES)
    this.editPatchList = new Array(sysex_cfg.EWI_NUM_PATCHES)
  }

  async _sleep(msec=0) {
    new Promise(resolve => setTimeout(resolve, msec))
  }

  setOneEditPatchFromStoredPatch(patchNo=-1) {
    if (patchNo < 0 || patchNo > sysex_cfg.EWI_NUM_PATCHES) {
      const msg = `[Patch No is out of limit] ${patchNo}`
      console.log(msg)
      throw new Error(msg)
    }
    if (typeof this.editPatchList[patchNo] == 'undefined') {
      this.editPatchList[patchNo] = { decoded: null }
    }
    this.editPatchList[patchNo]['decoded'] = this.storedPatchList[patchNo].decoded
    return this.editPatchList[patchNo]
  }

  getOneEditPatch(patchNo=-1) {
    return this.editPatchList[patchNo]
  }
  /**
   *
   * Type of newVal must be Uint8Array
   *
   **/
  updateOneEditPatch(patchNo=-1, paramName='', newVal=[]) {
    if (patchNo < 0 || patchNo > sysex_cfg.EWI_NUM_PATCHES
        || paramName==''
        || newVal.length < 1) {
      const msg = `[Param is wrong format] patchNo=[${patchNo}] paramName=[${paramName}] newVal=[${newVal}]`
      console.log(msg)
      throw new Error(msg)
    }
    if( !(newVal instanceof Uint8Array) ) {
      let tmp_newVal = null
      if (["string","number"].includes(typeof newVal)) {
        tmp_newVal = new Uint8Array(1)
        tmp_newVal[0] = typeof newVal == 'string' ? Number(newVal) : newVal
      } else {
        tmp_newVal = new Uint8Array(newVal.length)
        newVal.forEach( (oneHex, idx) => {
          tmp_newVal[idx] = typeof oneHex == 'string' ? Number(oneHex) : oneHex
        })
      }
      newVal = tmp_newVal
    }
    this.editPatchList[patchNo]['decoded'][paramName] = newVal
    return this.editPatchList[patchNo]
  }

  getMidiDevice() {
    return this.device
  }

  setOneStoredPatch(patchNo=-1, hexPatch={}, decodedPatch={}) {
    this.storedPatchList[patchNo] = {
      hex: hexPatch,
      decoded: decodedPatch
    }
    return this.storedPatchList[patchNo]
  }

  getOneStoredPatch(patchNo=-1) {
    return this.storedPatchList[patchNo]
  }

  setMidiDevice(type=null, device={}) {
    if (type != 'input' && type != 'output') {
      const msg = `[setMidiDevice] type=[${type}] device=[${device}]`
      console.error(msg)
      throw new Error(msg)
    }
    this.device[type] = device
  }

  // ewi 4000s specific //
  async requestDeviceId() {
    const reqMsg = []
    reqMsg.push(sysex_cmd.MIDI_SYSEX_HEADER)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_NONREALTIME)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_ALLCHANNELS)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_GEN_INFO)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_ID_REQ)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_TRAILER)

    this.device.input.onmidimessage = (event) => {
      let msg = []
      if (event.data[0]!=0xe0) {
        event.data.forEach(data => {
          msg.push(`${('00' + data.toString(16)).substr(-2)}`)
        })
        console.log(msg)
        console.log(this.isAkaiEwi4ks(event.data))
      }
    }

    console.log(reqMsg.join(' '))
    console.log(this.device.output)
    this.device.output.send(reqMsg)
    await this._sleep(sysex_cfg.MIDI_TIMEOUT_MS)
  }

  isAkaiEwi4ks(message = []) {
    let isAkaiEwi4ks = false
    if (message[0] == sysex_cmd.MIDI_SYSEX_HEADER
        && message[1] == sysex_cmd.MIDI_SYSEX_NONREALTIME
        && message[5] == sysex_cmd.MIDI_SYSEX_AKAI_ID
        && message[6] == sysex_cmd.MIDI_SYSEX_AKAI_EWI4K
        && message.length == sysex_cfg.EWI_SYSEX_ID_RESPONSE_LEN ) {
      isAkaiEwi4ks = true
    }
    return isAkaiEwi4ks
  }

  /**
   * !!! WATCH !!!
   * Internal Patch No and No on display is differ.
   * User Display  Internal Number
   *   0              99
   *   1               0
   *   2               1
   *         ...
   *  98              97
   *  99              98
   *
   */
  convertPatchNumToInternal(patchNo = -1) {
    patchNo = parseInt(patchNo)
    if (patchNo < 0 || patchNo > sysex_cfg.EWI_NUM_PATCHES) {
      console.error(`[Patch No is out of limit] ${patchNo}`)
      return -1
    }
    let ret_internal = -1
    if (patchNo == 0) {
      ret_internal = 99
    } else {
      ret_internal = patchNo - 1
    }
    return Number(ret_internal)
  }

  sendChannelMessage(message = []) {
    let uint8arr = message
    if (message instanceof Uint8Array != true) {
      uint8arr = new Uint8Array(message)
    }
    this.device.output.send(uint8arr)
  }

  // mode ={'store', 'edit'}
  async sendOnePatch(encodedPatch=[], onMidiMessage = () => {}) {
    const mode = 'store' // hard code /* not sure waht mode='edit' does */
    if (encodedPatch.length!=206 || !(encodedPatch instanceof Uint8Array)) {
      const msg = `[sendOnePatch] encodedPatch has wrong format. mode=[${mode}] encodedPatch=[${encodedPatch}]`
      console.log(msg)
      throw new Error(msg)
    }
    //const modeHex = mode == 'store' ? 0x00 : 0x20
    const modeHex =0x20
    encodedPatch[4] = modeHex
    this.device.input.onmidimessage = onMidiMessage
    let uint8arr
    if (encodedPatch instanceof Uint8Array) {
      uint8arr = encodedPatch
    } else {
      uint8arr = new Uint8Array(encodedPatch)
    }

    const color = {
      red: '\u001b[31m',
      green: '\u001b[32m'
    }
    // set to CHANNEL to 0x00
    uint8arr[3] = sysex_cfg.MIDI_SYSEX_CHANNEL

    // set MODE; store: 0x00, edit: 0x20
    //const modeHex = mode == 'store' ? sysex_cmd.MIDI_SYSEX_MODE_EWI_STORE : sysex_cmd.MIDI_SYSEX_MODE_EWI_EDIT
    uint8arr[4] = sysex_cmd.MIDI_SYSEX_MODE_EWI_STORE

    encodedPatch.forEach( (item, idx) => {
      console.log(`${color.green}idx=[${idx}] paramName=[${this.patchSysExStructure.getNameByByteIdx(idx)}] value=[${('00'+item.toString(16)).substr(-2)}]`)
    })
    console.log(`[sendOnePatch] encodedPatch instanceof Uint8Array=[${encodedPatch instanceof Uint8Array}]`)
    this.device.output.send(uint8arr)
    console.log(`[Patch sent] mode=[${mode}] patch=[${uint8arr}]`)
    await this._sleep(sysex_cfg.MIDI_TIMEOUT_MS)

    if (encodedPatch[4]==0x20) {
      uint8arr[5] = 0x00
      this.device.output.send(uint8arr)
    }

    //this.device.output.send(encodedPatch)
    //console.log(`[Patch sent] ${encodedPatch} - mode=[${mode}]`)
    //await this._sleep(sysex_cfg.MIDI_TIMEOUT_MS)
  }

  getMsgFetchOnePatch(patchNo = -1) {
    patchNo=parseInt(patchNo)
    if (patchNo < 0 ) {
      const msg = `[fetchOnePatch] patchNo must be 0 or larger. patchNo=[${patchNo}]`
      console.log(msg)
      throw new Error(msg)
    }
    const reqMsg = []
    reqMsg.push(sysex_cmd.MIDI_SYSEX_HEADER)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_AKAI_ID)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_AKAI_EWI4K)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_CHANNEL)
    reqMsg.push(sysex_cmd.MIDI_PRESET_DUMP_REQ)
    reqMsg.push(this.convertPatchNumToInternal(patchNo))
    reqMsg.push(sysex_cmd.MIDI_SYSEX_TRAILER)

    return reqMsg
  }

  async fetchOnePatch(patchNo = -1, onMidiMessage = () => {}) {
    patchNo=parseInt(patchNo)
    if (patchNo < 0 ) {
      const msg = `[fetchOnePatch] patchNo must be 0 or larger. patchNo=[${patchNo}]`
      console.log(msg)
      throw new Error(msg)
    }
    // [0xf0, 0x47, 0x64, 0x00, 0x40, 0xXX, 0xf7]
    const reqMsg = []
    reqMsg.push(sysex_cmd.MIDI_SYSEX_HEADER)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_AKAI_ID)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_AKAI_EWI4K)
    reqMsg.push(sysex_cmd.MIDI_SYSEX_CHANNEL)
    reqMsg.push(sysex_cmd.MIDI_PRESET_DUMP_REQ)
    reqMsg.push(this.convertPatchNumToInternal(patchNo))
    reqMsg.push(sysex_cmd.MIDI_SYSEX_TRAILER)

    this.device.input.onmidimessage = (event) => {
      let msg = []
      if (event.data[0]!=0xe0) {
        const decodedPatch = this.decodeOnePatch(event.data)
        this.setOneStoredPatch(patchNo, event.data, decodedPatch)
      }
      onMidiMessage(event)
    }

    console.log(reqMsg.join(' '))
    console.log(this.device.output)
    this.device.output.send(reqMsg)
    await this._sleep(sysex_cfg.MIDI_TIMEOUT_MS)
  }

  decodeOnePatch(patchHex = []) {
    console.log(`patchHexLength=[${patchHex.length}]`)
    // [TODO] to check length of HEX
    if (patchHex.length < 1) {
      const msg = `[Invalid PatchData] patchHex=[${patchHex.join(' ')}]`
      console.log(msg)
      throw new Error(msg)
    }
    let decodedPatch = {}
    this.patchSysExStructure.structure.forEach( item => {
      decodedPatch[item.name] = patchHex.slice().slice(item.startIdx, Number(item.startIdx)+Number(item.bytes))
    })
    decodedPatch.patchNameDecoded = this.decodePatchName(decodedPatch.patchName).join('')
    decodedPatch.osc1Decoded = this.decodeOSC(decodedPatch.osc1)
    decodedPatch.osc2Decoded = this.decodeOSC(decodedPatch.osc2)
    decodedPatch.oscFilter1Decoded = this.decodeFilter(decodedPatch.oscFilter1)
    decodedPatch.oscFilter2Decoded = this.decodeFilter(decodedPatch.oscFilter2)
    decodedPatch.noiseFilter1Decoded = this.decodeFilter(decodedPatch.noiseFilter1)
    decodedPatch.noiseFilter2Decoded = this.decodeFilter(decodedPatch.noiseFilter2)
    decodedPatch.antiAliasNRPNDecoded = this.docodeNrpn(decodedPatch.antiAliasNRPN)
    decodedPatch.noiseNRPNDecoded = this.docodeNrpn(decodedPatch.noiseNRPN)
    decodedPatch.miscNRPNDecoded = this.docodeNrpn(decodedPatch.miscNRPN)
    decodedPatch.ampNRPNDecoded = this.docodeNrpn(decodedPatch.ampNRPN)
    decodedPatch.chorusNRPNDecoded = this.docodeNrpn(decodedPatch.chorusNRPN)
    decodedPatch.delayNRPNDecoded = this.docodeNrpn(decodedPatch.delayNRPN)
    decodedPatch.reverbNRPNDecoded = this.docodeNrpn(decodedPatch.reverbNRPN)

    return decodedPatch
  }

  encodePatchName(patchNameString='') {
    if (patchNameString=='') {
      const msg = `[Invalid PatchName] patchNameString=[${patchNameString}]`
      console.log(msg)
      throw new Error(msg)
    }
    let patchNameEncoded = new Uint8Array(sysex_cfg.EWI_PATCHNAME_LENGTH)
    for (let i=0; i<sysex_cfg.EWI_PATCHNAME_LENGTH; i++) {
      let codeIdx = patchNameString.charCodeAt(i)
      if (isNaN(codeIdx)) {
        codeIdx = " ".charCodeAt(0)
      }
      patchNameEncoded[i] = codeIdx
    }
    return patchNameEncoded
  }

  decodePatchName(patchNameHex=[]) {
    console.log(`>>> raw=${patchNameHex.join(' ')}, length=${patchNameHex.length}`)
    if (patchNameHex.length < 1) {
      const msg = `[Invalid PatchName] patchNameHex=[${patchNameHex.join(' ')}]`
      console.log(msg)
      throw new Error(msg)
    }
    let arr_str_patchName = []
    patchNameHex.forEach( charIdx => {
      arr_str_patchName.push(String.fromCharCode(charIdx))
    })
    return arr_str_patchName
  }

  docodeNrpn(nrpnHex=[]) {
    // [TODO] to check length of HEX
    if (nrpnHex.length < 1) {
      const msg = `[Invalid nrpnHex] nrpnHex=[${nrpnHex.join(' ')}]`
      console.log(msg)
      throw new Error(msg)
    }
    const nrpn = {lsb: nrpnHex[0], msb: nrpnHex[1], offset: nrpnHex[2]}
    return nrpn
  }
  decodeOSC(oscHex=[]) {
    // [TODO] to check length of HEX
    if (oscHex.length < 1) {
      const msg = `[Invalid oscHex] oscHex=[${oscHex.join(' ')}]`
      console.log(msg)
      throw new Error(msg)
    }
    console.log('>>>> ', oscHex, oscHex[18], oscHex[19])
    const decodedOsc = {
      nrpn: this.docodeNrpn(oscHex.slice().slice(0, 3)),
      //nrpn: {lsb: oscHex[0], msb: oscHex[1], offset: oscHex[2]},
      octave: oscHex[3],
      semitone: oscHex[4],
      fine: oscHex[5],
      beat: oscHex[6],
      filler1: oscHex[7],
      sawtooth: oscHex[8],
      triangle: oscHex[9],
      square: oscHex[10],
      pulseWidth: oscHex[11],
      pwmFreq: oscHex[12],
      pwmDepth: oscHex[13],
      sweepDepth: oscHex[14],
      sweepTime: oscHex[15],
      breathDepth: oscHex[16],
      breathAttain: oscHex[17],
      breathCurve: oscHex[18],
      breathThreshold: oscHex[19],
      level: oscHex[20],
    }
    return decodedOsc
  }

  decodeFilter(filterHex=[]) {
    // [TODO] to check length of HEX
    if (filterHex.length < 1) {
      const msg = `[Invalid filterHex] filterHex=[${filterHex.join(' ')}]`
      console.log(msg)
      throw new Error(msg)
    }
    const decodedFilter = {
      //nrpn: {lsb: filterHex[0], msb: filterHex[1], offset: filterHex[2]},
      nrpn: this.docodeNrpn(filterHex.slice().slice(0, 3)),
      mode: filterHex[3],
      freq: filterHex[4],
      q: filterHex[5],
      keyFollow: filterHex[6],
      breathMod: filterHex[7],
      lfoFreq: filterHex[8],
      lfoDepth: filterHex[9],
      lfoBreath: filterHex[10],
      lfoThreshold: filterHex[11],
      sweepDepth: filterHex[12],
      sweepTime: filterHex[13],
      breathCurve: filterHex[14],
    }
    return decodedFilter
  }

  encodeOnePatch(decodedPatch={}) {
    console.log(decodedPatch)
    if (Object.keys(decodedPatch).length < 1 ) {
      const msg = `[Invalid decodedPatch] decodedPatch=[${Object.keys(decodedPatch)}] length=[${Object.keys(decodedPatch).length}]`
      console.log(msg)
      throw new Error(msg)
    }
    let encodedPatch = new Uint8Array(206)
    let idx = 0
    encodedPatch.concat = (item) => {
      if (typeof item == 'number') {
        encodedPatch[idx] = item
        idx += 1
      } else {
        for (let i=0; i<item.length; i++) {
          encodedPatch[idx] = item[i]
          idx += 1
        }
      }
    }
    this.patchSysExStructure.getStructureKeys().forEach( idxName => {
      encodedPatch.concat(decodedPatch[idxName])
    })
    //console.log(encodedPatch.length, encodedPatch)
    return encodedPatch
  }

}



