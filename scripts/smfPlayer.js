/**
 *  Copyright (c) 2010, Matt Westcott & Ben Firshman
 *  Copyright (c) 2021, 2014 Ryoya KAWAI
 *
 *  See LICENSE for more information.
 *
 * forked from https://github.com/gasman/jasmid
 *
 **/
"use strict";

import { console_log_midi } from './consoleLogMidi.js'
console.log_midi = console_log_midi;

export class SmfPlayer {
  constructor(output={send: () => { console.error('[MIDI OUTPUT NOT SET]')}}) {
    this.debugMode = false
    this.mOut = output
    this.nsx1Mode = false
    this.timeManagementMode = 'absolute'
    this.rsrv = []
    this.chInfo = {
      on: new Array(16).fill(true)
    }
    this.eventNo = new Array(16).fill(0)
  }

  //init(midiFile, latency=0, eventNo) {
  init(midiFile, latency=0) {
    this.midiFile = midiFile
    this.latency = latency
    this.timePosition = 0

    this.trackStates = []
    this.tempo = 120
    this.beatsPerMinute = 120
    this.ticksPerBeat = this.midiFile.header.ticksPerBeat
    this.channelCount = 16
    this.timerId = 0
    this.deltaTiming = 0 // ticksToEvent
    this.nextEventInfo = {}
    this.samplesToNextEvent = 0
    this.finished = false
    this.nowPlaying = false

    this.eventTime = 0
    this.startTime = 0
    this.interval = 0
    this.eventNo = new Array(16).fill(0)

    this.forwading = false
    this.duration = 0
    this._handlingEvents = false
    this.posMoving = false
    this.promiseSendMode = false

    this.arr_msgs = []

    this.allEventCount = 0
    for (let i=0; i<this.midiFile.tracks.length; i++) {
      this.allEventCount += this.midiFile.tracks[i].length
    }
    console.log(this)
    this.getFirstEvent()
  }

  async sleep(msec=0) {
    return new Promise(resolve => setTimeout(resolve, msec))
  }
  getStartTime() {
    return this.startTime
  }
  getEventNo() {
    return this.eventNo
  }
  setDebugMode(mode=false) {
    if (typeof mode== 'boolean') {
      this.debugMode = mode
    }
  }
  setPromiseSendMode(mode=false) {
    if (typeof mode== 'boolean') {
      this.promiseSendMode = mode
    }
  }
  // {'absolute', 'relative'}
  setTimeManagementMode(mode='absolute') {
    if ((['absolute', 'relative']).includes(mode)) {
      this.timeManagementMode = mode
    } else {
      this.timeManagementMode = 'absolute'
      console.log(`[setTimeManagementMode()] SET TO 'absolute' SINCE WRONG MODE WAS PASSED. mode=[${mode}]`)
    }
  }
  setMidiOutput(midiOut = {send: () => { console.error('[MIDI OUTPUT NOT SET]')}}) {
    this.mOut = midiOut
  }
  // { 0: value, 3: value, .... }
  async setChInfo(values=[], type='on') {
    switch(type) {
      case 'on':
        for (let i=0; i<this.chInfo.on.length; i++) {
          const idx = i
          const val = this.chInfo.on[i]
          if (this.chInfo.on[idx] != values[idx] && values[idx] == false) {
            await this.allSoundOffCh(idx)
            setTimeout( async () => {
              await this.allSoundOffCh(idx)
            }, this.latency+20)
          }
          this.chInfo.on[idx] = values[idx]
        }
        break
      default:
        break
    }
  }
  async moveEvent(type) {
    const orgNowPlaying = this.nowPlaying
    this.stopPlayOnly()
    this.allSoundOff()
    this._allSoundOffLatency()
    let sumDeltaTime = 0
    let targetTime = 0
    const delta =  4000 * this.tempo / 120
    switch(type) {
      case 'eventNo':
        break
      case 'forward':
        targetTime = this.timePosition + delta
        while (targetTime > this.timePosition) {
          const nextEventInfo = this._getNextEventInfo()
          sumDeltaTime += nextEventInfo.event.deltaTime
          await this.processEvent(nextEventInfo, false)
          this.moveToNextEvent()
        }
        this.setStartTime()
        await this.sleep(100)
        break
      case 'rewind':
        targetTime = this.timePosition - delta
        this.getFirstEvent()
        while(targetTime > this.timePosition) {
          const nextEventInfo = this._getNextEventInfo()
          sumDeltaTime += nextEventInfo.event.deltaTime
          await this.processEvent(nextEventInfo, false)
          this.moveToNextEvent()
        }
        this.setStartTime()
        await this.sleep(100)
        break
      case 'begining':
        this.getFirstEvent()
        break
    }
    if (orgNowPlaying) {
      this.changeFinished(false)
      this.startPlay()
    }
  }

