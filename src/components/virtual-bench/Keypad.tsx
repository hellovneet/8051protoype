/**
 * Micro8051SiM 4x3 Matrix Keypad Component (High Contrast & EdSim51 Readability)
 */

import React from 'react';
import { KEYPAD_KEYS } from '../../peripherals/peripherals.ts';
import { PinMapping } from '../../core/types.ts';

interface KeypadProps {
  activeKey: { row: number; col: number } | null;
  onPressKey: (row: number, col: number) => void;
  onReleaseKey: () => void;
  mapping: PinMapping;
}

export const Keypad: React.FC<KeypadProps> = ({
  activeKey,
  onPressKey,
  onReleaseKey,
  mapping,
}) => {
  return (
    <div className="bg-[#1c1917] border border-[#44403c] rounded-sm p-3 select-none shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            4×3 Matrix Keypad
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-[#e7e5e4]">
          {activeKey ? `PRESSED: '${KEYPAD_KEYS[activeKey.row][activeKey.col]}'` : 'NO KEY PRESSED'}
        </span>
      </div>

      {/* Telephone Keypad Grid */}
      <div className="bg-[#141210] border border-[#38332c] p-2.5 rounded-sm flex flex-col items-center gap-2 my-1">
        {KEYPAD_KEYS.map((rowArr, rowIdx) => (
          <div key={rowIdx} className="flex gap-2.5">
            {rowArr.map((keyChar, colIdx) => {
              const isPressed =
                activeKey !== null && activeKey.row === rowIdx && activeKey.col === colIdx;

              return (
                <button
                  key={colIdx}
                  onMouseDown={() => onPressKey(rowIdx, colIdx)}
                  onMouseUp={onReleaseKey}
                  onMouseLeave={() => {
                    if (isPressed) onReleaseKey();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    onPressKey(rowIdx, colIdx);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onReleaseKey();
                  }}
                  className={`w-11 h-11 rounded-sm border-2 font-mono text-base font-black transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center ${
                    isPressed
                      ? 'bg-[#f59e0b] text-[#000000] border-[#fbbf24] shadow-[0_0_12px_#f59e0b]'
                      : 'bg-[#292524] text-[#ffffff] hover:bg-[#3d3733] border-[#57534e]'
                  }`}
                  title={`Key '${keyChar}' (Row ${rowIdx}, Col ${colIdx})`}
                >
                  {keyChar}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Row and Col pin info */}
      <div className="mt-1 pt-2 border-t border-[#38332c] text-[11px] font-mono text-[#a8a29e] flex justify-between font-bold">
        <span>ROWS: P{mapping.keypad.rows[0].port}.{mapping.keypad.rows[0].pin} - P{mapping.keypad.rows[3].port}.{mapping.keypad.rows[3].pin}</span>
        <span>COLS: P{mapping.keypad.cols[0].port}.{mapping.keypad.cols[0].pin} - P{mapping.keypad.cols[2].port}.{mapping.keypad.cols[2].pin}</span>
      </div>
    </div>
  );
};
