/**
 * 8051 Microcontroller Architecture & Simulator Types
 * Micro8051SiM
 */

// Standard Special Function Register (SFR) Addresses
export const SFR_ADDRESSES = {
  P0: 0x80,
  SP: 0x81,
  DPL: 0x82,
  DPH: 0x83,
  PCON: 0x87,
  TCON: 0x88,
  TMOD: 0x89,
  TL0: 0x8A,
  TL1: 0x8B,
  TH0: 0x8C,
  TH1: 0x8D,
  P1: 0x90,
  SCON: 0x98,
  SBUF: 0x99,
  P2: 0xA0,
  IE: 0xA8,
  P3: 0xB0,
  IP: 0xB8,
  PSW: 0xD0,
  ACC: 0xE0,
  B: 0xF0,
} as const;

export type SFRName = keyof typeof SFR_ADDRESSES;

// Program Status Word (PSW) Bit Positions
export const PSW_BITS = {
  CY: 7,   // Carry Flag
  AC: 6,   // Auxiliary Carry Flag
  F0: 5,   // Flag 0 (User Flag)
  RS1: 4,  // Register Bank Select Bit 1
  RS0: 3,  // Register Bank Select Bit 0
  OV: 2,   // Overflow Flag
  UD: 1,   // User Definable Flag
  P: 0,    // Parity Flag
} as const;

// Interrupt Enable (IE) Bit Positions
export const IE_BITS = {
  EA: 7,   // Global Interrupt Enable
  ES: 4,   // Serial Port Interrupt Enable
  ET1: 3,  // Timer 1 Overflow Interrupt Enable
  EX1: 2,  // External Interrupt 1 Enable
  ET0: 1,  // Timer 0 Overflow Interrupt Enable
  EX0: 0,  // External Interrupt 0 Enable
} as const;

// Interrupt Priority (IP) Bit Positions
export const IP_BITS = {
  PS: 4,
  PT1: 3,
  PX1: 2,
  PT0: 1,
  PX0: 0,
} as const;

// Timer Control (TCON) Bit Positions
export const TCON_BITS = {
  TF1: 7,  // Timer 1 Overflow Flag
  TR1: 6,  // Timer 1 Run Control
  TF0: 5,  // Timer 0 Overflow Flag
  TR0: 4,  // Timer 0 Run Control
  IE1: 3,  // External Interrupt 1 Edge Flag
  IT1: 2,  // External Interrupt 1 Type Select (1=falling edge, 0=low level)
  IE0: 1,  // External Interrupt 0 Edge Flag
  IT0: 0,  // External Interrupt 0 Type Select
} as const;

// Serial Control (SCON) Bit Positions
export const SCON_BITS = {
  SM0: 7,  // Serial Mode 0
  SM1: 6,  // Serial Mode 1
  SM2: 5,  // Multiprocessor Communication Enable
  REN: 4,  // Receive Enable
  TB8: 3,  // Transmit Bit 8
  RB8: 2,  // Receive Bit 8
  TI: 1,   // Transmit Interrupt Flag
  RI: 0,   // Receive Interrupt Flag
} as const;

// Interrupt Vectors in Code Memory
export const INTERRUPT_VECTORS = {
  RESET: 0x0000,
  EX0: 0x0003,
  ET0: 0x000B,
  EX1: 0x0013,
  ET1: 0x001B,
  ES: 0x0023,
} as const;

export interface CPUState {
  // Registers
  pc: number;          // Program Counter (16-bit, 0x0000 - 0xFFFF)
  sp: number;          // Stack Pointer (8-bit)
  acc: number;         // Accumulator (8-bit)
  b: number;           // B Register (8-bit)
  psw: number;         // Program Status Word (8-bit)
  dptr: number;        // Data Pointer (16-bit: DPH << 8 | DPL)

  // Register bank (0-3, derived from PSW.RS1, RS0)
  activeBank: number;
  r: [number, number, number, number, number, number, number, number]; // Current R0-R7

