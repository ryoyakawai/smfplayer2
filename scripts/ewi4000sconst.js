"use strict";

//SysEx commands from Akai
const sysex_cmd = {
  MIDI_PRESET_DUMP      : 0x00,
  MIDI_PRESET_DUMP_REQ  : 0x40,
  MIDI_QUICKPC_DUMP     : 0x01,
  MIDI_QUICKPC_DUMP_REQ : 0x41,
  MIDI_EDIT_LOAD        : 0x10,
  MIDI_EDIT_STORE       : 0x11,
  MIDI_EDIT_DUMP        : 0x20,
  MIDI_EDIT_DUMP_REQ    : 0x60,

  MIDI_SYSEX_HEADER     : 0xf0, // 0xf0
  MIDI_SYSEX_TRAILER    : 0xf7, // 0xf7
  MIDI_SYSEX_GEN_INFO   : 0x06,
  MIDI_SYSEX_ID_REQ     : 0x01,
  MIDI_SYSEX_ID         : 0x02,
  MIDI_SYSEX_AKAI_ID    : 0x47, // 71.
  MIDI_SYSEX_AKAI_EWI4K : 0x64, // 100.
  MIDI_SYSEX_CHANNEL    : 0x00,
  MIDI_SYSEX_NONREALTIME : 0x7e,
  MIDI_SYSEX_ALLCHANNELS : 0x7f,

  MIDI_CC_DATA_ENTRY    : 0x06,
  MIDI_CC_NRPN_LSB      : 0x62,
  MIDI_CC_NRPN_MSB      : 0x63,
}

const sysex_cfg = {
  MAX_SYSEX_LENGTH      : 262144,
  //EWI_SYSEX_PRESET_DUMP_LEN : EWI4000sPatch.EWI_PATCH_LENGTH,
  EWI_SYSEX_QUICKPC_DUMP_LEN : 91,
  EWI_SYSEX_ID_RESPONSE_LEN : 15,

  EWI_NUM_QUICKPCS      : 84,

  /** N.B. MIDI_TIMEOUT_MS must be significantly longer than MIDI_MESSAGE_LONG_PAUSE_MS
  * otherwise send & receive can get out of sync
  */
  MIDI_MESSAGE_SHORT_PAUSE_MS : 100,
  MIDI_MESSAGE_LONG_PAUSE_MS  : 250,
  MIDI_TIMEOUT_MS             : 3000,
  //
  EWI_NUM_PATCHES             : 100,  // 0..99
  EWI_PATCHNAME_LENGTH        : 32,
}


export { sysex_cmd, sysex_cfg }
