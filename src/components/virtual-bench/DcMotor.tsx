/**
 * Micro8051SiM DC Motor Simulation Component (High Contrast & Clean Borders)
 */

import React from 'react';
import { PinMapping } from '../../core/types.ts';

interface DcMotorProps {
  state: 'OFF' | 'CW' | 'CCW' | 'BRAKE';
  speed: number;
  angle: number;
  mapping: PinMapping;
}

export const DcMotor: React.FC<DcMotorProps> = ({
  state,
  speed,
  angle,
  mapping,
}) => {
  const stateColor = {
    CW: 'text-[#22c55e]',
    CCW: 'text-[#38bdf8]',
    BRAKE: 'text-[#ef4444]',
    OFF: 'text-[#a8a29e]',
  }[state];

  return (
    <div className="bg-[#1c1917] border border-[#44403c] rounded-sm p-3 select-none shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            DC Motor & H-Bridge
          </span>
        </div>
        <span className={`text-xs font-mono font-black ${stateColor}`}>
          STATUS: {state}
        </span>
      </div>

      {/* Motor Visualization Area */}
      <div className="bg-[#141210] border border-[#38332c] p-3 rounded-sm flex items-center justify-around my-1">
        {/* Animated Rotor */}
        <div className="relative w-20 h-20 bg-[#24201c] border-2 border-[#524d43] rounded-full p-1 flex items-center justify-center shadow-inner">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full transition-transform duration-75"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            {/* Center axle */}
            <circle cx="50" cy="50" r="14" fill="#574e44" stroke="#fbbf24" strokeWidth="2.5" />
            {/* Blades */}
            <path d="M50,36 L44,8 L56,8 Z" fill={state === 'OFF' ? '#6b6255' : '#f59e0b'} />
            <path d="M50,64 L44,92 L56,92 Z" fill={state === 'OFF' ? '#6b6255' : '#f59e0b'} />
            <path d="M36,50 L8,44 L8,56 Z" fill={state === 'OFF' ? '#6b6255' : '#f59e0b'} />
            <path d="M64,50 L92,44 L92,56 Z" fill={state === 'OFF' ? '#6b6255' : '#f59e0b'} />
          </svg>
        </div>

        {/* Speed & Direction Gauges */}
        <div className="flex flex-col gap-1.5 text-xs font-mono">
          <div className="flex justify-between gap-4">
            <span className="text-[#a8a29e] font-bold">SPEED:</span>
            <span className="text-[#ffffff] font-black">{speed}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#a8a29e] font-bold">DIR:</span>
            <span className={`font-black ${stateColor}`}>{state}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#a8a29e] font-bold">ANGLE:</span>
            <span className="text-[#fbbf24] font-black">{Math.round(angle)}°</span>
          </div>
        </div>
      </div>

      {/* Pin mapping footer */}
      <div className="mt-1 pt-2 border-t border-[#38332c] text-[11px] font-mono text-[#a8a29e] flex justify-between font-bold">
        <span>IN1: P{mapping.motor.in1.port}.{mapping.motor.in1.pin}</span>
        <span>IN2: P{mapping.motor.in2.port}.{mapping.motor.in2.pin}</span>
        <span>EN: P{mapping.motor.en.port}.{mapping.motor.en.pin}</span>
      </div>
    </div>
  );
};
