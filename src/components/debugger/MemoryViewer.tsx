/**
 * Micro8051SiM Data Memory (Internal RAM & External XRAM) Viewer & Editor
 * Cycle-accurate 8051 Data Memory inspector matching EdSim51 specifications:
 * - Internal Data Memory (IRAM): 256 Bytes (00H-FFH)
 *   - Lower 128B: Register Banks 0-3 (00H-1FH), Bit-Addressable RAM (20H-2FH), Scratchpad (30H-7FH)
 *   - Upper 128B (80H-FFH): Indirect RAM (accessible via @R0, @R1, and Stack SP)
 * - External Data Memory (XRAM / XDATA): 64 Kbytes (0000H-FFFFH accessed via MOVX @DPTR and MOVX @Ri)
 * - Special Function Registers (SFR): 128 Bytes Direct Mapped Space (80H-FFH)
 * - EdSim51 Quick Address & Value ALTER Box (with +1, -1, 00, FF quick adjustments)
 * - EdSim51 Bitfield Inspector (observing & toggling individual bit addresses 00H-FFH)
 * - Active Register Bank highlighting (synced with PSW.3 RS0 & PSW.4 RS1)
 * - Stack Pointer (SP / TOS) and active Stack Frame visual tracking
 * - Real-time changed byte glow on CPU step execution
 * - Hex / Decimal view mode switching
 */

import React, { useState, useMemo } from 'react';
import { CPUState, SFR_ADDRESSES } from '../../core/types.ts';

export interface MemoryViewerProps {
  cpuState: CPUState;
  onWriteByte?: (address: number, value: number) => void;
  onWriteRam?: (address: number, value: number) => void;
  onWriteXram?: (address: number, value: number) => void;
  onWriteSfr?: (address: number, value: number) => void;
  onWriteBit?: (bitAddress: number, value: boolean) => void;
  onClearRam?: (scratchpadOnly?: boolean) => void;
  onClearXram?: () => void;
  readDirect?: (address: number) => number;
}

// Known SFR names for 80H-FFH
const SFR_NAMES: Record<number, string> = {
  0x80: 'P0',
  0x81: 'SP',
  0x82: 'DPL',
  0x83: 'DPH',
  0x87: 'PCON',
  0x88: 'TCON',
  0x89: 'TMOD',
  0x8A: 'TL0',
  0x8B: 'TL1',
  0x8C: 'TH0',
  0x8D: 'TH1',
  0x90: 'P1',
  0x98: 'SCON',
  0x99: 'SBUF',
  0xA0: 'P2',
  0xA8: 'IE',
  0xB0: 'P3',
  0xB8: 'IP',
  0xD0: 'PSW',
  0xE0: 'ACC',
  0xF0: 'B',
};