  // Memory
  ram: Uint8Array;     // Internal RAM: 256 bytes (0x00-0x7F direct RAM + 0x80-0xFF indirect RAM)
  sfr: Uint8Array;     // SFR Space: 128 bytes mapped at 0x80-0xFF
  codeMemory: Uint8Array; // 64KB ROM / Flash (0x0000 - 0xFFFF)
  xram: Uint8Array;    // External Data Memory (XRAM / XDATA): 64KB (0x0000 - 0xFFFF)

  // Ports: latch state (written by CPU) and external pins (driven by connected devices/switches)
  portLatches: [number, number, number, number]; // P0, P1, P2, P3 latches
  portPins: [number, number, number, number];    // P0, P1, P2, P3 actual electrical pins

  // Interrupt system
  interruptPending: {
    ex0: boolean;
    et0: boolean;
    et1: boolean;
    ex1: boolean;
    es: boolean;
  };
  activeInterrupt: number | null; // Currently servicing vector or null

  // Execution Stats
  cycles: number;             // Total machine cycles
  instructionCount: number;   // Total instructions executed
  isHalted: boolean;          // Halted by error or unhandled condition
  lastCycleCost: number;      // Machine cycles of the last executed instruction
  changedRamIndices: Set<number>; // RAM addresses modified in last step (for UI highlight)
  changedSfrAddresses: Set<number>; // SFR addresses modified in last step
  changedXramIndices: Set<number>; // XRAM addresses modified in last step
}

export type ClockSpeedHz = 1000000 | 6000000 | 11059200 | 12000000 | 24000000;

export type SimulationSpeed = 0.25 | 0.5 | 1 | 2 | 5 | 10 | 999; // 999 = unlimited/max

export interface DisassembledInstruction {
  address: number;
  bytes: number[];
  mnemonic: string;
  operands: string;
  cycles: number;
  length: number;
  sourceLine?: number;
}

export interface AssemblerError {
  line: number;
  column?: number;
  message: string;
  type: 'error' | 'warning';
}

export interface AssemblerResult {
  success: boolean;
  code: Uint8Array;
  programSize: number;
  startAddress: number;
  errors: AssemblerError[];
  symbolTable: Map<string, number>;
  addressToLine: Map<number, number>; // code address -> 1-based source line
  lineToAddress: Map<number, number>; // 1-based source line -> code address
  disassembly: DisassembledInstruction[];
}

export interface PinMapping {
  // LEDs (8 outputs): port (0-3), pin (0-7)
  leds: Array<{ port: number; pin: number }>;
  // Switches (8 inputs): port (0-3), pin (0-7)
  switches: Array<{ port: number; pin: number }>;
  // LCD 16x2
  lcd: {
    rs: { port: number; pin: number };
    rw: { port: number; pin: number };
    en: { port: number; pin: number };
    dataPort: number; // 0, 1, 2, or 3 (8-bit or 4-bit upper nibble)
    mode: '8bit' | '4bit';
  };
  // 4-Digit 7-Segment
  sevenSegment: {
    segmentPort: number; // P0-P3 driving segments a-g, dp
    digitPins: Array<{ port: number; pin: number }>; // 4 digits select
    activeLowSegments: boolean;
    activeLowDigits: boolean;
  };
  // 4x3 Keypad
  keypad: {
    rows: Array<{ port: number; pin: number }>; // 4 rows
    cols: Array<{ port: number; pin: number }>; // 3 cols
  };
  // DC Motor
  motor: {
    in1: { port: number; pin: number };
    in2: { port: number; pin: number };
    en: { port: number; pin: number };
  };
  // DAC Output Port
  dac: {
    port: number; // Port driving 8-bit R-2R ladder DAC
  };
  // ADC Input Port
  adc: {
    dataPort: number;
    startPin: { port: number; pin: number };
    eocPin: { port: number; pin: number };
  };
  // Analog Comparator (EdSim51: compares Vin pot with Vdac, outputs on P3.7)
  comparator: {
    pin: { port: number; pin: number };
  };
}

export type ConsoleLogType = 'info' | 'assembler' | 'cpu' | 'uart' | 'warning' | 'error';

export interface ConsoleMessage {
  id: string;
  timestamp: string;
  type: ConsoleLogType;
  text: string;
}
