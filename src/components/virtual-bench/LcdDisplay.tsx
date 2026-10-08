/**
 * Micro8051SiM HD44780 16x2 Character LCD Display (EdSim51 High Contrast & Clean Borders)
 * Authentic vintage dot-matrix display with crystal-clear character matrix.
 */

import React from 'react';
import { LCD16x2Controller } from '../../peripherals/lcd-controller.ts';
import { PinMapping } from '../../core/types.ts';

interface LcdDisplayProps {
  lcd: LCD16x2Controller;
  mapping: PinMapping;
}

export const LcdDisplay: React.FC<LcdDisplayProps> = ({ lcd, mapping }) => {
  const renderLcdLine = (text: string, isLine2 = false) => {
    const chars = text.padEnd(16, ' ').slice(0, 16).split('');
    const baseAddr = isLine2 ? 0x40 : 0x00;

    return (
      <div className="flex items-center gap-1 justify-center">
        {chars.map((ch, idx) => {
          const isCursorAt = lcd.cursorOn && lcd.addressCounter === baseAddr + idx;

          return (
            <div
              key={idx}
              className={`w-5.5 h-8 flex items-center justify-center font-mono text-[15px] font-black rounded-xs transition-all border ${
                isCursorAt
                  ? 'bg-[#fbbf24] text-[#000000] border-[#fde047]'
                  : 'bg-[#1b2b16] text-[#bef264] border-[#2d4a25]'
              }`}
            >
              {ch}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-3 shadow-sm flex flex-col justify-between select-none">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-[#fbbf24]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            HD44780 16×2 LCD Display
          </span>
        </div>
        <div className="text-xs font-mono font-bold text-[#ffffff]">
          RS: P{mapping.lcd.rs.port}.{mapping.lcd.rs.pin} · EN: P{mapping.lcd.en.port}.{mapping.lcd.en.pin} · DATA: P{mapping.lcd.dataPort}
        </div>
      </div>

      {/* Screen Frame */}
      <div className="bg-[#141210] border border-[#44403c] rounded-sm p-3 my-1 flex flex-col items-center">
        {/* LCD Glass Screen */}
        <div className="bg-[#0b1208] border-2 border-[#2d4a25] p-3 rounded-sm w-full flex flex-col gap-2">
          {renderLcdLine(lcd.line1, false)}
          {renderLcdLine(lcd.line2, true)}
        </div>
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#44403c] text-xs font-mono text-[#ffffff] font-semibold">
        <span>DDRAM ADDR: <strong className="text-[#fbbf24]">0x{lcd.addressCounter.toString(16).toUpperCase().padStart(2, '0')}H</strong></span>
        <span>
          STATUS: <strong className={lcd.displayOn ? 'text-[#bef264]' : 'text-[#f87171]'}>
            {lcd.displayOn ? 'DISPLAY ACTIVE' : 'DISPLAY BLANK'}
          </strong>
        </span>
      </div>
    </div>
  );
};
