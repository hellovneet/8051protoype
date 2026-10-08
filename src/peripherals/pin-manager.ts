/**
 * Micro8051SiM Pin Mapping and Hardware Interconnect Manager
 */

import { PinMapping } from '../core/types.ts';

export const DEFAULT_PIN_MAPPING: PinMapping = {
  leds: [
    { port: 1, pin: 0 },
    { port: 1, pin: 1 },
    { port: 1, pin: 2 },
    { port: 1, pin: 3 },
    { port: 1, pin: 4 },
    { port: 1, pin: 5 },
    { port: 1, pin: 6 },
    { port: 1, pin: 7 },
  ],
  switches: [
    { port: 3, pin: 0 },
    { port: 3, pin: 1 },
    { port: 3, pin: 2 },
    { port: 3, pin: 3 },
    { port: 3, pin: 4 },
    { port: 3, pin: 5 },
    { port: 3, pin: 6 },
    { port: 3, pin: 7 },
  ],
  lcd: {
    rs: { port: 2, pin: 0 },
    rw: { port: 2, pin: 1 },
    en: { port: 2, pin: 2 },
    dataPort: 0, // Port 0 carries 8-bit data
    mode: '8bit',
  },
  sevenSegment: {
    segmentPort: 0, // Port 0 drives segments a-g, dp
    digitPins: [
      { port: 2, pin: 0 },
      { port: 2, pin: 1 },
      { port: 2, pin: 2 },
      { port: 2, pin: 3 },
    ],
    activeLowSegments: true, // typical common-anode
    activeLowDigits: true,
  },
  keypad: {
    rows: [
      { port: 2, pin: 0 },
      { port: 2, pin: 1 },
      { port: 2, pin: 2 },
      { port: 2, pin: 3 },
    ],
    cols: [
      { port: 2, pin: 4 },
      { port: 2, pin: 5 },
      { port: 2, pin: 6 },
    ],
  },
  motor: {
    in1: { port: 2, pin: 0 },
    in2: { port: 2, pin: 1 },
    en: { port: 2, pin: 2 },
  },
  dac: {
    port: 1, // Port 1 drives DAC
  },
  adc: {
    dataPort: 0,
    startPin: { port: 3, pin: 6 },
    eocPin: { port: 3, pin: 7 },
  },
  comparator: {
    pin: { port: 3, pin: 7 },
  },
};

export interface PinConflict {
  pinName: string;
  functions: string[];
}

export function detectPinConflicts(mapping: PinMapping): PinConflict[] {
  const usageMap = new Map<string, string[]>();

  const registerUsage = (port: number, pin: number, label: string) => {
    const pinKey = `P${port}.${pin}`;
    const list = usageMap.get(pinKey) || [];
    list.push(label);
    usageMap.set(pinKey, list);
  };

  mapping.leds.forEach((m: { port: number; pin: number }, idx: number) => registerUsage(m.port, m.pin, `LED ${idx}`));
  mapping.switches.forEach((m: { port: number; pin: number }, idx: number) => registerUsage(m.port, m.pin, `SW ${idx}`));

  registerUsage(mapping.lcd.rs.port, mapping.lcd.rs.pin, 'LCD RS');
  registerUsage(mapping.lcd.rw.port, mapping.lcd.rw.pin, 'LCD RW');
  registerUsage(mapping.lcd.en.port, mapping.lcd.en.pin, 'LCD EN');
  for (let i = 0; i < 8; i++) {
    registerUsage(mapping.lcd.dataPort, i, `LCD D${i}`);
  }

  mapping.sevenSegment.digitPins.forEach((d: { port: number; pin: number }, idx: number) =>
    registerUsage(d.port, d.pin, `7-SEG DIGIT ${idx}`)
  );

  mapping.keypad.rows.forEach((r: { port: number; pin: number }, idx: number) => registerUsage(r.port, r.pin, `KEYPAD ROW ${idx}`));
  mapping.keypad.cols.forEach((c: { port: number; pin: number }, idx: number) => registerUsage(c.port, c.pin, `KEYPAD COL ${idx}`));

  registerUsage(mapping.motor.in1.port, mapping.motor.in1.pin, 'MOTOR IN1');
  registerUsage(mapping.motor.in2.port, mapping.motor.in2.pin, 'MOTOR IN2');
  registerUsage(mapping.motor.en.port, mapping.motor.en.pin, 'MOTOR EN');

  const conflicts: PinConflict[] = [];
  for (const [pinName, funcs] of usageMap.entries()) {
    if (funcs.length > 1) {
      conflicts.push({ pinName, functions: funcs });
    }
  }

  return conflicts;
}
