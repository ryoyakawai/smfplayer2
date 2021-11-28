"use strict";

import { listMIDIDevices } from './midiconnection.js';
import { EWI4000sDriver } from './ewi4000sdriver.js';
import { BLEMIDIUtils } from './blemidiutils.js';
import { SmfPlayer } from './smfPlayer.js'
import { SmfParser } from './smfParser.js'

import { samplePatches } from './samplePatches.const.js'

( async () => {
  const requestMIDIAccessOption = {sysex: true}
  const ewi4ks = new EWI4000sDriver()
  const ble = new BLEMIDIUtils()
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

  const sendToBle = document.querySelector('input#send_to_ble')

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
    if (midiDevices == null) return
    const outputIdx = document.querySelector('select#midiOutput').value
    let midiOutput = null
    midiDevices.outputs.forEach( port => {
      if (port.id == outputIdx) {
        midiOutput = port
      }
    })
    if (sendToBle.checked) {
      const chara = ble.getCharacteristic()
      midiOutput = chara.output
      console.log(chara, midiOutput)
    }
    /*
    const inputIdx = document.querySelector('select#midiInput').value
    let midiInput = null
    midiDevices.inputs.forEach( port => {
      if (port.id == inputIdx) {
        midiInput = port
      }
    })
    */
    if (midiOutput==null) {
      console.log('[ERROR] OUTPUT IS NOT SET YET')
      return // error
    } else {
      smfPlayer.setMidiOutput( midiOutput )
    }

    const idx = 0
    smfPlayer.setStartTime()
    if (arrSmfFileList.length > 0) {
      if (smfPlayer.getEventNo().reduce( (a, b) => a + b)==0) {
        smfPlayer.init(arrSmfFileList[idx].data, LATENCY)
      }
    }
    if (sendToBle.checked) {
      smfPlayer.setTimeManagementMode('relative')
      smfPlayer.setPromiseSendMode(true)
      smfPlayer.setDebugMode(false)
      ble.setDebugMode(true)
    }
    smfPlayer.setDebugMode(true)
    smfPlayer.startPlay()
  }
  smfStop.onmousedown = () => {
    const idx = 0
    smfPlayer.stopPlay()
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


  function sendMsg(arr_msg) {
    //const sendToBle = document.querySelector('input#send_to_ble').checked

    let sendTo = () => {}
    if (sendToBle.checked) {
      const chara = ble.getCharacteristic()
      chara.output.send(arr_msg)
    } else {
      arr_msg.forEach( msg => {
        console.log(msg)
        ewi4ks.sendChannelMessage(msg)
      })
    }
  }

  document.querySelector('webaudio-keyboard#keyboard-01').addEventListener('change', (event) => {
    const note = event.note[1]
    const midiStatus = event.note[0] == 1 ? 0x90 : 0x80
    const knobVal = document.querySelector('webaudio-knob#knob-01').value
    const messages = []
    messages.push([0xb0, 0x7b, 0x00]) // all note off
    if (midiStatus == 0x90) {
      messages.push([0x90, note, 0x40]) // always send velocity 0x40(64)
      messages.push([0xb0, 0x02, knobVal]) // Breath Ctrl
      messages.push([0xd0, knobVal]) // Pressure
    }
    sendMsg(messages)
  })
  document.querySelector('webaudio-knob#knob-01').addEventListener('change', (event) => {
    //console.log(event.target.value)
  })

  document.querySelector('input#ble_debug').addEventListener('change', (event) => {
    ble.setDebugMode(event.target.checked)
  })


  document.querySelector('button#listMIDIDevices01').addEventListener('mousedown', async (event) => {
    const options = { sysex: true }
    const ret_midi = await listMIDIDevices(requestMIDIAccessOption)

    if (ret_midi.success) {
      midiDevices = ret_midi.devices
      const inputSelect = document.querySelector('select#midiInput')
      ret_midi.devices.inputs.forEach( port => {
        const option = new Option(port.name, port.id)
        inputSelect.appendChild(option)
      })
      const outputSelect = document.querySelector('select#midiOutput')
      ret_midi.devices.outputs.forEach( port => {
        const option = new Option(port.name, port.id)
        outputSelect.appendChild(option)
      })
    }

    if (ret_midi.success) {
      ewi4ks.setMidiDevice('input', ret_midi.devices.inputs[0])
      ewi4ks.setMidiDevice('output', ret_midi.devices.outputs[0])
    } else {
      console.error(ewi4ks.error_msg)
    }
  })

  document.querySelector('button#reqDeviceId01').addEventListener('mousedown', async (event) => {
    ewi4ks.requestDeviceId()
  })

  document.querySelector('button#reqPatch01').addEventListener('mousedown', async (event) => {
    const patchNo = Number(event.target.previousSibling.value)
    const patchNameArea =  document.querySelector('input#patchName01')
    function onMidiMessage(event) {
      const patch = this.getOneStoredPatch(patchNo)
      patchNameArea.setAttribute('value', '')
      patchNameArea.value=patch.decoded.patchNameDecoded.replace(/ /g, '')
    }

    ewi4ks.fetchOnePatch(patchNo, onMidiMessage.bind(ewi4ks))

    //const patchName = "TAKARAJIMA                   "
    //const patchNameEncoded = ewi4ks.encodePatchName(patchName)
    //console.log('[ENCODED PATCHNAME]', ewi4ks.encodePatchName(patchName), patchNameEncoded.length)
  })

  /* force restore several patch */
  document.querySelector('button#restorePatch00').addEventListener('mousedown', () => {restorePatch(0)}, false)
  document.querySelector('button#restorePatch01').addEventListener('mousedown', () => {restorePatch(1)}, false)
  document.querySelector('button#restorePatch02').addEventListener('mousedown', () => {restorePatch(2)}, false)
  document.querySelector('button#restorePatch03').addEventListener('mousedown', () => {restorePatch(3)}, false)

  function restorePatch(idx=0) {

    /*
       const miyazaki5 = [
       240, 71, 100, 127, 0, 99, 69, 52, 107, 9, 38, 6, 77,
       105, 121, 97, 122, 97, 107, 105, 32, 53, 32, 32, 32,
       32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32,
       32, 32, 32, 32, 32, 64, 18, 0, 64, 64, 67, 64, 0, 123, 0,
       50, 57, 8, 0, 63, 25, 64, 0, 64, 6, 125, 65, 18, 0, 64, 64, 61,
       64, 0, 127, 55, 9, 15, 33, 7, 61, 75, 64, 0, 64, 14, 127, 72,
       12, 0, 0, 108, 12, 75, 33, 46, 0, 68, 6, 56, 26, 57, 73, 12, 0,
       0, 124, 25, 67, 17, 0, 0, 64, 0, 63, 0, 53, 74, 12, 0, 0, 107,
       25, 73, 108, 42, 0, 64, 76, 64, 15, 64, 75, 12, 0, 4, 36, 11,
       64, 0, 1, 0, 64, 0, 64, 0, 64, 79, 3, 0, 1, 76, 12, 80, 3, 0,
       46, 64, 1, 81, 10, 0, 2, 0, 127, 2, 2, 0, 1, 1, 127, 1, 88, 3,
       0, 0, 127, 1, 112, 9, 0, 72, 59, 105, 5, 70, 114, 48, 8, 127,
       113, 5, 0, 38, 44, 33, 50, 127, 114, 5, 0, 127, 105, 85, 22, 58, 247
       ]
     */

    const obj_patches = {
      miyazaki5:    {"0":240,"1":71,"2":100,"3":127,"4":0,"5":99,"6":69,"7":52,"8":107,"9":9,"10":38,"11":6,"12":77,"13":105,"14":121,"15":97,"16":122,"17":97,"18":107,"19":105,"20":32,"21":53,"22":32,"23":32,"24":32,"25":32,"26":32,"27":32,"28":32,"29":32,"30":32,"31":32,"32":32,"33":32,"34":32,"35":32,"36":32,"37":32,"38":32,"39":32,"40":32,"41":32,"42":32,"43":32,"44":64,"45":18,"46":0,"47":64,"48":64,"49":67,"50":64,"51":0,"52":123,"53":0,"54":50,"55":57,"56":8,"57":0,"58":63,"59":25,"60":64,"61":0,"62":64,"63":6,"64":127,"65":65,"66":18,"67":0,"68":64,"69":64,"70":61,"71":64,"72":0,"73":127,"74":55,"75":9,"76":15,"77":33,"78":7,"79":61,"80":75,"81":64,"82":0,"83":64,"84":14,"85":127,"86":72,"87":12,"88":0,"89":0,"90":108,"91":12,"92":75,"93":33,"94":46,"95":0,"96":68,"97":6,"98":56,"99":26,"100":57,"101":73,"102":12,"103":0,"104":0,"105":124,"106":25,"107":67,"108":17,"109":0,"110":0,"111":64,"112":0,"113":63,"114":0,"115":53,"116":74,"117":12,"118":0,"119":0,"120":107,"121":25,"122":73,"123":108,"124":42,"125":0,"126":64,"127":76,"128":64,"129":15,"130":64,"131":75,"132":12,"133":0,"134":4,"135":36,"136":11,"137":64,"138":0,"139":1,"140":0,"141":64,"142":0,"143":64,"144":0,"145":64,"146":79,"147":3,"148":0,"149":1,"150":76,"151":12,"152":80,"153":3,"154":0,"155":46,"156":64,"157":1,"158":81,"159":10,"160":0,"161":2,"162":0,"163":127,"164":2,"165":2,"166":0,"167":1,"168":1,"169":127,"170":1,"171":88,"172":3,"173":0,"174":0,"175":127,"176":1,"177":112,"178":9,"179":0,"180":72,"181":59,"182":105,"183":5,"184":70,"185":114,"186":48,"187":8,"188":127,"189":113,"190":5,"191":0,"192":38,"193":44,"194":33,"195":50,"196":127,"197":114,"198":5,"199":0,"200":127,"201":105,"202":85,"203":22,"204":58,"205":247},
      takarajima:   {"0":240,"1":71,"2":100,"3":127,"4":0,"5":0,"6":69,"7":52,"8":107,"9":9,"10":38,"11":6,"12":84,"13":65,"14":75,"15":65,"16":82,"17":65,"18":74,"19":73,"20":77,"21":65,"22":32,"23":32,"24":32,"25":32,"26":32,"27":32,"28":32,"29":32,"30":32,"31":32,"32":32,"33":32,"34":32,"35":32,"36":32,"37":32,"38":32,"39":32,"40":32,"41":32,"42":32,"43":32,"44":64,"45":18,"46":0,"47":64,"48":64,"49":64,"50":64,"51":0,"52":111,"53":127,"54":66,"55":21,"56":1,"57":0,"58":64,"59":0,"60":64,"61":0,"62":64,"63":0,"64":117,"65":65,"66":18,"67":0,"68":64,"69":64,"70":64,"71":64,"72":0,"73":127,"74":63,"75":63,"76":127,"77":84,"78":0,"79":64,"80":0,"81":64,"82":0,"83":64,"84":0,"85":8,"86":72,"87":12,"88":0,"89":0,"90":111,"91":5,"92":64,"93":86,"94":14,"95":8,"96":64,"97":0,"98":64,"99":0,"100":49,"101":73,"102":12,"103":0,"104":4,"105":38,"106":5,"107":88,"108":0,"109":1,"110":0,"111":64,"112":0,"113":64,"114":1,"115":64,"116":74,"117":12,"118":0,"119":0,"120":99,"121":11,"122":73,"123":108,"124":42,"125":0,"126":64,"127":76,"128":64,"129":15,"130":64,"131":75,"132":12,"133":0,"134":4,"135":36,"136":11,"137":64,"138":0,"139":1,"140":0,"141":64,"142":0,"143":64,"144":0,"145":64,"146":79,"147":3,"148":0,"149":1,"150":76,"151":12,"152":80,"153":3,"154":0,"155":0,"156":0,"157":0,"158":81,"159":10,"160":0,"161":2,"162":0,"163":127,"164":0,"165":0,"166":0,"167":0,"168":1,"169":127,"170":0,"171":88,"172":3,"173":0,"174":0,"175":114,"176":0,"177":112,"178":9,"179":0,"180":3,"181":59,"182":114,"183":5,"184":70,"185":114,"186":44,"187":15,"188":118,"189":113,"190":5,"191":0,"192":48,"193":44,"194":4,"195":0,"196":127,"197":114,"198":5,"199":0,"200":127,"201":127,"202":85,"203":36,"204":58,"205":247},
      madato_honda: {"0":240,"1":71,"2":100,"3":127,"4":0,"5":1,"6":69,"7":52,"8":107,"9":9,"10":38,"11":6,"12":77,"13":65,"14":83,"15":65,"16":84,"17":79,"18":95,"19":72,"20":79,"21":78,"22":68,"23":65,"24":32,"25":32,"26":32,"27":32,"28":32,"29":32,"30":32,"31":32,"32":32,"33":32,"34":32,"35":32,"36":32,"37":32,"38":32,"39":32,"40":32,"41":32,"42":32,"43":32,"44":64,"45":18,"46":0,"47":64,"48":64,"49":67,"50":64,"51":0,"52":113,"53":127,"54":50,"55":17,"56":0,"57":0,"58":64,"59":0,"60":64,"61":63,"62":64,"63":0,"64":127,"65":65,"66":18,"67":0,"68":64,"69":64,"70":60,"71":64,"72":0,"73":127,"74":65,"75":68,"76":11,"77":19,"78":87,"79":64,"80":68,"81":71,"82":97,"83":64,"84":0,"85":17,"86":72,"87":12,"88":0,"89":0,"90":111,"91":8,"92":68,"93":68,"94":13,"95":15,"96":64,"97":0,"98":64,"99":42,"100":55,"101":73,"102":12,"103":0,"104":4,"105":101,"106":90,"107":76,"108":127,"109":1,"110":0,"111":64,"112":0,"113":64,"114":44,"115":64,"116":74,"117":12,"118":0,"119":0,"120":99,"121":11,"122":73,"123":108,"124":77,"125":0,"126":64,"127":76,"128":64,"129":15,"130":64,"131":75,"132":12,"133":0,"134":4,"135":36,"136":11,"137":64,"138":0,"139":1,"140":0,"141":64,"142":0,"143":64,"144":0,"145":64,"146":79,"147":3,"148":0,"149":1,"150":76,"151":12,"152":80,"153":3,"154":0,"155":0,"156":0,"157":0,"158":81,"159":10,"160":0,"161":2,"162":0,"163":127,"164":0,"165":0,"166":0,"167":0,"168":0,"169":127,"170":0,"171":88,"172":3,"173":0,"174":0,"175":127,"176":0,"177":112,"178":9,"179":0,"180":3,"181":59,"182":114,"183":5,"184":70,"185":114,"186":44,"187":15,"188":118,"189":113,"190":5,"191":0,"192":48,"193":44,"194":4,"195":0,"196":127,"197":114,"198":5,"199":0,"200":127,"201":110,"202":85,"203":22,"204":58,"205":247},
      flute:        {"0":240,"1":71,"2":100,"3":127,"4":0,"5":3,"6":69,"7":52,"8":107,"9":9,"10":38,"11":6,"12":87,"13":111,"14":111,"15":100,"16":32,"17":87,"18":105,"19":110,"20":100,"21":32,"22":32,"23":32,"24":32,"25":32,"26":32,"27":32,"28":32,"29":32,"30":32,"31":32,"32":32,"33":32,"34":32,"35":32,"36":32,"37":32,"38":32,"39":32,"40":32,"41":32,"42":32,"43":32,"44":64,"45":18,"46":0,"47":64,"48":64,"49":64,"50":64,"51":0,"52":0,"53":0,"54":74,"55":0,"56":1,"57":53,"58":64,"59":28,"60":64,"61":0,"62":54,"63":0,"64":63,"65":65,"66":18,"67":0,"68":64,"69":64,"70":64,"71":63,"72":0,"73":0,"74":0,"75":59,"76":0,"77":22,"78":57,"79":64,"80":11,"81":64,"82":0,"83":64,"84":0,"85":0,"86":72,"87":12,"88":0,"89":0,"90":90,"91":8,"92":69,"93":61,"94":28,"95":3,"96":64,"97":127,"98":64,"99":0,"100":46,"101":73,"102":12,"103":0,"104":4,"105":70,"106":61,"107":64,"108":0,"109":1,"110":0,"111":64,"112":0,"113":64,"114":0,"115":64,"116":74,"117":12,"118":0,"119":0,"120":99,"121":11,"122":73,"123":108,"124":77,"125":0,"126":64,"127":76,"128":64,"129":15,"130":64,"131":75,"132":12,"133":0,"134":4,"135":36,"136":11,"137":64,"138":0,"139":1,"140":0,"141":64,"142":0,"143":64,"144":0,"145":64,"146":79,"147":3,"148":0,"149":1,"150":76,"151":12,"152":80,"153":3,"154":0,"155":0,"156":127,"157":4,"158":81,"159":10,"160":0,"161":2,"162":0,"163":127,"164":0,"165":0,"166":0,"167":0,"168":1,"169":127,"170":0,"171":88,"172":3,"173":0,"174":65,"175":89,"176":36,"177":112,"178":9,"179":0,"180":3,"181":59,"182":114,"183":5,"184":70,"185":114,"186":44,"187":15,"188":118,"189":113,"190":5,"191":0,"192":48,"193":44,"194":4,"195":0,"196":127,"197":114,"198":5,"199":0,"200":127,"201":110,"202":85,"203":22,"204":58,"205":247}
    }

    const obj_patch = obj_patches[Object.keys(obj_patches)[idx]]

    const patch = []
    Object.keys(obj_patch).forEach( idx => {
      const item = obj_patch[idx]
      patch.push(item)
    })
    console.log(patch.length, patch)

    const newEncodedPatch  = new Uint8Array(patch)

    function onMidiMessage(event) {
      let msg = []
      if (event.data[0]!=0xe0) {
        console.log(event.data)
      }
    }

    ewi4ks.sendOnePatch(newEncodedPatch, onMidiMessage)
    if (newEncodedPatch[4]==0x20) {
      newEncodedPatch[5]==0x00
    }
  }

  document.querySelector('button#sendPatch01').addEventListener('mousedown', async (event) => {
    const newPatchName =  document.querySelector('input#patchName01').value
    const patchNo = Number(document.querySelector('input#patchNumber01').value)
    try {
      ewi4ks.setOneEditPatchFromStoredPatch(patchNo)
      console.log(ewi4ks.getOneEditPatch(patchNo))
      const encodedPatchName = ewi4ks.encodePatchName(newPatchName)
      const newDecodedPatch = ewi4ks.updateOneEditPatch(patchNo, 'patchName', encodedPatchName)
      const newEncodedPatch = ewi4ks.encodeOnePatch(newDecodedPatch.decoded)
      console.log('!!!!![ENCODED] ', newEncodedPatch)
      console.log(newDecodedPatch.decoded)
      function onMidiMessage(event) {
        let msg = []
        if (event.data[0]!=0xe0) {
          console.log(event.data)
        }
      }


      ewi4ks.sendOnePatch(newEncodedPatch, onMidiMessage)
      if (newEncodedPatch[4]==0x20) {
        newEncodedPatch[5]==0x00
      }
    } catch (err) {
      console.error(err)
    }
  })

  function compareEncodedDecoded(event_data=[]) {
    const decodedPatch = this.decodeOnePatch(event_data)
    console.log('[DOCODED] ', decodedPatch)
    const encodedPatch = this.encodeOnePatch(decodedPatch)
    console.log('[ENCODED] ', encodedPatch)

    let msg = []
    event_data.forEach(data => {
      msg.push(`${('00' + data.toString(16)).substr(-2)}`)
    })

    let ret_out = []
    msg.forEach( digit => {
      ret_out.push(parseInt(digit, 16))
    })
    for(let i=0; i<ret_out.length; i++) {
      console.log(`[${i}] [${ret_out[i] == encodedPatch[i]}] Hex: ${ret_out[i]} ${encodedPatch[i]}` )
    }
  }

  document.querySelector('button#stop_ble').addEventListener('mousedown', async (event) => {
    ble.endBle()
    document.querySelector('input#send_to_ble').checked = false
  })
  document.querySelector('button#start_ble').addEventListener('mousedown', async (event) => {
    const arr_midiMsgToExclude = [0xe0, 0xd0, 0xcf, 0xb0] // requesst deivice id

    const connectedBleCallback = () => {
      console.log('[connectedBleCallback] ')
    }
    ble.setConnectedBleCallback(connectedBleCallback)
    const debugMode = document.querySelector('input#ble_debug').checked
    ble.setDebugMode(debugMode)
    ble.setMidiEventHandleCallback(() => { })
    try {
      await ble.startBle()
      document.querySelector('input#send_to_ble').checked = true
    } catch(e) {
      console.log('[Caneled]')
    }
  })


  document.querySelector('button#reqPatch02Ble').addEventListener('mousedown', async (event) => {
    const patchNo = Number(document.querySelector('input#patchNumber01').value)
    const patchNameArea =  document.querySelector('input#patchName01')
    function onMidiMessage(event) {
      const patch = this.getOneStoredPatch(patchNo)
      patchNameArea.setAttribute('value', '')
      patchNameArea.value=patch.decoded.patchNameDecoded.replace(/ /g, '')
    }

    const msgFetchOnePatch = ewi4ks.getMsgFetchOnePatch(patchNo)
    const chara = ble.getCharacteristic()
    const debugMode = document.querySelector('input#ble_debug').checked
    ble.setDebugMode(debugMode)
    let sysExMessage = []

    ble.setMidiEventHandleCallback( () => { })
    //ble.setMidiEventHandleCallback( (event) => { console.log(event.detail)})
    chara.output.send(msgFetchOnePatch)
  })

  document.querySelector('button#send_ble').addEventListener('mousedown', async (event) => {
    const chara = ble.getCharacteristic()
    const debugMode = document.querySelector('input#ble_debug').checked
    ble.setDebugMode(debugMode)
    const req_id_msg_raw = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]
    let sysExMessage = []

    ble.setMidiEventHandleCallback( () => { })
    chara.output.send(req_id_msg_raw)
  })

  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
  async function packetConvertTest() {
    const ble = new BLEMIDIUtils()
    const repeat_count = 200
    const sleepms = 500
    for (let i=0; i<repeat_count; i++) {
      // inset 'system common/realtime' message into devided sysex
      for (let no=0; no<samplePatches.length; no++) {
        const sample_patch = samplePatches[no]
        const ts = ble.generateTimeStamp()
        const ble_packet = ble.convMIDIMsgToBLEMIDIPacket(sample_patch)

        // inset 'system common/realtime' into original
        const tp = ble_packet.slice()
        const tpLen = tp.length
        if (tpLen<1) {
          tp[0] = [ tp[0][0], ts.l_b, 0xfe, ...tp[0].slice().splice(1)]
        } else {
          const insetno = getRandom(3, tpLen)
          insetno.forEach( num => {
            switch (num % 4) {
              case 1:
                tp[tpLen-num] = [ tp[tpLen-num][0], ts.l_b, 0xfe, ...tp[tpLen-num].slice().splice(1)]
                break
              case 2:
                tp[tpLen-num] = [ tp[tpLen-num][0], ts.l_b, 0xf2, 0x40, 0x40, ...tp[tpLen-num].slice().splice(1)]
                break
              case 3:
              default:
               tp[tpLen-num] = [ts.l_b, 0xf2, 0x40, 0x40, ...tp[tpLen-num].slice().splice(1)]
                break
              case 4:
                tp[tpLen-num] = [
                  ...tp[tpLen-num].slice().splice(0, 4), tp[0][1], 0xfe, ...tp[tpLen-num].slice().splice(4)]
                break
            }
            // A System Real-Time message interrupting a yet unterminated SysEx message
            // must be preceded by its own timestamp byte. (page.6)
          })
        }

console.log('3')
        // extrude
        let returnVal = []
        for (let pi=0; pi<tp.length; pi++) {
          const packet = tp[pi]
console.log('3.1')
          const midiMsg = await ble.convBLEMIDIPacketToMIDIMsg(packet)
console.log(`i=[4] pi=[${pi}/${tp.length}]`)
console.log(packet, midiMsg)
          if (midiMsg.length > 0) {
            returnVal = midiMsg
          }
        }
console.log('5')
        /*
        for (let pi=0; pi<ble_packet.length; pi++) {
          const packet = ble_packet[pi]
          const midiMsg = await ble.convBLEMIDIPacketToMIDIMsg(packet)
          //console.log(packet, midiMsg)
          if (midiMsg.length > 0) {
            returnVal = midiMsg
          }
        }
        */

console.log('6')
        const tmp_tp = convToString16(tp)
        const tmp_sample_patch = convToString16(sample_patch)
        function convToString16(tp) {
          const tmp_tp = []
          for (let i=0; i<tp.length; i++) {
            if (!(tp[i] instanceof Array)) {
              const msg = tp
              msg.forEach( byte => {
                tmp_tp.push(('00' + byte.toString(16)).substr(-2))
              })
              break
            } else {
              const msg = tp[i]
              msg.forEach( byte => {
                tmp_tp.push(('00' + byte.toString(16)).substr(-2))
              })
            }
            tmp_tp[tmp_tp.length-1] += "\n"
          }
          return tmp_tp
        }
        if (!(returnVal[0] instanceof Array)) { // avoid error caused from an bug
          returnVal[0] = []
          console.trace('ERROR')
        }
        const result = (sample_patch.join(' ') == returnVal[0].join(' '))
        const styleColor = (result) ? 'color: #5E35B1' : 'color: #D81B60'
        console.log(`%ci=[${i}] no=[${no}]\n`
                  + `  !!! result=[${sample_patch.join(' ') == returnVal[0].join(' ')}]\n`
                  + `  >>> org_midi=[\n${convToString16(sample_patch).join(' ')}]\n`
                  + `  >>> ble_midi=[\n ${convToString16(tp).join(" ")}]\n`
                  + `  >>> return=[\n${convToString16(returnVal[0]).join(' ')}]\n`
                  + `  !!> result=[${sample_patch.join(' ') == returnVal[0].join(' ')}]\n`, styleColor)
        //expect(returnVal[0]).toEqual(sample_patch)
      }
      console.log(` >> ------ Start Sleep time=[${sleepms}] ms (${i+1}/${repeat_count}) ------`)
      await sleep(sleepms)
    }
    console.log(`------ [COMPLETE (${repeat_count})] ------`)

    function getRandom(size = 3, max=5) {
      if (size==0 || size > max) return []
      if (size==max) return [...Array(size).keys()]
      const arr_random = []
      while(arr_random.length < size ) {
        const num = Math.floor(max * Math.random())
        if (!arr_random.includes(num) && num != 0) {
          arr_random.push(num)
        }
      }
      return arr_random
    }
  }

  document.querySelector('button#check_decode_endode_patch_ble').addEventListener('mousedown', async (event) => {
    await packetConvertTest()

//    const sample_patch = [
//      0xf0, 0x47, 0x64, 0x7f, 0x00, 0x00, 0x45, 0x34, 0x6b, 0x09,
//      0x26, 0x06, 0x54, 0x41, 0x4b, 0x41, 0x52, 0x41, 0x4a, 0x49,
//      0x4d, 0x41, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
//      0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
//      0x20, 0x20, 0x20, 0x20, 0x40, 0x12, 0x00, 0x40, 0x40, 0x40,
//      0x40, 0x00, 0x6f, 0x7f, 0x42, 0x15, 0x01, 0x00, 0x40, 0x00,
//      0x40, 0x00, 0x40, 0x00, 0x60, 0x41, 0x12, 0x00, 0x40, 0x40,
//      0x40, 0x40, 0x00, 0x7f, 0x3f, 0x3f, 0x7f, 0x54, 0x00, 0x40,
//      0x00, 0x40, 0x00, 0x40, 0x00, 0x07, 0x48, 0x0c, 0x00, 0x00,
//      0x6f, 0x05, 0x40, 0x56, 0x0e, 0x08, 0x40, 0x00, 0x40, 0x00,
//      0x31, 0x49, 0x0c, 0x00, 0x04, 0x26, 0x05, 0x58, 0x00, 0x01,
//      0x00, 0x40, 0x00, 0x40, 0x01, 0x40, 0x4a, 0x0c, 0x00, 0x00,
//      0x63, 0x0b, 0x49, 0x6c, 0x2a, 0x00, 0x40, 0x4c, 0x40, 0x0f,
//      0x40, 0x4b, 0x0c, 0x00, 0x04, 0x24, 0x0b, 0x40, 0x00, 0x01,
//      0x00, 0x40, 0x00, 0x40, 0x00, 0x40, 0x4f, 0x03, 0x00, 0x01,
//      0x4c, 0x0c, 0x50, 0x03, 0x00, 0x00, 0x00, 0x00, 0x51, 0x0a,
//      0x00, 0x02, 0x00, 0x7f, 0x00, 0x00, 0x00, 0x00, 0x01, 0x7f,
//      0x00, 0x58, 0x03, 0x00, 0x00, 0x72, 0x00, 0x70, 0x09, 0x00,
//      0x03, 0x3b, 0x72, 0x05, 0x46, 0x72, 0x2c, 0x0f, 0x76, 0x71,
//      0x05, 0x00, 0x30, 0x2c, 0x04, 0x00, 0x7f, 0x72, 0x05, 0x00,
//      0x7f, 0x6f, 0x55, 0x16, 0x3a, 0xf7 ]
//    /*
//    const sample_patch = [0x90, 0x45, 0x45]
//     */
//    const ts = ble.generateTimeStamp()
//    const ble_packet = ble.convMIDIMsgToBLEMIDIPacket(sample_patch)
//
//    //const f6_ble_packet = ble_packet.slice()
//    //f6_ble_packet[f6_ble_packet.length-1] = [ f6_ble_packet[f6_ble_packet.length-1][0], f6_ble_packet[0][1], 0xf6, ...f6_ble_packet[f6_ble_packet.length-1].slice().splice(1)]
//    //console.log(f6_ble_packet[f6_ble_packet.length-1])
//
//    const f2_ble_packet = ble_packet.slice()
//    f2_ble_packet[f2_ble_packet.length-4] = [
//      ...f2_ble_packet[f2_ble_packet.length-4].slice().splice(0, 4), f2_ble_packet[0][1], 0xfe, ...f2_ble_packet[f2_ble_packet.length-4].slice().splice(4)]
//    f2_ble_packet[f2_ble_packet.length-3] = [ f2_ble_packet[f2_ble_packet.length-3][0], ts.l_b, 0xfe, ...f2_ble_packet[f2_ble_packet.length-3].slice().splice(1)]
//    f2_ble_packet[f2_ble_packet.length-2] = [ f2_ble_packet[f2_ble_packet.length-2][0], ts.l_b, 0xf2, 0x40, 0x40, ...f2_ble_packet[f2_ble_packet.length-2].slice().splice(1)]
//    f2_ble_packet[f2_ble_packet.length-1] = [ f2_ble_packet[f2_ble_packet.length-1][0], ts.l_b, 0xf2, 0x40, 0x40, ...f2_ble_packet[f2_ble_packet.length-1].slice().splice(1)]
//
//    let returnVal = []
//    f2_ble_packet.forEach( packet => {
//      const midiMsg = ble.convBLEMIDIPacketToMIDIMsg(packet)
//      //console.log(packet, midiMsg)
//      if (midiMsg.length > 0) {
//        returnVal = midiMsg
//      }
//    })
//
//    // check sysex
//    let ok_count = 0
//    returnVal[0].forEach( (byte, idx) => {
//      if (byte == sample_patch[idx]) {
//        ok_count += 1
//      }
//    })
//    if (ok_count == returnVal[0].length && ok_count == sample_patch.length) {
//      console.log('[SUCCESS] sysex: encode & decode')
//    } else {
//      console.log(`[ERROR] sysex: encode & decode; ok_count=[${ok_count}] returnVal.length=[${returnVal[0].length}] sample_patch.length=[${sample_patch.length}]`)
//      console.log('[returnVal] ', sample_patch)
//      console.log('[returnVal] ', returnVal)
//    }
//
  })


})()
