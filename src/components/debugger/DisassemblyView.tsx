/**
 * Micro8051SiM Machine Code Disassembly Inspector (EdSim51 Program Listing & Store Addresses)
 * Displays ROM Store Address, Hex Bytes, Mnemonics, Operands, and Machine Cycles.
 */

import React, { useState } from 'react';
import { DisassembledInstruction } from '../../core/types.ts';

interface DisassemblyViewProps {
  disassembly: DisassembledInstruction[];
  currentPc: number;
  breakpoints: Set<number>;
  onToggleBreakpoint: (address: number) => void;
}

export const DisassemblyView: React.FC<DisassemblyViewProps> = ({
  disassembly,
  currentPc,
  breakpoints,
  onToggleBreakpoint,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDisassembly = disassembly.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const addrHex = item.address.toString(16).toLowerCase();
    return (
      addrHex.includes(term) ||
      item.mnemonic.toLowerCase().includes(term) ||
      item.operands.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#141210] border border-[#524d43] p-2.5 text-xs font-mono select-none overflow-hidden rounded-sm shadow-sm">
      {/* Title & Search bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-[#ffffff]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#fbbf24]">
            EdSim51 Program Memory Listing (ROM Store Addresses)
          </span>
          <span className="bg-[#29221a] text-[#fbbf24] px-1.5 py-0.5 rounded-xs text-[10px] font-bold border border-[#785b34]">
            {disassembly.length} INSTRUCTIONS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search address (e.g. 0000) or opcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#1c1917] border border-[#524d43] text-[#ffffff] px-2 py-0.5 rounded-xs text-[11px] placeholder:text-[#78716c] focus:outline-none focus:border-[#fbbf24] w-48 font-medium"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#1c1917] z-10">
            <tr className="text-[11px] text-[#ffffff] border-b border-[#44403c]">
              <th className="py-1 px-1.5 w-8 text-center font-black">PC</th>
              <th className="py-1 px-2 font-black text-[#fbbf24]">STORE ADDR (ROM)</th>
              <th className="py-1 px-2 font-black text-[#38bdf8]">MACHINE BYTES (HEX)</th>
              <th className="py-1 px-2 font-black text-[#ffffff]">INSTRUCTION</th>
              <th className="py-1 px-2 font-black text-[#6ee7b7]">OPERANDS</th>
              <th className="py-1 px-1 text-center font-bold text-[#d4d4d8]">CYCLES</th>
            </tr>
          </thead>
          <tbody>
            {filteredDisassembly.map((item) => {
              const isCurrent = item.address === currentPc;
              const hasBreakpoint = breakpoints.has(item.address);
              const hexBytes = item.bytes
                .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');

              return (
                <tr
                  key={item.address}
                  className={`hover:bg-[#26221e] border-b border-[#24201c] cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-[#f59e0b] text-[#000000] font-black'
                      : 'hover:bg-[#292524]'
                  }`}
                  onClick={() => onToggleBreakpoint(item.address)}
                  title={`Store Address: 0x${item.address.toString(16).toUpperCase().padStart(4, '0')}H · Click to toggle breakpoint`}
                >
                  {/* Breakpoint / PC pointer */}
                  <td className="py-1 px-1.5 text-center">
                    {isCurrent ? (
                      <span className="text-[#000000] text-xs font-black animate-bounce inline-block">
                        ▶
                      </span>
                    ) : hasBreakpoint ? (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-[#ffffff] shadow-[0_0_6px_#ef4444]" />
                    ) : null}
                  </td>

                  {/* Store Address in ROM */}
                  <td
                    className={`py-1 px-2 text-xs font-black ${
                      isCurrent ? 'text-[#000000]' : 'text-[#fbbf24]'
                    }`}
                  >
                    0x{item.address.toString(16).toUpperCase().padStart(4, '0')}H
                  </td>

                  {/* Raw machine code hex bytes */}
                  <td
                    className={`py-1 px-2 text-[11px] font-mono font-bold ${
                      isCurrent ? 'text-[#000000]' : 'text-[#38bdf8]'
                    }`}
                  >
                    {hexBytes}
                  </td>

                  {/* Mnemonic */}
                  <td
                    className={`py-1 px-2 text-xs font-black ${
                      isCurrent ? 'text-[#000000]' : 'text-[#ffffff]'
                    }`}
                  >
                    {item.mnemonic}
                  </td>

                  {/* Operands */}
                  <td
                    className={`py-1 px-2 text-xs font-bold ${
                      isCurrent ? 'text-[#000000]' : 'text-[#6ee7b7]'
                    }`}
                  >
                    {item.operands}
                  </td>

                  {/* Machine cycles */}
                  <td
                    className={`py-1 px-1 text-center text-xs font-bold ${
                      isCurrent ? 'text-[#000000]' : 'text-[#d6d3d1]'
                    }`}
                  >
                    {item.cycles}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
