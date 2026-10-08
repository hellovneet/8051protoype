/**
 * Micro8051SiM 8051 Assembler
 * Two-pass assembler with full standard instruction set, labels, EQU, ORG, DB, DW,
 * symbols, and detailed line/column diagnostic messages.
 */

import {
  AssemblerError,
  AssemblerResult,
  DisassembledInstruction,
  SFR_ADDRESSES,
  PSW_BITS,
  IE_BITS,
  TCON_BITS,
  SCON_BITS,
} from '../types.ts';
import { disassembleInstruction } from '../instruction-set/disassembler.ts';

// Standard bit name to bit address lookup
const BIT_NAME_TO_ADDR: Record<string, number> = {
  // PSW flags
  CY: 0xD0 + PSW_BITS.CY,
  AC: 0xD0 + PSW_BITS.AC,
  F0: 0xD0 + PSW_BITS.F0,
  RS1: 0xD0 + PSW_BITS.RS1,
  RS0: 0xD0 + PSW_BITS.RS0,
  OV: 0xD0 + PSW_BITS.OV,
  P: 0xD0 + PSW_BITS.P,

  // IE flags
  EA: 0xA8 + IE_BITS.EA,
  ES: 0xA8 + IE_BITS.ES,
  ET1: 0xA8 + IE_BITS.ET1,
  EX1: 0xA8 + IE_BITS.EX1,
  ET0: 0xA8 + IE_BITS.ET0,
  EX0: 0xA8 + IE_BITS.EX0,

  // TCON flags
  TF1: 0x88 + TCON_BITS.TF1,
  TR1: 0x88 + TCON_BITS.TR1,
  TF0: 0x88 + TCON_BITS.TF0,
  TR0: 0x88 + TCON_BITS.TR0,
  IE1: 0x88 + TCON_BITS.IE1,
  IT1: 0x88 + TCON_BITS.IT1,
  IE0: 0x88 + TCON_BITS.IE0,
  IT0: 0x88 + TCON_BITS.IT0,

  // SCON flags
  SM0: 0x98 + SCON_BITS.SM0,
  SM1: 0x98 + SCON_BITS.SM1,
  SM2: 0x98 + SCON_BITS.SM2,
  REN: 0x98 + SCON_BITS.REN,
  TB8: 0x98 + SCON_BITS.TB8,
  RB8: 0x98 + SCON_BITS.RB8,
  TI: 0x98 + SCON_BITS.TI,
  RI: 0x98 + SCON_BITS.RI,
};

// Add P0.0-P0.7, P1.0-P1.7, P2.0-P2.7, P3.0-P3.7, ACC.0-ACC.7, B.0-B.7
const bitPortBases: Record<string, number> = {
  P0: 0x80,
  P1: 0x90,
  P2: 0xA0,
  P3: 0xB0,
  ACC: 0xE0,
  B: 0xF0,
  PSW: 0xD0,
  IE: 0xA8,
  IP: 0xB8,
  TCON: 0x88,
  SCON: 0x98,
};

for (const [portName, base] of Object.entries(bitPortBases)) {
  for (let i = 0; i < 8; i++) {
    BIT_NAME_TO_ADDR[`${portName}.${i}`] = base + i;
  }
}

