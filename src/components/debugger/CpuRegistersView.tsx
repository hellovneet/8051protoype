/**
 * Micro8051SiM CPU Registers & State Inspector (High Contrast & EdSim51 Readability)
 * Real-time register display with HEX/DEC/BIN toggles and amber change highlights.
 */

import React, { useState } from 'react';
import { CPUState, PSW_BITS } from '../../core/types.ts';

interface CpuRegistersViewProps {
  cpuState: CPUState;
}

type DisplayFormat = 'hex' | 'dec' | 'bin';

export const CpuRegistersView: React.FC<CpuRegistersViewProps> = ({ cpuState }) => {
  const [format, setFormat] = useState<DisplayFormat>('hex');

  const formatByte = (val: number): string => {
    val &= 0xFF;
    if (format === 'hex') {
      return `${val.toString(16).toUpperCase().padStart(2, '0')}H`;
    }
    if (format === 'dec') {
      return val.toString(10);
    }
    return val.toString(2).padStart(8, '0') + 'B';
  };

  const formatWord = (val: number): string => {
    val &= 0xFFFF;
    if (format === 'hex') {
      return `${val.toString(16).toUpperCase().padStart(4, '0')}H`;
    }
    if (format === 'dec') {
      return val.toString(10);
    }
    return val.toString(2).padStart(16, '0') + 'B';
  };

  const pswFlags = [
    { label: 'CY', bit: PSW_BITS.CY, desc: 'Carry Flag' },
    { label: 'AC', bit: PSW_BITS.AC, desc: 'Auxiliary Carry' },
    { label: 'F0', bit: PSW_BITS.F0, desc: 'Flag 0' },
    { label: 'RS1', bit: PSW_BITS.RS1, desc: 'Register Bank Select 1' },
    { label: 'RS0', bit: PSW_BITS.RS0, desc: 'Register Bank Select 0' },
    { label: 'OV', bit: PSW_BITS.OV, desc: 'Overflow Flag' },
    { label: 'P', bit: PSW_BITS.P, desc: 'Parity Flag' },
  ];

  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-3 font-mono text-xs select-none shadow-sm">
      {/* Title & Format Switch */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-[#ffffff]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#fbbf24]">
            CPU Registers & PSW Flags
          </span>
        </div>

        <div className="inline-flex rounded border border-[#524d43] p-0.5 bg-[#141210]">
          {(['hex', 'dec', 'bin'] as DisplayFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase font-black rounded-xs cursor-pointer transition-colors ${
                format === fmt
                  ? 'bg-[#f59e0b] text-[#000000]'
                  : 'text-[#d4d4d8] hover:text-[#ffffff]'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Registers */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2.5">
        <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex flex-col items-center">
          <span className="text-[11px] text-[#fbbf24] font-black">ACC</span>
          <span className="text-[#ffffff] font-black text-sm">{formatByte(cpuState.acc)}</span>
        </div>

        <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex flex-col items-center">
          <span className="text-[11px] text-[#ffffff] font-black">B</span>
          <span className="text-[#ffffff] font-bold text-sm">{formatByte(cpuState.b)}</span>
        </div>

        <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex flex-col items-center">
          <span className="text-[11px] text-[#fbbf24] font-black">PC</span>
          <span className="text-[#fbbf24] font-black text-sm">{formatWord(cpuState.pc)}</span>
        </div>

        <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex flex-col items-center">
          <span className="text-[11px] text-[#ffffff] font-black">DPTR</span>
          <span className="text-[#ffffff] font-bold text-sm">{formatWord(cpuState.dptr)}</span>
        </div>

        <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex flex-col items-center">
          <span className="text-[11px] text-[#ffffff] font-black">SP</span>
          <span className="text-[#ffffff] font-bold text-sm">{formatByte(cpuState.sp)}</span>
        </div>

        <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex flex-col items-center">
          <span className="text-[11px] text-[#ffffff] font-black">PSW</span>
          <span className="text-[#ffffff] font-bold text-sm">{formatByte(cpuState.psw)}</span>
        </div>
      </div>

      {/* PSW Flags Banner */}
      <div className="bg-[#141210] border border-[#524d43] p-2 rounded-xs mb-2.5 flex items-center justify-between">
        <span className="text-[11px] text-[#fbbf24] font-black uppercase mr-2.5">PSW BITS:</span>
        <div className="flex-1 grid grid-cols-7 gap-1.5">
          {pswFlags.map((f) => {
            const isSet = ((cpuState.psw >> f.bit) & 1) === 1;
            return (
              <div
                key={f.label}
                className={`text-center py-1 rounded-xs border text-[11px] font-bold ${
                  isSet
                    ? 'bg-[#f59e0b] text-[#000000] font-black border-[#fbbf24]'
                    : 'bg-[#1c1917] text-[#a8a29e] border-[#44403c]'
                }`}
                title={`${f.desc}: ${isSet ? '1 (SET)' : '0 (CLR)'}`}
              >
                <div className="text-[10px] uppercase font-black">{f.label}</div>
                <div className="text-xs font-black">{isSet ? '1' : '0'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Working Registers R0 - R7 */}
      <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs mb-1.5 flex items-center justify-between">
        <span className="text-[10px] text-[#fbbf24] font-black uppercase mr-2 shrink-0">
          BANK {cpuState.activeBank}:
        </span>
        <div className="flex-1 grid grid-cols-8 gap-1">
          {cpuState.r.map((val, idx) => (
            <div
              key={idx}
              className="text-center bg-[#1c1917] border border-[#44403c] py-0.5 rounded-xs"
            >
              <div className="text-[10px] text-[#fbbf24] font-black">R{idx}</div>
              <div className="text-[11px] font-black text-[#ffffff]">{formatByte(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 8051 I/O Ports Latches (P0 - P3) */}
      <div className="bg-[#141210] border border-[#524d43] p-1.5 rounded-xs flex items-center justify-between text-[11px]">
        <span className="text-[10px] text-[#fbbf24] font-black uppercase mr-2 shrink-0">
          PORTS:
        </span>
        <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-[#1c1917] border border-[#44403c] py-0.5 rounded-xs">
            <span className="text-[#ffffff] text-[10px] font-bold">P0: </span>
            <span className="text-[#fbbf24] font-black">{formatByte(cpuState.portLatches[0])}</span>
          </div>
          <div className="bg-[#1c1917] border border-[#f59e0b] py-0.5 rounded-xs">
            <span className="text-[#fbbf24] text-[10px] font-black">P1 [LEDs]: </span>
            <span className="text-[#ffffff] font-black">{formatByte(cpuState.portLatches[1])}</span>
          </div>
          <div className="bg-[#1c1917] border border-[#44403c] py-0.5 rounded-xs">
            <span className="text-[#ffffff] text-[10px] font-bold">P2: </span>
            <span className="text-[#fbbf24] font-black">{formatByte(cpuState.portLatches[2])}</span>
          </div>
          <div className="bg-[#1c1917] border border-[#f59e0b] py-0.5 rounded-xs">
            <span className="text-[#fbbf24] text-[10px] font-black">P3 [SW]: </span>
            <span className="text-[#ffffff] font-black">{formatByte(cpuState.portPins[3])}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
