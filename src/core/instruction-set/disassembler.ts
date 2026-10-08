/**
 * 8051 Instruction Decoder and Disassembler
 * Micro8051SiM
 */

import { DisassembledInstruction, SFR_ADDRESSES } from '../types.ts';

// Map SFR address to name for clean disassembly
const SFR_NAME_BY_ADDR: Record<number, string> = {};
for (const [name, addr] of Object.entries(SFR_ADDRESSES)) {
  SFR_NAME_BY_ADDR[addr] = name;
}

export function formatDirectAddress(addr: number): string {
  if (SFR_NAME_BY_ADDR[addr]) {
    return SFR_NAME_BY_ADDR[addr];
  }
  return `${addr.toString(16).toUpperCase().padStart(2, '0')}H`;
}

export function formatBitAddress(bitAddr: number): string {
  if (bitAddr < 0x80) {
    // RAM bit 0x00 - 0x7F -> byte (0x20 + bit/8), bit (bit % 8)
    const byteAddr = 0x20 + Math.floor(bitAddr / 8);
    const bitNum = bitAddr % 8;
    return `${byteAddr.toString(16).toUpperCase().padStart(2, '0')}H.${bitNum}`;
  } else {
    // SFR bit address: base SFR is bitAddr & 0xF8
    const sfrAddr = bitAddr & 0xF8;
    const bitNum = bitAddr & 0x07;
    const sfrName = SFR_NAME_BY_ADDR[sfrAddr] || `${sfrAddr.toString(16).toUpperCase().padStart(2, '0')}H`;
    return `${sfrName}.${bitNum}`;
  }
}

/**
 * Disassemble a single instruction from a byte stream/memory at a given PC
 */
