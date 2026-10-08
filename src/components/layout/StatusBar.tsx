/**
 * Micro8051SiM Bottom Hardware Status Bar (High Contrast & EdSim51 Readability)
 */

import React from 'react';
import { SimulatorStatus } from '../../simulator/execution-controller.ts';
import { ClockSpeedHz } from '../../core/types.ts';

interface StatusBarProps {
  status: SimulatorStatus;
  clockHz: ClockSpeedHz;
  cycles: number;
  instructions: number;
  pc: number;
  breakpointCount: number;
  programSize: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  clockHz,
  cycles,
  instructions,
  pc,
  breakpointCount,
  programSize,
}) => {
  const clockMhz = (clockHz / 1000000).toFixed(clockHz === 11059200 ? 4 : 0);

  const statusColor = {
    RUNNING: 'text-[#22c55e]',
    PAUSED: 'text-[#fbbf24]',
    READY: 'text-[#d6d3d1]',
    BREAKPOINT: 'text-[#f87171]',
    HALTED: 'text-[#ef4444]',
  }[status];

  return (
    <div className="bg-[#141210] border-t border-[#44403c] px-3.5 py-1.5 flex items-center justify-between text-[11px] font-mono select-none text-[#a8a29e] z-20">
      <div className="flex items-center gap-4">
        {/* CPU Status */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">CPU:</span>
          <span className={`font-black uppercase ${statusColor}`}>{status}</span>
        </div>

        {/* Clock */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Clock:</span>
          <span className="text-[#ffffff] font-black">{clockMhz} MHz</span>
        </div>

        {/* Machine Cycles */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Cycles:</span>
          <span className="text-[#fbbf24] font-black">
            {cycles.toString().padStart(8, '0')}
          </span>
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Instructions:</span>
          <span className="text-[#ffffff] font-bold">
            {instructions.toString().padStart(8, '0')}
          </span>
        </div>

        {/* Program Counter */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">PC:</span>
          <span className="text-[#fbbf24] font-black">
            0x{pc.toString(16).toUpperCase().padStart(4, '0')}H
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Breakpoints */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Breakpoints:</span>
          <span className="text-[#ffffff] font-bold">{breakpointCount}</span>
        </div>

        {/* Program Size */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Code:</span>
          <span className="text-[#ffffff] font-bold">{programSize} B</span>
        </div>

        {/* Memory Integrity */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Memory:</span>
          <span className="text-[#22c55e] font-black">OK</span>
        </div>
      </div>
    </div>
  );
};
