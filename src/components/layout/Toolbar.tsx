/**
 * Micro8051SiM Instrument Control Toolbar (EdSim51 Readability & High Contrast)
 */

import React from 'react';
import { InstrumentButton } from '../common/InstrumentButton.tsx';
import { ClockSpeedHz, SimulationSpeed } from '../../core/types.ts';
import { SimulatorStatus } from '../../simulator/execution-controller.ts';
import { EXAMPLES, ExampleProgram } from '../../examples/examples.ts';

interface ToolbarProps {
  status: SimulatorStatus;
  clockHz: ClockSpeedHz;
  speed: SimulationSpeed;
  cycles: number;
  instructions: number;
  pc: number;
  selectedExampleId: string;
  onSelectExample: (ex: ExampleProgram) => void;
  onAssemble: () => void;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onChangeClock: (hz: ClockSpeedHz) => void;
  onChangeSpeed: (spd: SimulationSpeed) => void;
  isHighContrast?: boolean;
  onToggleHighContrast?: () => void;
  isAssembling?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  status,
  clockHz,
  speed,
  cycles,
  pc,
  selectedExampleId,
  onSelectExample,
  onAssemble,
  onRun,
  onPause,
  onStep,
  onReset,
  onChangeClock,
  onChangeSpeed,
  isHighContrast = false,
  onToggleHighContrast,
  isAssembling = false,
}) => {
  const isRunning = status === 'RUNNING';

  const statusColors = {
    READY: 'bg-[#292524] text-[#e7e5e4] border-[#57534e]',
    RUNNING: 'bg-[#f59e0b] text-[#000000] font-black border-[#fbbf24] shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse',
    PAUSED: 'bg-[#451a03] text-[#fbbf24] font-bold border-[#d97706]',
    BREAKPOINT: 'bg-[#dc2626] text-[#ffffff] font-black border-[#f87171]',
    HALTED: 'bg-[#450a0a] text-[#fca5a5] border-[#991b1b]',
  }[status];

  return (
    <div className="bg-[#1c1917] border-b border-[#44403c] px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 select-none font-mono text-xs shadow-sm">
      {/* 1. Left Section: Examples Selector & Assemble */}
      <div className="flex items-center gap-2">
        {/* Quick Example Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#141210] border border-[#524d43] px-2.5 py-1 rounded-sm">
          <span className="text-[11px] text-[#f59e0b] font-black uppercase">EXAMPLE:</span>
          <select
            value={selectedExampleId}
            onChange={(e) => {
              const ex = EXAMPLES.find((item) => item.id === e.target.value);
              if (ex) onSelectExample(ex);
            }}
            className="bg-transparent text-[#ffffff] font-bold text-xs outline-none cursor-pointer max-w-[190px] sm:max-w-[240px]"
          >
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id} className="bg-[#1c1917] text-[#ffffff]">
                {ex.title}
              </option>
            ))}
          </select>
        </div>

        {/* Assemble Button */}
        <InstrumentButton
          variant="amber"
          size="md"
          onClick={onAssemble}
          disabled={isAssembling}
          title="Assemble Assembly code into 8051 machine code (F4)"
          className="font-black text-[#000000] bg-[#f59e0b] hover:bg-[#fbbf24] border-[#fbbf24] px-3"
        >
          {isAssembling ? 'BUILDING...' : '⚡ ASSM'}
        </InstrumentButton>
      </div>

      {/* 2. Middle Section: Execution Controls (EdSim51 Classic Buttons) */}
      <div className="flex items-center gap-1.5">
        {/* RUN */}
        <InstrumentButton
          variant="amber"
          size="md"
          active={isRunning}
          onClick={onRun}
          title="Run 8051 CPU continuously (F5)"
          className="font-black px-4 text-[#000000] bg-[#f59e0b] hover:bg-[#fbbf24] border-[#fbbf24]"
        >
          ▶ RUN
        </InstrumentButton>

        {/* STOP / PAUSE */}
        <InstrumentButton
          variant="secondary"
          size="md"
          disabled={!isRunning}
          onClick={onPause}
          title="Stop / Pause execution (F5)"
          className="font-bold px-3"
        >
          ⏸ STOP
        </InstrumentButton>

        {/* STEP */}
        <InstrumentButton
          variant="secondary"
          size="md"
          onClick={onStep}
          title="Execute exactly one instruction line-by-line (F7)"
          className="font-black px-4 text-[#fbbf24] bg-[#29221a] hover:bg-[#3d3224] border-[#785b34]"
        >
          ⏭ STEP
        </InstrumentButton>

        {/* RST */}
        <InstrumentButton
          variant="danger"
          size="md"
          onClick={onReset}
          title="Reset CPU to 0000H and reset hardware registers (F9)"
          className="font-bold px-3"
        >
          ↺ RST
        </InstrumentButton>
      </div>

      {/* 3. Right Section: Speed, Clock, and High-Contrast Status */}
      <div className="flex items-center gap-2">
        {/* Speed */}
        <div className="flex items-center gap-1 bg-[#141210] border border-[#524d43] px-2 py-1 rounded-sm">
          <span className="text-[10px] text-[#a8a29e] font-bold uppercase">SPEED:</span>
          <select
            value={speed}
            onChange={(e) => onChangeSpeed(parseFloat(e.target.value) as SimulationSpeed)}
            className="bg-transparent text-[#fbbf24] font-bold text-xs outline-none cursor-pointer"
          >
            <option value={0.25} className="bg-[#1c1917] text-[#ffffff]">0.25×</option>
            <option value={0.5} className="bg-[#1c1917] text-[#ffffff]">0.5×</option>
            <option value={1} className="bg-[#1c1917] text-[#ffffff]">1.0× (Real-time)</option>
            <option value={2} className="bg-[#1c1917] text-[#ffffff]">2.0×</option>
            <option value={5} className="bg-[#1c1917] text-[#ffffff]">5.0×</option>
            <option value={10} className="bg-[#1c1917] text-[#ffffff]">10.0×</option>
            <option value={999} className="bg-[#1c1917] text-[#ffffff]">Max (Unlimited)</option>
          </select>
        </div>

        {/* Clock */}
        <div className="hidden sm:flex items-center gap-1 bg-[#141210] border border-[#524d43] px-2 py-1 rounded-sm">
          <span className="text-[10px] text-[#a8a29e] font-bold uppercase">CLOCK:</span>
          <select
            value={clockHz}
            onChange={(e) => onChangeClock(parseInt(e.target.value, 10) as ClockSpeedHz)}
            className="bg-transparent text-[#fbbf24] font-bold text-xs outline-none cursor-pointer"
          >
            <option value={12000000} className="bg-[#1c1917] text-[#ffffff]">12 MHz</option>
            <option value={11059200} className="bg-[#1c1917] text-[#ffffff]">11.0592 MHz</option>
            <option value={6000000} className="bg-[#1c1917] text-[#ffffff]">6 MHz</option>
            <option value={1000000} className="bg-[#1c1917] text-[#ffffff]">1 MHz</option>
          </select>
        </div>

        {/* High Contrast Mode Quick Toggle Button */}
        {onToggleHighContrast && (
          <button
            onClick={onToggleHighContrast}
            className={`px-2 py-1 rounded-sm text-[11px] font-mono font-black uppercase border transition-colors cursor-pointer flex items-center gap-1 ${
              isHighContrast
                ? 'bg-[#ffffff] text-[#000000] border-[#ffffff]'
                : 'bg-[#292524] text-[#fbbf24] border-[#57534e] hover:border-[#fbbf24]'
            }`}
            title="Toggle High Contrast Mode (EdSim51 Readability)"
          >
            <span>◐</span>
            <span className="hidden lg:inline">{isHighContrast ? 'CONTRAST: ON' : 'CONTRAST'}</span>
          </button>
        )}

        {/* Status Pill */}
        <div
          className={`px-3 py-1 rounded-sm text-[11px] uppercase font-black tracking-wider border select-none ${statusColors}`}
        >
          ● {status}
        </div>

        {/* PC and Cycles Readout */}
        <div className="hidden md:flex items-center gap-2.5 text-[11px] bg-[#141210] border border-[#524d43] px-2.5 py-1 rounded-sm">
          <span className="text-[#a8a29e]">PC: <strong className="text-[#fbbf24] text-xs font-black">0x{pc.toString(16).toUpperCase().padStart(4, '0')}H</strong></span>
          <span className="text-[#a8a29e]">CYC: <strong className="text-[#ffffff] font-bold">{cycles.toLocaleString()}</strong></span>
        </div>
      </div>
    </div>
  );
};
