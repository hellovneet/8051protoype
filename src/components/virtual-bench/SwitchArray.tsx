/**
 * Micro8051SiM DIP Switch Array Component (EdSim51 High Contrast & Clean Borders)
 * 8 Rocker Switches providing digital inputs to mapped 8051 pins.
 */

import React from 'react';
import { PinMapping } from '../../core/types.ts';

interface SwitchArrayProps {
  switchStates: boolean[];
  mapping: PinMapping;
  onToggleSwitch: (index: number) => void;
  onSetAll?: (state: boolean) => void;
  portValue?: number; // Port 3 input pin state
}

export const SwitchArray: React.FC<SwitchArrayProps> = ({
  switchStates,
  mapping,
  onToggleSwitch,
  onSetAll,
  portValue,
}) => {
  // Compute pin value: closed switch pulls pin to 0, open is 1
  const pinByte = portValue !== undefined
    ? portValue
    : switchStates.reduce((acc, closed, i) => acc | (closed ? 0 : (1 << i)), 0);

  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-3 shadow-sm select-none">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-[#fbbf24]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            8-Channel Input Switches (SW7 - SW0)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-mono font-bold text-[#ffffff]">
            PORT {mapping.switches[0]?.port ?? 3} PINS:
          </span>
          <span className="bg-[#141210] border border-[#524d43] px-2 py-0.5 rounded-sm text-xs font-mono text-[#fbbf24] font-black">
            0x{pinByte.toString(16).toUpperCase().padStart(2, '0')}H
          </span>
          {onSetAll && (
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => onSetAll(false)}
                className="px-2 py-0.5 text-[10px] font-mono font-bold text-[#ffffff] hover:bg-[#38332c] border border-[#524d43] rounded-xs bg-[#292524] cursor-pointer"
                title="Open all switches (Pins = 1)"
              >
                ALL 1 (OPEN)
              </button>
              <button
                onClick={() => onSetAll(true)}
                className="px-2 py-0.5 text-[10px] font-mono font-black text-[#000000] hover:bg-[#fbbf24] border border-[#f59e0b] rounded-xs bg-[#f59e0b] cursor-pointer"
                title="Close all switches (Pins = 0)"
              >
                ALL 0 (CLOSED)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 8 Switches in a Row (SW7 down to SW0) */}
      <div className="grid grid-cols-8 gap-2 p-3 bg-[#141210] border border-[#44403c] rounded-sm">
        {Array.from({ length: 8 }, (_, i) => {
          const idx = 7 - i; // SW7 to SW0
          const isClosed = switchStates[idx] ?? false; // true = closed (LOW), false = open (HIGH)
          const pinDef = mapping.switches[idx];
          const pinLabel = pinDef ? `P${pinDef.port}.${pinDef.pin}` : `P3.${idx}`;

          return (
            <div key={idx} className="flex flex-col items-center">
              {/* Switch Label */}
              <span className="text-[12px] font-mono font-black text-[#ffffff] mb-1">
                SW{idx}
              </span>

              {/* Big Interactive DIP Switch */}
              <button
                onClick={() => onToggleSwitch(idx)}
                className={`w-10 h-16 rounded-sm border-2 p-1 flex flex-col justify-between transition-colors cursor-pointer select-none ${
                  isClosed
                    ? 'bg-[#3b230f] border-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    : 'bg-[#26221e] border-[#666055] hover:border-[#ffffff]'
                }`}
                title={`Switch ${idx} (${pinLabel}) - Click to toggle. State: ${
                  isClosed ? 'CLOSED (Pulls pin LOW / 0)' : 'OPEN (Pin is HIGH / 1)'
                }`}
              >
                {/* Physical rocker slider knob */}
                <div
                  className={`w-full h-6 rounded-xs transition-all duration-100 flex items-center justify-center text-[10px] font-mono font-black ${
                    isClosed
                      ? 'bg-[#f59e0b] text-[#000000] translate-y-7 shadow-sm'
                      : 'bg-[#574e44] text-[#ffffff] translate-y-0'
                  }`}
                >
                  {isClosed ? '0' : '1'}
                </div>
              </button>

              {/* Pin assignment label */}
              <span className="text-[11px] font-mono text-[#fbbf24] mt-1.5 font-black">
                {pinLabel}
              </span>

              {/* Pin level */}
              <span
                className={`text-[11px] font-mono font-black px-1.5 py-0.5 rounded-xs mt-1 border ${
                  isClosed
                    ? 'text-[#000000] bg-[#f59e0b] border-[#f59e0b]'
                    : 'text-[#ffffff] bg-[#1c1917] border-[#44403c]'
                }`}
              >
                {isClosed ? '0 (LOW)' : '1 (HIGH)'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