export function disassembleInstruction(
  code: Uint8Array | number[],
  pc: number
): DisassembledInstruction {
  const getByte = (offset: number) => {
    const addr = (pc + offset) & 0xFFFF;
    return code[addr] ?? 0;
  };

  const op = getByte(0);
  let mnemonic = '';
  let operands = '';
  let length = 1;
  let cycles = 1;

  // AJMP / ACALL masks:
  // AJMP: (page << 5) | 0x01  where page = (op >> 5)
  // ACALL: (page << 5) | 0x11
  if ((op & 0x1F) === 0x01) {
    mnemonic = 'AJMP';
    length = 2;
    cycles = 2;
    const highBits = ((op >> 5) & 0x07) << 8;
    const target = (((pc + 2) & 0xF800) | highBits | getByte(1)) & 0xFFFF;
    operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
    return {
      address: pc,
      bytes: [op, getByte(1)],
      mnemonic,
      operands,
      cycles,
      length,
    };
  }

  if ((op & 0x1F) === 0x11) {
    mnemonic = 'ACALL';
    length = 2;
    cycles = 2;
    const highBits = ((op >> 5) & 0x07) << 8;
    const target = (((pc + 2) & 0xF800) | highBits | getByte(1)) & 0xFFFF;
    operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
    return {
      address: pc,
      bytes: [op, getByte(1)],
      mnemonic,
      operands,
      cycles,
      length,
    };
  }

  // Register operand blocks (last 3 bits: 0..7 => R0..R7)
  const regNum = op & 0x07;
  const indReg = (op & 0x01) === 0 ? '@R0' : '@R1';

  switch (op) {
    case 0x00:
      mnemonic = 'NOP';
      break;

    case 0x02: {
      mnemonic = 'LJMP';
      length = 3;
      cycles = 2;
      const target = ((getByte(1) << 8) | getByte(2)) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x03:
      mnemonic = 'RR';
      operands = 'A';
      break;

    case 0x04:
      mnemonic = 'INC';
      operands = 'A';
      break;

    case 0x05:
      mnemonic = 'INC';
      operands = formatDirectAddress(getByte(1));
      length = 2;
      break;

    case 0x06:
    case 0x07:
      mnemonic = 'INC';
      operands = indReg;
      break;

    case 0x08:
    case 0x09:
    case 0x0A:
    case 0x0B:
    case 0x0C:
    case 0x0D:
    case 0x0E:
    case 0x0F:
      mnemonic = 'INC';
      operands = `R${regNum}`;
      break;

    case 0x10: {
      mnemonic = 'JBC';
      length = 3;
      cycles = 2;
      const bit = getByte(1);
      const rel = (getByte(2) << 24) >> 24; // signed
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `${formatBitAddress(bit)}, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x12: {
      mnemonic = 'LCALL';
      length = 3;
      cycles = 2;
      const target = ((getByte(1) << 8) | getByte(2)) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x13:
      mnemonic = 'RRC';
      operands = 'A';
      break;

    case 0x14:
      mnemonic = 'DEC';
      operands = 'A';
      break;

    case 0x15:
      mnemonic = 'DEC';
      operands = formatDirectAddress(getByte(1));
      length = 2;
      break;

    case 0x16:
    case 0x17:
      mnemonic = 'DEC';
      operands = indReg;
      break;

    case 0x18:
    case 0x19:
    case 0x1A:
    case 0x1B:
    case 0x1C:
    case 0x1D:
    case 0x1E:
    case 0x1F:
      mnemonic = 'DEC';
      operands = `R${regNum}`;
      break;

    case 0x20: {
      mnemonic = 'JB';
      length = 3;
      cycles = 2;
      const bit = getByte(1);
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `${formatBitAddress(bit)}, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x22:
      mnemonic = 'RET';
      cycles = 2;
      break;

    case 0x23:
      mnemonic = 'RL';
      operands = 'A';
      break;

    case 0x24:
      mnemonic = 'ADD';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x25:
      mnemonic = 'ADD';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0x26:
    case 0x27:
      mnemonic = 'ADD';
      operands = `A, ${indReg}`;
      break;

    case 0x28:
    case 0x29:
    case 0x2A:
    case 0x2B:
    case 0x2C:
    case 0x2D:
    case 0x2E:
    case 0x2F:
      mnemonic = 'ADD';
      operands = `A, R${regNum}`;
      break;

    case 0x30: {
      mnemonic = 'JNB';
      length = 3;
      cycles = 2;
      const bit = getByte(1);
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `${formatBitAddress(bit)}, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x32:
      mnemonic = 'RETI';
      cycles = 2;
      break;

    case 0x33:
      mnemonic = 'RLC';
      operands = 'A';
      break;

    case 0x34:
      mnemonic = 'ADDC';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x35:
      mnemonic = 'ADDC';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0x36:
    case 0x37:
      mnemonic = 'ADDC';
      operands = `A, ${indReg}`;
      break;

    case 0x38:
    case 0x39:
    case 0x3A:
    case 0x3B:
    case 0x3C:
    case 0x3D:
    case 0x3E:
    case 0x3F:
      mnemonic = 'ADDC';
      operands = `A, R${regNum}`;
      break;

    case 0x40: {
      mnemonic = 'JC';
      length = 2;
      cycles = 2;
      const rel = (getByte(1) << 24) >> 24;
      const target = (pc + 2 + rel) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x42:
      mnemonic = 'ORL';
      operands = `${formatDirectAddress(getByte(1))}, A`;
      length = 2;
      break;

    case 0x43:
      mnemonic = 'ORL';
      operands = `${formatDirectAddress(getByte(1))}, #${getByte(2).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 3;
      cycles = 2;
      break;

    case 0x44:
      mnemonic = 'ORL';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x45:
      mnemonic = 'ORL';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0x46:
    case 0x47:
      mnemonic = 'ORL';
      operands = `A, ${indReg}`;
      break;

    case 0x48:
    case 0x49:
    case 0x4A:
    case 0x4B:
    case 0x4C:
    case 0x4D:
    case 0x4E:
    case 0x4F:
      mnemonic = 'ORL';
      operands = `A, R${regNum}`;
      break;

    case 0x50: {
      mnemonic = 'JNC';
      length = 2;
      cycles = 2;
      const rel = (getByte(1) << 24) >> 24;
      const target = (pc + 2 + rel) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x52:
      mnemonic = 'ANL';
      operands = `${formatDirectAddress(getByte(1))}, A`;
      length = 2;
      break;

    case 0x53:
      mnemonic = 'ANL';
      operands = `${formatDirectAddress(getByte(1))}, #${getByte(2).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 3;
      cycles = 2;
      break;

    case 0x54:
      mnemonic = 'ANL';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x55:
      mnemonic = 'ANL';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0x56:
    case 0x57:
      mnemonic = 'ANL';
      operands = `A, ${indReg}`;
      break;

    case 0x58:
    case 0x59:
    case 0x5A:
    case 0x5B:
    case 0x5C:
    case 0x5D:
    case 0x5E:
    case 0x5F:
      mnemonic = 'ANL';
      operands = `A, R${regNum}`;
      break;

    case 0x60: {
      mnemonic = 'JZ';
      length = 2;
      cycles = 2;
      const rel = (getByte(1) << 24) >> 24;
      const target = (pc + 2 + rel) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x62:
      mnemonic = 'XRL';
      operands = `${formatDirectAddress(getByte(1))}, A`;
      length = 2;
      break;

    case 0x63:
      mnemonic = 'XRL';
      operands = `${formatDirectAddress(getByte(1))}, #${getByte(2).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 3;
      cycles = 2;
      break;

    case 0x64:
      mnemonic = 'XRL';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x65:
      mnemonic = 'XRL';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0x66:
    case 0x67:
      mnemonic = 'XRL';
      operands = `A, ${indReg}`;
      break;

    case 0x68:
    case 0x69:
    case 0x6A:
    case 0x6B:
    case 0x6C:
    case 0x6D:
    case 0x6E:
    case 0x6F:
      mnemonic = 'XRL';
      operands = `A, R${regNum}`;
      break;

    case 0x70: {
      mnemonic = 'JNZ';
      length = 2;
      cycles = 2;
      const rel = (getByte(1) << 24) >> 24;
      const target = (pc + 2 + rel) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x72:
      mnemonic = 'ORL';
      operands = `C, ${formatBitAddress(getByte(1))}`;
      length = 2;
      cycles = 2;
      break;

    case 0x73:
      mnemonic = 'JMP';
      operands = '@A+DPTR';
      cycles = 2;
      break;

    case 0x74:
      mnemonic = 'MOV';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x75:
      mnemonic = 'MOV';
      operands = `${formatDirectAddress(getByte(1))}, #${getByte(2).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 3;
      cycles = 2;
      break;

    case 0x76:
    case 0x77:
      mnemonic = 'MOV';
      operands = `${indReg}, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x78:
    case 0x79:
    case 0x7A:
    case 0x7B:
    case 0x7C:
    case 0x7D:
    case 0x7E:
    case 0x7F:
      mnemonic = 'MOV';
      operands = `R${regNum}, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x80: {
      mnemonic = 'SJMP';
      length = 2;
      cycles = 2;
      const rel = (getByte(1) << 24) >> 24;
      const target = (pc + 2 + rel) & 0xFFFF;
      operands = `${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0x82:
      mnemonic = 'ANL';
      operands = `C, ${formatBitAddress(getByte(1))}`;
      length = 2;
      cycles = 2;
      break;

    case 0x83:
      mnemonic = 'MOVC';
      operands = 'A, @A+PC';
      cycles = 2;
      break;

    case 0x84:
      mnemonic = 'DIV';
      operands = 'AB';
      cycles = 4;
      break;

    case 0x85:
      mnemonic = 'MOV';
      operands = `${formatDirectAddress(getByte(2))}, ${formatDirectAddress(getByte(1))}`;
      length = 3;
      cycles = 2;
      break;

    case 0x86:
    case 0x87:
      mnemonic = 'MOV';
      operands = `${formatDirectAddress(getByte(1))}, ${indReg}`;
      length = 2;
      cycles = 2;
      break;

    case 0x88:
    case 0x89:
    case 0x8A:
    case 0x8B:
    case 0x8C:
    case 0x8D:
    case 0x8E:
    case 0x8F:
      mnemonic = 'MOV';
      operands = `${formatDirectAddress(getByte(1))}, R${regNum}`;
      length = 2;
      cycles = 2;
      break;

    case 0x90: {
      mnemonic = 'MOV';
      const dptrVal = ((getByte(1) << 8) | getByte(2)) & 0xFFFF;
      operands = `DPTR, #${dptrVal.toString(16).toUpperCase().padStart(4, '0')}H`;
      length = 3;
      cycles = 2;
      break;
    }

    case 0x92:
      mnemonic = 'MOV';
      operands = `${formatBitAddress(getByte(1))}, C`;
      length = 2;
      cycles = 2;
      break;

    case 0x93:
      mnemonic = 'MOVC';
      operands = 'A, @A+DPTR';
      cycles = 2;
      break;

    case 0x94:
      mnemonic = 'SUBB';
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H`;
      length = 2;
      break;

    case 0x95:
      mnemonic = 'SUBB';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0x96:
    case 0x97:
      mnemonic = 'SUBB';
      operands = `A, ${indReg}`;
      break;

    case 0x98:
    case 0x99:
    case 0x9A:
    case 0x9B:
    case 0x9C:
    case 0x9D:
    case 0x9E:
    case 0x9F:
      mnemonic = 'SUBB';
      operands = `A, R${regNum}`;
      break;

    case 0xA0:
      mnemonic = 'ORL';
      operands = `C, /${formatBitAddress(getByte(1))}`;
      length = 2;
      cycles = 2;
      break;

    case 0xA2:
      mnemonic = 'MOV';
      operands = `C, ${formatBitAddress(getByte(1))}`;
      length = 2;
      break;

    case 0xA3:
      mnemonic = 'INC';
      operands = 'DPTR';
      cycles = 2;
      break;

    case 0xA4:
      mnemonic = 'MUL';
      operands = 'AB';
      cycles = 4;
      break;

    case 0xA5:
      mnemonic = 'DB';
      operands = '0A5H ; UNDEFINED';
      break;

    case 0xA6:
    case 0xA7:
      mnemonic = 'MOV';
      operands = `${indReg}, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      cycles = 2;
      break;

    case 0xA8:
    case 0xA9:
    case 0xAA:
    case 0xAB:
    case 0xAC:
    case 0xAD:
    case 0xAE:
    case 0xAF:
      mnemonic = 'MOV';
      operands = `R${regNum}, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      cycles = 2;
      break;

    case 0xB0:
      mnemonic = 'ANL';
      operands = `C, /${formatBitAddress(getByte(1))}`;
      length = 2;
      cycles = 2;
      break;

    case 0xB2:
      mnemonic = 'CPL';
      operands = formatBitAddress(getByte(1));
      length = 2;
      break;

    case 0xB3:
      mnemonic = 'CPL';
      operands = 'C';
      break;

    case 0xB4: {
      mnemonic = 'CJNE';
      length = 3;
      cycles = 2;
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `A, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0xB5: {
      mnemonic = 'CJNE';
      length = 3;
      cycles = 2;
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `A, ${formatDirectAddress(getByte(1))}, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0xB6:
    case 0xB7: {
      mnemonic = 'CJNE';
      length = 3;
      cycles = 2;
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `${indReg}, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0xB8:
    case 0xB9:
    case 0xBA:
    case 0xBB:
    case 0xBC:
    case 0xBD:
    case 0xBE:
    case 0xBF: {
      mnemonic = 'CJNE';
      length = 3;
      cycles = 2;
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `R${regNum}, #${getByte(1).toString(16).toUpperCase().padStart(2, '0')}H, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0xC0:
      mnemonic = 'PUSH';
      operands = formatDirectAddress(getByte(1));
      length = 2;
      cycles = 2;
      break;

    case 0xC2:
      mnemonic = 'CLR';
      operands = formatBitAddress(getByte(1));
      length = 2;
      break;

    case 0xC3:
      mnemonic = 'CLR';
      operands = 'C';
      break;

    case 0xC4:
      mnemonic = 'SWAP';
      operands = 'A';
      break;

    case 0xC5:
      mnemonic = 'XCH';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0xC6:
    case 0xC7:
      mnemonic = 'XCH';
      operands = `A, ${indReg}`;
      break;

    case 0xC8:
    case 0xC9:
    case 0xCA:
    case 0xCB:
    case 0xCC:
    case 0xCD:
    case 0xCE:
    case 0xCF:
      mnemonic = 'XCH';
      operands = `A, R${regNum}`;
      break;

    case 0xD0:
      mnemonic = 'POP';
      operands = formatDirectAddress(getByte(1));
      length = 2;
      cycles = 2;
      break;

    case 0xD2:
      mnemonic = 'SETB';
      operands = formatBitAddress(getByte(1));
      length = 2;
      break;

    case 0xD3:
      mnemonic = 'SETB';
      operands = 'C';
      break;

    case 0xD4:
      mnemonic = 'DA';
      operands = 'A';
      break;

    case 0xD5: {
      mnemonic = 'DJNZ';
      length = 3;
      cycles = 2;
      const rel = (getByte(2) << 24) >> 24;
      const target = (pc + 3 + rel) & 0xFFFF;
      operands = `${formatDirectAddress(getByte(1))}, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0xD6:
    case 0xD7:
      mnemonic = 'XCHD';
      operands = `A, ${indReg}`;
      break;

    case 0xD8:
    case 0xD9:
    case 0xDA:
    case 0xDB:
    case 0xDC:
    case 0xDD:
    case 0xDE:
    case 0xDF: {
      mnemonic = 'DJNZ';
      length = 2;
      cycles = 2;
      const rel = (getByte(1) << 24) >> 24;
      const target = (pc + 2 + rel) & 0xFFFF;
      operands = `R${regNum}, ${target.toString(16).toUpperCase().padStart(4, '0')}H`;
      break;
    }

    case 0xE0:
      mnemonic = 'MOVX';
      operands = 'A, @DPTR';
      cycles = 2;
      break;

    case 0xE2:
    case 0xE3:
      mnemonic = 'MOVX';
      operands = `A, ${indReg}`;
      cycles = 2;
      break;

    case 0xE4:
      mnemonic = 'CLR';
      operands = 'A';
      break;

    case 0xE5:
      mnemonic = 'MOV';
      operands = `A, ${formatDirectAddress(getByte(1))}`;
      length = 2;
      break;

    case 0xE6:
    case 0xE7:
      mnemonic = 'MOV';
      operands = `A, ${indReg}`;
      break;

    case 0xE8:
    case 0xE9:
    case 0xEA:
    case 0xEB:
    case 0xEC:
    case 0xED:
    case 0xEE:
    case 0xEF:
      mnemonic = 'MOV';
      operands = `A, R${regNum}`;
      break;

    case 0xF0:
      mnemonic = 'MOVX';
      operands = '@DPTR, A';
      cycles = 2;
      break;

    case 0xF2:
    case 0xF3:
      mnemonic = 'MOVX';
      operands = `${indReg}, A`;
      cycles = 2;
      break;

    case 0xF4:
      mnemonic = 'CPL';
      operands = 'A';
      break;

    case 0xF5:
      mnemonic = 'MOV';
      operands = `${formatDirectAddress(getByte(1))}, A`;
      length = 2;
      break;

    case 0xF6:
    case 0xF7:
      mnemonic = 'MOV';
      operands = `${indReg}, A`;
      break;

    case 0xF8:
    case 0xF9:
    case 0xFA:
    case 0xFB:
    case 0xFC:
    case 0xFD:
    case 0xFE:
    case 0xFF:
      mnemonic = 'MOV';
      operands = `R${regNum}, A`;
      break;

    default:
      mnemonic = 'DB';
      operands = `${op.toString(16).toUpperCase().padStart(2, '0')}H`;
      break;
  }

  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    bytes.push(getByte(i));
  }

  return {
    address: pc,
    bytes,
    mnemonic,
    operands,
    cycles,
    length,
  };
}
