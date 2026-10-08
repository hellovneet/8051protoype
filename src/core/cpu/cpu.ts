/**
 * Micro8051SiM 8051 CPU Core Emulator
 * Complete, cycle-accurate implementation of standard Intel 8051 microcontroller.
 */

import {
  CPUState,
  SFR_ADDRESSES,
  PSW_BITS,
  IE_BITS,
  TCON_BITS,
  SCON_BITS,
  INTERRUPT_VECTORS,
} from '../types.ts';

export class CPU8051 {
  public state: CPUState;

  // External data memory (64KB XRAM for MOVX)
  public get xram(): Uint8Array {
    return this.state.xram;
  }
  public set xram(val: Uint8Array) {
    this.state.xram = val;
  }

  // Serial callback hooks
  public onSerialTransmit?: (byte: number) => void;

  // Track if current instruction is Read-Modify-Write
  private isReadModifyWrite = false;

  constructor() {
    this.state = this.createInitialState();
    this.reset();
  }

  private createInitialState(): CPUState {
    const ram = new Uint8Array(256);
    const sfr = new Uint8Array(128); // 0x80 - 0xFF
    const codeMemory = new Uint8Array(65536);
    const xram = new Uint8Array(65536);

    return {
      pc: 0x0000,
      sp: 0x07,
      acc: 0x00,
      b: 0x00,
      psw: 0x00,
      dptr: 0x0000,
      activeBank: 0,
      r: [0, 0, 0, 0, 0, 0, 0, 0],
      ram,
      sfr,
      codeMemory,
      xram,
      portLatches: [0xFF, 0xFF, 0xFF, 0xFF],
      portPins: [0xFF, 0xFF, 0xFF, 0xFF],
      interruptPending: {
        ex0: false,
        et0: false,
        ex1: false,
        et1: false,
        es: false,
      },
      activeInterrupt: null,
      cycles: 0,
      instructionCount: 0,
      isHalted: false,
      lastCycleCost: 0,
      changedRamIndices: new Set<number>(),
      changedSfrAddresses: new Set<number>(),
      changedXramIndices: new Set<number>(),
    };
  }

  /**
   * Reset CPU to power-on default state
   */
  public reset(preserveCode = true): void {
    const code = preserveCode ? this.state.codeMemory : new Uint8Array(65536);

    this.state.pc = 0x0000;
    this.state.sp = 0x07;
    this.state.acc = 0x00;
    this.state.b = 0x00;
    this.state.psw = 0x00;
    this.state.dptr = 0x0000;
    this.state.activeBank = 0;
    this.state.r = [0, 0, 0, 0, 0, 0, 0, 0];

    // Clear RAM and XRAM
    this.state.ram.fill(0);
    this.state.sfr.fill(0);
    this.state.xram.fill(0);
    this.state.codeMemory = code;

    // Reset Ports to 0xFF
    this.state.portLatches = [0xFF, 0xFF, 0xFF, 0xFF];
    this.setSfrDirect(SFR_ADDRESSES.P0, 0xFF);
    this.setSfrDirect(SFR_ADDRESSES.P1, 0xFF);
    this.setSfrDirect(SFR_ADDRESSES.P2, 0xFF);
    this.setSfrDirect(SFR_ADDRESSES.P3, 0xFF);

    this.setSfrDirect(SFR_ADDRESSES.SP, 0x07);
    this.setSfrDirect(SFR_ADDRESSES.PCON, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.TCON, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.TMOD, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.TL0, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.TH0, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.TL1, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.TH1, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.SCON, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.IE, 0x00);
    this.setSfrDirect(SFR_ADDRESSES.IP, 0x00);

    this.state.interruptPending = {
      ex0: false,
      et0: false,
      ex1: false,
      et1: false,
      es: false,
    };
    this.state.activeInterrupt = null;
    this.state.cycles = 0;
    this.state.instructionCount = 0;
    this.state.isHalted = false;
    this.state.lastCycleCost = 0;
    this.state.changedRamIndices.clear();
    this.state.changedSfrAddresses.clear();
    this.state.changedXramIndices.clear();
    this.syncRegistersFromState();
  }

  /**
   * Load executable code into code memory
   */
  public loadProgram(code: Uint8Array, startAddress = 0x0000): void {
    for (let i = 0; i < code.length; i++) {
      if (i < this.state.codeMemory.length) {
        this.state.codeMemory[i] = code[i];
      }
    }
    this.state.pc = startAddress;
  }

  // --- REGISTER & FLAG ACCESSORS ---

  public getBitPsw(bitIndex: number): boolean {
    return ((this.state.psw >> bitIndex) & 0x01) === 1;
  }

  public setBitPsw(bitIndex: number, value: boolean): void {
    if (value) {
      this.state.psw |= 1 << bitIndex;
    } else {
      this.state.psw &= ~(1 << bitIndex);
    }
    this.updateBankFromPsw();
    this.setSfrDirect(SFR_ADDRESSES.PSW, this.state.psw);
  }

  private updateParity(): void {
    let acc = this.state.acc;
    let count = 0;
    while (acc > 0) {
      count += acc & 1;
      acc >>= 1;
    }
    this.setBitPsw(PSW_BITS.P, (count & 1) === 1);
  }

  private updateBankFromPsw(): void {
    const rs1 = (this.state.psw >> PSW_BITS.RS1) & 1;
    const rs0 = (this.state.psw >> PSW_BITS.RS0) & 1;
    this.state.activeBank = (rs1 << 1) | rs0;
    const bankStart = this.state.activeBank * 8;
    for (let i = 0; i < 8; i++) {
      this.state.r[i] = this.state.ram[bankStart + i];
    }
  }

  public syncRegistersFromState(): void {
    this.updateBankFromPsw();
    this.state.dptr = (this.getSfrDirect(SFR_ADDRESSES.DPH) << 8) | this.getSfrDirect(SFR_ADDRESSES.DPL);
  }

  // --- MEMORY ACCESS ---

  /**
   * Direct address read (0x00-0x7F = RAM, 0x80-0xFF = SFR)
   */
  public readDirect(addr: number): number {
    addr &= 0xFF;
    if (addr < 0x80) {
      return this.state.ram[addr];
    }
    return this.readSfr(addr);
  }

