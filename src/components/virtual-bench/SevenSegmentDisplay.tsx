/**
 * Micro8051SiM 4-Digit 7-Segment Display (EdSim51 High Contrast & Clean Borders)
 * Renders large, high-legibility multiplexed digits with decoded value readouts.
 */

import React from 'react';
import { PinMapping } from '../../core/types.ts';

interface SevenSegmentDisplayProps {
  segmentDigits: number[];
  segmentPersistence: number[];
  mapping: PinMapping;
}

const SingleDigit: React.FC<{ byteVal: number; intensity: number }> = ({ byteVal, intensity }) => {
  const segA = (byteVal & 0x01) !== 0;
  const segB = (byteVal & 0x02) !== 0;
  const segC = (byteVal & 0x04) !== 0;
  const segD = (byteVal & 0x08) !== 0;
  const segE = (byteVal & 0x10) !== 0;
  const segF = (byteVal & 0x20) !== 0;
  const segG = (byteVal & 0x40) !== 0;
  const segDp = (byteVal & 0x80) !== 0;

  const onColor = `rgba(245, 158, 11, ${Math.max(0.4, intensity)})`;
  const offColor = '#241a12';

  return (
    <div className="relative w-14 h-24 sm:w-16 sm:h-26 bg-[#0c0a09] border-2 border-[#44403c] rounded-sm p-1.5 flex items-center justify-center">
      <svg viewBox="0 0 50 80" className="w-full h-full">
        {/* Segment a */}
        <polygon points="10,8 38,8 34,14 14,14" fill={segA ? onColor : offColor} />
        {/* Segment b */}
        <polygon points="39,9 43,13 39,37 35,34 35,13" fill={segB ? onColor : offColor} />
        {/* Segment c */}
        <polygon points="39,41 43,45 39,69 35,65 35,44" fill={segC ? onColor : offColor} />
        {/* Segment d */}
        <polygon points="14,66 34,66 38,72 10,72" fill={segD ? onColor : offColor} />
        {/* Segment e */}
        <polygon points="9,41 13,44 13,65 9,69 5,45" fill={segE ? onColor : offColor} />
        {/* Segment f */}
        <polygon points="9,9 13,13 13,34 9,37 5,13" fill={segF ? onColor : offColor} />
        {/* Segment g */}
        <polygon points="13,38 35,38 37,40 35,42 13,42 11,40" fill={segG ? onColor : offColor} />
        {/* Decimal Point */}
        <circle cx="44" cy="71" r="3.5" fill={segDp ? onColor : offColor} />
      </svg>
    </div>
  );
};

export const SevenSegmentDisplay: React.FC<SevenSegmentDisplayProps> = ({
  segmentDigits,
  segmentPersistence,
  mapping,
}) => {
  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-3 shadow-sm flex flex-col justify-between select-none">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-[#fbbf24]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            4-Digit 7-Segment Display
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-[#ffffff]">
          PORT {mapping.sevenSegment.segmentPort}
        </span>
      </div>

      {/* 4 Large Digits */}
      <div className="bg-[#141210] border border-[#44403c] p-3 rounded-sm flex items-center justify-center gap-4 my-1">
        {segmentDigits.map((byteVal, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <span className="text-xs font-mono text-[#ffffff] font-black mb-1">
              DIGIT {idx}
            </span>
            <SingleDigit
              byteVal={byteVal}
              intensity={segmentPersistence[idx] ?? 1}
            />
            <span className="text-xs font-mono text-[#fbbf24] mt-1.5 font-black">
              0x{byteVal.toString(16).toUpperCase().padStart(2, '0')}H
            </span>
          </div>
        ))}
      </div>

      {/* Pin mapping footer */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#44403c] text-xs font-mono text-[#ffffff] font-semibold">
        <span>SEGMENTS: <strong className="text-[#fbbf24]">Port {mapping.sevenSegment.segmentPort}</strong></span>
        <span>DIGIT SELECT: <strong className="text-[#fbbf24]">P2.0 - P2.3</strong></span>
      </div>
    </div>
  );
};
