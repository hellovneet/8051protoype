/**
 * Micro8051SiM LED Array Component (EdSim51 High Contrast & Clean Borders)
 * 8 Virtual LEDs connected to simulated port pins with large bulbs and clear ON/OFF values.
 */

import React from 'react';
import { PinMapping } from '../../core/types.ts';

interface LedArrayProps {
  ledStates: boolean[];
  mapping: PinMapping;
  portValue?: number; // Raw Port 1 byte value e.g. 0x55
  probedPort?: number;
  probedPin?: number;
  isPinEnabled?: (port: number, pin: number) => boolean;
  onProbePin?: (port: number, pin: number, label: string) => void;
}

export const LedArray: React.FC<LedArrayProps> = ({
  ledStates,
  mapping,
  portValue,
  probedPort,
  probedPin,
  isPinEnabled,
  onProbePin,
}) => {
  // Compute byte value from ledStates if portValue not provided
  const byteVal = portValue !== undefined
    ? portValue
    : ledStates.reduce((acc, on, i) => acc | (on ? (1 << i) : 0), 0);

  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-3 shadow-sm select-none">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-[#fbbf24]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            8-Channel Output LEDs (D7 - D0)
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs font-bold">
          <span className="text-[#ffffff]">PORT {mapping.leds[0]?.port ?? 1} LATCH:</span>
          <span className="bg-[#141210] border border-[#524d43] px-2 py-0.5 rounded-sm text-[#fbbf24] font-black">
            0x{byteVal.toString(16).toUpperCase().padStart(2, '0')}H ({byteVal.toString(2).padStart(8, '0')}b)
          </span>
        </div>
      </div>

      {/* 8 Big LEDs in a Row (D7 down to D0) */}
      <div className="grid grid-cols-8 gap-2 p-3 bg-[#141210] border border-[#44403c] rounded-sm">
        {Array.from({ length: 8 }, (_, i) => {
          const idx = 7 - i; // D7 (MSB) to D0 (LSB)
          const isOn = ledStates[idx] ?? false;
          const pinDef = mapping.leds[idx];
          const pinLabel = pinDef ? `P${pinDef.port}.${pinDef.pin}` : `P1.${idx}`;

          return (
            <div key={idx} className="flex flex-col items-center">
              {/* LED Label */}
              <span className="text-[12px] font-mono font-black text-[#ffffff] mb-1">
                D{idx}
              </span>

              {/* Physical LED Bulb */}
              <div className="p-1 rounded-full bg-[#26221e] border-2 border-[#666055]">
                <div
                  className={`w-8 h-8 rounded-full transition-all duration-75 flex items-center justify-center ${
                    isOn
                      ? 'bg-[#fbbf24] border-2 border-[#ffffff] shadow-[0_0_16px_#f59e0b]'
                      : 'bg-[#2a1a0d] border border-[#472c15]'
                  }`}
                >
                  {isOn && (
                    <div className="w-3 h-3 rounded-full bg-[#ffffff] opacity-80" />
                  )}
                </div>
              </div>

              {/* Pin assignment label */}
              <span className="text-[11px] font-mono text-[#fbbf24] mt-1.5 font-black">
                {pinLabel}
              </span>

              {/* Logic State Value */}
              <span
                className={`text-[11px] font-mono font-black px-1.5 py-0.5 rounded-xs mt-1 border ${
                  isOn
                    ? 'text-[#000000] bg-[#fbbf24] border-[#fbbf24]'
                    : 'text-[#d4d4d8] bg-[#1c1917] border-[#44403c]'
                }`}
              >
                {isOn ? '1 (ON)' : '0 (OFF)'}
              </span>

              {/* Interactive Logic Probe Button */}
              {onProbePin && (() => {
                const pinPort = pinDef?.port ?? 1;
                const pinBit = pinDef?.pin ?? idx;
                const isPrimary = (probedPort ?? 1) === pinPort && (probedPin ?? 0) === pinBit;
                const isChannelActive = isPinEnabled ? isPinEnabled(pinPort, pinBit) : isPrimary;

                return (
                  <button
                    onClick={() => onProbePin(pinPort, pinBit, `${pinLabel} (LED ${idx})`)}
                    className={`mt-1.5 px-1 py-0.5 text-[9px] font-mono font-black rounded-xs border cursor-pointer transition-all ${
                      isPrimary
                        ? 'bg-[#fbbf24] text-black border-white shadow-[0_0_6px_#f59e0b]'
                        : isChannelActive
                        ? 'bg-[#1c1917] text-[#38bdf8] border-[#38bdf8]'
                        : 'bg-[#141210] text-[#a8a29e] hover:text-[#fbbf24] border-[#38332c] hover:border-[#fbbf24]'
                    }`}
                    title={`Probe or focus ${pinLabel} in Multi-Channel Logic Analyzer`}
                  >
                    {isPrimary ? '⌖ FOCUS' : isChannelActive ? '⌖ ACTIVE' : '⌖ PROBE'}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