export function parseNumberOrSymbol(
  token: string,
  symbols: Map<string, number>,
  allowUndefined = false
): number | null {
  const clean = token.trim();
  if (!clean) return null;

  // Immediate prefix check: if called with '#55H', strip '#'
  const valStr = clean.startsWith('#') ? clean.slice(1).trim() : clean;

  // Location counter ($)
  if (valStr === '$') {
    return symbols.get('$') ?? 0;
  }

  // Check symbols / EQUs
  if (symbols.has(valStr.toUpperCase())) {
    return symbols.get(valStr.toUpperCase())!;
  }

  // Check predefined SFRs
  if (valStr.toUpperCase() in SFR_ADDRESSES) {
    return (SFR_ADDRESSES as Record<string, number>)[valStr.toUpperCase()];
  }

  // Check character literal: 'A' or "A"
  if (
    (valStr.startsWith("'") && valStr.endsWith("'") && valStr.length === 3) ||
    (valStr.startsWith('"') && valStr.endsWith('"') && valStr.length === 3)
  ) {
    return valStr.charCodeAt(1);
  }

  // Hex format: 0FFH, FFH (if valid hex followed by H/h), 0x55, $55
  if (/^0x[0-9a-fA-F]+$/i.test(valStr)) {
    return parseInt(valStr.slice(2), 16);
  }
  if (/^\$[0-9a-fA-F]+$/i.test(valStr)) {
    return parseInt(valStr.slice(1), 16);
  }
  if (/^[0-9][0-9a-fA-F]*[hH]$/i.test(valStr)) {
    return parseInt(valStr.slice(0, -1), 16);
  }

  // Binary format: 10101010B or 0b10101010
  if (/^0b[01]+$/i.test(valStr)) {
    return parseInt(valStr.slice(2), 2);
  }
  if (/^[01]+[bB]$/i.test(valStr)) {
    return parseInt(valStr.slice(0, -1), 2);
  }

  // Decimal format: 1234 or +1234, -12
  if (/^-?[0-9]+[dD]?$/i.test(valStr)) {
    const dec = valStr.endsWith('d') || valStr.endsWith('D') ? valStr.slice(0, -1) : valStr;
    return parseInt(dec, 10);
  }

  // If allowUndefined is true (pass 1 symbol collection), return dummy 0
  if (allowUndefined) {
    return 0;
  }

  return null;
}

export function parseBitAddress(
  token: string,
  symbols: Map<string, number>,
  allowUndefined = false
): number | null {
  const clean = token.trim().toUpperCase();

  // Direct bit names like P1.0, CY, OV
  if (clean in BIT_NAME_TO_ADDR) {
    return BIT_NAME_TO_ADDR[clean];
  }

  // Bit notation like 20H.3 or RAM_BYTE.4
  if (clean.includes('.')) {
    const [bytePart, bitPart] = clean.split('.');
    const bitNum = parseInt(bitPart, 10);
    if (isNaN(bitNum) || bitNum < 0 || bitNum > 7) {
      return null;
    }
    const byteAddr = parseNumberOrSymbol(bytePart, symbols, allowUndefined);
    if (byteAddr === null) return null;

    if (byteAddr >= 0x20 && byteAddr <= 0x2F) {
      // RAM bit address: (byteAddr - 0x20) * 8 + bitNum
      return (byteAddr - 0x20) * 8 + bitNum;
    } else if (byteAddr >= 0x80 && (byteAddr & 0x07) === 0) {
      // Bit addressable SFR
      return byteAddr + bitNum;
    }
    return null;
  }

  // Explicit bit address number (00H - 0FFH)
  return parseNumberOrSymbol(token, symbols, allowUndefined);
}

interface ParsedLine {
  lineNum: number;
  label?: string;
  mnemonic?: string;
  operands: string[];
  rawLine: string;
}

/**
 * Split source line into label, mnemonic, operands, ignoring comments
 */
