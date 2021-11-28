"use strict";

export {
  listMIDIDevices
}

async function listMIDIDevices(options = {sysex: false}) {
  const ret_val = {
    success: false,
    devices: [],
    error_msg: null
  }
  const devices = {
    input: {},
    output: {}
  }
  try {
    console.log(options)
    let midi_devices = await navigator.requestMIDIAccess(options)
    ret_val.success = true
    console.log(midi_devices)
    ret_val.devices.inputs = _getArrayDevices(midi_devices.inputs.values())
    ret_val.devices.outputs = _getArrayDevices(midi_devices.outputs.values())
  } catch (error) {
    ret_val.success = false
    ret_val.error_msg = error
  }
  return ret_val

  function _getArrayDevices(iterator=null) {
    let ret = []
    if (typeof iterator[Symbol.iterator] !== 'function') {
      return ret
    }
    for (let i= iterator.next(); !i.done; i=iterator.next()) {
      ret.push(i.value);
    }
    return ret
  }
}