// Known Bit-Addressable SFR Base Addresses
const BIT_ADDRESSABLE_SFR_ADDRS = [
  0x80, // P0 (bits 80H-87H)
  0x88, // TCON (bits 88H-8FH)
  0x90, // P1 (bits 90H-97H)
  0x98, // SCON (bits 98H-9FH)
  0xA0, // P2 (bits A0H-A7H)
  0xA8, // IE (bits A8H-AFH)
  0xB0, // P3 (bits B0H-B7H)
  0xB8, // IP (bits B8H-BFH)
  0xD0, // PSW (bits D0H-D7H)
  0xE0, // ACC (bits E0H-E7H)
  0xF0, // B (bits F0H-F7H)
];

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  cpuState,
  onWriteByte,
  onWriteRam,
  onWriteXram,
  onWriteSfr,
  onWriteBit,
  onClearRam,
  onClearXram,
  readDirect,
}) => {
  // Memory Space: Internal RAM (IRAM 256B), External Data (XRAM 64KB), or Direct SFR Map (80H-FFH)
  const [memorySpace, setMemorySpace] = useState<'iram' | 'xram' | 'sfr'>('iram');

  // Internal RAM filters
  const [iramFilter, setIramFilter] = useState<'all' | 'lower128' | 'banks' | 'bit' | 'scratch' | 'upper128'>('all');

  // External RAM base address (0000H - FFFFH in chunks of 64 bytes)
  const [xramBaseAddr, setXramBaseAddr] = useState<number>(0x0000);
  const [xramJumpInput, setXramJumpInput] = useState<string>('0000');

  // Display Format: HEX or DEC
  const [displayFormat, setDisplayFormat] = useState<'hex' | 'dec'>('hex');

  // Inline editing state
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editVal, setEditVal] = useState<string>('');

  // EdSim51 Quick ALTER Form inputs
  const [alterSpace, setAlterSpace] = useState<'iram' | 'xram' | 'sfr'>('iram');
  const [quickAddrInput, setQuickAddrInput] = useState<string>('30');
  const [quickValInput, setQuickValInput] = useState<string>('00');
  const [writeFeedback, setWriteFeedback] = useState<string | null>(null);

  // Bitfield Inspector Drawer
  const [showBitfield, setShowBitfield] = useState<boolean>(false);
  const [inspectedBitByteAddr, setInspectedBitByteAddr] = useState<number>(0x20); // Default to first bit-addressable RAM byte

  // Active Register Bank information
  const activeBank = cpuState.activeBank; // 0, 1, 2, or 3
  const bankStartAddr = activeBank * 8;

  // External pointers
  const dptrAddr = cpuState.dptr;
  const p2Val = cpuState.sfr[SFR_ADDRESSES.P2 - 0x80] ?? 0xFF;
  const r0Addr16 = (p2Val << 8) | cpuState.r[0];
  const r1Addr16 = (p2Val << 8) | cpuState.r[1];

  // Helper to read a byte from the current space
  const getByteAt = (addr: number, space: 'iram' | 'xram' | 'sfr' = memorySpace): number => {
    if (space === 'xram') {
      const idx = addr & 0xFFFF;
      return cpuState.xram ? cpuState.xram[idx] ?? 0 : 0;
    }
    if (space === 'sfr') {
      const a = addr & 0xFF;
      if (a < 0x80) return cpuState.ram[a];
      if (readDirect) return readDirect(a);
      return cpuState.sfr[a - 0x80] ?? 0;
    }
    // IRAM: Always return true Internal RAM 00H-FFH
    return cpuState.ram[addr & 0xFF] ?? 0;
  };

  // Helper to write a byte
  const performWriteByte = (addr: number, val: number, targetSpace: 'iram' | 'xram' | 'sfr' = alterSpace) => {
    val &= 0xFF;
    if (targetSpace === 'xram') {
      const a16 = addr & 0xFFFF;
      if (onWriteXram) {
        onWriteXram(a16, val);
      } else if (cpuState.xram) {
        cpuState.xram[a16] = val;
        cpuState.changedXramIndices?.add(a16);
      }
      setWriteFeedback(`✓ Applied 0x${val.toString(16).toUpperCase().padStart(2, '0')} (${val}) to XRAM[0x${a16.toString(16).toUpperCase().padStart(4, '0')}H]`);
    } else if (targetSpace === 'sfr') {
      const a8 = addr & 0xFF;
      if (onWriteSfr) {
        onWriteSfr(a8, val);
      } else if (onWriteByte) {
        onWriteByte(a8, val);
      }
      setWriteFeedback(`✓ Applied 0x${val.toString(16).toUpperCase().padStart(2, '0')} (${val}) to SFR[0x${a8.toString(16).toUpperCase().padStart(2, '0')}H]`);
    } else {
      // IRAM
      const a8 = addr & 0xFF;
      if (onWriteRam) {
        onWriteRam(a8, val);
      } else if (onWriteByte) {
        onWriteByte(a8, val);
      }
      setWriteFeedback(`✓ Applied 0x${val.toString(16).toUpperCase().padStart(2, '0')} (${val}) to IRAM[0x${a8.toString(16).toUpperCase().padStart(2, '0')}H]`);
    }
    setTimeout(() => setWriteFeedback(null), 3000);
  };

  // Determine row indices to show
  const filteredRowIndices = useMemo(() => {
    if (memorySpace === 'xram') {
      // 8 rows * 8 columns = 64 bytes window starting at xramBaseAddr
      return Array.from({ length: 8 }, (_, i) => i);
    }
    if (memorySpace === 'sfr') {
      // SFR space: 16 rows * 8 = 128 bytes (80H to FFH)
      return Array.from({ length: 16 }, (_, i) => i + 16);
    }
    // IRAM: 32 rows * 8 = 256 bytes (00H to FFH)
    return Array.from({ length: 32 }, (_, i) => i).filter((r) => {
      const startAddr = r * 8;
      if (iramFilter === 'lower128') return startAddr < 0x80;
      if (iramFilter === 'banks') return startAddr < 0x20;
      if (iramFilter === 'bit') return startAddr >= 0x20 && startAddr < 0x30;
      if (iramFilter === 'scratch') return startAddr >= 0x30 && startAddr < 0x80;
      if (iramFilter === 'upper128') return startAddr >= 0x80;
      return true; // 'all' (256B)
    });
  }, [memorySpace, iramFilter, xramBaseAddr]);

  // Handle cell click for inline editing
  const handleCellClick = (addr: number) => {
    setEditingAddr(addr);
    const val = getByteAt(addr, memorySpace);
    setEditVal(displayFormat === 'hex' ? val.toString(16).toUpperCase().padStart(2, '0') : val.toString(10));

    // Sync alter box with clicked cell
    setAlterSpace(memorySpace);
    setQuickAddrInput(memorySpace === 'xram' ? addr.toString(16).toUpperCase().padStart(4, '0') : addr.toString(16).toUpperCase().padStart(2, '0'));
    setQuickValInput(val.toString(16).toUpperCase().padStart(2, '0'));

    // If clicking inside bit-addressable RAM or SFR, sync bitfield inspector
    if (addr >= 0x20 && addr < 0x30) {
      setInspectedBitByteAddr(addr);
    } else if (BIT_ADDRESSABLE_SFR_ADDRS.includes(addr)) {
      setInspectedBitByteAddr(addr);
    }
  };

  // Submit inline cell edit
  const handleEditSubmit = (addr: number) => {
    let parsed: number;
    if (displayFormat === 'hex') {
      parsed = parseInt(editVal.replace(/^0x/i, '').replace(/H$/i, ''), 16);
    } else {
      parsed = parseInt(editVal, 10);
    }

    if (!isNaN(parsed)) {
      performWriteByte(addr, parsed & 0xFF, memorySpace);
    }
    setEditingAddr(null);
  };

  // EdSim51 Quick Address & Value Write Handler
  const handleQuickWrite = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanAddrStr = quickAddrInput.trim().replace(/^0x/i, '').replace(/H$/i, '');
    const cleanValStr = quickValInput.trim().replace(/^0x/i, '').replace(/H$/i, '');

    const parsedAddr = parseInt(cleanAddrStr, 16);
    let parsedVal = parseInt(cleanValStr, 16);

    if (isNaN(parsedVal)) {
      parsedVal = parseInt(cleanValStr, 10);
    }

    if (!isNaN(parsedAddr) && !isNaN(parsedVal)) {
      const maxAddr = alterSpace === 'xram' ? 0xFFFF : 0xFF;
      const targetAddr = Math.min(Math.max(0, parsedAddr), maxAddr);
      performWriteByte(targetAddr, parsedVal & 0xFF, alterSpace);
    }
  };

  // Quick Alter Button Adjustments (+1, -1, 00, FF)
  const handleAdjustQuickVal = (delta: 'inc' | 'dec' | 'zero' | 'ff') => {
    const cleanAddrStr = quickAddrInput.trim().replace(/^0x/i, '').replace(/H$/i, '');
    const parsedAddr = parseInt(cleanAddrStr, 16);
    if (isNaN(parsedAddr)) return;

    const currentVal = getByteAt(parsedAddr, alterSpace);
    let newVal = currentVal;
    if (delta === 'inc') newVal = (currentVal + 1) & 0xFF;
    else if (delta === 'dec') newVal = (currentVal - 1 + 256) & 0xFF;
    else if (delta === 'zero') newVal = 0x00;
    else if (delta === 'ff') newVal = 0xFF;

    setQuickValInput(newVal.toString(16).toUpperCase().padStart(2, '0'));
    performWriteByte(parsedAddr, newVal, alterSpace);
  };

  // Bit toggle handler in Bitfield Inspector
  const handleToggleBit = (bitIndex: number) => {
    const byteAddr = inspectedBitByteAddr;
    const isRamBit = byteAddr >= 0x20 && byteAddr < 0x30;
    const isSfrBit = BIT_ADDRESSABLE_SFR_ADDRS.includes(byteAddr);

    let bitAddr: number | null = null;
    if (isRamBit) {
      bitAddr = (byteAddr - 0x20) * 8 + bitIndex;
    } else if (isSfrBit) {
      bitAddr = byteAddr + bitIndex;
    }

    const currentByte = byteAddr >= 0x80 && readDirect ? readDirect(byteAddr) : cpuState.ram[byteAddr & 0xFF] ?? 0;
    const currentBit = ((currentByte >> bitIndex) & 1) === 1;
    const nextBitVal = !currentBit;

    if (bitAddr !== null && onWriteBit) {
      onWriteBit(bitAddr, nextBitVal);
      setWriteFeedback(`Bit b${bitIndex} (Addr 0x${bitAddr.toString(16).toUpperCase().padStart(2, '0')}H) set to ${nextBitVal ? '1' : '0'}`);
    } else {
      const newByte = nextBitVal ? currentByte | (1 << bitIndex) : currentByte & ~(1 << bitIndex);
      if (byteAddr >= 0x80 && onWriteSfr) {
        onWriteSfr(byteAddr, newByte);
      } else if (onWriteRam) {
        onWriteRam(byteAddr, newByte);
      } else if (onWriteByte) {
        onWriteByte(byteAddr, newByte);
      }
      setWriteFeedback(`Byte 0x${byteAddr.toString(16).toUpperCase().padStart(2, '0')}H bit b${bitIndex} toggled to ${nextBitVal ? '1' : '0'}`);
    }
    setTimeout(() => setWriteFeedback(null), 2500);
  };

  // Scan for next non-zero byte in XRAM
  const handleFindNextNonZeroXram = () => {
    if (!cpuState.xram) return;
    const start = (xramBaseAddr + 64) & 0xFFFF;
    for (let i = 0; i < 65536; i++) {
      const testAddr = (start + i) & 0xFFFF;
      if (cpuState.xram[testAddr] !== 0) {
        const pageStart = testAddr & ~0x3F; // align to 64 bytes
        setXramBaseAddr(pageStart);
        setXramJumpInput(pageStart.toString(16).toUpperCase().padStart(4, '0'));
        setWriteFeedback(`Found non-zero byte 0x${cpuState.xram[testAddr].toString(16).toUpperCase().padStart(2, '0')} at 0x${testAddr.toString(16).toUpperCase().padStart(4, '0')}H`);
        setTimeout(() => setWriteFeedback(null), 3000);
        return;
      }
    }
    setWriteFeedback('All 64KB of XRAM is currently zeroed (00H)');
    setTimeout(() => setWriteFeedback(null), 2500);
  };

  // Bitfield Inspected Byte Value
  const inspectedByteVal = inspectedBitByteAddr >= 0x80 && readDirect
    ? readDirect(inspectedBitByteAddr)
    : cpuState.ram[inspectedBitByteAddr & 0xFF] ?? 0;

  return (
    <div className="flex flex-col h-full bg-[#181614] border border-[#44403c] p-2 text-xs font-mono select-none rounded-sm gap-1.5 shadow-sm">
      {/* 1. Header: Title, Memory Space Selector, Bank, SP, Format */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-[#38332c]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#fbbf24]">
            DATA MEMORY
          </span>

          {/* Primary Memory Space Selector */}
          <div className="inline-flex rounded-xs border border-[#524d43] bg-[#141210] p-0.5 text-[9px] font-black">
            <button
              onClick={() => {
                setMemorySpace('iram');
                setAlterSpace('iram');
              }}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition-colors ${
                memorySpace === 'iram' ? 'bg-[#f59e0b] text-black shadow-xs font-black' : 'text-[#a8a29e] hover:text-white'
              }`}
              title="8051 Internal Data RAM: 256 Bytes (00H-FFH)"
            >
              IRAM (256B)
            </button>
            <button
              onClick={() => {
                setMemorySpace('xram');
                setAlterSpace('xram');
              }}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition-colors ${
                memorySpace === 'xram' ? 'bg-[#38bdf8] text-black shadow-xs font-black' : 'text-[#a8a29e] hover:text-white'
              }`}
              title="8051 External Data RAM: 64 Kbytes (0000H-FFFFH for MOVX)"
            >
              XRAM (64KB)
            </button>
            <button
              onClick={() => {
                setMemorySpace('sfr');
                setAlterSpace('sfr');
              }}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition-colors ${
                memorySpace === 'sfr' ? 'bg-[#c084fc] text-black shadow-xs font-black' : 'text-[#a8a29e] hover:text-white'
              }`}
              title="Special Function Registers direct map (80H-FFH)"
            >
              SFR MAP (80-FF)
            </button>
          </div>

          {/* Active Register Bank Badge (for IRAM) */}
          {memorySpace === 'iram' && (
            <span
              className="text-[9.5px] bg-[#141210] text-[#38bdf8] px-1.5 py-0.5 rounded-xs border border-[#0284c7] font-black"
              title={`Active Bank is selected by PSW.3 (RS0=${(cpuState.psw >> 3) & 1}) and PSW.4 (RS1=${(cpuState.psw >> 4) & 1}). R0-R7 map to 0x${bankStartAddr.toString(16).toUpperCase().padStart(2, '0')}H - 0x${(bankStartAddr + 7).toString(16).toUpperCase().padStart(2, '0')}H`}
            >
              ★ BANK {activeBank} (0x{bankStartAddr.toString(16).toUpperCase().padStart(2, '0')}H)
            </span>
          )}

          {/* Stack Pointer Readout */}
          <span className="text-[9.5px] text-[#e7e5e4] bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#44403c]">
            SP: <strong className="text-[#fbbf24]">0x{cpuState.sp.toString(16).toUpperCase().padStart(2, '0')}H</strong>
            <span className="text-[#78716c] ml-1">
              ({cpuState.sp >= 7 ? `${cpuState.sp - 7} B pushed` : 'reset'})
            </span>
          </span>
        </div>

        {/* View Controls: HEX/DEC, Bitfield Toggle */}
        <div className="flex items-center gap-1">
          {/* Format Toggle (HEX / DEC) */}
          <div className="inline-flex rounded-xs border border-[#44403c] bg-[#141210] p-0.5 text-[9px] font-black">
            <button
              onClick={() => setDisplayFormat('hex')}
              className={`px-1.5 py-0.5 rounded-xs cursor-pointer transition-colors ${
                displayFormat === 'hex' ? 'bg-[#f59e0b] text-black' : 'text-[#a8a29e] hover:text-white'
              }`}
            >
              HEX
            </button>
            <button
              onClick={() => setDisplayFormat('dec')}
              className={`px-1.5 py-0.5 rounded-xs cursor-pointer transition-colors ${
                displayFormat === 'dec' ? 'bg-[#f59e0b] text-black' : 'text-[#a8a29e] hover:text-white'
              }`}
            >
              DEC
            </button>
          </div>

          {/* Bitfield Drawer Toggle */}
          <button
            onClick={() => setShowBitfield(!showBitfield)}
            className={`px-1.5 py-0.5 text-[10px] font-black rounded-xs border cursor-pointer transition-colors flex items-center gap-1 ${
              showBitfield
                ? 'bg-[#38bdf8] text-black border-[#38bdf8]'
                : 'bg-[#141210] text-[#38bdf8] border-[#38bdf8] hover:bg-[#1c1917]'
            }`}
            title="Inspect individual bit addresses in 20H-2FH and bit-addressable SFRs"
          >
            <span>🔢</span>
            <span>BITFIELD {showBitfield ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* 2. EdSim51 Quick ALTER Form Bar */}
      <form
        onSubmit={handleQuickWrite}
        className="flex flex-wrap items-center justify-between gap-1.5 p-1 bg-[#141210] border border-[#38332c] rounded-xs text-[10px]"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[#fbbf24] font-black uppercase">EdSim51 ALTER:</span>

          {/* Target Space */}
          <select
            value={alterSpace}
            onChange={(e) => setAlterSpace(e.target.value as 'iram' | 'xram' | 'sfr')}
            className="bg-[#1c1917] text-[#fbbf24] border border-[#524d43] rounded-xs px-1 py-0.5 font-bold outline-none cursor-pointer"
          >
            <option value="iram">IRAM</option>
            <option value="xram">XRAM</option>
            <option value="sfr">SFR</option>
          </select>

          {/* Address Input */}
          <div className="flex items-center gap-0.5">
            <span className="text-[#a8a29e]">ADDR:</span>
            <div className="flex items-center bg-[#1c1917] border border-[#524d43] rounded-xs px-1">
              <span className="text-[#78716c]">0x</span>
              <input
                type="text"
                value={quickAddrInput}
                maxLength={alterSpace === 'xram' ? 4 : 2}
                onChange={(e) => setQuickAddrInput(e.target.value.toUpperCase())}
                placeholder={alterSpace === 'xram' ? '2000' : '30'}
                className={`${alterSpace === 'xram' ? 'w-10' : 'w-7'} bg-transparent text-[#ffffff] font-bold text-center outline-none`}
                title={`Enter address in hex (e.g. ${alterSpace === 'xram' ? '2000' : '30'})`}
              />
              <span className="text-[#78716c]">H</span>
            </div>
          </div>

          {/* Value Input */}
          <div className="flex items-center gap-0.5">
            <span className="text-[#a8a29e]">VALUE:</span>
            <div className="flex items-center bg-[#1c1917] border border-[#524d43] rounded-xs px-1">
              <span className="text-[#78716c]">0x</span>
              <input
                type="text"
                value={quickValInput}
                maxLength={2}
                onChange={(e) => setQuickValInput(e.target.value.toUpperCase())}
                placeholder="55"
                className="w-7 bg-transparent text-[#ffffff] font-bold text-center outline-none"
                title="Enter byte value in hex (e.g. 55) or decimal"
              />
              <span className="text-[#78716c]">H</span>
            </div>
          </div>

          {/* Write / Apply Button */}
          <button
            type="submit"
            className="px-2 py-0.5 font-black bg-[#f59e0b] text-black hover:bg-[#fbbf24] rounded-xs cursor-pointer transition-colors shadow-xs"
            title="Write value to selected memory address"
          >
            ⚡ WRITE
          </button>

          {/* Quick Increment / Decrement / Zero / FF adjustments */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleAdjustQuickVal('inc')}
              className="px-1 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#38332c] rounded-xs cursor-pointer"
              title="Increment byte value by 1"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => handleAdjustQuickVal('dec')}
              className="px-1 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#38332c] rounded-xs cursor-pointer"
              title="Decrement byte value by 1"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => handleAdjustQuickVal('zero')}
              className="px-1 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-[#fbbf24] border border-[#38332c] rounded-xs cursor-pointer"
              title="Set byte value to 00H"
            >
              CLR 00
            </button>
            <button
              type="button"
              onClick={() => handleAdjustQuickVal('ff')}
              className="px-1 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-[#38bdf8] border border-[#38332c] rounded-xs cursor-pointer"
              title="Set byte value to FFH"
            >
              SET FF
            </button>
          </div>

          {/* Current Byte preview */}
          {(() => {
            const pa = parseInt(quickAddrInput.replace(/^0x/i, '').replace(/H$/i, ''), 16);
            if (!isNaN(pa)) {
              const cur = getByteAt(pa, alterSpace);
              return (
                <span className="text-[9px] text-[#78716c] ml-1">
                  CURRENT: <strong className="text-white">0x{cur.toString(16).toUpperCase().padStart(2, '0')}H</strong> ({cur})
                </span>
              );
            }
            return null;
          })()}
        </div>

        {/* Feedback Banner & Memory Clear buttons */}
        <div className="flex items-center gap-1.5">
          {writeFeedback && (
            <span className="text-[9px] text-[#4ade80] font-bold animate-pulse">
              {writeFeedback}
            </span>
          )}

          {/* Clear Actions */}
          <div className="flex items-center gap-1">
            {memorySpace === 'xram' ? (
              <button
                type="button"
                onClick={() => {
                  if (onClearXram) onClearXram();
                  else if (cpuState.xram) {
                    cpuState.xram.fill(0);
                    cpuState.changedXramIndices?.clear();
                  }
                  setWriteFeedback('✓ Cleared all 64KB of XRAM to 00H');
                  setTimeout(() => setWriteFeedback(null), 2500);
                }}
                className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-[#f87171] border border-[#38332c] hover:border-[#f87171] rounded-xs cursor-pointer transition-colors"
                title="Zero all 64KB of External Data Memory (XRAM)"
              >
                ZERO XRAM
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (onClearRam) onClearRam(true);
                    else {
                      for (let i = 0x30; i < 0x80; i++) cpuState.ram[i] = 0;
                    }
                    setWriteFeedback('✓ Cleared Scratchpad RAM 30H-7FH to 00H');
                    setTimeout(() => setWriteFeedback(null), 2500);
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-[#fbbf24] border border-[#38332c] hover:border-[#fbbf24] rounded-xs cursor-pointer transition-colors"
                  title="Clear user scratchpad RAM (30H to 7FH) to 00H"
                >
                  CLEAR 30H-7FH
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onClearRam) onClearRam(false);
                    else {
                      cpuState.ram.fill(0);
                    }
                    setWriteFeedback('✓ Zeroed all 256 bytes of Internal RAM');
                    setTimeout(() => setWriteFeedback(null), 2500);
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] hover:text-[#f87171] border border-[#38332c] hover:border-[#f87171] rounded-xs cursor-pointer transition-colors"
                  title="Zero all internal RAM bytes (00H to FFH)"
                >
                  ZERO RAM (256B)
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* 3. EdSim51 Bitfield Inspector Drawer */}
      {showBitfield && (
        <div className="bg-[#12100e] border border-[#38bdf8] p-1.5 rounded-xs flex flex-col gap-1 text-[10px]">
          <div className="flex items-center justify-between flex-wrap gap-1 pb-1 border-b border-[#25211c]">
            <div className="flex items-center gap-2">
              <span className="text-[#38bdf8] font-black">
                🔢 BITFIELD INSPECTOR:
              </span>
              <span className="text-white font-bold bg-[#1c1917] px-1.5 py-0.2 rounded-xs border border-[#44403c]">
                BYTE 0x{inspectedBitByteAddr.toString(16).toUpperCase()}H
                {inspectedBitByteAddr >= 0x20 && inspectedBitByteAddr < 0x30 ? (
                  <span className="text-[#4ade80] ml-1">
                    (RAM Bits 0x{((inspectedBitByteAddr - 0x20) * 8).toString(16).toUpperCase().padStart(2, '0')}H - 0x{((inspectedBitByteAddr - 0x20) * 8 + 7).toString(16).toUpperCase().padStart(2, '0')}H)
                  </span>
                ) : BIT_ADDRESSABLE_SFR_ADDRS.includes(inspectedBitByteAddr) ? (
                  <span className="text-[#c084fc] ml-1">
                    (SFR {SFR_NAMES[inspectedBitByteAddr]} Bits 0x{inspectedBitByteAddr.toString(16).toUpperCase()}H - 0x{(inspectedBitByteAddr + 7).toString(16).toUpperCase()}H)
                  </span>
                ) : (
                  <span className="text-[#78716c] ml-1">(General Byte)</span>
                )}
              </span>
              <span className="text-[#fbbf24] font-black tabular-nums">
                = 0x{inspectedByteVal.toString(16).toUpperCase().padStart(2, '0')} ({inspectedByteVal.toString(2).padStart(8, '0')}b)
              </span>
            </div>

            {/* Quick Byte Selectors */}
            <div className="flex items-center gap-0.5 overflow-x-auto max-w-full">
              <span className="text-[9px] text-[#78716c] mr-1">BIT-RAM:</span>
              {Array.from({ length: 16 }, (_, i) => 0x20 + i).map((bAddr) => (
                <button
                  key={bAddr}
                  type="button"
                  onClick={() => setInspectedBitByteAddr(bAddr)}
                  className={`px-1 py-0.2 text-[8.5px] font-black rounded-xs border cursor-pointer ${
                    inspectedBitByteAddr === bAddr
                      ? 'bg-[#38bdf8] text-black border-[#38bdf8]'
                      : 'bg-[#1c1917] text-[#a8a29e] border-[#2d2924] hover:text-white'
                  }`}
                >
                  .{bAddr.toString(16).toUpperCase()}
                </button>
              ))}

              <span className="text-[9px] text-[#c084fc] ml-1 mr-0.5">SFR:</span>
              {['P0', 'TCON', 'P1', 'SCON', 'P2', 'IE', 'P3', 'IP', 'PSW', 'ACC', 'B'].map((sfrName) => {
                const sAddr = Object.entries(SFR_NAMES).find(([_, n]) => n === sfrName)?.[0];
                if (!sAddr) return null;
                const addrNum = parseInt(sAddr, 10);
                return (
                  <button
                    key={sfrName}
                    type="button"
                    onClick={() => setInspectedBitByteAddr(addrNum)}
                    className={`px-1 py-0.2 text-[8px] font-black rounded-xs border cursor-pointer ${
                      inspectedBitByteAddr === addrNum
                        ? 'bg-[#c084fc] text-black border-[#c084fc]'
                        : 'bg-[#1c1917] text-[#c084fc] border-[#2d2924] hover:text-white'
                    }`}
                  >
                    {sfrName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8 Bits Interactive Grid */}
          <div className="grid grid-cols-8 gap-1 pt-0.5">
            {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
              const bitVal = ((inspectedByteVal >> bitIdx) & 1) === 1;
              const isRamBit = inspectedBitByteAddr >= 0x20 && inspectedBitByteAddr < 0x30;
              const isSfrBit = BIT_ADDRESSABLE_SFR_ADDRS.includes(inspectedBitByteAddr);
              const bitAddr = isRamBit
                ? (inspectedBitByteAddr - 0x20) * 8 + bitIdx
                : isSfrBit
                ? inspectedBitByteAddr + bitIdx
                : null;

              return (
                <button
                  key={bitIdx}
                  type="button"
                  onClick={() => handleToggleBit(bitIdx)}
                  className={`flex flex-col items-center justify-between p-1 rounded-xs border transition-colors cursor-pointer ${
                    bitVal
                      ? 'bg-[#142319] text-[#4ade80] border-[#22c55e] shadow-xs'
                      : 'bg-[#1c1917] text-[#78716c] border-[#38332c] hover:border-[#78716c]'
                  }`}
                  title={
                    bitAddr !== null
                      ? `Bit b${bitIdx} (Address 0x${bitAddr.toString(16).toUpperCase().padStart(2, '0')}H): Click to toggle`
                      : `Bit b${bitIdx}: Click to toggle`
                  }
                >
                  <span className="text-[8.5px] text-[#a8a29e] font-black">b{bitIdx}</span>
                  <span className={`text-base font-black tabular-nums my-0.5 ${bitVal ? 'text-[#22c55e]' : 'text-[#78716c]'}`}>
                    {bitVal ? '1' : '0'}
                  </span>
                  <span className="text-[8px] text-[#38bdf8] font-bold">
                    {bitAddr !== null ? `0x${bitAddr.toString(16).toUpperCase().padStart(2, '0')}H` : `b${bitIdx}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Sub-Navigation / Filter Bar */}
      <div className="flex items-center justify-between gap-1 flex-wrap pb-0.5 border-b border-[#2d2924]">
        {memorySpace === 'iram' && (
          <div className="inline-flex rounded-xs border border-[#44403c] p-0.5 bg-[#141210] flex-wrap gap-0.5">
            {[
              { id: 'all', label: 'ALL 256B (00-FF)' },
              { id: 'lower128', label: 'LOWER 128B (00-7F)' },
              { id: 'banks', label: 'BANKS (00-1F)' },
              { id: 'bit', label: 'BIT-RAM (20-2F)' },
              { id: 'scratch', label: 'SCRATCHPAD (30-7F)' },
              { id: 'upper128', label: 'UPPER RAM (80-FF)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setIramFilter(f.id as typeof iramFilter)}
                className={`px-2 py-0.5 text-[9.5px] font-black uppercase transition-colors rounded-xs cursor-pointer ${
                  iramFilter === f.id
                    ? 'bg-[#f59e0b] text-[#000000] shadow-xs'
                    : 'text-[#a8a29e] hover:text-[#ffffff]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {memorySpace === 'xram' && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9.5px] text-[#38bdf8] font-black">PAGE:</span>
            {/* Page Jump Input */}
            <div className="flex items-center bg-[#141210] border border-[#524d43] rounded-xs px-1">
              <span className="text-[#78716c] text-[9.5px]">0x</span>
              <input
                type="text"
                value={xramJumpInput}
                maxLength={4}
                onChange={(e) => setXramJumpInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const pa = parseInt(xramJumpInput, 16);
                    if (!isNaN(pa)) setXramBaseAddr(pa & 0xFFFF);
                  }
                }}
                className="w-10 bg-transparent text-[#ffffff] font-bold text-center text-[10px] outline-none"
              />
              <span className="text-[#78716c] text-[9.5px]">H</span>
            </div>
            <button
              onClick={() => {
                const pa = parseInt(xramJumpInput, 16);
                if (!isNaN(pa)) setXramBaseAddr(pa & 0xFFFF);
              }}
              className="px-1.5 py-0.5 text-[9px] font-bold bg-[#1c1917] text-[#38bdf8] border border-[#0284c7] rounded-xs cursor-pointer"
            >
              GO
            </button>

            {/* Quick Jumps */}
            <button
              onClick={() => {
                const pa = dptrAddr & ~0x3F;
                setXramBaseAddr(pa);
                setXramJumpInput(pa.toString(16).toUpperCase().padStart(4, '0'));
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#fbbf24] border border-[#d97706] rounded-xs cursor-pointer hover:bg-[#d97706] hover:text-black"
              title={`Jump to address pointed to by DPTR (0x${dptrAddr.toString(16).toUpperCase().padStart(4, '0')}H)`}
            >
              DPTR (0x{dptrAddr.toString(16).toUpperCase().padStart(4, '0')}H)
            </button>

            <button
              onClick={() => {
                const pa = r0Addr16 & ~0x3F;
                setXramBaseAddr(pa);
                setXramJumpInput(pa.toString(16).toUpperCase().padStart(4, '0'));
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#0284c7] rounded-xs cursor-pointer hover:bg-[#0284c7] hover:text-black"
              title={`Jump to external address addressed by MOVX @R0 (P2:R0 = 0x${r0Addr16.toString(16).toUpperCase().padStart(4, '0')}H)`}
            >
              @R0 (0x{r0Addr16.toString(16).toUpperCase().padStart(4, '0')}H)
            </button>

            <button
              onClick={() => {
                const pa = r1Addr16 & ~0x3F;
                setXramBaseAddr(pa);
                setXramJumpInput(pa.toString(16).toUpperCase().padStart(4, '0'));
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#0284c7] rounded-xs cursor-pointer hover:bg-[#0284c7] hover:text-black"
              title={`Jump to external address addressed by MOVX @R1 (P2:R1 = 0x${r1Addr16.toString(16).toUpperCase().padStart(4, '0')}H)`}
            >
              @R1 (0x{r1Addr16.toString(16).toUpperCase().padStart(4, '0')}H)
            </button>

            {/* Prev / Next buttons */}
            <button
              onClick={() => {
                const newBase = (xramBaseAddr - 64 + 65536) & 0xFFFF;
                setXramBaseAddr(newBase);
                setXramJumpInput(newBase.toString(16).toUpperCase().padStart(4, '0'));
              }}
              className="px-1.5 py-0.5 text-[9px] font-bold bg-[#141210] text-[#a8a29e] hover:text-white border border-[#44403c] rounded-xs cursor-pointer"
            >
              ◀ -64B
            </button>
            <button
              onClick={() => {
                const newBase = (xramBaseAddr + 64) & 0xFFFF;
                setXramBaseAddr(newBase);
                setXramJumpInput(newBase.toString(16).toUpperCase().padStart(4, '0'));
              }}
              className="px-1.5 py-0.5 text-[9px] font-bold bg-[#141210] text-[#a8a29e] hover:text-white border border-[#44403c] rounded-xs cursor-pointer"
            >
              +64B ▶
            </button>

            {/* Find non-zero byte */}
            <button
              onClick={handleFindNextNonZeroXram}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#141210] text-[#4ade80] hover:bg-[#22c55e] hover:text-black border border-[#22c55e] rounded-xs cursor-pointer"
              title="Search and jump to the next non-zero byte in 64KB XRAM"
            >
              🔍 FIND NON-ZERO
            </button>
          </div>
        )}

        {memorySpace === 'sfr' && (
          <div className="text-[10px] text-[#c084fc] font-bold">
            DIRECT SPECIAL FUNCTION REGISTER SPACE (80H - FFH)
          </div>
        )}

        <span className="text-[9px] text-[#78716c]">
          {filteredRowIndices.length * 8} BYTES SHOWN
        </span>
      </div>

      {/* 5. Memory Hex & Ascii Grid Table */}
      <div className="flex-1 overflow-auto bg-[#0e0d0c] rounded-xs border border-[#2d2924] min-h-[140px]">
        <table className="w-full text-left border-collapse font-mono">
          <thead className="sticky top-0 bg-[#141210] z-10 shadow-xs">
            <tr className="text-[10px] text-[#a8a29e] border-b border-[#38332c]">
              <th className="py-1 px-1.5 font-black text-[#fbbf24]">ADDR</th>
              {Array.from({ length: 8 }, (_, i) => (
                <th key={i} className="py-1 px-1 text-center font-bold text-[#ffffff]">
                  +{i.toString(16).toUpperCase()}
                </th>
              ))}
              <th className="py-1 px-2 text-left text-[#a8a29e] font-bold">ASCII</th>
            </tr>
          </thead>
          <tbody>
            {filteredRowIndices.map((row) => {
              const baseAddr = memorySpace === 'xram' ? (xramBaseAddr + row * 8) & 0xFFFF : row * 8;
              let asciiStr = '';

              // Check if this row is part of a register bank in IRAM
              const isBank0 = memorySpace === 'iram' && baseAddr < 0x08;
              const isBank1 = memorySpace === 'iram' && baseAddr >= 0x08 && baseAddr < 0x10;
              const isBank2 = memorySpace === 'iram' && baseAddr >= 0x10 && baseAddr < 0x18;
              const isBank3 = memorySpace === 'iram' && baseAddr >= 0x18 && baseAddr < 0x20;
              const rowBank = isBank0 ? 0 : isBank1 ? 1 : isBank2 ? 2 : isBank3 ? 3 : null;
              const isRowActiveBank = rowBank !== null && rowBank === activeBank;

              return (
                <tr
                  key={row}
                  className={`border-b border-[#1f1d1a] hover:bg-[#1f1c18] transition-colors ${
                    isRowActiveBank ? 'bg-[#261e12]/60' : ''
                  }`}
                >
                  {/* Address Column */}
                  <td className="py-0.5 px-1.5 font-black text-[11px] whitespace-nowrap">
                    <span className={isRowActiveBank ? 'text-[#38bdf8]' : memorySpace === 'xram' ? 'text-[#38bdf8]' : 'text-[#fbbf24]'}>
                      0x{baseAddr.toString(16).toUpperCase().padStart(memorySpace === 'xram' ? 4 : 2, '0')}H
                    </span>
                    {isRowActiveBank && (
                      <span className="text-[8px] bg-[#0284c7] text-white px-1 py-0.2 rounded-xs font-black ml-1">
                        BANK {activeBank}
                      </span>
                    )}
                  </td>

                  {/* 8 Data Byte Columns */}
                  {Array.from({ length: 8 }, (_, col) => {
                    const addr = memorySpace === 'xram' ? (baseAddr + col) & 0xFFFF : baseAddr + col;
                    const byteVal = getByteAt(addr, memorySpace);
                    const isChanged = memorySpace === 'xram'
                      ? cpuState.changedXramIndices?.has(addr)
                      : memorySpace === 'sfr'
                      ? cpuState.changedSfrAddresses.has(addr)
                      : cpuState.changedRamIndices.has(addr);

                    const isSp = memorySpace === 'iram' && cpuState.sp === addr;
                    const inStackFrame = memorySpace === 'iram' && addr > 0x07 && addr <= cpuState.sp;
                    const isEditing = editingAddr === addr;

                    // Register names and mapped SFR indicators
                    const regName = memorySpace === 'iram' && rowBank !== null ? `R${col}` : null;
                    const sfrName = SFR_NAMES[addr & 0xFF];

                    const ch = byteVal >= 32 && byteVal <= 126 ? String.fromCharCode(byteVal) : '.';
                    asciiStr += ch;

                    return (
                      <td
                        key={col}
                        onClick={() => handleCellClick(addr)}
                        className={`py-0.5 px-1 text-center cursor-pointer transition-colors text-[11px] font-bold relative ${
                          isEditing
                            ? 'bg-[#f59e0b] text-[#000000]'
                            : isChanged
                            ? 'bg-[#f59e0b]/40 text-[#fbbf24] font-black shadow-inner animate-pulse'
                            : isSp
                            ? 'bg-[#0369a1]/40 text-[#38bdf8] font-black border border-[#38bdf8]'
                            : inStackFrame
                            ? 'bg-[#0c2438]/40 text-[#7dd3fc]'
                            : isRowActiveBank
                            ? 'text-[#ffffff] bg-[#1a140a]'
                            : byteVal !== 0
                            ? 'text-[#ffffff]'
                            : 'text-[#6b6255]'
                        }`}
                        title={
                          `Address: 0x${addr.toString(16).toUpperCase().padStart(memorySpace === 'xram' ? 4 : 2, '0')}H (${addr})` +
                          (regName ? ` | ${regName} (Bank ${rowBank})` : '') +
                          (memorySpace === 'iram' && addr >= 0x80 && sfrName ? ` | [Note: Direct 0x${addr.toString(16).toUpperCase()}H maps to SFR ${sfrName}; Indirect @R0/@R1 accesses this RAM byte]` : '') +
                          (memorySpace === 'sfr' && sfrName ? ` | SFR: ${sfrName}` : '') +
                          (isSp ? ' | [STACK POINTER / TOS]' : inStackFrame ? ' | [STACK FRAME]' : '') +
                          ` | Value: 0x${byteVal.toString(16).toUpperCase().padStart(2, '0')} (${byteVal})`
                        }
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editVal}
                            maxLength={displayFormat === 'hex' ? 2 : 3}
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => handleEditSubmit(addr)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSubmit(addr);
                              if (e.key === 'Escape') setEditingAddr(null);
                            }}
                            className="w-7 text-center bg-[#000000] text-[#fbbf24] font-black outline-none border border-[#f59e0b] text-[10px]"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <span>
                              {displayFormat === 'hex'
                                ? byteVal.toString(16).toUpperCase().padStart(2, '0')
                                : byteVal.toString(10)}
                            </span>
                            {/* Badges for SP, SFR name, or Upper RAM */}
                            {isSp && (
                              <span className="text-[7px] text-[#38bdf8] font-black leading-none -mt-0.5">
                                SP
                              </span>
                            )}
                            {memorySpace === 'sfr' && sfrName && !isSp && (
                              <span className="text-[6.5px] text-[#c084fc] font-bold leading-none -mt-0.5">
                                {sfrName}
                              </span>
                            )}
                            {memorySpace === 'iram' && addr >= 0x80 && sfrName && !isSp && (
                              <span className="text-[6px] text-[#78716c] font-bold leading-none -mt-0.5" title={`Direct space maps to SFR ${sfrName}`}>
                                [{sfrName}]
                              </span>
                            )}
                            {regName && !isSp && (
                              <span className="text-[6.5px] text-[#38bdf8] font-bold leading-none -mt-0.5">
                                {regName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* ASCII Column */}
                  <td className="py-0.5 px-2 text-[#a8a29e] text-[10.5px] tracking-widest font-mono">
                    {asciiStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
