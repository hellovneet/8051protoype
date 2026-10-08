/**
 * Micro8051SiM 8051 Instruction Set Quick Reference Modal
 * Complete architectural instruction cheat sheet with search and filtering.
 */

import React, { useState } from 'react';
import { InstrumentButton } from '../common/InstrumentButton.tsx';

interface InstructionRefModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InstructionItem {
  mnemonic: string;
  operands: string;
  bytes: number;
  cycles: number;
  flags: string;
  desc: string;
  category: 'Data Transfer' | 'Arithmetic' | 'Logical' | 'Boolean' | 'Branch';
}

const INSTRUCTION_LIST: InstructionItem[] = [
  // Data Transfer
  { mnemonic: 'MOV', operands: 'A, #data', bytes: 2, cycles: 1, flags: 'None', desc: 'Move immediate data into Accumulator', category: 'Data Transfer' },
  { mnemonic: 'MOV', operands: 'A, dir', bytes: 2, cycles: 1, flags: 'None', desc: 'Move direct address byte into Accumulator', category: 'Data Transfer' },
  { mnemonic: 'MOV', operands: 'A, Rn', bytes: 1, cycles: 1, flags: 'None', desc: 'Move register Rn into Accumulator', category: 'Data Transfer' },
  { mnemonic: 'MOV', operands: 'dir, A', bytes: 2, cycles: 1, flags: 'None', desc: 'Move Accumulator into direct address', category: 'Data Transfer' },
  { mnemonic: 'MOV', operands: 'DPTR, #data16', bytes: 3, cycles: 2, flags: 'None', desc: 'Load 16-bit constant into Data Pointer', category: 'Data Transfer' },
  { mnemonic: 'PUSH', operands: 'dir', bytes: 2, cycles: 2, flags: 'None', desc: 'Push direct byte onto Stack', category: 'Data Transfer' },
  { mnemonic: 'POP', operands: 'dir', bytes: 2, cycles: 2, flags: 'None', desc: 'Pop byte from Stack into direct address', category: 'Data Transfer' },
  { mnemonic: 'XCH', operands: 'A, Rn / dir', bytes: 1, cycles: 1, flags: 'None', desc: 'Exchange Accumulator with register or direct byte', category: 'Data Transfer' },
  { mnemonic: 'MOVC', operands: 'A, @A+DPTR', bytes: 1, cycles: 2, flags: 'None', desc: 'Move Code byte relative to DPTR into A', category: 'Data Transfer' },
  { mnemonic: 'MOVX', operands: 'A, @DPTR', bytes: 1, cycles: 2, flags: 'None', desc: 'Read external RAM byte into Accumulator', category: 'Data Transfer' },
  { mnemonic: 'MOVX', operands: '@DPTR, A', bytes: 1, cycles: 2, flags: 'None', desc: 'Write Accumulator into external RAM', category: 'Data Transfer' },

  // Arithmetic
  { mnemonic: 'ADD', operands: 'A, #data / dir / Rn', bytes: 2, cycles: 1, flags: 'CY, AC, OV', desc: 'Add byte to Accumulator', category: 'Arithmetic' },
  { mnemonic: 'ADDC', operands: 'A, #data / dir / Rn', bytes: 2, cycles: 1, flags: 'CY, AC, OV', desc: 'Add with carry to Accumulator', category: 'Arithmetic' },
  { mnemonic: 'SUBB', operands: 'A, #data / dir / Rn', bytes: 2, cycles: 1, flags: 'CY, AC, OV', desc: 'Subtract with borrow from Accumulator', category: 'Arithmetic' },
  { mnemonic: 'INC', operands: 'A / Rn / dir / DPTR', bytes: 1, cycles: 1, flags: 'None', desc: 'Increment operand by 1', category: 'Arithmetic' },
  { mnemonic: 'DEC', operands: 'A / Rn / dir', bytes: 1, cycles: 1, flags: 'None', desc: 'Decrement operand by 1', category: 'Arithmetic' },
  { mnemonic: 'MUL', operands: 'AB', bytes: 1, cycles: 4, flags: 'CY=0, OV', desc: 'Unsigned multiply A * B -> Low A, High B', category: 'Arithmetic' },
  { mnemonic: 'DIV', operands: 'AB', bytes: 1, cycles: 4, flags: 'CY=0, OV', desc: 'Unsigned divide A / B -> Quotient A, Remainder B', category: 'Arithmetic' },
  { mnemonic: 'DA', operands: 'A', bytes: 1, cycles: 1, flags: 'CY', desc: 'Decimal Adjust Accumulator for packed BCD', category: 'Arithmetic' },

  // Logical
  { mnemonic: 'ANL', operands: 'A, #data / dir', bytes: 2, cycles: 1, flags: 'None', desc: 'Bitwise AND Accumulator with operand', category: 'Logical' },
  { mnemonic: 'ORL', operands: 'A, #data / dir', bytes: 2, cycles: 1, flags: 'None', desc: 'Bitwise OR Accumulator with operand', category: 'Logical' },
  { mnemonic: 'XRL', operands: 'A, #data / dir', bytes: 2, cycles: 1, flags: 'None', desc: 'Bitwise Exclusive-OR Accumulator with operand', category: 'Logical' },
  { mnemonic: 'CLR', operands: 'A', bytes: 1, cycles: 1, flags: 'None', desc: 'Clear Accumulator to 00H', category: 'Logical' },
  { mnemonic: 'CPL', operands: 'A', bytes: 1, cycles: 1, flags: 'None', desc: 'Complement (invert) Accumulator bits', category: 'Logical' },
  { mnemonic: 'RL', operands: 'A', bytes: 1, cycles: 1, flags: 'None', desc: 'Rotate Accumulator Left', category: 'Logical' },
  { mnemonic: 'RLC', operands: 'A', bytes: 1, cycles: 1, flags: 'CY', desc: 'Rotate Accumulator Left through Carry', category: 'Logical' },
  { mnemonic: 'RR', operands: 'A', bytes: 1, cycles: 1, flags: 'None', desc: 'Rotate Accumulator Right', category: 'Logical' },
  { mnemonic: 'RRC', operands: 'A', bytes: 1, cycles: 1, flags: 'CY', desc: 'Rotate Accumulator Right through Carry', category: 'Logical' },
  { mnemonic: 'SWAP', operands: 'A', bytes: 1, cycles: 1, flags: 'None', desc: 'Swap high and low nibbles of Accumulator', category: 'Logical' },

  // Boolean
  { mnemonic: 'CLR', operands: 'C / bit', bytes: 2, cycles: 1, flags: 'CY (if C)', desc: 'Clear Carry or addressed bit to 0', category: 'Boolean' },
  { mnemonic: 'SETB', operands: 'C / bit', bytes: 2, cycles: 1, flags: 'CY (if C)', desc: 'Set Carry or addressed bit to 1', category: 'Boolean' },
  { mnemonic: 'CPL', operands: 'C / bit', bytes: 2, cycles: 1, flags: 'CY (if C)', desc: 'Complement addressed bit', category: 'Boolean' },
  { mnemonic: 'MOV', operands: 'C, bit / bit, C', bytes: 2, cycles: 1, flags: 'CY', desc: 'Move bit to/from Carry flag', category: 'Boolean' },
  { mnemonic: 'ANL', operands: 'C, bit / C, /bit', bytes: 2, cycles: 2, flags: 'CY', desc: 'AND Carry with addressed bit', category: 'Boolean' },
  { mnemonic: 'ORL', operands: 'C, bit / C, /bit', bytes: 2, cycles: 2, flags: 'CY', desc: 'OR Carry with addressed bit', category: 'Boolean' },

  // Branch
  { mnemonic: 'SJMP', operands: 'rel', bytes: 2, cycles: 2, flags: 'None', desc: 'Short Jump relative (-128 to +127 bytes)', category: 'Branch' },
  { mnemonic: 'AJMP', operands: 'addr11', bytes: 2, cycles: 2, flags: 'None', desc: 'Absolute Jump within 2KB code page', category: 'Branch' },
  { mnemonic: 'LJMP', operands: 'addr16', bytes: 3, cycles: 2, flags: 'None', desc: 'Long Jump to 16-bit address (0-64KB)', category: 'Branch' },
  { mnemonic: 'JZ / JNZ', operands: 'rel', bytes: 2, cycles: 2, flags: 'None', desc: 'Jump if Accumulator is Zero / Not Zero', category: 'Branch' },
  { mnemonic: 'JC / JNC', operands: 'rel', bytes: 2, cycles: 2, flags: 'None', desc: 'Jump if Carry is Set / Not Set', category: 'Branch' },
  { mnemonic: 'JB / JNB', operands: 'bit, rel', bytes: 3, cycles: 2, flags: 'None', desc: 'Jump if bit is Set / Not Set', category: 'Branch' },
  { mnemonic: 'CJNE', operands: 'A/Rn, #data, rel', bytes: 3, cycles: 2, flags: 'CY', desc: 'Compare and Jump if Not Equal', category: 'Branch' },
  { mnemonic: 'DJNZ', operands: 'Rn/dir, rel', bytes: 2, cycles: 2, flags: 'None', desc: 'Decrement and Jump if Not Zero (Loops)', category: 'Branch' },
  { mnemonic: 'ACALL', operands: 'addr11', bytes: 2, cycles: 2, flags: 'None', desc: 'Absolute Subroutine Call (2KB page)', category: 'Branch' },
  { mnemonic: 'LCALL', operands: 'addr16', bytes: 3, cycles: 2, flags: 'None', desc: 'Long Subroutine Call (64KB)', category: 'Branch' },
  { mnemonic: 'RET', operands: '', bytes: 1, cycles: 2, flags: 'None', desc: 'Return from Subroutine', category: 'Branch' },
  { mnemonic: 'RETI', operands: '', bytes: 1, cycles: 2, flags: 'None', desc: 'Return from Interrupt Service Routine', category: 'Branch' },
  { mnemonic: 'NOP', operands: '', bytes: 1, cycles: 1, flags: 'None', desc: 'No Operation', category: 'Branch' },
];

