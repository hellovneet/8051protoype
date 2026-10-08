/**
 * Micro8051SiM UART Serial Terminal (High Contrast & Clean Borders)
 */

import React, { useState } from 'react';

interface UartTerminalProps {
  txHistory: string;
  onSendSerialData: (data: string) => void;
  onClearHistory: () => void;
}

export const UartTerminal: React.FC<UartTerminalProps> = ({
  txHistory,
  onSendSerialData,
  onClearHistory,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;
    onSendSerialData(inputText);
    setInputText('');
  };

  return (
    <div className="bg-[#1c1917] border border-[#44403c] rounded-sm p-3 select-none shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-[#fbbf24]">
            UART Serial Terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-[#e7e5e4]">
            9600 BAUD · 8-N-1 · SBUF
          </span>
          <button
            onClick={onClearHistory}
            className="px-2 py-0.5 text-[10px] font-mono font-bold text-[#a8a29e] hover:text-[#ffffff] border border-[#524d43] rounded-sm bg-[#292524] cursor-pointer"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Terminal Screen */}
      <div className="bg-[#0c0a09] border border-[#38332c] rounded-sm p-2.5 h-32 overflow-y-auto font-mono text-xs text-[#bef264] shadow-inner mb-2.5 whitespace-pre-wrap flex flex-col justify-end font-semibold">
        <div>
          {txHistory ? txHistory : <span className="text-[#78716c] italic">Waiting for serial transmission...</span>}
        </div>
      </div>

      {/* Input box */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={inputText}
          placeholder="Send character or text to 8051 (e.g. 'A')..."
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-[#141210] border border-[#524d43] rounded-sm px-3 py-1.5 text-xs font-mono text-[#ffffff] placeholder:text-[#78716c] focus:outline-none focus:border-[#f59e0b] font-medium"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#000000] text-xs font-mono font-black uppercase rounded-sm cursor-pointer shadow-sm"
        >
          SEND
        </button>
      </form>
    </div>
  );
};
