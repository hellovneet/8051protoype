/**
 * Main application header and menu bar.
 * Includes quick access to simulation, tools, help, and display settings.
 */

import React, { useState, useRef, useEffect } from 'react';
import { InstrumentButton } from '../common/InstrumentButton.tsx';

interface HeaderProps {
  onNewProject: () => void;
  onOpenPinMapper: () => void;
  onOpenInstructionRef: () => void;
  onOpenSettings: () => void;
  onExportAsm: () => void;
  onExportHex: () => void;
  onClearBreakpoints: () => void;
  onResetCpu: () => void;
  onAssemble: () => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  isAssembling?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onNewProject,
  onOpenPinMapper,
  onOpenInstructionRef,
  onOpenSettings,
  onExportAsm,
  onExportHex,
  onClearBreakpoints,
  onResetCpu,
  onAssemble,
  isHighContrast,
  onToggleHighContrast,
  isAssembling = false,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (name: string) => {
    setOpenMenu(openMenu === name ? null : name);
  };

  return (
    <header className="bg-[#1c1917] border-b border-[#44403c] px-3.5 py-1.5 flex items-center justify-between select-none font-mono text-xs z-30 relative shadow-sm">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Amber CRT Power Lamp */}
          <div className="w-3.5 h-3.5 rounded-full bg-[#f59e0b] shadow-[0_0_10px_#f59e0b] border-2 border-[#fbbf24]" />
          <div>
            <span className="font-black tracking-widest text-[#fbbf24] text-base">
              Micro8051SiM
            </span>
            <span className="hidden sm:inline-block text-[11px] text-[#a8a29e] ml-2 font-bold font-mono">
              8051 Microcontroller Simulator & Virtual Lab
            </span>
          </div>
        </div>

        {/* Desktop Menu Bar */}
        <div ref={menuRef} className="flex items-center gap-1 ml-4">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('file')}
              className={`px-2.5 py-1 rounded-sm font-bold hover:bg-[#292524] hover:text-[#fbbf24] transition-colors cursor-pointer ${
                openMenu === 'file' ? 'bg-[#292524] text-[#fbbf24]' : 'text-[#ffffff]'
              }`}
            >
              File
            </button>
            {openMenu === 'file' && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1c1917] border border-[#524d43] rounded-sm shadow-2xl py-1 z-50">
                <button
                  onClick={() => { onNewProject(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] flex justify-between font-bold"
                >
                  <span>New File</span>
                  <span className="text-[#a8a29e]">Ctrl+N</span>
                </button>
                <div className="border-t border-[#44403c] my-1" />
                <button
                  onClick={() => { onExportAsm(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  Export .ASM Source
                </button>
                <button
                  onClick={() => { onExportHex(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  Export Intel .HEX File
                </button>
              </div>
            )}
          </div>

          {/* Simulation Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('sim')}
              className={`px-2.5 py-1 rounded-sm font-bold hover:bg-[#292524] hover:text-[#fbbf24] transition-colors cursor-pointer ${
                openMenu === 'sim' ? 'bg-[#292524] text-[#fbbf24]' : 'text-[#ffffff]'
              }`}
            >
              Simulation
            </button>
            {openMenu === 'sim' && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1c1917] border border-[#524d43] rounded-sm shadow-2xl py-1 z-50">
                <button
                  onClick={() => { onAssemble(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] flex justify-between font-bold"
                >
                  <span>Assemble Code</span>
                  <span className="text-[#a8a29e]">F4</span>
                </button>
                <button
                  onClick={() => { onResetCpu(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  Reset CPU (Power On)
                </button>
                <div className="border-t border-[#44403c] my-1" />
                <button
                  onClick={() => { onClearBreakpoints(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  Clear All Breakpoints
                </button>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('tools')}
              className={`px-2.5 py-1 rounded-sm font-bold hover:bg-[#292524] hover:text-[#fbbf24] transition-colors cursor-pointer ${
                openMenu === 'tools' ? 'bg-[#292524] text-[#fbbf24]' : 'text-[#ffffff]'
              }`}
            >
              Tools
            </button>
            {openMenu === 'tools' && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1c1917] border border-[#524d43] rounded-sm shadow-2xl py-1 z-50">
                <button
                  onClick={() => { onOpenPinMapper(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  Hardware Pin Mapper
                </button>
                <button
                  onClick={() => { onOpenSettings(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  Workstation Settings
                </button>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('help')}
              className={`px-2.5 py-1 rounded-sm font-bold hover:bg-[#292524] hover:text-[#fbbf24] transition-colors cursor-pointer ${
                openMenu === 'help' ? 'bg-[#292524] text-[#fbbf24]' : 'text-[#ffffff]'
              }`}
            >
              Help
            </button>
            {openMenu === 'help' && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[#1c1917] border border-[#524d43] rounded-sm shadow-2xl py-1 z-50">
                <button
                  onClick={() => { onOpenInstructionRef(); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#292524] hover:text-[#fbbf24] font-bold"
                >
                  8051 Instruction Reference Card
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: High Contrast Toggle & Settings Button */}
      <div className="flex items-center gap-2">
        {/* Quick High Contrast Mode Toggle */}
        <button
          onClick={onToggleHighContrast}
          className={`px-2.5 py-1 text-[11px] font-mono font-black uppercase rounded-sm border transition-colors cursor-pointer flex items-center gap-1.5 ${
            isHighContrast
              ? 'bg-[#ffffff] text-[#000000] border-[#ffffff]'
              : 'bg-[#292524] text-[#fbbf24] border-[#57534e] hover:border-[#fbbf24]'
          }`}
          title="Toggle High Contrast Mode (Strict black-and-white borders & text)"
        >
          <span>◐</span>
          <span>{isHighContrast ? 'CONTRAST: ON' : 'HIGH CONTRAST'}</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="px-2 py-1 text-xs font-mono font-bold text-[#e7e5e4] hover:text-[#ffffff] bg-[#292524] hover:bg-[#38332c] border border-[#524d43] rounded-sm cursor-pointer"
          title="Open Workstation Settings"
        >
          ⚙ SETTINGS
        </button>

        <InstrumentButton
          variant="amber"
          size="sm"
          onClick={onAssemble}
          disabled={isAssembling}
          className="text-[#000000] bg-[#f59e0b] hover:bg-[#fbbf24] border-[#fbbf24] font-black"
        >
          {isAssembling ? 'BUILDING...' : '⚡ ASSEMBLE'}
        </InstrumentButton>
      </div>
    </header>
  );
};