  /**
   * Direct address write (0x00-0x7F = RAM, 0x80-0xFF = SFR)
   */
  public writeDirect(addr: number, val: number): void {
    addr &= 0xFF;
    val &= 0xFF;
    if (addr < 0x80) {
      this.state.ram[addr] = val;
      this.state.changedRamIndices.add(addr);
      // Sync R0-R7 if writing to active register bank
      const bankStart = this.state.activeBank * 8;
      if (addr >= bankStart && addr < bankStart + 8) {
        this.state.r[addr - bankStart] = val;
      }
    } else {
      this.writeSfr(addr, val);
    }
  }

  /**
   * Indirect RAM read (@R0 or @R1) - supports full 256 bytes
   */
  public readIndirect(addr: number): number {
    addr &= 0xFF;
    return this.state.ram[addr];
  }

  /**
   * Indirect RAM write (@R0 or @R1) - supports full 256 bytes
   */
  public writeIndirect(addr: number, val: number): void {
    addr &= 0xFF;
    val &= 0xFF;
    this.state.ram[addr] = val;
    this.state.changedRamIndices.add(addr);
    const bankStart = this.state.activeBank * 8;
    if (addr >= bankStart && addr < bankStart + 8) {
      this.state.r[addr - bankStart] = val;
    }
  }

  /**
   * Read Register Rn (R0..R7)
   */
  public readR(index: number): number {
    const bankStart = this.state.activeBank * 8;
    return this.state.ram[bankStart + (index & 0x07)];
  }

  /**
   * Write Register Rn (R0..R7)
   */
  public writeR(index: number, val: number): void {
    val &= 0xFF;
    const addr = this.state.activeBank * 8 + (index & 0x07);
    this.state.ram[addr] = val;
    this.state.r[index & 0x07] = val;
    this.state.changedRamIndices.add(addr);
  }

  /**
   * Explicit Internal RAM read (00H-FFH, full 256 bytes)
   */
  public readRam(addr: number): number {
    return this.state.ram[addr & 0xFF];
  }

  /**
   * Explicit Internal RAM write (00H-FFH, full 256 bytes)
   * Synchronizes R0-R7 registers if writing into the active register bank.
   */
  public writeRam(addr: number, val: number): void {
    addr &= 0xFF;
    val &= 0xFF;
    this.state.ram[addr] = val;
    this.state.changedRamIndices.add(addr);
    const bankStart = this.state.activeBank * 8;
    if (addr >= bankStart && addr < bankStart + 8) {
      this.state.r[addr - bankStart] = val;
    }
  }

  /**
   * Explicit External Data Memory (XRAM) read (0000H-FFFFH)
   */
  public readXram(addr: number): number {
    return this.state.xram[addr & 0xFFFF];
  }

  /**
   * Explicit External Data Memory (XRAM) write (0000H-FFFFH)
   */
  public writeXram(addr: number, val: number): void {
    addr &= 0xFFFF;
    val &= 0xFF;
    this.state.xram[addr] = val;
    this.state.changedXramIndices.add(addr);
  }

  /**
   * Clear Internal RAM
   * @param scratchpadOnly If true, zeroes 30H-7FH; otherwise zeroes all 256 bytes.
   */
  public clearRam(scratchpadOnly = false): void {
    if (scratchpadOnly) {
      for (let i = 0x30; i < 0x80; i++) {
        this.state.ram[i] = 0;
      }
    } else {
      this.state.ram.fill(0);
      this.syncRegistersFromState();
    }
    this.state.changedRamIndices.clear();
  }

  /**
   * Clear all 64KB of External Data Memory (XRAM)
   */
  public clearXram(): void {
    this.state.xram.fill(0);
    this.state.changedXramIndices.clear();
  }

  // --- BIT ADDRESSING ---

  public readBit(bitAddr: number): boolean {
    bitAddr &= 0xFF;
    if (bitAddr < 0x80) {
      // RAM bit: byte (0x20 + bit/8), bit (bit % 8)
      const byteAddr = 0x20 + Math.floor(bitAddr / 8);
      const bitNum = bitAddr % 8;
      return ((this.state.ram[byteAddr] >> bitNum) & 1) === 1;
    } else {
      // SFR bit address: base SFR is (bitAddr & 0xF8)
      const sfrAddr = bitAddr & 0xF8;
      const bitNum = bitAddr & 0x07;
      const sfrVal = this.readSfr(sfrAddr);
      return ((sfrVal >> bitNum) & 1) === 1;
    }
  }

  public writeBit(bitAddr: number, val: boolean): void {
    bitAddr &= 0xFF;
    if (bitAddr < 0x80) {
      const byteAddr = 0x20 + Math.floor(bitAddr / 8);
      const bitNum = bitAddr % 8;
      let byteVal = this.state.ram[byteAddr];
      if (val) byteVal |= 1 << bitNum;
      else byteVal &= ~(1 << bitNum);
      this.state.ram[byteAddr] = byteVal;
      this.state.changedRamIndices.add(byteAddr);
    } else {
      const sfrAddr = bitAddr & 0xF8;
      const bitNum = bitAddr & 0x07;
      // Read-modify-write on SFR bit reads latch
      const oldVal = this.getSfrDirect(sfrAddr);
      const newVal = val ? oldVal | (1 << bitNum) : oldVal & ~(1 << bitNum);
      this.writeSfr(sfrAddr, newVal);
    }
  }

  // --- SFR READ & WRITE WITH HARDWARE SIDE-EFFECTS ---

  public getSfrDirect(sfrAddr: number): number {
    return this.state.sfr[(sfrAddr & 0xFF) - 0x80] ?? 0;
  }

  public setSfrDirect(sfrAddr: number, val: number): void {
    this.state.sfr[(sfrAddr & 0xFF) - 0x80] = val & 0xFF;
    this.state.changedSfrAddresses.add(sfrAddr & 0xFF);
  }