  getFirstEvent() {
    this.eventNo = new Array(16).fill(0)
    this.timePosition = 0
    for (let i = 0; i < this.midiFile.tracks.length; i++) {
      this.trackStates[i] = {
        'nextEventIndex': 0,
        'ticksToNextEvent': (
          this.midiFile.tracks[i].length ?
          this.midiFile.tracks[i][0].deltaTime :
          null
        )
      }
    }
    this.moveToNextEvent()
  }

  moveToNextEvent() {
    this._moveToEvent()
  }

  _moveToEvent() {
    let next = { ticksToEvent: null, eventTrack: null, eventIndex: null }
    for (let i = 0; i < this.trackStates.length; i++) {
      if ( this.trackStates[i].ticksToNextEvent != null
        && (next.ticksToEvent == null || this.trackStates[i].ticksToNextEvent < next.ticksToEvent)
      ) {
        next = {
          ticksToEvent: this.trackStates[i].ticksToNextEvent,
          eventTrack: i,
          eventIndex: this.trackStates[i].nextEventIndex
        }
      }
    }

    if (next.eventTrack != null) {
      // consume event from that track
      const nextEvent = this.midiFile.tracks[next.eventTrack][next.eventIndex]
      if (this.midiFile.tracks[next.eventTrack][next.eventIndex + 1]) {
        this.trackStates[next.eventTrack].ticksToNextEvent += this.midiFile.tracks[next.eventTrack][next.eventIndex + 1].deltaTime
      } else {
        this.trackStates[next.eventTrack].ticksToNextEvent = null
      }
      this.trackStates[next.eventTrack].nextEventIndex += 1
      // advance timings on all tracks by ticksToNextEvent
      for (let i = 0; i < this.trackStates.length; i++) {
        if (this.trackStates[i].ticksToNextEvent != null) {
          this.trackStates[i].ticksToNextEvent -= next.ticksToEvent
        }
      }

      this.nextEventInfo = {
        ticksToEvent: next.ticksToEvent,
        track: next.eventTrack,
        event: nextEvent,
        eventIdx: next.eventIndex
      }
      let beatsToNextEvent = next.ticksToEvent / this.ticksPerBeat
      let secondsToNextEvent = beatsToNextEvent / (this.beatsPerMinute / 60)
    } else {
      this.nextEventInfo=null
      this.samplesToNextEvent=null
      this.finished=true
    }
  }

