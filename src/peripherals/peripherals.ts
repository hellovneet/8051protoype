/**
 * Micro8051SiM Peripherals Manager
 * Handles real hardware emulation: LEDs, Switches, LCD, 7-Segment, Keypad, Motor, DAC/ADC, UART
 */

import { PinMapping, CPUState } from '../core/types.ts';
import { DEFAULT_PIN_MAPPING } from './pin-manager.ts';
import { LCD16x2Controller } from './lcd-controller.ts';
import { FrequencyAnalyzer } from './frequency-analyzer.ts';

// 4x3 Matrix Keypad definition
// Rows 0..3, Cols 0..2
export const KEYPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

export class PeripheralsManager {
  public mapping: PinMapping = { ...DEFAULT_PIN_MAPPING };

  // 8 LEDs state (true = ON, false = OFF)
  public ledStates: boolean[] = new Array(8).fill(false);

  // 8 Switches state (true = CLOSED/LOW, false = OPEN/HIGH)
  // In typical 8051 systems, closing a switch to ground pulls the pin to 0.
  public switchStates: boolean[] = new Array(8).fill(false);

  // LCD 16x2
  public lcd: LCD16x2Controller = new LCD16x2Controller();

  // 4-Digit 7-Segment Display
  // Segment values currently active on each of the 4 digits (0x00 - 0xFF)
  public segmentDigits: number[] = [0, 0, 0, 0];
  // Persistence counters for smooth multiplexed display rendering
  public segmentPersistence: number[] = [0, 0, 0, 0];

  // Keypad: Currently pressed key (row, col) or null
  public activeKey: { row: number; col: number } | null = null;

  // DC Motor
  public motorState: 'OFF' | 'CW' | 'CCW' | 'BRAKE' = 'OFF';
  public motorSpeed = 0; // 0 to 100%
  public motorAngle = 0; // Current rotor angle in degrees

  // DAC & Oscilloscope
  public dacVoltage = 0.0; // 0.0 to 5.0 V
  public dacWaveformHistory: number[] = new Array(120).fill(0);

  // ADC
  public adcInputVoltage = 2.5; // 0.0 to 5.0 V slider
  public adcDigitalValue = 128; // 8-bit conversion 0-255

  // Analog Comparator (EdSim51: Vin on non-inverting, Vdac on inverting, output on P3.7)
  public comparatorEnabled = true;
  public comparatorOutput: 0 | 1 = 1;

  // UART Terminal
  public uartRxBuffer: number[] = [];
  public uartTxHistory = '';

