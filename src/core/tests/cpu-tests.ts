/**
 * Micro8051SiM Automated Self-Test Verification Suite
 * Verifies instruction set arithmetic, branching, memory, flags, and assembler.
 */

import { CPU8051 } from '../cpu/cpu.ts';
import { assemble8051 } from '../assembler/assembler.ts';
import { PSW_BITS } from '../types.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runCpuSelfTests(): TestResult[] {
  const results: TestResult[] = [];

  // Helper
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true, message: 'OK' });
    } catch (err: unknown) {
      results.push({
        name,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // 1. Test MOV and Register Bank
  test('MOV immediate and register bank', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV A,#55H
      MOV R0,A
      MOV R7,#0AAH
      MOV 30H,#12H
      MOV A,30H
      SJMP $
    `);
    if (!asm.success) throw new Error('Assembly failed');
    cpu.loadProgram(asm.code, 0x0000);

    // Step 5 instructions
    for (let i = 0; i < 5; i++) cpu.step();

    if (cpu.state.acc !== 0x12) throw new Error(`ACC expected 0x12, got 0x${cpu.state.acc.toString(16)}`);
    if (cpu.state.r[0] !== 0x55) throw new Error(`R0 expected 0x55, got 0x${cpu.state.r[0].toString(16)}`);
    if (cpu.state.r[7] !== 0xAA) throw new Error(`R7 expected 0xAA, got 0x${cpu.state.r[7].toString(16)}`);
    if (cpu.state.ram[0x30] !== 0x12) throw new Error(`RAM[30H] expected 0x12, got 0x${cpu.state.ram[0x30].toString(16)}`);
  });

  // 2. Test ADD, Carry, and Overflow
  test('ADD arithmetic and PSW flags (CY, AC, OV)', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV A,#0FFH
      ADD A,#01H       ; Should result in 00H with CY=1, AC=1
      SJMP $
    `);
    cpu.loadProgram(asm.code, 0x0000);
    cpu.step(); // MOV A,#FFH
    cpu.step(); // ADD A,#01H

    if (cpu.state.acc !== 0x00) throw new Error(`ACC expected 0x00, got 0x${cpu.state.acc.toString(16)}`);
    if (!cpu.getBitPsw(PSW_BITS.CY)) throw new Error('CY flag expected to be set');
    if (!cpu.getBitPsw(PSW_BITS.AC)) throw new Error('AC flag expected to be set');
  });

  // 3. Test MUL and DIV
  test('MUL AB multiplication', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV A,#12H
      MOV B,#05H
      MUL AB          ; 18 * 5 = 90 (5AH). A = 5AH, B = 00H
      SJMP $
    `);
    cpu.loadProgram(asm.code, 0x0000);
    cpu.step(); // MOV A,#12H
    cpu.step(); // MOV B,#05H
    cpu.step(); // MUL AB

    const accMul: number = cpu.state.acc;
    const bMul: number = cpu.state.b;
    if (accMul !== 0x5A) throw new Error(`MUL ACC expected 0x5A, got 0x${accMul.toString(16)}`);
    if (bMul !== 0x00) throw new Error(`MUL B expected 0x00, got 0x${bMul.toString(16)}`);
  });

  test('DIV AB division', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV A,#64H      ; 100
      MOV B,#0AH      ; 10
      DIV AB          ; 100 / 10 = 10 (0AH), rem 0. A = 0AH, B = 00H
      SJMP $
    `);
    cpu.loadProgram(asm.code, 0x0000);
    cpu.step(); // MOV A,#64H
    cpu.step(); // MOV B,#0AH
    cpu.step(); // DIV AB

    const accDiv: number = cpu.state.acc;
    const bDiv: number = cpu.state.b;
    if (accDiv !== 0x0A) throw new Error(`DIV ACC expected 0x0A, got 0x${accDiv.toString(16)}`);
    if (bDiv !== 0x00) throw new Error(`DIV B expected 0x00, got 0x${bDiv.toString(16)}`);
  });

  // 4. Test Subroutines LCALL, ACALL, RET and Stack
  test('LCALL and RET subroutine stack execution', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV R7,#00H
      LCALL SUB1
      MOV R6,#99H
      SJMP $

      SUB1:
      MOV R7,#42H
      RET
    `);
    cpu.loadProgram(asm.code, 0x0000);
    cpu.step(); // MOV R7,#00H
    cpu.step(); // LCALL SUB1
    cpu.step(); // MOV R7,#42H
    cpu.step(); // RET
    cpu.step(); // MOV R6,#99H

    if (cpu.state.r[7] !== 0x42) throw new Error(`R7 expected 0x42, got 0x${cpu.state.r[7].toString(16)}`);
    if (cpu.state.r[6] !== 0x99) throw new Error(`R6 expected 0x99, got 0x${cpu.state.r[6].toString(16)}`);
    if (cpu.state.sp !== 0x07) throw new Error(`SP expected 0x07 after RET, got 0x${cpu.state.sp.toString(16)}`);
  });

  // 5. Test DJNZ and CJNE Branching
  test('DJNZ loop countdown and CJNE compare', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV R2,#05H
      MOV A,#00H
      LOOP:
      INC A
      DJNZ R2,LOOP
      CJNE A,#05H,FAIL
      MOV R3,#88H
      SJMP $
      FAIL:
      MOV R3,#00H
      SJMP $
    `);
    cpu.loadProgram(asm.code, 0x0000);

    // Run until completion or max 50 steps
    for (let i = 0; i < 30; i++) {
      cpu.step();
    }

    if (cpu.state.acc !== 0x05) throw new Error(`ACC expected 0x05, got 0x${cpu.state.acc.toString(16)}`);
    if (cpu.state.r[3] !== 0x88) throw new Error(`R3 expected 0x88 (CJNE match), got 0x${cpu.state.r[3].toString(16)}`);
  });

  // 6. Test Ports and Bit Manipulation
  test('Bit manipulation (SETB, CLR, CPL) and Ports', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      MOV P1,#00H
      SETB P1.0
      SETB P1.7
      CPL P1.0
      SJMP $
    `);
    cpu.loadProgram(asm.code, 0x0000);
    cpu.step(); // MOV P1,#00H
    if (cpu.state.portLatches[1] !== 0x00) throw new Error('P1 latch expected 0x00');
    cpu.step(); // SETB P1.0
    if ((cpu.state.portLatches[1] & 0x01) !== 0x01) throw new Error('P1.0 expected to be 1');
    cpu.step(); // SETB P1.7
    if ((cpu.state.portLatches[1] & 0x80) !== 0x80) throw new Error('P1.7 expected to be 1');
    cpu.step(); // CPL P1.0
    if ((cpu.state.portLatches[1] & 0x01) !== 0x00) throw new Error('P1.0 expected to be complemented to 0');
  });

  // 7. Test Data Memory: Upper RAM (80H-FFH) indirect access and External Data Memory (XRAM)
  test('Data Memory (Internal Upper RAM @Ri and External XRAM MOVX)', () => {
    const cpu = new CPU8051();
    const asm = assemble8051(`
      ORG 0000H
      ; Test Upper 128B Internal RAM indirect access (80H-FFH)
      MOV R0,#85H
      MOV @R0,#0A5H
      MOV A,#00H
      MOV A,@R0

      ; Test External Data Memory (XRAM 64KB) via DPTR
      MOV DPTR,#2000H
      MOV A,#55H
      MOVX @DPTR,A
      MOV A,#00H
      MOVX A,@DPTR

      ; Test External Data Memory via Ri
      MOV P2,#30H
      MOV R1,#40H
      MOV A,#77H
      MOVX @R1,A
      MOV A,#00H
      MOVX A,@R1

      SJMP $
    `);
    if (!asm.success) throw new Error(`Assembly failed: ${asm.errors.join(', ')}`);
    cpu.loadProgram(asm.code, 0x0000);

    // Step through Upper RAM instructions
    cpu.step(); // MOV R0,#85H
    cpu.step(); // MOV @R0,#A5H
    cpu.step(); // MOV A,#00H
    cpu.step(); // MOV A,@R0

    if (cpu.state.ram[0x85] !== 0xA5) throw new Error(`Upper RAM[85H] expected 0xA5, got 0x${cpu.state.ram[0x85].toString(16)}`);
    const accR0: number = cpu.state.acc;
    if (accR0 !== 0xA5) throw new Error(`ACC expected 0xA5 from @R0, got 0x${accR0.toString(16)}`);

    // Step through External XRAM via DPTR
    cpu.step(); // MOV DPTR,#2000H
    cpu.step(); // MOV A,#55H
    cpu.step(); // MOVX @DPTR,A
    cpu.step(); // MOV A,#00H
    cpu.step(); // MOVX A,@DPTR

    if (cpu.readXram(0x2000) !== 0x55) throw new Error(`XRAM[2000H] expected 0x55, got 0x${cpu.readXram(0x2000).toString(16)}`);
    const accDptr: number = cpu.state.acc;
    if (accDptr !== 0x55) throw new Error(`ACC expected 0x55 from MOVX @DPTR, got 0x${accDptr.toString(16)}`);

    // Step through External XRAM via Ri (P2:R1 = 3040H)
    cpu.step(); // MOV P2,#30H
    cpu.step(); // MOV R1,#40H
    cpu.step(); // MOV A,#77H
    cpu.step(); // MOVX @R1,A
    cpu.step(); // MOV A,#00H
    cpu.step(); // MOVX A,@R1

    if (cpu.readXram(0x3040) !== 0x77) throw new Error(`XRAM[3040H] expected 0x77, got 0x${cpu.readXram(0x3040).toString(16)}`);
    const accRi: number = cpu.state.acc;
    if (accRi !== 0x77) throw new Error(`ACC expected 0x77 from MOVX @R1, got 0x${accRi.toString(16)}`);

    // Test clear functions
    cpu.clearRam(true);
    if (cpu.readRam(0x85) !== 0xA5) throw new Error('Scratchpad clear should not alter upper RAM');
    cpu.clearRam(false);
    if (cpu.readRam(0x85) !== 0x00) throw new Error('Full RAM clear should zero upper RAM');

    cpu.clearXram();
    if (cpu.readXram(0x2000) !== 0x00 || cpu.readXram(0x3040) !== 0x00) {
      throw new Error('clearXram should zero all XRAM');
    }
  });

  return results;
}