  public readSfr(sfrAddr: number): number {
    sfrAddr &= 0xFF;
    // Port pins vs latch
    if (sfrAddr === SFR_ADDRESSES.P0) {
      return this.isReadModifyWrite ? this.state.portLatches[0] : (this.state.portLatches[0] & this.state.portPins[0]);
    }
    if (sfrAddr === SFR_ADDRESSES.P1) {
      return this.isReadModifyWrite ? this.state.portLatches[1] : (this.state.portLatches[1] & this.state.portPins[1]);
    }
    if (sfrAddr === SFR_ADDRESSES.P2) {
      return this.isReadModifyWrite ? this.state.portLatches[2] : (this.state.portLatches[2] & this.state.portPins[2]);
    }
    if (sfrAddr === SFR_ADDRESSES.P3) {
      return this.isReadModifyWrite ? this.state.portLatches[3] : (this.state.portLatches[3] & this.state.portPins[3]);
    }

    if (sfrAddr === SFR_ADDRESSES.ACC) return this.state.acc;
    if (sfrAddr === SFR_ADDRESSES.B) return this.state.b;
    if (sfrAddr === SFR_ADDRESSES.PSW) return this.state.psw;
    if (sfrAddr === SFR_ADDRESSES.SP) return this.state.sp;

    return this.getSfrDirect(sfrAddr);
  }

  public writeSfr(sfrAddr: number, val: number): void {
    sfrAddr &= 0xFF;
    val &= 0xFF;

    this.setSfrDirect(sfrAddr, val);

    // Port Latch Update
    if (sfrAddr === SFR_ADDRESSES.P0) {
      this.state.portLatches[0] = val;
    } else if (sfrAddr === SFR_ADDRESSES.P1) {
      this.state.portLatches[1] = val;
    } else if (sfrAddr === SFR_ADDRESSES.P2) {
      this.state.portLatches[2] = val;
    } else if (sfrAddr === SFR_ADDRESSES.P3) {
      this.state.portLatches[3] = val;
    } else if (sfrAddr === SFR_ADDRESSES.ACC) {
      this.state.acc = val;
      this.updateParity();
    } else if (sfrAddr === SFR_ADDRESSES.B) {
      this.state.b = val;
    } else if (sfrAddr === SFR_ADDRESSES.PSW) {
      this.state.psw = val;
      this.updateBankFromPsw();
    } else if (sfrAddr === SFR_ADDRESSES.SP) {
      this.state.sp = val;
    } else if (sfrAddr === SFR_ADDRESSES.DPL) {
      this.state.dptr = (this.state.dptr & 0xFF00) | val;
    } else if (sfrAddr === SFR_ADDRESSES.DPH) {
      this.state.dptr = (this.state.dptr & 0x00FF) | (val << 8);
    } else if (sfrAddr === SFR_ADDRESSES.SBUF) {
      // UART transmission triggered
      if (this.onSerialTransmit) {
        this.onSerialTransmit(val);
      }
      // Set TI (Transmit Interrupt flag) in SCON
      const scon = this.getSfrDirect(SFR_ADDRESSES.SCON);
      this.setSfrDirect(SFR_ADDRESSES.SCON, scon | (1 << SCON_BITS.TI));
    }
  }

  // --- STACK OPERATIONS ---

  public push(val: number): void {
    this.state.sp = (this.state.sp + 1) & 0xFF;
    this.setSfrDirect(SFR_ADDRESSES.SP, this.state.sp);
    this.state.ram[this.state.sp] = val & 0xFF;
    this.state.changedRamIndices.add(this.state.sp);
  }

  public pop(): number {
    const val = this.state.ram[this.state.sp];
    this.state.sp = (this.state.sp - 1) & 0xFF;
    this.setSfrDirect(SFR_ADDRESSES.SP, this.state.sp);
    return val;
  }

  // --- TIMERS & INTERRUPTS UPDATE ---

  public stepTimers(cycles: number): void {
    const tcon = this.getSfrDirect(SFR_ADDRESSES.TCON);
    const tmod = this.getSfrDirect(SFR_ADDRESSES.TMOD);

    // Timer 0
    if ((tcon & (1 << TCON_BITS.TR0)) !== 0) {
      const mode0 = tmod & 0x03;
      let tl0 = this.getSfrDirect(SFR_ADDRESSES.TL0);
      let th0 = this.getSfrDirect(SFR_ADDRESSES.TH0);

      if (mode0 === 0) {
        // 13-bit timer
        let t13 = ((th0 & 0xFF) << 5) | (tl0 & 0x1F);
        t13 += cycles;
        if (t13 >= 0x2000) {
          t13 &= 0x1FFF;
          this.setSfrDirect(SFR_ADDRESSES.TCON, tcon | (1 << TCON_BITS.TF0));
        }
        this.setSfrDirect(SFR_ADDRESSES.TL0, t13 & 0x1F);
        this.setSfrDirect(SFR_ADDRESSES.TH0, (t13 >> 5) & 0xFF);
      } else if (mode0 === 1) {
        // 16-bit timer
        let t16 = (th0 << 8) | tl0;
        t16 += cycles;
        if (t16 >= 0x10000) {
          t16 &= 0xFFFF;
          this.setSfrDirect(SFR_ADDRESSES.TCON, tcon | (1 << TCON_BITS.TF0));
        }
        this.setSfrDirect(SFR_ADDRESSES.TL0, t16 & 0xFF);
        this.setSfrDirect(SFR_ADDRESSES.TH0, (t16 >> 8) & 0xFF);
      } else if (mode0 === 2) {
        // 8-bit auto-reload
        tl0 += cycles;
        if (tl0 >= 0x100) {
          tl0 = th0 + (tl0 - 0x100);
          this.setSfrDirect(SFR_ADDRESSES.TCON, tcon | (1 << TCON_BITS.TF0));
        }
        this.setSfrDirect(SFR_ADDRESSES.TL0, tl0 & 0xFF);
      }
    }

    // Timer 1
    if ((tcon & (1 << TCON_BITS.TR1)) !== 0) {
      const mode1 = (tmod >> 4) & 0x03;
      let tl1 = this.getSfrDirect(SFR_ADDRESSES.TL1);
      let th1 = this.getSfrDirect(SFR_ADDRESSES.TH1);

      if (mode1 === 0) {
        let t13 = ((th1 & 0xFF) << 5) | (tl1 & 0x1F);
        t13 += cycles;
        if (t13 >= 0x2000) {
          t13 &= 0x1FFF;
          this.setSfrDirect(SFR_ADDRESSES.TCON, tcon | (1 << TCON_BITS.TF1));
        }
        this.setSfrDirect(SFR_ADDRESSES.TL1, t13 & 0x1F);
        this.setSfrDirect(SFR_ADDRESSES.TH1, (t13 >> 5) & 0xFF);
      } else if (mode1 === 1) {
        let t16 = (th1 << 8) | tl1;
        t16 += cycles;
        if (t16 >= 0x10000) {
          t16 &= 0xFFFF;
          this.setSfrDirect(SFR_ADDRESSES.TCON, tcon | (1 << TCON_BITS.TF1));
        }
        this.setSfrDirect(SFR_ADDRESSES.TL1, t16 & 0xFF);
        this.setSfrDirect(SFR_ADDRESSES.TH1, (t16 >> 8) & 0xFF);
      } else if (mode1 === 2) {
        tl1 += cycles;
        if (tl1 >= 0x100) {
          tl1 = th1 + (tl1 - 0x100);
          this.setSfrDirect(SFR_ADDRESSES.TCON, tcon | (1 << TCON_BITS.TF1));
        }
        this.setSfrDirect(SFR_ADDRESSES.TL1, tl1 & 0xFF);
      }
    }
  }

