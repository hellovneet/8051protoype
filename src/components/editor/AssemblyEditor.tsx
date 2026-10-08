/**
 * Micro8051SiM Assembly Code Editor (EdSim51 High Contrast & High Readability)
 * Displays ROM Store Address (hexadecimal, e.g. 0000H) next to each line number in the gutter,
 * with machine code bytes (HEX), line numbers, syntax highlighting layer, and breakpoint gutter.
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { AssemblerError, DisassembledInstruction } from '../../core/types.ts';

interface AssemblyEditorProps {
  sourceCode: string;
  onChange: (newCode: string) => void;
  currentLine?: number; // 1-based source line currently executing
  currentPc?: number; // Current Program Counter
  breakpoints: Set<number>; // addresses
  lineToAddress: Map<number, number>;
  disassembly?: DisassembledInstruction[];
  onToggleBreakpoint: (line: number) => void;
  errors: AssemblerError[];
  isReadOnly?: boolean;
}

// 8051 Standard Mnemonics for syntax highlighting
const MNEMONICS = new Set([
  'MOV', 'MOVX', 'MOVC', 'PUSH', 'POP', 'XCH', 'XCHD',
  'ADD', 'ADDC', 'SUBB', 'INC', 'DEC', 'MUL', 'DIV', 'DA',
  'ANL', 'ORL', 'XRL', 'CLR', 'CPL', 'RL', 'RLC', 'RR', 'RRC', 'SWAP',
  'SETB', 'JC', 'JNC', 'JB', 'JNB', 'JBC', 'JZ', 'JNZ', 'CJNE', 'DJNZ',
  'SJMP', 'LJMP', 'AJMP', 'JMP', 'ACALL', 'LCALL', 'RET', 'RETI', 'NOP'
]);

const DIRECTIVES = new Set(['ORG', 'END', 'EQU', 'DB', 'DW', 'BIT', 'DATA', 'IDATA', 'XDATA']);

export const AssemblyEditor: React.FC<AssemblyEditorProps> = ({
  sourceCode,
  onChange,
  currentLine,
  currentPc,
  breakpoints,
  lineToAddress,
  disassembly = [],
  onToggleBreakpoint,
  errors,
  isReadOnly = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  // Font size setting (default 15px for high visibility)
  const [fontSize, setFontSize] = useState<number>(15);
  // Toggle to show/hide Store Address and Bytes columns
  const [showStoreAddress, setShowStoreAddress] = useState<boolean>(true);
  const [showHexBytes, setShowHexBytes] = useState<boolean>(true);

  const lineHeight = Math.round(fontSize * 1.55);
  const lines = useMemo(() => sourceCode.split('\n'), [sourceCode]);

  // Build map of lineNum -> { addressStr, bytesStr, addrNum } from disassembly and lineToAddress
  const lineDetailsMap = useMemo(() => {
    const map = new Map<number, { addressStr: string; bytesStr: string; addrNum: number }>();

    // 1. First from disassembly (most accurate for encoded instructions)
    disassembly.forEach((d) => {
      if (d.sourceLine !== undefined) {
        const addressStr = `${d.address.toString(16).toUpperCase().padStart(4, '0')}H`;
        const bytesStr = d.bytes
          .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
          .join(' ');
        map.set(d.sourceLine, { addressStr, bytesStr, addrNum: d.address });
      }
    });

    // 2. Also fill in from lineToAddress (e.g. for ORG and labels)
    lineToAddress.forEach((addr, line) => {
      if (!map.has(line)) {
        const addressStr = `${addr.toString(16).toUpperCase().padStart(4, '0')}H`;
        map.set(line, { addressStr, bytesStr: '', addrNum: addr });
      }
    });

    return map;
  }, [disassembly, lineToAddress]);

  // Map of line -> error message
  const errorMap = useMemo(() => {
    const map = new Map<number, AssemblerError>();
    errors.forEach((e) => {
      if (!map.has(e.line) || e.type === 'error') {
        map.set(e.line, e);
      }
    });
    return map;
  }, [errors]);

  // Sync scroll between textarea, highlight layer, and gutter
  const handleScroll = () => {
    if (textareaRef.current) {
      const top = textareaRef.current.scrollTop;
      const left = textareaRef.current.scrollLeft;
      if (gutterRef.current) gutterRef.current.scrollTop = top;
      if (highlightLayerRef.current) {
        highlightLayerRef.current.scrollTop = top;
        highlightLayerRef.current.scrollLeft = left;
      }
    }
  };

  // Scroll active execution line into view if it changes
  useEffect(() => {
    if (currentLine && textareaRef.current) {
      const targetScroll = (currentLine - 4) * lineHeight;
      if (Math.abs(textareaRef.current.scrollTop - targetScroll) > lineHeight * 6) {
        textareaRef.current.scrollTop = Math.max(0, targetScroll);
        if (gutterRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        if (highlightLayerRef.current) highlightLayerRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    }
  }, [currentLine, lineHeight]);

  // Syntax tokenize line for crisp high-contrast visual display
  const renderHighlightedLine = (lineStr: string) => {
    if (!lineStr) return ' ';

    // Split comments first
    const commentIdx = lineStr.indexOf(';');
    const codePart = commentIdx >= 0 ? lineStr.slice(0, commentIdx) : lineStr;
    const commentPart = commentIdx >= 0 ? lineStr.slice(commentIdx) : '';

    // Regex to capture tokens: labels, words, numbers, strings
    const tokenRegex = /([a-zA-Z_][a-zA-Z0-9_]*:?|#[0-9a-fA-F]+[hH]?|[0-9][0-9a-fA-F]*[hH]?|[0-9]+[bB]?|'[a-zA-Z0-9]'|,|\s+|@R[01])/g;
    const tokens: React.ReactNode[] = [];
    let match;
    let lastIdx = 0;

    while ((match = tokenRegex.exec(codePart)) !== null) {
      const text = match[0];
      const upper = text.toUpperCase();

      if (text.endsWith(':')) {
        // Label definition
        tokens.push(<span key={match.index} className="text-[#f472b6] font-black">{text}</span>);
      } else if (MNEMONICS.has(upper)) {
        // Assembly Instruction mnemonic
        tokens.push(<span key={match.index} className="text-[#fbbf24] font-black">{text}</span>);
      } else if (DIRECTIVES.has(upper)) {
        // Assembler directive
        tokens.push(<span key={match.index} className="text-[#fcd34d] font-bold">{text}</span>);
      } else if (upper.startsWith('#') || /^[0-9]/.test(upper)) {
        // Immediate value or numeric literal
        tokens.push(<span key={match.index} className="text-[#38bdf8] font-bold">{text}</span>);
      } else if (['A', 'B', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'DPTR', 'PC', 'SP', 'PSW', 'C', 'P0', 'P1', 'P2', 'P3'].includes(upper)) {
        // Core register or Port
        tokens.push(<span key={match.index} className="text-[#34d399] font-bold">{text}</span>);
      } else {
        tokens.push(<span key={match.index} className="text-[#ffffff] font-medium">{text}</span>);
      }
      lastIdx = tokenRegex.lastIndex;
    }

    if (lastIdx < codePart.length) {
      tokens.push(<span key={lastIdx} className="text-[#ffffff] font-medium">{codePart.slice(lastIdx)}</span>);
    }

    return (
      <>
        {tokens}
        {commentPart && (
          <span className="text-[#86efac] font-bold italic">{commentPart}</span>
        )}
      </>
    );
  };

  return (
    <div className="relative flex flex-col flex-1 h-full w-full bg-[#141210] border border-[#524d43] rounded-sm overflow-hidden font-mono shadow-sm">
      {/* Editor Sub-Toolbar: Store Address controls, font size, active line */}
      <div className="bg-[#1c1917] border-b border-[#44403c] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-[#fbbf24] uppercase tracking-wider">
            8051 PROGRAM EDITOR
          </span>
          {currentPc !== undefined && (
            <span className="bg-[#f59e0b] text-[#000000] px-2 py-0.5 rounded-xs text-[11px] font-black border border-[#fbbf24]">
              ► PC: 0x{currentPc.toString(16).toUpperCase().padStart(4, '0')}H
            </span>
          )}
        </div>

        {/* Store Address & Display Controls */}
        <div className="flex items-center gap-2">
          {/* Toggle Store Address */}
          <button
            onClick={() => setShowStoreAddress((p) => !p)}
            className={`px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded-xs border transition-colors cursor-pointer ${
              showStoreAddress
                ? 'bg-[#fbbf24] text-[#000000] border-[#fbbf24]'
                : 'bg-[#292524] text-[#a8a29e] border-[#524d43]'
            }`}
            title="Toggle display of ROM Store Addresses (0000H, 0002H...)"
          >
            {showStoreAddress ? '✓ ROM ADDR' : 'ROM ADDR'}
          </button>

          {/* Toggle Hex Bytes */}
          <button
            onClick={() => setShowHexBytes((p) => !p)}
            className={`px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded-xs border transition-colors cursor-pointer ${
              showHexBytes
                ? 'bg-[#38bdf8] text-[#000000] border-[#38bdf8]'
                : 'bg-[#292524] text-[#a8a29e] border-[#524d43]'
            }`}
            title="Toggle display of Machine Code Hex Bytes (74 55...)"
          >
            {showHexBytes ? '✓ HEX BYTES' : 'HEX BYTES'}
          </button>

          {/* Font size picker */}
          <div className="flex items-center gap-1 bg-[#141210] border border-[#524d43] px-1 py-0.5 rounded-xs">
            <span className="text-[10px] text-[#ffffff] font-bold">FONT:</span>
            {[13, 15, 17].map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-1.5 py-0.2 text-[10px] font-bold font-mono rounded-xs cursor-pointer ${
                  fontSize === size
                    ? 'bg-[#f59e0b] text-[#000000] font-black'
                    : 'text-[#d4d4d8] hover:text-[#ffffff]'
                }`}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column Headers over Gutter & Code Area */}
      <div className="flex bg-[#161412] border-b border-[#44403c] text-[10px] font-mono font-black select-none z-10">
        {/* Gutter Headers */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1c1917] border-r border-[#44403c] shrink-0">
          <span className="w-4 text-center text-[#a8a29e]" title="Breakpoints & Execution Pointer">BP</span>
          <span className="w-6 text-right text-[#a8a29e]" title="Source line number">LN</span>
          {showStoreAddress && (
            <span
              className="w-16 text-center text-[#fbbf24] font-black uppercase tracking-wider"
              title="ROM Store Address in hexadecimal (e.g. 0000H, 0002H)"
            >
              ROM ADDR
            </span>
          )}
          {showHexBytes && (
            <span
              className="w-20 text-left text-[#38bdf8] font-black uppercase tracking-wider"
              title="Machine code bytes in hexadecimal (e.g. 74 55)"
            >
              OPCODES
            </span>
          )}
        </div>

        {/* Code Header */}
        <div className="px-3 py-1 text-[#ffffff] font-bold flex-1">
          8051 ASSEMBLY SOURCE CODE
        </div>
      </div>

      <div className="relative flex flex-1 h-full w-full overflow-hidden">
        {/* 1. Gutter: Breakpoint, Line numbers, Store Address (ROM), Machine Hex Bytes */}
        <div
          ref={gutterRef}
          className="bg-[#1c1917] border-r border-[#44403c] py-2 overflow-hidden flex flex-col shrink-0 select-none text-left"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isExecLine = currentLine === lineNum;
            const hasError = errorMap.has(lineNum);
            const lineInfo = lineDetailsMap.get(lineNum);
            const targetAddr = lineInfo ? lineInfo.addrNum : lineToAddress.get(lineNum);
            const hasBreak = targetAddr !== undefined && breakpoints.has(targetAddr);

            return (
              <div
                key={lineNum}
                style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                className={`flex items-center gap-1.5 cursor-pointer px-2 transition-colors border-r border-transparent ${
                  isExecLine
                    ? 'bg-[#f59e0b] text-[#000000] font-black border-r-2 border-r-[#ffffff]'
                    : hasError
                    ? 'bg-[#7f1d1d] text-[#ffffff]'
                    : 'hover:bg-[#292524]'
                }`}
                onClick={() => onToggleBreakpoint(lineNum)}
                title={
                  targetAddr !== undefined
                    ? `Line ${lineNum} · ROM Address: 0x${targetAddr.toString(16).toUpperCase().padStart(4, '0')}H · Click to toggle breakpoint`
                    : `Line ${lineNum} · Click to toggle breakpoint`
                }
              >
                {/* Breakpoint / Execution pointer */}
                <div className="w-4 flex items-center justify-center shrink-0">
                  {isExecLine ? (
                    <span className="text-[#000000] text-xs font-black leading-none animate-bounce">
                      ▶
                    </span>
                  ) : hasBreak ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-[#ffffff] shadow-[0_0_8px_#ef4444]" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full opacity-0 hover:opacity-50 bg-[#fbbf24]" />
                  )}
                </div>

                {/* Line number */}
                <span
                  className={`w-6 text-right text-[11px] font-mono tabular-nums font-bold shrink-0 ${
                    isExecLine ? 'text-[#000000] font-black' : 'text-[#a8a29e]'
                  }`}
                >
                  {lineNum.toString().padStart(2, '0')}
                </span>

                {/* ROM Store Address (0000H) */}
                {showStoreAddress && (
                  <span
                    className={`w-16 text-center text-[11px] font-mono font-black shrink-0 px-1 rounded-xs border ${
                      isExecLine
                        ? 'bg-[#000000] text-[#fbbf24] border-[#fbbf24]'
                        : lineInfo
                        ? 'text-[#fbbf24] bg-[#29221a] border-[#524d43]'
                        : 'text-[#44403c] border-transparent'
                    }`}
                  >
                    {lineInfo ? lineInfo.addressStr : '····'}
                  </span>
                )}

                {/* Machine Code Hex Bytes (74 55) */}
                {showHexBytes && (
                  <span
                    className={`w-20 text-left text-[10px] font-mono font-bold shrink-0 truncate px-1 rounded-xs border ${
                      isExecLine
                        ? 'bg-[#000000] text-[#38bdf8] font-black border-[#38bdf8]'
                        : lineInfo && lineInfo.bytesStr
                        ? 'text-[#38bdf8] bg-[#141c22] border-[#25323a]'
                        : 'text-[#2e2a26] border-transparent'
                    }`}
                  >
                    {lineInfo && lineInfo.bytesStr ? lineInfo.bytesStr : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. Main Code Area: Syntax Highlighting Layer + Transparent Input Textarea */}
        <div className="relative flex-1 h-full overflow-hidden bg-[#141210]">
          {/* Active execution line background highlight */}
          {currentLine && currentLine <= lines.length && (
            <div
              className="absolute left-0 right-0 pointer-events-none bg-[#f59e0b]/25 border-y-2 border-[#f59e0b] z-0 transition-all duration-75"
              style={{
                top: `${(currentLine - 1) * lineHeight + 8 - (textareaRef.current?.scrollTop || 0)}px`,
                height: `${lineHeight}px`,
              }}
            />
          )}

          {/* Syntax-highlighted presentation layer (perfectly synced with textarea) */}
          <div
            ref={highlightLayerRef}
            className="absolute inset-0 p-2 pointer-events-none overflow-hidden whitespace-pre font-mono select-none"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`,
              tabSize: 4,
            }}
          >
            {lines.map((l, i) => (
              <div
                key={i}
                style={{ height: `${lineHeight}px` }}
                className="overflow-visible"
              >
                {renderHighlightedLine(l)}
              </div>
            ))}
          </div>

          {/* Real Input Textarea on top with transparent text color so cursor and typing work seamlessly */}
          <textarea
            ref={textareaRef}
            value={sourceCode}
            readOnly={isReadOnly}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="Type or paste 8051 Assembly code here..."
            className="relative z-10 w-full h-full p-2 bg-transparent text-transparent caret-[#fbbf24] resize-none outline-none font-mono whitespace-pre overflow-auto select-text selection:bg-[#f59e0b]/40 selection:text-transparent"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`,
              tabSize: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
};
