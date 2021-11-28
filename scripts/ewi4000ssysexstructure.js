"use strict";

import { sysex_cfg } from './ewi4000sconst.js';

const structure = [
  { name: 'header',             itemIdx:  1, startIdx:   0, endIdx:   3, bytes:   4 },
  { name: 'mode',               itemIdx:  2, startIdx:   4, endIdx:   4, bytes:   1 },
  { name: 'internalPatchNum',   itemIdx:  3, startIdx:   5, endIdx:   5, bytes:   1 },
  { name: 'filler2',            itemIdx:  4, startIdx:   6, endIdx:   6, bytes:   1 },
  { name: 'filler3',            itemIdx:  5, startIdx:   7, endIdx:   7, bytes:   1 },
  { name: 'filler4',            itemIdx:  6, startIdx:   8, endIdx:   8, bytes:   1 },
  { name: 'filler5',            itemIdx:  7, startIdx:   9, endIdx:   9, bytes:   1 },
  { name: 'filler6',            itemIdx:  8, startIdx:  10, endIdx:  10, bytes:   1 },
  { name: 'filler7',            itemIdx:  9, startIdx:  11, endIdx:  11, bytes:   1 },
  { name: 'patchName',          itemIdx: 10, startIdx:  12, endIdx:  43, bytes:  sysex_cfg.EWI_PATCHNAME_LENGTH }, // 32
  { name: 'osc1',               itemIdx: 11, startIdx:  44, endIdx:  64, bytes:  21 },
  { name: 'osc2',               itemIdx: 12, startIdx:  65, endIdx:  85, bytes:  21 },
  { name: 'oscFilter1',         itemIdx: 13, startIdx:  86, endIdx: 100, bytes:  15 },
  { name: 'oscFilter2',         itemIdx: 14, startIdx: 101, endIdx: 115, bytes:  15 },
  { name: 'noiseFilter1',       itemIdx: 15, startIdx: 116, endIdx: 130, bytes:  15 },
  { name: 'noiseFilter2',       itemIdx: 16, startIdx: 131, endIdx: 145, bytes:  15 },
  { name: 'antiAliasNRPN',      itemIdx: 17, startIdx: 146, endIdx: 148, bytes:   3 },
  { name: 'antiAliasSwitch',    itemIdx: 18, startIdx: 149, endIdx: 149, bytes:   1 },
  { name: 'antiAliasCutoff',    itemIdx: 19, startIdx: 150, endIdx: 150, bytes:   1 },
  { name: 'antiAliasKeyFollow', itemIdx: 20, startIdx: 151, endIdx: 151, bytes:   1 },
  { name: 'noiseNRPN',          itemIdx: 21, startIdx: 152, endIdx: 154, bytes:   3 },
  { name: 'noiseTime',          itemIdx: 22, startIdx: 155, endIdx: 155, bytes:   1 },
  { name: 'noiseBreath',        itemIdx: 23, startIdx: 156, endIdx: 156, bytes:   1 },
  { name: 'noiseLevel',         itemIdx: 24, startIdx: 157, endIdx: 157, bytes:   1 },
  { name: 'miscNRPN',           itemIdx: 25, startIdx: 158, endIdx: 160, bytes:   3 },
  { name: 'bendRange',          itemIdx: 26, startIdx: 161, endIdx: 161, bytes:   1 },
  { name: 'bendStepMode',       itemIdx: 27, startIdx: 162, endIdx: 162, bytes:   1 },
  { name: 'biteVibrato',        itemIdx: 28, startIdx: 163, endIdx: 163, bytes:   1 },
  { name: 'oscFilterLink',      itemIdx: 29, startIdx: 164, endIdx: 164, bytes:   1 },
  { name: 'noiseFilterLink',    itemIdx: 30, startIdx: 165, endIdx: 165, bytes:   1 },
  { name: 'formantFilter',      itemIdx: 31, startIdx: 166, endIdx: 166, bytes:   1 },
  { name: 'osc2Xfade',          itemIdx: 32, startIdx: 167, endIdx: 167, bytes:   1 },
  { name: 'keyTrigger',         itemIdx: 33, startIdx: 168, endIdx: 168, bytes:   1 },
  { name: 'filler10',           itemIdx: 34, startIdx: 169, endIdx: 169, bytes:   1 },
  { name: 'chorusSwitch',       itemIdx: 35, startIdx: 170, endIdx: 170, bytes:   1 },
  { name: 'ampNRPN',            itemIdx: 36, startIdx: 171, endIdx: 173, bytes:   3 },
  { name: 'biteTremolo',        itemIdx: 37, startIdx: 174, endIdx: 174, bytes:   1 },
  { name: 'ampLevel',           itemIdx: 38, startIdx: 175, endIdx: 175, bytes:   1 },
  { name: 'octaveLevel',        itemIdx: 39, startIdx: 176, endIdx: 176, bytes:   1 },
  { name: 'chorusNRPN',         itemIdx: 40, startIdx: 177, endIdx: 179, bytes:   3 },
  { name: 'chorusDelay1',       itemIdx: 41, startIdx: 180, endIdx: 180, bytes:   1 },
  { name: 'chorusModLev1',      itemIdx: 42, startIdx: 181, endIdx: 181, bytes:   1 },
  { name: 'chorusWetLev1',      itemIdx: 43, startIdx: 182, endIdx: 182, bytes:   1 },
  { name: 'chorusDelay2',       itemIdx: 44, startIdx: 183, endIdx: 183, bytes:   1 },
  { name: 'chorusModLev2',      itemIdx: 45, startIdx: 184, endIdx: 184, bytes:   1 },
  { name: 'chorusWetLev2',      itemIdx: 46, startIdx: 185, endIdx: 185, bytes:   1 },
  { name: 'chorusFeedback',     itemIdx: 47, startIdx: 186, endIdx: 186, bytes:   1 },
  { name: 'chorusLFOfreq',      itemIdx: 48, startIdx: 187, endIdx: 187, bytes:   1 },
  { name: 'chorusDryLevel',     itemIdx: 49, startIdx: 188, endIdx: 188, bytes:   1 },
  { name: 'delayNRPN',          itemIdx: 50, startIdx: 189, endIdx: 191, bytes:   3 },
  { name: 'delayTime',          itemIdx: 51, startIdx: 192, endIdx: 192, bytes:   1 },
  { name: 'delayFeedback',      itemIdx: 52, startIdx: 193, endIdx: 193, bytes:   1 },
  { name: 'delayDamp',          itemIdx: 53, startIdx: 194, endIdx: 194, bytes:   1 },
  { name: 'delayLevel',         itemIdx: 54, startIdx: 195, endIdx: 195, bytes:   1 },
  { name: 'delayDry',           itemIdx: 55, startIdx: 196, endIdx: 196, bytes:   1 },
  { name: 'reverbNRPN',         itemIdx: 56, startIdx: 197, endIdx: 199, bytes:   3 },
  { name: 'reverbDry',          itemIdx: 57, startIdx: 200, endIdx: 200, bytes:   1 },
  { name: 'reverbLevel',        itemIdx: 58, startIdx: 201, endIdx: 201, bytes:   1 },
  { name: 'reverbDensity',      itemIdx: 59, startIdx: 202, endIdx: 202, bytes:   1 },
  { name: 'reverbTime',         itemIdx: 60, startIdx: 203, endIdx: 203, bytes:   1 },
  { name: 'reverbDamp',         itemIdx: 61, startIdx: 204, endIdx: 204, bytes:   1 },
  { name: 'trailer_f7',         itemIdx: 62, startIdx: 205, endIdx: 205, bytes:   1 },
]


const patchSysExStructure = {
  structure: structure,
  getStructureKeys: () => {
    const keys = []
    //console.log(this)
    structure.forEach( item => {
      keys[item.itemIdx] = item.name
    })
    return keys
  },
  getOneStructureByName: (name='') => {
    const ret_structure = structure.filter( item => name == item.name)
    return ret_structure
  },
  getNameByByteIdx: (idx=null) => {
    if (idx == null) return `(idx wes not undefined. idx=${idx})`
    let map_item_name = []
    for (let i=0; i<structure.length; i++) {
      const item = structure[i]
      for (let j=0; j<item.bytes; j++) {
        map_item_name.push(item.name)
      }
    }
    return map_item_name[idx]
  }

}

export {
  patchSysExStructure
}