  processEvent(eventInfo={}, withTime = true) {
    return new Promise( async (resolve) => {
      if (Object.keys(eventInfo)<1) return
      this.timePosition += eventInfo.event.deltaTime
      this.eventNo[eventInfo.track] = eventInfo.eventIdx
      const event = eventInfo.event
      switch(event.type) {
        case 'meta':
          if (event.subtype == 'setTempo') {
            this.tempo = ~~(60000000/event.microsecondsPerBeat)
            console.info('[Change Tempo] ', this.tempo)
            console.info('[Change Interval] ', (event.microsecondsPerBeat/1000)/this.ticksPerBeat, event.microsecondsPerBeat)
            this.interval = (event.microsecondsPerBeat/1000)/this.ticksPerBeat
            clearTimeout(this.timerId)
            if (this.finished==false) {
              this.startPlay()
            }
          } else {
            console.info(`[meta] ${event.subtype} : ${event.text} : ${event.key} : ${event.scale} : ${this.eventTime}`)
          }
          break
        case 'channel':
        case 'sysEx':
        case 'dividedSysEx':
          let sendFl = true
          if (event.type=='sysEx') {
            let gsSysEx=[0xF0, 0x41, 0x10, 0x42, 0x12]
            if (event.raw.slice(0, gsSysEx.length).join(' ')==gsSysEx.join(' ')) {
              sendFl = false
              const out=[]
              for(let i=0, msg=event.raw; i<msg.length; i++) out.push( ('00' + msg[i].toString(16)).substr(-2) )
              console.info('[Skip GS SYSEX] ', out.join(' '))
            }
          }

          // for dividedSysEx
          if (event.type=='sysEx') {
            if (event.raw[0]==0xf0 && event.raw[event.raw.length-1]!=0xf7) {
              this.rsrv=event.raw
              sendFl=false
            }
          }
          if (event.type=='dividedSysEx') {
            event.raw.shift()
            console.log(event.raw, this.rsrv)
            Array.prototype.push.apply(this.rsrv, event.raw)
            if (this.rsrv[this.rsrv.length-1]==0xf7) {
              event.raw=this.rsrv
              this.rsrv=[]
            } else {
              sendFl=false
            }
          }
          if (sendFl===true) {
            const chStripStetus = (event.raw[0] >> 4) << 4
            if (withTime) {
              await this._sendToDevice(event.raw)
            } else {
              if ([0xb0, 0xc0, 0xe0].includes(chStripStetus)) {
                this.mOut.send(event.raw)
              }
            }
          }
          break
      }
      resolve()
    })
  }

  _getNextEventInfo() {
    return this.nextEventInfo
  }

  async _handleEvent() {
    // add absolite timestamp, and send msaage a little bit faster
    let rightNow=window.performance.now()
    if ((this.startTime+this.eventTime)<=rightNow) { // latency
      if (this.finished==true)  {
        this.allSoundOff()
        return
      }
      const nextEventInfo = this._getNextEventInfo()
      const event = nextEventInfo.event
      this.deltaTiming = nextEventInfo.ticksToEvent
      this.eventTime += this.deltaTiming * this.interval

      //this.processEvent(event, true)
      await this.processEvent(nextEventInfo, true)
      this.moveToNextEvent()

      if (nextEventInfo!=null) {
        const nEvent = nextEventInfo.event
        // Recursion
        if (nEvent.deltaTime==0 && this.finished===false) {
          clearInterval(this.timerId)
          this._handleEvent.bind(this)()
        }
        if (this.finished==false) {
          this.startPlay()
        }
      }
    }
  }

  async _sendToDevice(msg, timeDelta=0) {
    if (this.posMoving==true) {
      return
    }

    this.dispEventMonitor(msg, null, this.latency)
    const chStripStetus = (msg[0] >> 4) << 4
    if (chStripStetus==0x80 || chStripStetus==0x90) {
      const ch = msg[0] - chStripStetus
      if (!this.chInfo.on[ch]) {
        return
      }
    }
    console.log(msg)
    if (this.debugMode) console.log_midi(msg, 'midi', ' [smfPlayer.js] ', true)
    if (this.timeManagementMode=='absolute') {
      if (this.promiseSendMode) {
        await this.mOut.send(msg, this.startTime + this.eventTime + this.latency)
        //await this.mOut.send(this.arr_msgs, this.startTime + this.eventTime + this.latency)
      } else {
        //this.mOut.send(msg, this.startTime + this.eventTime + this.latency)
        this.mOut.send(msg)
        console.log(msg)
      }
    } else
    if (this.timeManagementMode=='relative') {
      if (timeDelta!=0) timeDelta = this.deltaTiming * this.interval
      if (this.promiseSendMode) {
        if (this.nextEventInfo.ticksToEvent==0) {
          this.arr_msgs.push(msg)
        } else {
          this.arr_msgs.push(msg)
          try {
            await this.mOut.send(this.arr_msgs, timeDelta + this.latency)
          } catch(e) {
            console.log(e)
          }
          this.arr_msgs=[]
        }
      } else {
        this.mOut.send(msg, timeDelta + this.latency)
      }
    }
  }

