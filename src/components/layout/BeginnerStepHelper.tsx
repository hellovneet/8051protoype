/**
 * Micro8051SiM Beginner Step-by-Step Helper
 * Explains currently executing instruction, ROM Store Address, and guided actions in plain language.
 */

import React, { useState } from 'react';
import { CPUState, DisassembledInstruction } from '../../core/types.ts';

interface BeginnerStepHelperProps {
  cpuState: CPUState;
  disassembly: DisassembledInstruction[];
  onAssemble: () => void;
  onStep: () => void;
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
}

export const BeginnerStepHelper: React.FC<BeginnerStepHelperProps> = ({
  cpuState,
  disassembly,
  onAssemble,
  onStep,
  onRun,
  onReset,
  isRunning,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(true);

  // Find instruction currently at PC
  const currentInstruction = disassembly.find((d) => d.address === cpuState.pc);
  const nextInstructionIdx = disassembly.findIndex((d) => d.address === cpuState.pc);
  const nextInstruction = nextInstructionIdx >= 0 && nextInstructionIdx + 1 < disassembly.length
    ? disassembly[nextInstructionIdx + 1]
    : undefined;

  const getExplanation = (d?: DisassembledInstruction): string => {
    if (!d) return 'Waiting for program to be assembled or reset to 0000H.';
    const m = d.mnemonic.toUpperCase();
    const ops = d.operands;

    if (m === 'MOV') {
      if (ops.startsWith('A, #') || ops.startsWith('A,#')) {
        return `Loads literal constant value into Accumulator A. (A will become ${ops.split('#')[1]}).`;
      }
      if (ops.startsWith('P1, A') || ops.startsWith('P1,A')) {
        return `Transfers Accumulator A into Port 1 latch (Controls the 8 LEDs D7-D0 directly).`;
      }
      if (ops.startsWith('P1, #') || ops.startsWith('P1,#')) {
        return `Directly writes constant value into Port 1 (Turns connected LEDs ON/OFF).`;
      }
      if (ops.startsWith('P3, A') || ops.startsWith('P3,A')) {
        return `Transfers Accumulator A to Port 3.`;
      }
      if (ops.startsWith('P2, A') || ops.startsWith('P2,A')) {
        return `Transfers Accumulator A to Port 2 (Controls 7-Segment / Display selector).`;
      }
      if (ops.startsWith('P0, A') || ops.startsWith('P0,A')) {
        return `Transfers Accumulator A to Port 0.`;
      }
      if (/^R[0-7],\s*#/i.test(ops)) {
        return `Loads direct constant value into working register ${ops.split(',')[0].trim()}.`;
      }
      if (/^A,\s*R[0-7]/i.test(ops)) {
        return `Copies working register ${ops.split(',')[1].trim()} into Accumulator A.`;
      }
      if (/^R[0-7],\s*A/i.test(ops)) {
        return `Saves Accumulator A into working register ${ops.split(',')[0].trim()}.`;
      }
      if (/^DPTR,\s*#/i.test(ops)) {
        return `Loads 16-bit data pointer address into DPTR.`;
      }
      return `Copies data: ${ops}.`;
    }

    if (m === 'SETB') {
      return `Sets bit ${ops} to 1 (HIGH / 5V).`;
    }
    if (m === 'CLR') {
      return `Clears bit ${ops} to 0 (LOW / GND).`;
    }
    if (m === 'CPL') {
      return `Complements (inverts) bit or register ${ops} (1 becomes 0, 0 becomes 1).`;
    }
    if (m === 'DJNZ') {
      return `Decrements counter register and jumps if not zero (Classic loop delay mechanism).`;
    }
    if (m === 'CJNE') {
      return `Compares first operand with second. Jumps to label if they are NOT equal.`;
    }
    if (m === 'SJMP') {
      return `Short Jump: loops/jumps unconditionally to ${ops}.`;
    }
    if (m === 'LJMP') {
      return `Long Jump: jumps to 16-bit ROM address ${ops}.`;
    }
    if (m === 'AJMP' || m === 'JMP') {
      return `Jumps unconditionally to ${ops}.`;
    }
    if (m === 'ACALL' || m === 'LCALL') {
      return `Calls subroutine ${ops} (saves return address on stack SP).`;
    }
    if (m === 'RET') {
      return `Returns from subroutine back to original caller.`;
    }
    if (m === 'ADD' || m === 'ADDC') {
      return `Adds ${ops} to Accumulator A (updates CY, AC, OV flags).`;
    }
    if (m === 'SUBB') {
      return `Subtracts ${ops} with borrow from Accumulator A.`;
    }
    if (m === 'INC') {
      return `Increments ${ops} by 1.`;
    }
    if (m === 'DEC') {
      return `Decrements ${ops} by 1.`;
    }
    if (m === 'MUL') {
      return `Multiplies A by B (16-bit result stored in B:A).`;
    }
    if (m === 'DIV') {
      return `Divides A by B (Quotient in A, remainder in B).`;
    }
    if (m === 'NOP') {
      return `No operation (used for accurate microsecond timing delays).`;
    }

    return `Executes ${d.mnemonic} ${d.operands}. Machine cycle cost: ${d.cycles}.`;
  };

  const storeAddrHex = cpuState.pc.toString(16).toUpperCase().padStart(4, '0') + 'H';
  const hexBytesStr = currentInstruction
    ? currentInstruction.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    : '--';

  return (
    <div className="bg-[#1c1917] border-b border-[#524d43] px-3 py-1.5 font-mono text-xs select-none shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#f59e0b] text-[#000000] px-1.5 py-0.5 rounded-xs font-black text-[10px] tracking-wider uppercase">
            BEGINNER ASSISTANT
          </span>

          <span className="text-[#ffffff] font-bold text-[11px]">
            STORE ADDR (ROM): <strong className="text-[#fbbf24] text-xs font-black">{storeAddrHex}</strong>
          </span>

          {currentInstruction && (
            <span className="bg-[#141210] border border-[#524d43] px-2 py-0.5 rounded-xs text-[11px] font-black text-[#ffffff]">
              OPCODE: <strong className="text-[#38bdf8]">{hexBytesStr}</strong> · <strong className="text-[#fbbf24]">{currentInstruction.mnemonic} {currentInstruction.operands}</strong>
            </span>
          )}
        </div>

        {/* Quick Stepping Actions & Minimize */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onStep}
            className="px-2.5 py-0.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#000000] font-black rounded-xs text-[11px] cursor-pointer shadow-xs border border-[#fbbf24]"
            title="Execute exactly 1 instruction (F7)"
          >
            ⏭ STEP (F7)
          </button>

          <button
            onClick={isRunning ? onReset : onRun}
            className={`px-2 py-0.5 font-bold rounded-xs text-[11px] cursor-pointer border ${
              isRunning
                ? 'bg-[#ef4444] text-[#ffffff] border-[#f87171]'
                : 'bg-[#292524] text-[#ffffff] hover:bg-[#38332c] border-[#524d43]'
            }`}
          >
            {isRunning ? '⏹ STOP' : '▶ RUN'}
          </button>

          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="text-[#a8a29e] hover:text-[#ffffff] px-1.5 py-0.5 rounded-xs text-[10px] font-bold border border-[#44403c] cursor-pointer"
            title={isMinimized ? 'Expand Guide' : 'Minimize Guide'}
          >
            {isMinimized ? '▼ HELP' : '▲ HIDE'}
          </button>
        </div>
      </div>

      {/* Expanded Explanation Body */}
      {!isMinimized && (
        <div className="mt-1.5 pt-1.5 border-t border-[#38332c] flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px]">
          <div className="flex-1 flex items-start gap-1.5">
            <span className="text-[#fbbf24] font-black shrink-0">💡 What it does:</span>
            <span className="text-[#ffffff] font-medium leading-relaxed">
              {getExplanation(currentInstruction)}
              {nextInstruction && (
                <span className="text-[#a8a29e] ml-2 font-normal">
                  (Next at 0x{nextInstruction.address.toString(16).toUpperCase().padStart(4, '0')}H: <strong className="text-[#d4d4d8]">{nextInstruction.mnemonic} {nextInstruction.operands}</strong>)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[10px] text-[#a8a29e]">
            <span>1. Click <strong>⚡ ASSEMBLE</strong></span>
            <span>➔</span>
            <span>2. Click <strong>⏭ STEP</strong></span>
            <span>➔</span>
            <span>3. Watch <strong>LEDs & Registers</strong> update!</span>
          </div>
        </div>
      )}
    </div>
  );
};