function tokenizeLine(line: string, lineNum: number): ParsedLine {
  // Strip comments
  const commentIdx = line.indexOf(';');
  const codePart = commentIdx !== -1 ? line.slice(0, commentIdx) : line;
  const trimmed = codePart.trim();

  const result: ParsedLine = {
    lineNum,
    operands: [],
    rawLine: line,
  };

  if (!trimmed) return result;

  let rest = trimmed;

  // Check if starts with a label (e.g. "START:" or "START EQU 50H")
  const colonIdx = rest.indexOf(':');
  if (colonIdx !== -1) {
    // Check if label contains spaces before colon
    const potentialLabel = rest.slice(0, colonIdx).trim();
    if (!potentialLabel.includes(' ') && !potentialLabel.includes('\t')) {
      result.label = potentialLabel.toUpperCase();
      rest = rest.slice(colonIdx + 1).trim();
    }
  }

  if (!rest) return result;

  // Extract mnemonic
  const tokens = rest.split(/\s+/);
  const firstToken = tokens[0].toUpperCase();

  // If second token is EQU, first token was label without colon
  if (tokens.length >= 2 && tokens[1].toUpperCase() === 'EQU') {
    result.label = firstToken;
    result.mnemonic = 'EQU';
    result.operands = [tokens.slice(2).join(' ')];
    return result;
  }

  result.mnemonic = firstToken;

  // Operands is everything after the mnemonic
  const afterMnemonic = rest.slice(tokens[0].length).trim();
  if (afterMnemonic) {
    // Split operands by comma, but respect quotes
    const ops: string[] = [];
    let cur = '';
    let inQuotes: string | null = null;
    for (let i = 0; i < afterMnemonic.length; i++) {
      const ch = afterMnemonic[i];
      if ((ch === '"' || ch === "'") && (!inQuotes || inQuotes === ch)) {
        inQuotes = inQuotes ? null : ch;
        cur += ch;
      } else if (ch === ',' && !inQuotes) {
        ops.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) {
      ops.push(cur.trim());
    }
    result.operands = ops;
  }

  return result;
}

/**
 * Assemble 8051 assembly source code
 */
export function assemble8051(source: string): AssemblerResult {
  const lines = source.split(/\r?\n/);
  const errors: AssemblerError[] = [];
  const symbols = new Map<string, number>();
  const parsedLines: ParsedLine[] = [];

  // Initialize standard symbols (SFR names)
  for (const [name, addr] of Object.entries(SFR_ADDRESSES)) {
    symbols.set(name, addr);
  }

  // Pre-parse all lines
  for (let i = 0; i < lines.length; i++) {
    const parsed = tokenizeLine(lines[i], i + 1);
    parsedLines.push(parsed);
  }

  // PASS 1: Calculate PC offsets and collect labels / symbols
  let currentPc = 0x0000;
  let startAddress = 0x0000;
  let hasSetStart = false;

  for (const pl of parsedLines) {
    if (!pl.mnemonic && pl.label) {
      symbols.set(pl.label, currentPc);
      continue;
    }
    if (!pl.mnemonic) continue;

    const m = pl.mnemonic;

    if (m === 'ORG') {
      const addr = parseNumberOrSymbol(pl.operands[0] || '0', symbols, true);
      if (addr !== null) {
        currentPc = addr & 0xFFFF;
        if (!hasSetStart) {
          startAddress = currentPc;
          hasSetStart = true;
        }
      }
      if (pl.label) symbols.set(pl.label, currentPc);
      continue;
    }

    if (m === 'EQU') {
      if (pl.label && pl.operands[0]) {
        const val = parseNumberOrSymbol(pl.operands[0], symbols, true);
        if (val !== null) {
          symbols.set(pl.label, val);
        }
      }
      continue;
    }

    if (m === 'END') {
      break;
    }

    symbols.set('$', currentPc);

    if (pl.label) {
      symbols.set(pl.label, currentPc);
    }

    // Determine byte length of instruction in pass 1
    const len = estimateInstructionLength(pl, symbols);
    currentPc = (currentPc + len) & 0xFFFF;
  }

  // PASS 2: Emit machine code bytes
  const codeMemory = new Uint8Array(65536);
  const addressToLine = new Map<number, number>();
  const lineToAddress = new Map<number, number>();
  let emitPc = 0x0000;
  let maxAddress = 0;

  for (const pl of parsedLines) {
    if (pl.label && !pl.mnemonic) {
      lineToAddress.set(pl.lineNum, emitPc);
      continue;
    }

    if (!pl.mnemonic) continue;

    const m = pl.mnemonic;

    if (m === 'ORG') {
      const addr = parseNumberOrSymbol(pl.operands[0] || '0', symbols, false);
      if (addr === null) {
        errors.push({ line: pl.lineNum, message: `Invalid ORG address: "${pl.operands[0]}"`, type: 'error' });
      } else {
        emitPc = addr & 0xFFFF;
        lineToAddress.set(pl.lineNum, emitPc);
      }
      continue;
    }

    if (m === 'EQU') continue;
    if (m === 'END') break;

    const instrPc = emitPc;
    symbols.set('$', instrPc);
    addressToLine.set(instrPc, pl.lineNum);
    lineToAddress.set(pl.lineNum, instrPc);

    try {
      const bytes = encodeInstruction(pl, instrPc, symbols, errors);
      if (bytes && bytes.length > 0) {
        for (let b = 0; b < bytes.length; b++) {
          const target = (instrPc + b) & 0xFFFF;
          codeMemory[target] = bytes[b];
          if (target > maxAddress) maxAddress = target;
        }
        emitPc = (emitPc + bytes.length) & 0xFFFF;
      }
    } catch (err: unknown) {
      errors.push({
        line: pl.lineNum,
        message: err instanceof Error ? err.message : String(err),
        type: 'error',
      });
    }
  }

  // Build Disassembly view of the assembled code
  const disassembly: DisassembledInstruction[] = [];
  let dPc = startAddress;
  const endLimit = Math.max(maxAddress + 1, startAddress + 1);

  while (dPc < endLimit) {
    const dis = disassembleInstruction(codeMemory, dPc);
    if (addressToLine.has(dPc)) {
      dis.sourceLine = addressToLine.get(dPc);
    }
    disassembly.push(dis);
    dPc = (dPc + dis.length) & 0xFFFF;
  }

  return {
    success: errors.filter((e) => e.type === 'error').length === 0,
    code: codeMemory,
    programSize: maxAddress >= startAddress ? maxAddress - startAddress + 1 : 0,
    startAddress,
    errors,
    symbolTable: symbols,
    addressToLine,
    lineToAddress,
    disassembly,
  };
}

/**
 * Estimate instruction byte length for Pass 1
 */
function estimateInstructionLength(pl: ParsedLine, symbols: Map<string, number>): number {
  const m = pl.mnemonic!;
  const ops = pl.operands;

  if (m === 'DB') {
    let count = 0;
    for (const op of ops) {
      if ((op.startsWith('"') && op.endsWith('"')) || (op.startsWith("'") && op.endsWith("'"))) {
        count += op.length - 2;
      } else {
        count += 1;
      }
    }
    return Math.max(1, count);
  }

  if (m === 'DW') {
    return ops.length * 2;
  }

  if (m === 'NOP' || m === 'RET' || m === 'RETI' || m === 'DIV' || m === 'MUL' || m === 'DA' || m === 'SWAP') {
    return 1;
  }

  if (m === 'LJMP' || m === 'LCALL') return 3;
  if (m === 'SJMP' || m === 'AJMP' || m === 'ACALL') return 2;
  if (m === 'MOV DPTR' || (m === 'MOV' && ops[0]?.toUpperCase() === 'DPTR')) return 3;

  // Direct instructions with 3 bytes: MOV dir, #data; CJNE; DJNZ dir, rel; JBC, JB, JNB; MOV dir, dir
  if (m === 'CJNE') return 3;
  if (m === 'JB' || m === 'JNB' || m === 'JBC') return 3;
  if (m === 'DJNZ' && ops.length === 2 && !/^R[0-7]$/i.test(ops[0])) return 3;
  if (m === 'MOV' && ops.length === 2 && !/^A$/i.test(ops[0]) && !/^R[0-7]$/i.test(ops[0]) && !ops[0].startsWith('@') && ops[1].startsWith('#')) {
    return 3;
  }
  if (m === 'MOV' && ops.length === 2 && !/^A$/i.test(ops[0]) && !/^R[0-7]$/i.test(ops[0]) && !ops[0].startsWith('@') && !/^A$/i.test(ops[1]) && !/^R[0-7]$/i.test(ops[1]) && !ops[1].startsWith('@') && !ops[1].startsWith('#')) {
    return 3;
  }
  if (m === 'ORL' || m === 'ANL' || m === 'XRL') {
    if (ops.length === 2 && !/^A$/i.test(ops[0]) && !/^C$/i.test(ops[0]) && ops[1].startsWith('#')) return 3;
  }

  // Branch conditions
  if (m === 'JZ' || m === 'JNZ' || m === 'JC' || m === 'JNC' || m === 'DJNZ') return 2;
  if (m === 'PUSH' || m === 'POP' || m === 'SETB' || m === 'CLR' || m === 'CPL') {
    if (ops[0]?.toUpperCase() === 'C' || ops[0]?.toUpperCase() === 'A') return 1;
    return 2;
  }

  if (m === 'INC' || m === 'DEC') {
    if (/^A$/i.test(ops[0]) || /^R[0-7]$/i.test(ops[0]) || ops[0]?.startsWith('@') || /^DPTR$/i.test(ops[0])) return 1;
    return 2;
  }

  if (m === 'RL' || m === 'RLC' || m === 'RR' || m === 'RRC') return 1;
  if (m === 'MOVC' || m === 'MOVX' || m === 'JMP') return 1;

  if (ops.length === 2 && ops[1].startsWith('#')) return 2;
  if (ops.length === 2 && (ops[0] === 'A' || ops[1] === 'A')) {
    if (/^R[0-7]$/i.test(ops[0]) || /^R[0-7]$/i.test(ops[1]) || ops[0]?.startsWith('@') || ops[1]?.startsWith('@')) return 1;
    return 2;
  }

  return 2;
}

/**
 * Encode instruction into binary opcodes (Pass 2)
 */
function encodeInstruction(
  pl: ParsedLine,
  pc: number,
  symbols: Map<string, number>,
  errors: AssemblerError[]
): number[] {
  const m = pl.mnemonic!.toUpperCase();
  const ops = pl.operands;

  const getNum = (token: string): number => {
    if (token.trim() === '$') return pc;
    const val = parseNumberOrSymbol(token, symbols, false);
    if (val === null) {
      throw new Error(`Line ${pl.lineNum}: Undefined symbol or invalid number "${token}"`);
    }
    return val;
  };

  const getBit = (token: string): number => {
    const val = parseBitAddress(token, symbols, false);
    if (val === null) {
      throw new Error(`Line ${pl.lineNum}: Invalid bit address "${token}"`);
    }
    return val;
  };

  const getRel = (targetToken: string, instrLen: number): number => {
    const targetAddr = getNum(targetToken);
    const nextPc = (pc + instrLen) & 0xFFFF;
    const diff = targetAddr - nextPc;
    if (diff < -128 || diff > 127) {
      throw new Error(
        `Line ${pl.lineNum}: Relative jump out of range (${diff} bytes, allowed -128 to +127)`
      );
    }
    return (diff < 0 ? diff + 256 : diff) & 0xFF;
  };

  // DB Directive
  if (m === 'DB') {
    const bytes: number[] = [];
    for (const op of ops) {
      if ((op.startsWith('"') && op.endsWith('"')) || (op.startsWith("'") && op.endsWith("'"))) {
        const text = op.slice(1, -1);
        for (let i = 0; i < text.length; i++) {
          bytes.push(text.charCodeAt(i) & 0xFF);
        }
      } else {
        bytes.push(getNum(op) & 0xFF);
      }
    }
    return bytes;
  }

  // DW Directive
  if (m === 'DW') {
    const bytes: number[] = [];
    for (const op of ops) {
      const val = getNum(op);
      bytes.push((val >> 8) & 0xFF, val & 0xFF);
    }
    return bytes;
  }

  // NOP
  if (m === 'NOP') return [0x00];

  // RET / RETI
  if (m === 'RET') return [0x22];
  if (m === 'RETI') return [0x32];

  // SJMP rel
  if (m === 'SJMP') {
    return [0x80, getRel(ops[0], 2)];
  }

  // LJMP addr16
  if (m === 'LJMP') {
    const target = getNum(ops[0]);
    return [0x02, (target >> 8) & 0xFF, target & 0xFF];
  }

  // AJMP addr11
  if (m === 'AJMP') {
    const target = getNum(ops[0]);
    const nextPc = (pc + 2) & 0xFFFF;
    if ((target & 0xF800) !== (nextPc & 0xF800)) {
      errors.push({
        line: pl.lineNum,
        message: `AJMP target (0x${target.toString(16)}) is in a different 2KB page from PC (0x${nextPc.toString(16)})`,
        type: 'warning',
      });
    }
    const pageBits = (target >> 8) & 0x07;
    return [(pageBits << 5) | 0x01, target & 0xFF];
  }

  // LCALL addr16
  if (m === 'LCALL') {
    const target = getNum(ops[0]);
    return [0x12, (target >> 8) & 0xFF, target & 0xFF];
  }

  // ACALL addr11
  if (m === 'ACALL') {
    const target = getNum(ops[0]);
    const nextPc = (pc + 2) & 0xFFFF;
    const pageBits = (target >> 8) & 0x07;
    return [(pageBits << 5) | 0x11, target & 0xFF];
  }

  // JMP @A+DPTR
  if (m === 'JMP') {
    const clean = ops[0].replace(/\s+/g, '').toUpperCase();
    if (clean === '@A+DPTR') return [0x73];
    throw new Error(`Line ${pl.lineNum}: Expected "@A+DPTR" after JMP`);
  }

  // Conditional jumps: JZ, JNZ, JC, JNC
  if (m === 'JZ') return [0x60, getRel(ops[0], 2)];
  if (m === 'JNZ') return [0x70, getRel(ops[0], 2)];
  if (m === 'JC') return [0x40, getRel(ops[0], 2)];
  if (m === 'JNC') return [0x50, getRel(ops[0], 2)];

  // Bit jumps: JB, JNB, JBC
  if (m === 'JB') return [0x20, getBit(ops[0]), getRel(ops[1], 3)];
  if (m === 'JNB') return [0x30, getBit(ops[0]), getRel(ops[1], 3)];
  if (m === 'JBC') return [0x10, getBit(ops[0]), getRel(ops[1], 3)];

  // DJNZ
  if (m === 'DJNZ') {
    const regMatch = ops[0].toUpperCase().match(/^R([0-7])$/);
    if (regMatch) {
      return [0xD8 + parseInt(regMatch[1], 10), getRel(ops[1], 2)];
    }
    return [0xD5, getNum(ops[0]) & 0xFF, getRel(ops[1], 3)];
  }

  // CJNE
  if (m === 'CJNE') {
    const op1 = ops[0].toUpperCase();
    const op2 = ops[1];
    const rel = getRel(ops[2], 3);

    if (op1 === 'A') {
      if (op2.startsWith('#')) {
        return [0xB4, getNum(op2) & 0xFF, rel];
      }
      return [0xB5, getNum(op2) & 0xFF, rel];
    }
    const rMatch = op1.match(/^R([0-7])$/);
    if (rMatch) {
      return [0xB8 + parseInt(rMatch[1], 10), getNum(op2) & 0xFF, rel];
    }
    if (op1 === '@R0') return [0xB6, getNum(op2) & 0xFF, rel];
    if (op1 === '@R1') return [0xB7, getNum(op2) & 0xFF, rel];
    throw new Error(`Line ${pl.lineNum}: Invalid operands for CJNE`);
  }

  // INC
  if (m === 'INC') {
    const op = ops[0].toUpperCase();
    if (op === 'A') return [0x04];
    if (op === 'DPTR') return [0xA3];
    if (op === '@R0') return [0x06];
    if (op === '@R1') return [0x07];
    const rMatch = op.match(/^R([0-7])$/);
    if (rMatch) return [0x08 + parseInt(rMatch[1], 10)];
    return [0x05, getNum(op) & 0xFF];
  }

  // DEC
  if (m === 'DEC') {
    const op = ops[0].toUpperCase();
    if (op === 'A') return [0x14];
    if (op === '@R0') return [0x16];
    if (op === '@R1') return [0x17];
    const rMatch = op.match(/^R([0-7])$/);
    if (rMatch) return [0x18 + parseInt(rMatch[1], 10)];
    return [0x15, getNum(op) & 0xFF];
  }

  // MUL AB / DIV AB / DA A / SWAP A / RL A / RLC A / RR A / RRC A
  if (m === 'MUL' && ops[0]?.toUpperCase() === 'AB') return [0xA4];
  if (m === 'DIV' && ops[0]?.toUpperCase() === 'AB') return [0x84];
  if (m === 'DA' && ops[0]?.toUpperCase() === 'A') return [0xD4];
  if (m === 'SWAP' && ops[0]?.toUpperCase() === 'A') return [0xC4];
  if (m === 'RL' && ops[0]?.toUpperCase() === 'A') return [0x23];
  if (m === 'RLC' && ops[0]?.toUpperCase() === 'A') return [0x33];
  if (m === 'RR' && ops[0]?.toUpperCase() === 'A') return [0x03];
  if (m === 'RRC' && ops[0]?.toUpperCase() === 'A') return [0x13];

  // CLR / SETB / CPL
  if (m === 'CLR') {
    const op = ops[0].toUpperCase();
    if (op === 'A') return [0xE4];
    if (op === 'C') return [0xC3];
    return [0xC2, getBit(op)];
  }
  if (m === 'SETB') {
    const op = ops[0].toUpperCase();
    if (op === 'C') return [0xD3];
    return [0xD2, getBit(op)];
  }
  if (m === 'CPL') {
    const op = ops[0].toUpperCase();
    if (op === 'A') return [0xF4];
    if (op === 'C') return [0xB3];
    return [0xB2, getBit(op)];
  }

  // ADD / ADDC / SUBB
  if (m === 'ADD' || m === 'ADDC' || m === 'SUBB') {
    if (ops[0].toUpperCase() !== 'A') {
      throw new Error(`Line ${pl.lineNum}: First operand of ${m} must be A`);
    }
    const op2 = ops[1];
    const baseOp = m === 'ADD' ? 0x24 : m === 'ADDC' ? 0x34 : 0x94;

    if (op2.startsWith('#')) return [baseOp, getNum(op2) & 0xFF];
    if (op2.toUpperCase() === '@R0') return [baseOp + 2];
    if (op2.toUpperCase() === '@R1') return [baseOp + 3];
    const rMatch = op2.toUpperCase().match(/^R([0-7])$/);
    if (rMatch) return [baseOp + 4 + parseInt(rMatch[1], 10)];
    return [baseOp + 1, getNum(op2) & 0xFF];
  }

  // ANL / ORL / XRL
  if (m === 'ANL' || m === 'ORL' || m === 'XRL') {
    const op1 = ops[0].toUpperCase();
    const op2 = ops[1];
    const base = m === 'ORL' ? 0x40 : m === 'ANL' ? 0x50 : 0x60;

    // Bitwise boolean logic: ORL C, bit / ORL C, /bit
    if (op1 === 'C') {
      if (m === 'XRL') throw new Error(`Line ${pl.lineNum}: XRL C, bit is not supported in 8051`);
      if (op2.startsWith('/')) {
        return [m === 'ORL' ? 0xA0 : 0xB0, getBit(op2.slice(1))];
      }
      return [m === 'ORL' ? 0x72 : 0x82, getBit(op2)];
    }

    if (op1 === 'A') {
      if (op2.startsWith('#')) return [base + 0x04, getNum(op2) & 0xFF];
      if (op2.toUpperCase() === '@R0') return [base + 0x06];
      if (op2.toUpperCase() === '@R1') return [base + 0x07];
      const rMatch = op2.toUpperCase().match(/^R([0-7])$/);
      if (rMatch) return [base + 0x08 + parseInt(rMatch[1], 10)];
      return [base + 0x05, getNum(op2) & 0xFF];
    }

    // ANL direct, A or ANL direct, #imm
    if (op2.toUpperCase() === 'A') {
      return [base + 0x02, getNum(op1) & 0xFF];
    }
    if (op2.startsWith('#')) {
      return [base + 0x03, getNum(op1) & 0xFF, getNum(op2) & 0xFF];
    }
    throw new Error(`Line ${pl.lineNum}: Invalid operands for ${m}`);
  }

  // PUSH / POP
  if (m === 'PUSH') return [0xC0, getNum(ops[0]) & 0xFF];
  if (m === 'POP') return [0xD0, getNum(ops[0]) & 0xFF];

  // XCH / XCHD
  if (m === 'XCH') {
    if (ops[0].toUpperCase() !== 'A') throw new Error(`Line ${pl.lineNum}: First operand of XCH must be A`);
    const op2 = ops[1].toUpperCase();
    if (op2 === '@R0') return [0xC6];
    if (op2 === '@R1') return [0xC7];
    const rMatch = op2.match(/^R([0-7])$/);
    if (rMatch) return [0xC8 + parseInt(rMatch[1], 10)];
    return [0xC5, getNum(op2) & 0xFF];
  }

  if (m === 'XCHD') {
    if (ops[0].toUpperCase() !== 'A') throw new Error(`Line ${pl.lineNum}: First operand of XCHD must be A`);
    const op2 = ops[1].toUpperCase();
    if (op2 === '@R0') return [0xD6];
    if (op2 === '@R1') return [0xD7];
    throw new Error(`Line ${pl.lineNum}: XCHD only supports @R0 or @R1 as second operand`);
  }

  // MOVC
  if (m === 'MOVC') {
    const clean = `${ops[0]},${ops[1]}`.replace(/\s+/g, '').toUpperCase();
    if (clean === 'A,@A+DPTR') return [0x93];
    if (clean === 'A,@A+PC') return [0x83];
    throw new Error(`Line ${pl.lineNum}: MOVC requires "A, @A+DPTR" or "A, @A+PC"`);
  }

  // MOVX
  if (m === 'MOVX') {
    const op1 = ops[0].replace(/\s+/g, '').toUpperCase();
    const op2 = ops[1].replace(/\s+/g, '').toUpperCase();
    if (op1 === 'A' && op2 === '@DPTR') return [0xE0];
    if (op1 === 'A' && op2 === '@R0') return [0xE2];
    if (op1 === 'A' && op2 === '@R1') return [0xE3];
    if (op1 === '@DPTR' && op2 === 'A') return [0xF0];
    if (op1 === '@R0' && op2 === 'A') return [0xF2];
    if (op1 === '@R1' && op2 === 'A') return [0xF3];
    throw new Error(`Line ${pl.lineNum}: Invalid operands for MOVX`);
  }

  // MOV
  if (m === 'MOV') {
    const op1 = ops[0].trim();
    const op2 = ops[1].trim();
    const u1 = op1.toUpperCase();
    const u2 = op2.toUpperCase();

    // MOV DPTR, #data16
    if (u1 === 'DPTR') {
      const val = getNum(op2);
      return [0x90, (val >> 8) & 0xFF, val & 0xFF];
    }

    // MOV C, bit
    if (u1 === 'C') {
      return [0xA2, getBit(op2)];
    }

    // MOV bit, C
    if (u2 === 'C') {
      return [0x92, getBit(op1)];
    }

    // MOV A, ...
    if (u1 === 'A') {
      if (op2.startsWith('#')) return [0x74, getNum(op2) & 0xFF];
      if (u2 === '@R0') return [0xE6];
      if (u2 === '@R1') return [0xE7];
      const rMatch = u2.match(/^R([0-7])$/);
      if (rMatch) return [0xE8 + parseInt(rMatch[1], 10)];
      return [0xE5, getNum(op2) & 0xFF];
    }

    // MOV Rn, ...
    const rMatch1 = u1.match(/^R([0-7])$/);
    if (rMatch1) {
      const rNum = parseInt(rMatch1[1], 10);
      if (u2 === 'A') return [0xF8 + rNum];
      if (op2.startsWith('#')) return [0x78 + rNum, getNum(op2) & 0xFF];
      return [0xA8 + rNum, getNum(op2) & 0xFF];
    }

    // MOV @Ri, ...
    if (u1 === '@R0' || u1 === '@R1') {
      const ind = u1 === '@R0' ? 0 : 1;
      if (u2 === 'A') return [0xF6 + ind];
      if (op2.startsWith('#')) return [0x76 + ind, getNum(op2) & 0xFF];
      return [0xA6 + ind, getNum(op2) & 0xFF];
    }

    // MOV direct, ...
    const dirAddr = getNum(op1) & 0xFF;
    if (u2 === 'A') return [0xF5, dirAddr];
    if (op2.startsWith('#')) return [0x75, dirAddr, getNum(op2) & 0xFF];
    if (u2 === '@R0') return [0x86, dirAddr];
    if (u2 === '@R1') return [0x87, dirAddr];
    const rMatch2 = u2.match(/^R([0-7])$/);
    if (rMatch2) return [0x88 + parseInt(rMatch2[1], 10), dirAddr];
    // MOV direct, direct (note: 8051 format is opcode 85H, src_addr, dest_addr)
    const srcDir = getNum(op2) & 0xFF;
    return [0x85, srcDir, dirAddr];
  }

  throw new Error(`Line ${pl.lineNum}: Unknown instruction "${m}"`);
}
