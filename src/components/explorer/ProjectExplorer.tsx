/**
 * Micro8051SiM Project Explorer & Verified Examples Library
 */

import React, { useState } from 'react';
import { EXAMPLES, ExampleProgram } from '../../examples/examples.ts';

interface ProjectExplorerProps {
  currentProjectName: string;
  onSelectExample: (example: ExampleProgram) => void;
  onOpenPinMapper: () => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  currentProjectName,
  onSelectExample,
  onOpenPinMapper,
}) => {
  const [selectedExampleId, setSelectedExampleId] = useState<string>('led-blink');

  const categories = ['Basics', 'Peripherals', 'Timers & Interrupts', 'Communications', 'Advanced'] as const;

  return (
    <div className="flex flex-col h-full bg-[#161412] border border-[#2b2621] p-2 text-xs font-mono select-none overflow-hidden">
      {/* Current File Header */}
      <div className="pb-2 mb-2 border-b border-[#26221d]">
        <div className="text-[10px] uppercase font-bold text-[#8c8275] mb-1">
          ACTIVE PROJECT
        </div>
        <div className="flex items-center gap-2 bg-[#1b1916] border border-[#302821] px-2 py-1.5 rounded">
          <span className="text-[#fbbf24] font-bold">📄</span>
          <span className="text-[#fef3c7] font-semibold truncate flex-1">
            {currentProjectName}
          </span>
        </div>
      </div>

      {/* Examples Library */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <div className="text-[10px] uppercase font-bold text-[#8c8275] flex items-center justify-between">
          <span>LAB EXAMPLES LIBRARY</span>
          <span className="text-[#fbbf24] font-bold">{EXAMPLES.length}</span>
        </div>

        {categories.map((cat) => {
          const catExamples = EXAMPLES.filter((e) => e.category === cat);
          if (catExamples.length === 0) return null;

          return (
            <div key={cat} className="space-y-1">
              <div className="text-[9px] uppercase font-bold text-[#6e6355] px-1">
                {cat}
              </div>
              <div className="space-y-0.5">
                {catExamples.map((ex) => {
                  const isSelected = selectedExampleId === ex.id;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => {
                        setSelectedExampleId(ex.id);
                        onSelectExample(ex);
                      }}
                      className={`w-full text-left px-2 py-1 rounded transition-colors text-[11px] truncate block cursor-pointer ${
                        isSelected
                          ? 'bg-[#d97706]/25 border border-[#d97706] text-[#fbbf24] font-bold'
                          : 'text-[#ded7cd] hover:bg-[#221e1a] hover:text-[#fef3c7] border border-transparent'
                      }`}
                      title={ex.description}
                    >
                      {ex.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hardware Configuration Action */}
      <div className="pt-2 mt-2 border-t border-[#26221d]">
        <button
          onClick={onOpenPinMapper}
          className="w-full py-1.5 px-2 bg-[#1f1b16] hover:bg-[#2d251d] border border-[#4d3d2c] hover:border-[#d97706] rounded text-[#fbbf24] text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>⚙</span> Hardware Pin Mapping
        </button>
      </div>
    </div>
  );
};
