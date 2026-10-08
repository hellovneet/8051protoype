/**
 * Micro8051SiM Settings Modal
 * Includes High Contrast Mode toggle, default simulation parameters, and display options.
 */

import React from 'react';
import { InstrumentButton } from '../common/InstrumentButton.tsx';
import { ClockSpeedHz, SimulationSpeed } from '../../core/types.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  clockHz: ClockSpeedHz;
  onChangeClock: (hz: ClockSpeedHz) => void;
  speed: SimulationSpeed;
  onChangeSpeed: (spd: SimulationSpeed) => void;
  onResetAllSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isHighContrast,
  onToggleHighContrast,
  clockHz,
  onChangeClock,
  speed,
  onChangeSpeed,
  onResetAllSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs select-none">
      <div className="bg-[#1c1917] border-2 border-[#524d43] rounded-sm w-full max-w-lg flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#141210] border-b border-[#44403c]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-[#fbbf24]">
              Workstation Configuration & Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#a8a29e] hover:text-[#ffffff] text-sm font-black px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* 1. High Contrast Mode Setting */}
          <div className="bg-[#141210] border border-[#38332c] p-3.5 rounded-sm flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase text-[#ffffff]">
                  ◐ High Contrast Mode
                </span>
                {isHighContrast && (
                  <span className="bg-[#f59e0b] text-[#000000] text-[9px] font-black px-1.5 py-0.5 rounded-xs">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#a8a29e] leading-relaxed">
                Removes subtle shadows, phosphor blurs, and gradients. Uses strict black-and-white definitions with high-contrast text and clean single-pixel borders for EdSim51-grade legibility.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={onToggleHighContrast}
              className={`w-14 h-7 rounded-sm border-2 p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                isHighContrast
                  ? 'bg-[#f59e0b] border-[#fbbf24] justify-end'
                  : 'bg-[#292524] border-[#57534e] justify-start'
              }`}
              title="Toggle High Contrast Mode"
            >
              <div
                className={`w-5 h-5 rounded-xs font-black text-[9px] flex items-center justify-center ${
                  isHighContrast
                    ? 'bg-[#000000] text-[#f59e0b]'
                    : 'bg-[#a8a29e] text-[#000000]'
                }`}
              >
                {isHighContrast ? 'ON' : 'OFF'}
              </div>
            </button>
          </div>

          {/* 2. Clock Speed */}
          <div className="bg-[#141210] border border-[#38332c] p-3.5 rounded-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-black uppercase text-[#ffffff]">
                Default Oscillator Frequency
              </div>
              <div className="text-[11px] text-[#a8a29e]">
                Standard 8051 machine cycle = 12 oscillator periods.
              </div>
            </div>
            <select
              value={clockHz}
              onChange={(e) => onChangeClock(parseInt(e.target.value, 10) as ClockSpeedHz)}
              className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-2.5 py-1 rounded-sm font-bold text-xs outline-none cursor-pointer"
            >
              <option value={12000000}>12 MHz (Standard)</option>
              <option value={11059200}>11.0592 MHz (UART standard)</option>
              <option value={6000000}>6 MHz</option>
              <option value={1000000}>1 MHz</option>
              <option value={24000000}>24 MHz</option>
            </select>
          </div>

          {/* 3. Execution Speed */}
          <div className="bg-[#141210] border border-[#38332c] p-3.5 rounded-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-black uppercase text-[#ffffff]">
                Execution Speed Multiplier
              </div>
              <div className="text-[11px] text-[#a8a29e]">
                Adjusts real-time step delay or unlimited execution.
              </div>
            </div>
            <select
              value={speed}
              onChange={(e) => onChangeSpeed(parseFloat(e.target.value) as SimulationSpeed)}
              className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-2.5 py-1 rounded-sm font-bold text-xs outline-none cursor-pointer"
            >
              <option value={0.25}>0.25× (Slow motion)</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1.0× (Real-time)</option>
              <option value={2}>2.0×</option>
              <option value={5}>5.0×</option>
              <option value={10}>10.0×</option>
              <option value={999}>Max (Unlimited)</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#141210] border-t border-[#44403c]">
          <InstrumentButton variant="secondary" onClick={onResetAllSettings}>
            Reset Defaults
          </InstrumentButton>
          <InstrumentButton variant="amber" onClick={onClose}>
            Done
          </InstrumentButton>
        </div>
      </div>
    </div>
  );
};