export const InstructionRefModal: React.FC<InstructionRefModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('ALL');

  if (!isOpen) return null;

  const filtered = INSTRUCTION_LIST.filter((item) => {
    const matchesSearch =
      item.mnemonic.toLowerCase().includes(search.toLowerCase()) ||
      item.operands.toLowerCase().includes(search.toLowerCase()) ||
      item.desc.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === 'ALL' || item.category === filterCat;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
      <div className="bg-[#181512] border-2 border-[#3d3429] rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1a16] border-b border-[#302921]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#fbbf24]">
              8051 Instruction Set Reference Manual
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8c8275] hover:text-[#fef3c7] text-sm font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-[#141210] border-b border-[#26211a] flex flex-wrap items-center justify-between gap-2">
          <input
            type="text"
            placeholder="Search mnemonic or description (e.g. 'MOV', 'Jump', 'DIV')..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1b1713] border border-[#382f25] rounded px-3 py-1.5 text-xs text-[#fef3c7] placeholder:text-[#6b6255] w-72 focus:outline-none focus:border-[#d97706]"
          />

          <div className="flex flex-wrap gap-1">
            {['ALL', 'Data Transfer', 'Arithmetic', 'Logical', 'Boolean', 'Branch'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${
                  filterCat === cat
                    ? 'bg-[#d97706] text-[#121110] border-[#fbbf24]'
                    : 'bg-[#1e1a16] text-[#8c8275] border-[#382f25] hover:text-[#ded7cd]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions Table */}
        <div className="flex-1 overflow-y-auto p-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] text-[#786f64] border-b border-[#2b251f]">
                <th className="py-1 px-2 font-bold">MNEMONIC</th>
                <th className="py-1 px-2 font-bold">OPERANDS</th>
                <th className="py-1 px-2 font-bold">BYTES</th>
                <th className="py-1 px-2 font-bold">CYCLES</th>
                <th className="py-1 px-2 font-bold">FLAGS</th>
                <th className="py-1 px-2 font-bold">DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-[#1f1a15] border-b border-[#211c16] text-[11px]"
                >
                  <td className="py-1.5 px-2 font-bold text-[#fbbf24]">
                    {inst.mnemonic}
                  </td>
                  <td className="py-1.5 px-2 text-[#38bdf8]">
                    {inst.operands}
                  </td>
                  <td className="py-1.5 px-2 text-[#a89f92]">
                    {inst.bytes}
                  </td>
                  <td className="py-1.5 px-2 text-[#d97706] font-bold">
                    {inst.cycles}
                  </td>
                  <td className="py-1.5 px-2 text-[#f472b6]">
                    {inst.flags}
                  </td>
                  <td className="py-1.5 px-2 text-[#ded7cd]">
                    {inst.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2 bg-[#1e1a16] border-t border-[#302921]">
          <InstrumentButton variant="secondary" onClick={onClose}>
            Close
          </InstrumentButton>
        </div>
      </div>
    </div>
  );
};
