/**
 * Micro8051SiM Diagnostic Console Panel (High Contrast & EdSim51 Readability)
 */

import React, { useState } from 'react';
import { ConsoleMessage, AssemblerError } from '../../core/types.ts';

interface ConsolePanelProps {
  messages: ConsoleMessage[];
  errors: AssemblerError[];
  onClear: () => void;
  onSelectErrorLine?: (line: number) => void;
}

type ConsoleTab = 'all' | 'errors' | 'cpu' | 'uart';

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  messages,
  errors,
  onClear,
  onSelectErrorLine,
}) => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('all');

  const filteredMessages = messages.filter((m) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'cpu') return m.type === 'cpu';
    if (activeTab === 'uart') return m.type === 'uart';
    return true;
  });

  const errorCount = errors.filter((e) => e.type === 'error').length;
  const warnCount = errors.filter((e) => e.type === 'warning').length;

  return (
    <div className="flex flex-col h-full bg-[#181614] border border-[#44403c] p-2.5 text-xs font-mono select-none rounded-sm">
      {/* Tab Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#44403c]">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-black uppercase transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#f59e0b] text-[#000000]'
                : 'text-[#a8a29e] hover:text-[#ffffff]'
            }`}
          >
            Console ({messages.length})
          </button>

          <button
            onClick={() => setActiveTab('errors')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-black uppercase transition-colors cursor-pointer ${
              activeTab === 'errors'
                ? 'bg-[#dc2626] text-white'
                : errorCount > 0
                ? 'text-[#f87171] bg-[#450a0a]'
                : 'text-[#a8a29e] hover:text-[#ffffff]'
            }`}
          >
            Errors ({errorCount} {warnCount > 0 ? `/ ${warnCount}W` : ''})
          </button>

          <button
            onClick={() => setActiveTab('cpu')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-black uppercase transition-colors cursor-pointer ${
              activeTab === 'cpu'
                ? 'bg-[#f59e0b] text-[#000000]'
                : 'text-[#a8a29e] hover:text-[#ffffff]'
            }`}
          >
            CPU Logs
          </button>

          <button
            onClick={() => setActiveTab('uart')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-black uppercase transition-colors cursor-pointer ${
              activeTab === 'uart'
                ? 'bg-[#f59e0b] text-[#000000]'
                : 'text-[#a8a29e] hover:text-[#ffffff]'
            }`}
          >
            UART Traffic
          </button>
        </div>

        <button
          onClick={onClear}
          className="text-[10px] font-bold text-[#a8a29e] hover:text-[#ffffff] px-2 py-0.5 rounded-sm hover:bg-[#292524] cursor-pointer"
        >
          CLEAR
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1 p-1">
        {activeTab === 'errors' ? (
          errors.length === 0 ? (
            <div className="text-[#22c55e] font-black italic py-2">
              ✓ No assembler errors or warnings. Build clean.
            </div>
          ) : (
            errors.map((err, idx) => (
              <div
                key={idx}
                onClick={() => onSelectErrorLine && onSelectErrorLine(err.line)}
                className={`p-1.5 rounded-sm border cursor-pointer hover:bg-[#2e1515] flex items-start gap-2 ${
                  err.type === 'error'
                    ? 'bg-[#291010] border-[#7f1d1d] text-[#fca5a5]'
                    : 'bg-[#2e230f] border-[#854d0e] text-[#fef08a]'
                }`}
              >
                <span className="font-black text-[11px] uppercase shrink-0">
                  [{err.type.toUpperCase()}] Line {err.line}:
                </span>
                <span className="font-bold">{err.message}</span>
              </div>
            ))
          )
        ) : filteredMessages.length === 0 ? (
          <div className="text-[#78716c] italic py-2">
            Console log is empty...
          </div>
        ) : (
          filteredMessages.map((m) => {
            const typeColor = {
              assembler: 'text-[#fbbf24]',
              cpu: 'text-[#38bdf8]',
              uart: 'text-[#bef264]',
              warning: 'text-[#facc15]',
              error: 'text-[#ef4444]',
              info: 'text-[#e7e5e4]',
            }[m.type];

            return (
              <div key={m.id} className="leading-tight flex items-start gap-2">
                <span className="text-[#78716c] text-[10px] shrink-0 font-bold">{m.timestamp}</span>
                <span className={`font-black shrink-0 text-[10px] uppercase ${typeColor}`}>
                  [{m.type}]
                </span>
                <span className="text-[#ffffff] font-medium">{m.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
