/**
 * Vintage LED Indicator Lamp
 * Authentic bezel with ambient glow when ON.
 */

import React from 'react';

interface LEDIndicatorProps {
  on: boolean;
  color?: 'amber' | 'red' | 'green';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
}

export const LEDIndicator: React.FC<LEDIndicatorProps> = ({
  on,
  color = 'amber',
  size = 'md',
  label,
  sublabel,
}) => {
  const sizeMap = {
    sm: { bulb: 'w-2.5 h-2.5', ring: 'p-0.5' },
    md: { bulb: 'w-3.5 h-3.5', ring: 'p-0.5' },
    lg: { bulb: 'w-5 h-5', ring: 'p-1' },
  }[size];

  const colorStyles = {
    amber: {
      onBulb: 'bg-[#fbbf24] shadow-[0_0_8px_#f59e0b,0_0_14px_#d97706]',
      offBulb: 'bg-[#3b2712] border border-[#523315]',
    },
    red: {
      onBulb: 'bg-[#ef4444] shadow-[0_0_8px_#dc2626,0_0_14px_#991b1b]',
      offBulb: 'bg-[#331414] border border-[#481c1c]',
    },
    green: {
      onBulb: 'bg-[#22c55e] shadow-[0_0_8px_#16a34a,0_0_14px_#15803d]',
      offBulb: 'bg-[#122b19] border border-[#1d4427]',
    },
  }[color];

  return (
    <div className="inline-flex flex-col items-center select-none">
      {label && (
        <span className="text-[10px] font-mono tracking-wider text-[#998f82] uppercase mb-1">
          {label}
        </span>
      )}
      {/* Metal bezel ring */}
      <div
        className={`rounded-full bg-[#201d1a] border border-[#3d3730] shadow-inner ${sizeMap.ring}`}
      >
        <div
          className={`rounded-full transition-all duration-100 ${sizeMap.bulb} ${
            on ? colorStyles.onBulb : colorStyles.offBulb
          }`}
        />
      </div>
      {sublabel && (
        <span className="text-[9px] font-mono text-[#786f64] mt-1">
          {sublabel}
        </span>
      )}
    </div>
  );
};