  public checkInterrupts(): boolean {
    const ie = this.getSfrDirect(SFR_ADDRESSES.IE);
    const ea = (ie & (1 << IE_BITS.EA)) !== 0;
    if (!ea || this.state.activeInterrupt !== null) {
      return false;
    }

    const tcon = this.getSfrDirect(SFR_ADDRESSES.TCON);
    const scon = this.getSfrDirect(SFR_ADDRESSES.SCON);

    // External 0
    if ((ie & (1 << IE_BITS.EX0)) !== 0 && (tcon & (1 << TCON_BITS.IE0)) !== 0) {
      this.serviceInterrupt(INTERRUPT_VECTORS.EX0);
      this.setSfrDirect(SFR_ADDRESSES.TCON, tcon & ~(1 << TCON_BITS.IE0));
      return true;
    }

    // Timer 0
    if ((ie & (1 << IE_BITS.ET0)) !== 0 && (tcon & (1 << TCON_BITS.TF0)) !== 0) {
      this.serviceInterrupt(INTERRUPT_VECTORS.ET0);
      this.setSfrDirect(SFR_ADDRESSES.TCON, tcon & ~(1 << TCON_BITS.TF0));
      return true;
    }

    // External 1
    if ((ie & (1 << IE_BITS.EX1)) !== 0 && (tcon & (1 << TCON_BITS.IE1)) !== 0) {
      this.serviceInterrupt(INTERRUPT_VECTORS.EX1);
      this.setSfrDirect(SFR_ADDRESSES.TCON, tcon & ~(1 << TCON_BITS.IE1));
      return true;
    }

    // Timer 1
    if ((ie & (1 << IE_BITS.ET1)) !== 0 && (tcon & (1 << TCON_BITS.TF1)) !== 0) {
      this.serviceInterrupt(INTERRUPT_VECTORS.ET1);
      this.setSfrDirect(SFR_ADDRESSES.TCON, tcon & ~(1 << TCON_BITS.TF1));
      return true;
    }

    // Serial
    if ((ie & (1 << IE_BITS.ES)) !== 0) {
      const ti = (scon & (1 << SCON_BITS.TI)) !== 0;
      const ri = (scon & (1 << SCON_BITS.RI)) !== 0;
      if (ti || ri) {
        this.serviceInterrupt(INTERRUPT_VECTORS.ES);
        return true;
      }
    }

    return false;
  }

  private serviceInterrupt(vector: number): void {
    this.push(this.state.pc & 0xFF);
    this.push((this.state.pc >> 8) & 0xFF);
    this.state.pc = vector;
    this.state.activeInterrupt = vector;
  }

  // --- ARITHMETIC HELPERS ---

  private add8(val1: number, val2: number, carryIn: number): number {
    const sum = val1 + val2 + carryIn;
    const res = sum & 0xFF;

    // Carry out from bit 7
    this.setBitPsw(PSW_BITS.CY, sum > 0xFF);

    // Auxiliary Carry out from bit 3
    const ac = ((val1 & 0x0F) + (val2 & 0x0F) + carryIn) > 0x0F;
    this.setBitPsw(PSW_BITS.AC, ac);

    // Overflow flag (OV): signed overflow
    const ov = (!(((val1 ^ val2) & 0x80) !== 0) && (((val1 ^ res) & 0x80) !== 0));
    this.setBitPsw(PSW_BITS.OV, ov);

    return res;
  }

  private sub8(val1: number, val2: number, borrowIn: number): number {
    const diff = val1 - val2 - borrowIn;
    const res = diff & 0xFF;

    // Borrow out of bit 7
    this.setBitPsw(PSW_BITS.CY, diff < 0);

    // Auxiliary borrow out of bit 3
    const ac = (val1 & 0x0F) - (val2 & 0x0F) - borrowIn < 0;
    this.setBitPsw(PSW_BITS.AC, ac);

    // Overflow flag
    const ov = ((((val1 ^ val2) & 0x80) !== 0) && (((val1 ^ res) & 0x80) !== 0));
    this.setBitPsw(PSW_BITS.OV, ov);

    return res;
  }

  // --- STEP EXECUTION OF ONE INSTRUCTION ---