  startPlay () {
    if (typeof this.midiFile == 'undefined') {
      console.log('[ERROR] MIDI FILE IS NOT SET YET')
      return
    }
    if (this.startTime==0) {
      this.setStartTime()
      this.setGM()
    }
    clearInterval(this.timerId)
    if (this.startTime==0) {
      this.setStartTime()
      this.setGM()
    }
    if (this.finished==false) {
      const self = this
      this.nowPlaying=true
      this.timerId = setInterval( async function() {
        await self._handleEvent.bind(self)()
        if (self.finished==true) {
          clearInterval(self.timerId)
          self.stopPlay.bind(self)()
        }
      }, this.interval )
    }
    /*
    const self = this
    play()
    async function play() {
      for await (let idx of [...Array(self.allEventCount).keys()]) {
        await self._handleEvent.bind(self)()
        await self.sleep(self.interval / 1000)
      }
    }
    */
    return this.startTime
  }

  _startPlay () {
    if (typeof this.midiFile == 'undefined') {
      console.log('[ERROR] MIDI FILE IS NOT SET YET')
      return
    }
    clearInterval(this.timerId)
    if (this.startTime==0) {
      this.setStartTime()
      this.setGM()
    }
    if (this.finished==false) {
      let self=this
      this.nowPlaying=true
      this.timerId=setInterval( async function() {
        await self._handleEvent.bind(self)()
        if (self.finished==true) {
          clearInterval(self.timerId)
          self.stopPlay.bind(self)()
        }
      }, this.interval )
    }
    return this.startTime
  }
  _allSoundOffLatency() {
    setTimeout( () => {
      this.allSoundOff()
    }, this.latency+5)
  }
  pausePlay() {
    this.nowPlaying=false
    clearInterval(this.timerId)
    this._allSoundOffLatency()
  }

  stopPlayOnly() {
    this.nowPlaying=false
    clearInterval(this.timerId)
    this.eventNo = new Array(16).fill(0)
    this._allSoundOffLatency()
  }

  stopPlay() {
    this.stopPlayOnly()
    this.changeUiStop()
    this._allSoundOffLatency()
  }

  changeUiStop() {
  }

  dispEventMonitor(msg, type, latency) {
  }

  changeFinished(status) {
    this.finished=status
    clearInterval(this.timerId)
  }

  async changeMasterVolume(vol=102) {
    if (vol>127) vol = 127
    if (vol<0) vol = 0

    const msg = [
      0xf0, 0x7F, 0x7F, 0x04, 0x01,
      0x00, vol,
      0xF7
    ]
    await this._sendToDevice(msg, 0)
  }

  setStartTime () {
    this.startTime=window.performance.now()
    this.eventTime=0
    console.log("[setStartTime]", this.startTime)
  }

  async allSoundOffCh (ch = null) {
    if (ch==null) return
    const msg = [0xb0 + ch, 0x78, 0x00]
    await this._sendToDevice(msg, Math.ceil(Math.pow(ch, 2)/2))
    //await this._sendToDevice(msg, 20)
  }

  async allSoundOff (only_send_ch = []) {
    for(let ch=0; ch<16; ch++) {
      await this.allSoundOffCh(ch)
    }
  }

  async revertPitchBend () {
    for(let i=0; i<16; i++) {
      //let fb="0xe"+i.toString(16)
      const fb = 0xe0 + i
      //await this._sendToDevice([fb, 0x00, 0x00], this.startTime+this.eventTime)
      await this._sendToDevice([fb, 0x00, 0x00], this.eventTime)
    }
  }

  async setGM () {
    console.log("[Set GM]")
    await this._sendToDevice([0xf0, 0x7e, 0x7f, 0x09, 0x01, 0xf7], 0) // GM System ON
  }

}

