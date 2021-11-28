"use strict";

import { listMIDIDevices } from './midiconnection.js';
import { SmfPlayer } from './smfPlayer.js'
import { SmfParser } from './smfParser.js'

( async () => {
  const requestMIDIAccessOption = {sysex: true}
  let targetPatch = {}
  let midiDevices = null

  /*
   *  SMF Player
   */
  // vv -- vv -- vv
  const smfPlayer = new SmfPlayer()
  const smfParser = new SmfParser()
  let arrSmfFileList = []
  const LATENCY = 500 // msec

  const inputSmfFileLoad = document.querySelector('input#loadsmffile')
  const divLoadSmfArea = document.querySelector('div#loadSmfArea')
  const smfPlay = document.querySelector('button#smfPlay')
  const smfPause = document.querySelector('button#smfPause')
  const smfStop = document.querySelector('button#smfStop')
  const smfPanic = document.querySelector('button#smfPanic')
  const smfForward = document.querySelector('button#smfForward')
  const smfRewind = document.querySelector('button#smfRewind')
  const smfMasterVolume = document.querySelector('input#smfMasterVolume')
  const smfMVFadeout = document.querySelector('button#smfMVFadeout')

  const tSynth = document.querySelector('webaudio-tinysynth#tinysynth')
  console.log(tSynth)

  let fadeoutInterval = 0

  const ch = new Array(16)
  for (let i=0; i<16; i++) {
    document.querySelector(`input#ch${i}`).addEventListener('change', (event) => {
      const values = new Array(16).fill(false)
      for (let j=0; j<16; j++) {
        const elem = document.querySelector(`input#ch${j}`)
        values[Number(elem.id.replace(/^ch/, ''))] = elem.checked
      }
      smfPlayer.setChInfo(values, 'on')
    })
  }
  smfForward.onmousedown = async () => {
    await smfPlayer.moveEvent('forward')
  }
  smfRewind.onmousedown = async () => {
    await smfPlayer.moveEvent('rewind')
  }
  smfPause.onmousedown = () => {
    const idx = 0
    smfPlayer.pausePlay()
  }
  smfMasterVolume.oninput = (event) => {
    smfPlayer.changeMasterVolume((parseInt(event.target.value)))
  }
  smfMVFadeout.onmousedown = () => {
    let fadeDuration = 8 // in sec
    let volume = smfMasterVolume.value
    const slope = volume / (fadeDuration/1.27)
    const timeFreq = 1000
    let timeNow = 0
    if (fadeoutInterval!=0) return
    fadeoutInterval = setInterval( async () => {
      timeNow += timeFreq
      //volume = parseInt(volume) + parseInt(slope * timeNow)
      volume = parseInt(volume) - parseInt(slope)
      smfMasterVolume.value = parseInt(volume)
      await smfPlayer.changeMasterVolume(smfMasterVolume.value)
      if (volume<=0) {
        setTimeout( async () => {
          smfPlayer.allSoundOff()
          smfPlayer.stopPlay()
          smfMasterVolume.value = 127
        }, timeFreq + 100)
        clearInterval(fadeoutInterval)
        fadeoutInterval = 0
      }
    }, timeFreq)
  }
  smfPanic.onmousedown = () => {
    smfPlayer.allSoundOff()
  }
  smfPlay.onmousedown = () => {
    const synthType =
      (document.querySelector('input#useExternalSynth').value=='on') ? 'external' : 'internal'
    tSynth.setSynthType(synthType)
    if (synthType=='external') {
      const outputIdx = document.querySelector('select#midiOutput').value
      let midiOutput = null
      midiDevices.outputs.forEach( port => {
        if (port.id == outputIdx) {
          midiOutput = port
        }
      })
      console.log(midiOutput)
      tSynth.setExternalDevice(midiOutput)
    }
    tSynth.playMIDI()
  }
  smfStop.onmousedown = () => {
    tSynth.stopMIDI()
  }
  inputSmfFileLoad.ondragover = () => {
    divLoadSmfArea.classList.add('file_hover')
  }
  inputSmfFileLoad.ondragend = () => {
    divLoadSmfArea.classList.remove('file_hover')
  }
  inputSmfFileLoad.ondragleave = () => {
    divLoadSmfArea.classList.remove('file_hover')
  }
  inputSmfFileLoad.onchange = function(event) {
    divLoadSmfArea.classList.remove('file_hover')
    fileLoad.bind(this)(event)
  }
  function fileLoad(event) {
    console.log(this.files)
    let file = {}
    if (this.files instanceof FileList) {
      file = this.files[0]
    } else {
      file = event.dataTransfer.files[0]
    }
    if (typeof file=="undefined") return
    event.dataTransfer = {files: this.files}
    tSynth.execDrop(event)
  }
  function _fileLoad(event) {
    let file = {}
    if (this.files instanceof FileList) {
      file = this.files[0]
    } else {
      file = event.dataTransfer.files[0]
    }
    if (typeof file=="undefined") return
    let reader = new FileReader()
    reader.onload = function (event) {
      const smfFile = {
        name:file.name,
        size:~~(file.size/1000),
        data: smfParser.parse(event.target.result),
        eventNo: 0
      }
      //arrSmfFileList.push(smfFile)
      smfPlayer.init(smfFile.data, LATENCY)
      smfMasterVolume.value = 127
      smfPlayer.changeMasterVolume(smfMasterVolume.value)
      arrSmfFileList[0] = smfFile
      console.log(arrSmfFileList)
    }
    reader.readAsBinaryString(file)
    event.preventDefault()
  }
  // ^^ -- ^^ -- ^^
  document.querySelector('button#listMIDIDevices01').addEventListener('mousedown', async (event) => {
    const options = { sysex: true }
    const ret_midi = await listMIDIDevices(requestMIDIAccessOption)

    if (ret_midi.success) {
      midiDevices = ret_midi.devices
      const inputSelect = document.querySelector('select#midiInput')
      if (inputSelect != null) {
        ret_midi.devices.inputs.forEach( port => {
          const option = new Option(port.name, port.id)
          inputSelect.appendChild(option)
        })
      }
      const outputSelect = document.querySelector('select#midiOutput')
      ret_midi.devices.outputs.forEach( port => {
        const option = new Option(port.name, port.id)
        outputSelect.appendChild(option)
      })
    }

  })

})()
