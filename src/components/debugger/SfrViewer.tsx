/**
 * Micro8051SiM Special Function Registers (SFR) Inspector (High Contrast & EdSim51 Readability)
 */

import React from 'react';
import { CPUState, SFR_ADDRESSES } from '../../core/types.ts';

interface SfrViewerProps {
  cpuState: CPUState;
}

interface SfrDefinition {
  name: string;
  address: number;
  description: string;
  bitAddressable: boolean;
}

const SFR_DEFINITIONS: SfrDefinition[] = [
  { name: 'P0', address: SFR_ADDRESSES.P0, description: 'Port 0 Latch', bitAddressable: true },
  { name: 'SP', address: SFR_ADDRESSES.SP, description: 'Stack Pointer', bitAddressable: false },
  { name: 'DPL', address: SFR_ADDRESSES.DPL, description: 'Data Pointer Low Byte', bitAddressable: false },
  { name: 'DPH', address: SFR_ADDRESSES.DPH, description: 'Data Pointer High Byte', bitAddressable: false },
  { name: 'PCON', address: SFR_ADDRESSES.PCON, description: 'Power Control Register', bitAddressable: false },
  { name: 'TCON', address: SFR_ADDRESSES.TCON, description: 'Timer/Counter Control', bitAddressable: true },
  { name: 'TMOD', address: SFR_ADDRESSES.TMOD, description: 'Timer/Counter Mode', bitAddressable: false },
  { name: 'TL0', address: SFR_ADDRESSES.TL0, description: 'Timer 0 Low Byte', bitAddressable: false },
  { name: 'TL1', address: SFR_ADDRESSES.TL1, description: 'Timer 1 Low Byte', bitAddressable: false },
  { name: 'TH0', address: SFR_ADDRESSES.TH0, description: 'Timer 0 High Byte', bitAddressable: false },
  { name: 'TH1', address: SFR_ADDRESSES.TH1, description: 'Timer 1 High Byte', bitAddressable: false },
  { name: 'P1', address: SFR_ADDRESSES.P1, description: 'Port 1 Latch', bitAddressable: true },
  { name: 'SCON', address: SFR_ADDRESSES.SCON, description: 'Serial Port Control', bitAddressable: true },
  { name: 'SBUF', address: SFR_ADDRESSES.SBUF, description: 'Serial Data Buffer', bitAddressable: false },
  { name: 'P2', address: SFR_ADDRESSES.P2, description: 'Port 2 Latch', bitAddressable: true },
  { name: 'IE', address: SFR_ADDRESSES.IE, description: 'Interrupt Enable', bitAddressable: true },
  { name: 'P3', address: SFR_ADDRESSES.P3, description: 'Port 3 Latch', bitAddressable: true },
  { name: 'IP', address: SFR_ADDRESSES.IP, description: 'Interrupt Priority', bitAddressable: true },
  { name: 'PSW', address: SFR_ADDRESSES.PSW, description: 'Program Status Word', bitAddressable: true },
  { name: 'ACC', address: SFR_ADDRESSES.ACC, description: 'Accumulator', bitAddressable: true },
  { name: 'B', address: SFR_ADDRESSES.B, description: 'B Register (Math)', bitAddressable: true },
];

export const SfrViewer: React.FC<SfrViewerProps> = ({ cpuState }) => {
  return (
    <div className="flex flex-col h-full bg-[#181614] border border-[#44403c] p-2.5 text-xs font-mono select-none rounded-sm">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <span className="text-xs font-black uppercase tracking-wider text-[#fbbf24]">
          Special Function Registers (SFR)
        </span>
        <span className="text-[11px] text-[#e7e5e4] font-bold">
          21 STANDARD REGISTERS
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] text-[#a8a29e] border-b border-[#38332c]">
              <th className="py-1 px-2 font-bold">NAME</th>
              <th className="py-1 px-2 font-bold">ADDR</th>
              <th className="py-1 px-2 text-center font-bold">HEX</th>
              <th className="py-1 px-2 text-center font-bold">BINARY</th>
              <th className="py-1 px-2 font-bold">DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {SFR_DEFINITIONS.map((def) => {
              const val = cpuState.sfr[def.address - 0x80] ?? 0;
              const isChanged = cpuState.changedSfrAddresses.has(def.address);

              return (
                <tr
                  key={def.name}
                  className="hover:bg-[#26221e] border-b border-[#2b2621] transition-colors"
                >
                  <td className="py-1 px-2 font-black text-[#fbbf24] text-xs">
                    {def.name}
                  </td>
                  <td className="py-1 px-2 text-[#a8a29e] text-[11px] font-bold">
                    0x{def.address.toString(16).toUpperCase()}H
                  </td>
                  <td
                    className={`py-1 px-2 text-center font-black text-xs ${
                      isChanged
                        ? 'bg-[#f59e0b]/40 text-[#fbbf24]'
                        : val !== 0
                        ? 'text-[#ffffff]'
                        : 'text-[#6b6255]'
                    }`}
                  >
                    0x{val.toString(16).toUpperCase().padStart(2, '0')}H
                  </td>
                  <td className="py-1 px-2 text-center font-mono text-[11px] text-[#e7e5e4] font-bold">
                    {val.toString(2).padStart(8, '0')}B
                  </td>
                  <td className="py-1 px-2 text-[#d6d3d1] text-[11px] truncate max-w-[150px]">
                    {def.description}
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