  public step(): number {
    if (this.state.isHalted) {
      return 0;
    }

    this.state.changedRamIndices.clear();
    this.state.changedSfrAddresses.clear();
    this.state.changedXramIndices.clear();

    // Check interrupts before executing instruction
    if (this.checkInterrupts()) {
      this.stepTimers(2);
      this.state.cycles += 2;
      this.state.lastCycleCost = 2;
      return 2;
    }

    const pc = this.state.pc;
    const getByte = (offset: number) => this.state.codeMemory[(pc + offset) & 0xFFFF];

    const op = getByte(0);
    let cycles = 1;
    let nextPc = (pc + 1) & 0xFFFF;

    // Set Read-Modify-Write flag for instructions that should read port latch
    this.isReadModifyWrite =
      op === 0x10 || // JBC
      op === 0xB2 || // CPL bit
      op === 0xC2 || // CLR bit
      op === 0xD2 || // SETB bit
      op === 0x92 || // MOV bit, C
      op === 0x05 || // INC direct
      op === 0x15 || // DEC direct
      op === 0xD5 || // DJNZ direct, rel
      op === 0x42 || op === 0x43 || // ORL direct, ...
      op === 0x52 || op === 0x53 || // ANL direct, ...
      op === 0x62 || op === 0x63;   // XRL direct, ...

    // Handle AJMP / ACALL
    if ((op & 0x1F) === 0x01) {
      // AJMP addr11
      const highBits = ((op >> 5) & 0x07) << 8;
      nextPc = (((pc + 2) & 0xF800) | highBits | getByte(1)) & 0xFFFF;
      cycles = 2;
      this.finishStep(nextPc, cycles);
      return cycles;
    }

    if ((op & 0x1F) === 0x11) {
      // ACALL addr11
      const returnPc = (pc + 2) & 0xFFFF;
      this.push(returnPc & 0xFF);
      this.push((returnPc >> 8) & 0xFF);
      const highBits = ((op >> 5) & 0x07) << 8;
      nextPc = (((pc + 2) & 0xF800) | highBits | getByte(1)) & 0xFFFF;
      cycles = 2;
      this.finishStep(nextPc, cycles);
      return cycles;
    }

    const regNum = op & 0x07;

    switch (op) {
      case 0x00: // NOP
        cycles = 1;
        break;

      case 0x02: // LJMP addr16
        nextPc = ((getByte(1) << 8) | getByte(2)) & 0xFFFF;
        cycles = 2;
        break;

      case 0x03: { // RR A
        const a = this.state.acc;
        this.writeSfr(SFR_ADDRESSES.ACC, ((a >> 1) | ((a & 1) << 7)) & 0xFF);
        break;
      }

      case 0x04: // INC A
        this.writeSfr(SFR_ADDRESSES.ACC, (this.state.acc + 1) & 0xFF);
        break;

      case 0x05: { // INC dir
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(addr, (this.readDirect(addr) + 1) & 0xFF);
        break;
      }

      case 0x06: // INC @R0
      case 0x07: { // INC @R1
        const rAddr = this.readR(op & 1);
        this.writeIndirect(rAddr, (this.readIndirect(rAddr) + 1) & 0xFF);
        break;
      }

      case 0x08: case 0x09: case 0x0A: case 0x0B:
      case 0x0C: case 0x0D: case 0x0E: case 0x0F: // INC Rn
        this.writeR(regNum, (this.readR(regNum) + 1) & 0xFF);
        break;

      case 0x10: { // JBC bit, rel
        const bitAddr = getByte(1);
        const rel = (getByte(2) << 24) >> 24;
        const bitVal = this.readBit(bitAddr);
        nextPc = (pc + 3) & 0xFFFF;
        if (bitVal) {
          this.writeBit(bitAddr, false);
          nextPc = (nextPc + rel) & 0xFFFF;
        }
        cycles = 2;
        break;
      }

      case 0x12: { // LCALL addr16
        const returnPc = (pc + 3) & 0xFFFF;
        this.push(returnPc & 0xFF);
        this.push((returnPc >> 8) & 0xFF);
        nextPc = ((getByte(1) << 8) | getByte(2)) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x13: { // RRC A
        const a = this.state.acc;
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        this.setBitPsw(PSW_BITS.CY, (a & 1) === 1);
        this.writeSfr(SFR_ADDRESSES.ACC, ((a >> 1) | (c << 7)) & 0xFF);
        break;
      }

      case 0x14: // DEC A
        this.writeSfr(SFR_ADDRESSES.ACC, (this.state.acc - 1) & 0xFF);
        break;

      case 0x15: { // DEC dir
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(addr, (this.readDirect(addr) - 1) & 0xFF);
        break;
      }

      case 0x16: // DEC @R0
      case 0x17: { // DEC @R1
        const rAddr = this.readR(op & 1);
        this.writeIndirect(rAddr, (this.readIndirect(rAddr) - 1) & 0xFF);
        break;
      }

      case 0x18: case 0x19: case 0x1A: case 0x1B:
      case 0x1C: case 0x1D: case 0x1E: case 0x1F: // DEC Rn
        this.writeR(regNum, (this.readR(regNum) - 1) & 0xFF);
        break;

      case 0x20: { // JB bit, rel
        const bitVal = this.readBit(getByte(1));
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        if (bitVal) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x22: { // RET
        const high = this.pop();
        const low = this.pop();
        nextPc = ((high << 8) | low) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x23: { // RL A
        const a = this.state.acc;
        this.writeSfr(SFR_ADDRESSES.ACC, (((a << 1) & 0xFE) | ((a >> 7) & 1)) & 0xFF);
        break;
      }

      case 0x24: { // ADD A, #data
        nextPc = (pc + 2) & 0xFFFF;
        const res = this.add8(this.state.acc, getByte(1), 0);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x25: { // ADD A, dir
        nextPc = (pc + 2) & 0xFFFF;
        const res = this.add8(this.state.acc, this.readDirect(getByte(1)), 0);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x26: case 0x27: { // ADD A, @Ri
        const val = this.readIndirect(this.readR(op & 1));
        const res = this.add8(this.state.acc, val, 0);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x28: case 0x29: case 0x2A: case 0x2B:
      case 0x2C: case 0x2D: case 0x2E: case 0x2F: { // ADD A, Rn
        const res = this.add8(this.state.acc, this.readR(regNum), 0);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x30: { // JNB bit, rel
        const bitVal = this.readBit(getByte(1));
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        if (!bitVal) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x32: { // RETI
        const high = this.pop();
        const low = this.pop();
        nextPc = ((high << 8) | low) & 0xFFFF;
        this.state.activeInterrupt = null;
        cycles = 2;
        break;
      }

      case 0x33: { // RLC A
        const a = this.state.acc;
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        this.setBitPsw(PSW_BITS.CY, ((a >> 7) & 1) === 1);
        this.writeSfr(SFR_ADDRESSES.ACC, (((a << 1) & 0xFE) | c) & 0xFF);
        break;
      }

      case 0x34: { // ADDC A, #data
        nextPc = (pc + 2) & 0xFFFF;
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const res = this.add8(this.state.acc, getByte(1), c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x35: { // ADDC A, dir
        nextPc = (pc + 2) & 0xFFFF;
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const res = this.add8(this.state.acc, this.readDirect(getByte(1)), c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x36: case 0x37: { // ADDC A, @Ri
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const val = this.readIndirect(this.readR(op & 1));
        const res = this.add8(this.state.acc, val, c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x38: case 0x39: case 0x3A: case 0x3B:
      case 0x3C: case 0x3D: case 0x3E: case 0x3F: { // ADDC A, Rn
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const res = this.add8(this.state.acc, this.readR(regNum), c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x40: { // JC rel
        const rel = (getByte(1) << 24) >> 24;
        nextPc = (pc + 2) & 0xFFFF;
        if (this.getBitPsw(PSW_BITS.CY)) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x42: { // ORL dir, A
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(addr, this.readDirect(addr) | this.state.acc);
        break;
      }

      case 0x43: { // ORL dir, #data
        const addr = getByte(1);
        const data = getByte(2);
        nextPc = (pc + 3) & 0xFFFF;
        this.writeDirect(addr, this.readDirect(addr) | data);
        cycles = 2;
        break;
      }

      case 0x44: // ORL A, #data
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc | getByte(1));
        break;

      case 0x45: // ORL A, dir
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc | this.readDirect(getByte(1)));
        break;

      case 0x46: case 0x47: // ORL A, @Ri
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc | this.readIndirect(this.readR(op & 1)));
        break;

      case 0x48: case 0x49: case 0x4A: case 0x4B:
      case 0x4C: case 0x4D: case 0x4E: case 0x4F: // ORL A, Rn
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc | this.readR(regNum));
        break;

      case 0x50: { // JNC rel
        const rel = (getByte(1) << 24) >> 24;
        nextPc = (pc + 2) & 0xFFFF;
        if (!this.getBitPsw(PSW_BITS.CY)) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x52: { // ANL dir, A
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(addr, this.readDirect(addr) & this.state.acc);
        break;
      }

      case 0x53: { // ANL dir, #data
        const addr = getByte(1);
        const data = getByte(2);
        nextPc = (pc + 3) & 0xFFFF;
        this.writeDirect(addr, this.readDirect(addr) & data);
        cycles = 2;
        break;
      }

      case 0x54: // ANL A, #data
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc & getByte(1));
        break;

      case 0x55: // ANL A, dir
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc & this.readDirect(getByte(1)));
        break;

      case 0x56: case 0x57: // ANL A, @Ri
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc & this.readIndirect(this.readR(op & 1)));
        break;

      case 0x58: case 0x59: case 0x5A: case 0x5B:
      case 0x5C: case 0x5D: case 0x5E: case 0x5F: // ANL A, Rn
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc & this.readR(regNum));
        break;

      case 0x60: { // JZ rel
        const rel = (getByte(1) << 24) >> 24;
        nextPc = (pc + 2) & 0xFFFF;
        if (this.state.acc === 0) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x62: { // XRL dir, A
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(addr, this.readDirect(addr) ^ this.state.acc);
        break;
      }

      case 0x63: { // XRL dir, #data
        const addr = getByte(1);
        const data = getByte(2);
        nextPc = (pc + 3) & 0xFFFF;
        this.writeDirect(addr, this.readDirect(addr) ^ data);
        cycles = 2;
        break;
      }

      case 0x64: // XRL A, #data
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc ^ getByte(1));
        break;

      case 0x65: // XRL A, dir
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc ^ this.readDirect(getByte(1)));
        break;

      case 0x66: case 0x67: // XRL A, @Ri
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc ^ this.readIndirect(this.readR(op & 1)));
        break;

      case 0x68: case 0x69: case 0x6A: case 0x6B:
      case 0x6C: case 0x6D: case 0x6E: case 0x6F: // XRL A, Rn
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.acc ^ this.readR(regNum));
        break;

      case 0x70: { // JNZ rel
        const rel = (getByte(1) << 24) >> 24;
        nextPc = (pc + 2) & 0xFFFF;
        if (this.state.acc !== 0) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x72: { // ORL C, bit
        nextPc = (pc + 2) & 0xFFFF;
        const b = this.readBit(getByte(1));
        this.setBitPsw(PSW_BITS.CY, this.getBitPsw(PSW_BITS.CY) || b);
        cycles = 2;
        break;
      }

      case 0x73: // JMP @A+DPTR
        nextPc = (this.state.acc + this.state.dptr) & 0xFFFF;
        cycles = 2;
        break;

      case 0x74: // MOV A, #data
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, getByte(1));
        break;

      case 0x75: { // MOV dir, #data
        const addr = getByte(1);
        const data = getByte(2);
        nextPc = (pc + 3) & 0xFFFF;
        this.writeDirect(addr, data);
        cycles = 2;
        break;
      }

      case 0x76: case 0x77: { // MOV @Ri, #data
        nextPc = (pc + 2) & 0xFFFF;
        this.writeIndirect(this.readR(op & 1), getByte(1));
        break;
      }

      case 0x78: case 0x79: case 0x7A: case 0x7B:
      case 0x7C: case 0x7D: case 0x7E: case 0x7F: // MOV Rn, #data
        nextPc = (pc + 2) & 0xFFFF;
        this.writeR(regNum, getByte(1));
        break;

      case 0x80: { // SJMP rel
        const rel = (getByte(1) << 24) >> 24;
        nextPc = ((pc + 2) + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x82: { // ANL C, bit
        nextPc = (pc + 2) & 0xFFFF;
        const b = this.readBit(getByte(1));
        this.setBitPsw(PSW_BITS.CY, this.getBitPsw(PSW_BITS.CY) && b);
        cycles = 2;
        break;
      }

      case 0x83: { // MOVC A, @A+PC
        const target = ((pc + 1) + this.state.acc) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.codeMemory[target]);
        cycles = 2;
        break;
      }

      case 0x84: { // DIV AB
        cycles = 4;
        const bVal = this.state.b;
        if (bVal === 0) {
          this.setBitPsw(PSW_BITS.OV, true);
        } else {
          this.setBitPsw(PSW_BITS.OV, false);
          const quotient = Math.floor(this.state.acc / bVal);
          const remainder = this.state.acc % bVal;
          this.writeSfr(SFR_ADDRESSES.ACC, quotient);
          this.writeSfr(SFR_ADDRESSES.B, remainder);
        }
        this.setBitPsw(PSW_BITS.CY, false);
        break;
      }

      case 0x85: { // MOV dir, dir (bytes: 85, src, dest)
        const srcAddr = getByte(1);
        const destAddr = getByte(2);
        nextPc = (pc + 3) & 0xFFFF;
        this.writeDirect(destAddr, this.readDirect(srcAddr));
        cycles = 2;
        break;
      }

      case 0x86: case 0x87: { // MOV dir, @Ri
        const dirAddr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(dirAddr, this.readIndirect(this.readR(op & 1)));
        cycles = 2;
        break;
      }

      case 0x88: case 0x89: case 0x8A: case 0x8B:
      case 0x8C: case 0x8D: case 0x8E: case 0x8F: { // MOV dir, Rn
        const dirAddr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(dirAddr, this.readR(regNum));
        cycles = 2;
        break;
      }

      case 0x90: { // MOV DPTR, #data16
        const dptr = ((getByte(1) << 8) | getByte(2)) & 0xFFFF;
        this.state.dptr = dptr;
        this.setSfrDirect(SFR_ADDRESSES.DPH, (dptr >> 8) & 0xFF);
        this.setSfrDirect(SFR_ADDRESSES.DPL, dptr & 0xFF);
        nextPc = (pc + 3) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0x92: { // MOV bit, C
        nextPc = (pc + 2) & 0xFFFF;
        this.writeBit(getByte(1), this.getBitPsw(PSW_BITS.CY));
        cycles = 2;
        break;
      }

      case 0x93: { // MOVC A, @A+DPTR
        const target = (this.state.dptr + this.state.acc) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.codeMemory[target]);
        cycles = 2;
        break;
      }

      case 0x94: { // SUBB A, #data
        nextPc = (pc + 2) & 0xFFFF;
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const res = this.sub8(this.state.acc, getByte(1), c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x95: { // SUBB A, dir
        nextPc = (pc + 2) & 0xFFFF;
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const res = this.sub8(this.state.acc, this.readDirect(getByte(1)), c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x96: case 0x97: { // SUBB A, @Ri
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const val = this.readIndirect(this.readR(op & 1));
        const res = this.sub8(this.state.acc, val, c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0x98: case 0x99: case 0x9A: case 0x9B:
      case 0x9C: case 0x9D: case 0x9E: case 0x9F: { // SUBB A, Rn
        const c = this.getBitPsw(PSW_BITS.CY) ? 1 : 0;
        const res = this.sub8(this.state.acc, this.readR(regNum), c);
        this.writeSfr(SFR_ADDRESSES.ACC, res);
        break;
      }

      case 0xA0: { // ORL C, /bit
        nextPc = (pc + 2) & 0xFFFF;
        const b = !this.readBit(getByte(1));
        this.setBitPsw(PSW_BITS.CY, this.getBitPsw(PSW_BITS.CY) || b);
        cycles = 2;
        break;
      }

      case 0xA2: { // MOV C, bit
        nextPc = (pc + 2) & 0xFFFF;
        this.setBitPsw(PSW_BITS.CY, this.readBit(getByte(1)));
        break;
      }

      case 0xA3: // INC DPTR
        this.state.dptr = (this.state.dptr + 1) & 0xFFFF;
        this.setSfrDirect(SFR_ADDRESSES.DPH, (this.state.dptr >> 8) & 0xFF);
        this.setSfrDirect(SFR_ADDRESSES.DPL, this.state.dptr & 0xFF);
        cycles = 2;
        break;

      case 0xA4: { // MUL AB
        cycles = 4;
        const prod = this.state.acc * this.state.b;
        this.writeSfr(SFR_ADDRESSES.ACC, prod & 0xFF);
        this.writeSfr(SFR_ADDRESSES.B, (prod >> 8) & 0xFF);
        this.setBitPsw(PSW_BITS.OV, prod > 0xFF);
        this.setBitPsw(PSW_BITS.CY, false);
        break;
      }

      case 0xA6: case 0xA7: { // MOV @Ri, dir
        const dirAddr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeIndirect(this.readR(op & 1), this.readDirect(dirAddr));
        cycles = 2;
        break;
      }

      case 0xA8: case 0xA9: case 0xAA: case 0xAB:
      case 0xAC: case 0xAD: case 0xAE: case 0xAF: { // MOV Rn, dir
        const dirAddr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeR(regNum, this.readDirect(dirAddr));
        cycles = 2;
        break;
      }

      case 0xB0: { // ANL C, /bit
        nextPc = (pc + 2) & 0xFFFF;
        const b = !this.readBit(getByte(1));
        this.setBitPsw(PSW_BITS.CY, this.getBitPsw(PSW_BITS.CY) && b);
        cycles = 2;
        break;
      }

      case 0xB2: { // CPL bit
        nextPc = (pc + 2) & 0xFFFF;
        const bitAddr = getByte(1);
        this.writeBit(bitAddr, !this.readBit(bitAddr));
        break;
      }

      case 0xB3: // CPL C
        this.setBitPsw(PSW_BITS.CY, !this.getBitPsw(PSW_BITS.CY));
        break;

      case 0xB4: { // CJNE A, #data, rel
        const data = getByte(1);
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        this.setBitPsw(PSW_BITS.CY, this.state.acc < data);
        if (this.state.acc !== data) {
          nextPc = (nextPc + rel) & 0xFFFF;
        }
        cycles = 2;
        break;
      }

      case 0xB5: { // CJNE A, dir, rel
        const dirVal = this.readDirect(getByte(1));
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        this.setBitPsw(PSW_BITS.CY, this.state.acc < dirVal);
        if (this.state.acc !== dirVal) {
          nextPc = (nextPc + rel) & 0xFFFF;
        }
        cycles = 2;
        break;
      }

      case 0xB6: case 0xB7: { // CJNE @Ri, #data, rel
        const val = this.readIndirect(this.readR(op & 1));
        const data = getByte(1);
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        this.setBitPsw(PSW_BITS.CY, val < data);
        if (val !== data) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0xB8: case 0xB9: case 0xBA: case 0xBB:
      case 0xBC: case 0xBD: case 0xBE: case 0xBF: { // CJNE Rn, #data, rel
        const rVal = this.readR(regNum);
        const data = getByte(1);
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        this.setBitPsw(PSW_BITS.CY, rVal < data);
        if (rVal !== data) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0xC0: { // PUSH dir
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.push(this.readDirect(addr));
        cycles = 2;
        break;
      }

      case 0xC2: { // CLR bit
        nextPc = (pc + 2) & 0xFFFF;
        this.writeBit(getByte(1), false);
        break;
      }

      case 0xC3: // CLR C
        this.setBitPsw(PSW_BITS.CY, false);
        break;

      case 0xC4: { // SWAP A
        const a = this.state.acc;
        this.writeSfr(SFR_ADDRESSES.ACC, ((a >> 4) | (a << 4)) & 0xFF);
        break;
      }

      case 0xC5: { // XCH A, dir
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        const val = this.readDirect(addr);
        this.writeDirect(addr, this.state.acc);
        this.writeSfr(SFR_ADDRESSES.ACC, val);
        break;
      }

      case 0xC6: case 0xC7: { // XCH A, @Ri
        const rAddr = this.readR(op & 1);
        const val = this.readIndirect(rAddr);
        this.writeIndirect(rAddr, this.state.acc);
        this.writeSfr(SFR_ADDRESSES.ACC, val);
        break;
      }

      case 0xC8: case 0xC9: case 0xCA: case 0xCB:
      case 0xCC: case 0xCD: case 0xCE: case 0xCF: { // XCH A, Rn
        const val = this.readR(regNum);
        this.writeR(regNum, this.state.acc);
        this.writeSfr(SFR_ADDRESSES.ACC, val);
        break;
      }

      case 0xD0: { // POP dir
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        const val = this.pop();
        this.writeDirect(addr, val);
        cycles = 2;
        break;
      }

      case 0xD2: { // SETB bit
        nextPc = (pc + 2) & 0xFFFF;
        this.writeBit(getByte(1), true);
        break;
      }

      case 0xD3: // SETB C
        this.setBitPsw(PSW_BITS.CY, true);
        break;

      case 0xD4: { // DA A (Decimal Adjust Accumulator)
        let a = this.state.acc;
        let cy = this.getBitPsw(PSW_BITS.CY);
        const ac = this.getBitPsw(PSW_BITS.AC);

        if ((a & 0x0F) > 9 || ac) {
          a += 6;
        }
        if (a > 0x9F || cy) {
          a += 0x60;
          cy = true;
        }
        this.setBitPsw(PSW_BITS.CY, cy);
        this.writeSfr(SFR_ADDRESSES.ACC, a & 0xFF);
        break;
      }

      case 0xD5: { // DJNZ dir, rel
        const addr = getByte(1);
        const rel = (getByte(2) << 24) >> 24;
        nextPc = (pc + 3) & 0xFFFF;
        const newVal = (this.readDirect(addr) - 1) & 0xFF;
        this.writeDirect(addr, newVal);
        if (newVal !== 0) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0xD6: case 0xD7: { // XCHD A, @Ri
        const rAddr = this.readR(op & 1);
        const val = this.readIndirect(rAddr);
        const newA = (this.state.acc & 0xF0) | (val & 0x0F);
        const newVal = (val & 0xF0) | (this.state.acc & 0x0F);
        this.writeIndirect(rAddr, newVal);
        this.writeSfr(SFR_ADDRESSES.ACC, newA);
        break;
      }

      case 0xD8: case 0xD9: case 0xDA: case 0xDB:
      case 0xDC: case 0xDD: case 0xDE: case 0xDF: { // DJNZ Rn, rel
        const rel = (getByte(1) << 24) >> 24;
        nextPc = (pc + 2) & 0xFFFF;
        const newVal = (this.readR(regNum) - 1) & 0xFF;
        this.writeR(regNum, newVal);
        if (newVal !== 0) nextPc = (nextPc + rel) & 0xFFFF;
        cycles = 2;
        break;
      }

      case 0xE0: { // MOVX A, @DPTR
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.xram[this.state.dptr]);
        cycles = 2;
        break;
      }

      case 0xE2: case 0xE3: { // MOVX A, @Ri
        const p2 = this.getSfrDirect(SFR_ADDRESSES.P2);
        const addr16 = (p2 << 8) | this.readR(op & 1);
        this.writeSfr(SFR_ADDRESSES.ACC, this.state.xram[addr16]);
        cycles = 2;
        break;
      }

      case 0xE4: // CLR A
        this.writeSfr(SFR_ADDRESSES.ACC, 0x00);
        break;

      case 0xE5: // MOV A, dir
        nextPc = (pc + 2) & 0xFFFF;
        this.writeSfr(SFR_ADDRESSES.ACC, this.readDirect(getByte(1)));
        break;

      case 0xE6: case 0xE7: // MOV A, @Ri
        this.writeSfr(SFR_ADDRESSES.ACC, this.readIndirect(this.readR(op & 1)));
        break;

      case 0xE8: case 0xE9: case 0xEA: case 0xEB:
      case 0xEC: case 0xED: case 0xEE: case 0xEF: // MOV A, Rn
        this.writeSfr(SFR_ADDRESSES.ACC, this.readR(regNum));
        break;

      case 0xF0: { // MOVX @DPTR, A
        this.state.xram[this.state.dptr] = this.state.acc;
        this.state.changedXramIndices.add(this.state.dptr);
        cycles = 2;
        break;
      }

      case 0xF2: case 0xF3: { // MOVX @Ri, A
        const p2 = this.getSfrDirect(SFR_ADDRESSES.P2);
        const addr16 = (p2 << 8) | this.readR(op & 1);
        this.state.xram[addr16] = this.state.acc;
        this.state.changedXramIndices.add(addr16);
        cycles = 2;
        break;
      }

      case 0xF4: // CPL A
        this.writeSfr(SFR_ADDRESSES.ACC, (~this.state.acc) & 0xFF);
        break;

      case 0xF5: { // MOV dir, A
        const addr = getByte(1);
        nextPc = (pc + 2) & 0xFFFF;
        this.writeDirect(addr, this.state.acc);
        break;
      }

      case 0xF6: case 0xF7: // MOV @Ri, A
        this.writeIndirect(this.readR(op & 1), this.state.acc);
        break;

      case 0xF8: case 0xF9: case 0xFA: case 0xFB:
      case 0xFC: case 0xFD: case 0xFE: case 0xFF: // MOV Rn, A
        this.writeR(regNum, this.state.acc);
        break;

      default:
        // Undefined opcode 0xA5
        cycles = 1;
        break;
    }

    this.finishStep(nextPc, cycles);
    return cycles;
  }

  private finishStep(nextPc: number, cycles: number): void {
    this.state.pc = nextPc;
    this.state.cycles += cycles;
    this.state.instructionCount++;
    this.state.lastCycleCost = cycles;
    this.stepTimers(cycles);
    this.syncRegistersFromState();
  }
}