  // Real-Time Pin Frequency & Duty Cycle Analyzer Probe
  public frequencyAnalyzer: FrequencyAnalyzer = new FrequencyAnalyzer({ port: 1, pin: 0, label: 'P1.0 (LED 0)' });

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.ledStates.fill(false);
    this.lcd.reset();
    this.segmentDigits = [0, 0, 0, 0];
    this.segmentPersistence = [0, 0, 0, 0];
    this.activeKey = null;
    this.motorState = 'OFF';
    this.motorSpeed = 0;
    this.motorAngle = 0;
    this.dacVoltage = 0.0;
    this.dacWaveformHistory.fill(0);
    this.adcDigitalValue = Math.round((this.adcInputVoltage / 5.0) * 255);
    this.comparatorOutput = this.adcInputVoltage > this.dacVoltage ? 1 : 0;
    this.uartTxHistory = '';
    this.frequencyAnalyzer.reset();
  }

  /**
   * Before CPU executes, update external port pins based on connected inputs
   * (Switches, Keypad matrix, ADC, and Comparator)
   */
  public updateInputsToCpu(state: CPUState): void {
    // Start with all external pins HIGH (0xFF) due to internal pull-ups
    const newPortPins = [0xFF, 0xFF, 0xFF, 0xFF];

    // 1. Process 8 Switches:
    // If a switch is closed (ON), pull its mapped port pin LOW (0)
    for (let i = 0; i < 8; i++) {
      if (this.switchStates[i]) {
        const sw = this.mapping.switches[i];
        if (sw && sw.port >= 0 && sw.port <= 3 && sw.pin >= 0 && sw.pin <= 7) {
          newPortPins[sw.port] &= ~(1 << sw.pin);
        }
      }
    }

    // 2. Process Keypad matrix:
    // If a key at (row, col) is pressed, it connects the row pin and col pin.
    // If CPU drives the row pin LOW (in portLatches), the col pin is pulled LOW.
    // Conversely, if CPU drives col LOW, row is pulled LOW.
    if (this.activeKey) {
      const { row, col } = this.activeKey;
      const rowPinDef = this.mapping.keypad.rows[row];
      const colPinDef = this.mapping.keypad.cols[col];

      if (rowPinDef && colPinDef) {
        const rowLatchLevel = (state.portLatches[rowPinDef.port] >> rowPinDef.pin) & 1;
        const colLatchLevel = (state.portLatches[colPinDef.port] >> colPinDef.pin) & 1;

        if (rowLatchLevel === 0) {
          // Row driven low -> pull col low
          newPortPins[colPinDef.port] &= ~(1 << colPinDef.pin);
        }
        if (colLatchLevel === 0) {
          // Col driven low -> pull row low
          newPortPins[rowPinDef.port] &= ~(1 << rowPinDef.pin);
        }
      }
    }

    // 3. Process ADC & Analog Comparator (EdSim51):
    this.adcDigitalValue = Math.min(255, Math.max(0, Math.round((this.adcInputVoltage / 5.0) * 255)));

    // Evaluate Comparator: (+) Vin (potentiometer) vs (-) Vdac (Port 1 DAC output)
    this.comparatorOutput = this.adcInputVoltage > this.dacVoltage ? 1 : 0;

    if (this.comparatorEnabled) {
      // In Comparator mode, comparator output actively drives P3.7
      const compPort = this.mapping.comparator.pin.port;
      const compPin = this.mapping.comparator.pin.pin;
      if (this.comparatorOutput === 0) {
        newPortPins[compPort] &= ~(1 << compPin);
      } else {
        const swIdx = this.mapping.switches.findIndex((s) => s.port === compPort && s.pin === compPin);
        if (swIdx < 0 || !this.switchStates[swIdx]) {
          newPortPins[compPort] |= (1 << compPin);
        }
      }
    }

    // Apply computed external pin levels
    state.portPins[0] = newPortPins[0];
    state.portPins[1] = newPortPins[1];
    state.portPins[2] = newPortPins[2];
    state.portPins[3] = newPortPins[3];
  }

  /**
   * After CPU executes or during step, update peripheral outputs from CPU port state
   */
  public updateOutputsFromCpu(state: CPUState): void {
    // 1. Evaluate 8 LEDs:
    // LED turns ON if mapped pin is driven LOW (active low LED) or HIGH (active high).
    // In classic 8051 circuits, LEDs are connected with anodes to VCC and cathodes to port pins
    // (active LOW), OR active HIGH. Here we support standard: pin logic 1 = HIGH, pin logic 0 = LOW.
    // We treat port bit = 1 or latch = 1 as ON for user intuitive visualization, or inverted if user wants.
    // By convention in educational labs (e.g. MOV P1, #55H -> 01010101 -> alternating LEDs lit):
    for (let i = 0; i < 8; i++) {
      const led = this.mapping.leds[i];
      if (led && led.port >= 0 && led.port <= 3) {
        const bit = (state.portLatches[led.port] >> led.pin) & 1;
        this.ledStates[i] = bit === 1;
      }
    }

    // 2. Evaluate LCD 16x2:
    const lcdCfg = this.mapping.lcd;
    const rs = (state.portLatches[lcdCfg.rs.port] >> lcdCfg.rs.pin) & 1;
    const rw = (state.portLatches[lcdCfg.rw.port] >> lcdCfg.rw.pin) & 1;
    const en = (state.portLatches[lcdCfg.en.port] >> lcdCfg.en.pin) & 1;
    const dataByte = state.portLatches[lcdCfg.dataPort] ?? 0;
    this.lcd.step(rs, rw, en, dataByte);

    // 3. Evaluate 4-Digit 7-Segment Display:
    const segCfg = this.mapping.sevenSegment;
    const segByte = state.portLatches[segCfg.segmentPort] ?? 0;
    for (let d = 0; d < 4; d++) {
      const dPin = segCfg.digitPins[d];
      if (dPin) {
        const dLevel = (state.portLatches[dPin.port] >> dPin.pin) & 1;
        const isDigitActive = segCfg.activeLowDigits ? dLevel === 0 : dLevel === 1;
        if (isDigitActive) {
          const rawSegments = segCfg.activeLowSegments ? (~segByte) & 0xFF : segByte;
          this.segmentDigits[d] = rawSegments;
          this.segmentPersistence[d] = 1.0; // full brightness persistence
        } else {
          // Decay persistence slowly so multiplexed scanning displays appear illuminated
          this.segmentPersistence[d] = Math.max(0, this.segmentPersistence[d] - 0.05);
        }
      }
    }

    // 4. Evaluate DC Motor:
    const mot = this.mapping.motor;
    const in1 = (state.portLatches[mot.in1.port] >> mot.in1.pin) & 1;
    const in2 = (state.portLatches[mot.in2.port] >> mot.in2.pin) & 1;
    const enMot = (state.portLatches[mot.en.port] >> mot.en.pin) & 1;

    if (enMot === 1) {
      if (in1 === 1 && in2 === 0) {
        this.motorState = 'CW';
        this.motorSpeed = 100;
        this.motorAngle = (this.motorAngle + 18) % 360;
      } else if (in1 === 0 && in2 === 1) {
        this.motorState = 'CCW';
        this.motorSpeed = 100;
        this.motorAngle = (this.motorAngle - 18 + 360) % 360;
      } else if (in1 === in2 && in1 === 1) {
        this.motorState = 'BRAKE';
        this.motorSpeed = 0;
      } else {
        this.motorState = 'OFF';
        this.motorSpeed = 0;
      }
    } else {
      this.motorState = 'OFF';
      this.motorSpeed = 0;
    }

    // 5. Evaluate DAC & Oscilloscope:
    const dacPortIdx = this.mapping.dac.port;
    const dacVal = state.portLatches[dacPortIdx] ?? 0;
    this.dacVoltage = (dacVal / 255.0) * 5.0;

    // Shift waveform history
    this.dacWaveformHistory.push(this.dacVoltage);
    if (this.dacWaveformHistory.length > 120) {
      this.dacWaveformHistory.shift();
    }

    // Evaluate Comparator output following DAC change
    this.comparatorOutput = this.adcInputVoltage > this.dacVoltage ? 1 : 0;
    if (this.comparatorEnabled) {
      const compPort = this.mapping.comparator.pin.port;
      const compPin = this.mapping.comparator.pin.pin;
      if (this.comparatorOutput === 0) {
        state.portPins[compPort] &= ~(1 << compPin);
      } else {
        const swIdx = this.mapping.switches.findIndex((s) => s.port === compPort && s.pin === compPin);
        if (swIdx < 0 || !this.switchStates[swIdx]) {
          state.portPins[compPort] |= (1 << compPin);
        }
      }
    }

    // 6. Sample Pin Frequency & Duty Cycle Analyzer
    this.frequencyAnalyzer.sample(state.portLatches, state.portPins, state.cycles);
  }

  // Toggle Analog Comparator mode
  public toggleComparator(enabled?: boolean): boolean {
    this.comparatorEnabled = enabled !== undefined ? enabled : !this.comparatorEnabled;
    return this.comparatorEnabled;
  }

  // Toggle user switch
  public toggleSwitch(index: number): void {
    if (index >= 0 && index < 8) {
      this.switchStates[index] = !this.switchStates[index];
    }
  }

  public setSwitch(index: number, state: boolean): void {
    if (index >= 0 && index < 8) {
      this.switchStates[index] = state;
    }
  }

  // Press / Release keypad key
  public pressKey(row: number, col: number): void {
    this.activeKey = { row, col };
  }

  public releaseKey(): void {
    this.activeKey = null;
  }

  // Handle incoming UART byte from CPU
  public onCpuSerialTransmit(byte: number): void {
    const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : `[${byte.toString(16).toUpperCase()}]`;
    this.uartTxHistory += char;
    // Cap history
    if (this.uartTxHistory.length > 2000) {
      this.uartTxHistory = this.uartTxHistory.slice(-1500);
    }
  }
}
