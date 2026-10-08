/**
 * Micro8051SiM Multi-Channel Pin Frequency & Logic Analyzer Display
 * High-precision digital logic probe measuring toggling frequency,
 * period, duty cycle, high/low times, machine cycle costs, and live multi-channel waveforms.
 * Features:
 * - Simultaneous display and toggling of multiple pin states (e.g., P1.0 through P1.3)
 * - Standard CSV export of captured pin signal transition history for external analysis
 * - Synchronous & Asynchronous communication timing graphs (UART 8-N-1 vs Mode 0 / SPI)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FrequencyAnalyzer,
  FrequencyAnalysisMetrics,
  CHANNEL_COLORS,
  CommunicationViewMode,
  SignalDisplayMode,
} from '../../peripherals/frequency-analyzer.ts';
import { ClockSpeedHz } from '../../core/types.ts';
import { CommunicationGraph } from './CommunicationGraph.tsx';

interface FrequencyDisplayProps {
  analyzer: FrequencyAnalyzer;
  cpuCycles: number;
  clockHz: ClockSpeedHz;
  compact?: boolean;
  onSelectPin?: (port: number, pin: number, label: string) => void;
  onLoadCodePreset?: (code: string, title: string) => void;
}

export const FrequencyDisplay: React.FC<FrequencyDisplayProps> = ({
  analyzer,
  cpuCycles,
  clockHz,
  compact = false,
  onSelectPin,
  onLoadCodePreset,
}) => {
  const [selectedPort, setSelectedPort] = useState<number>(analyzer.probeTarget.port);
  const [selectedPin, setSelectedPin] = useState<number>(analyzer.probeTarget.pin);
  const [isHold, setIsHold] = useState<boolean>(analyzer.isHold);
  const [timeDivUs, setTimeDivUs] = useState<number>(0); // 0 = Auto
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);
  const [signalViewMode, setSignalViewMode] = useState<SignalDisplayMode>('timeline');
  const [commMode, setCommMode] = useState<CommunicationViewMode>('logic-traces');
  const [uartBaudRate, setUartBaudRate] = useState<number>(9600);
  const [asyncTestByte, setAsyncTestByte] = useState<number>(0x41); // 'A'
  const [syncTestByte, setSyncTestByte] = useState<number>(0x55);   // 01010101b
  const [csvDownloadCount, setCsvDownloadCount] = useState<number>(0);
  const [, setForceUpdate] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive Vertical Cursors State
  const [showCursors, setShowCursors] = useState<boolean>(true);
  const [cursorAFrac, setCursorAFrac] = useState<number>(0.2); // 20% across timeline
  const [cursorBFrac, setCursorBFrac] = useState<number>(0.7); // 70% across timeline
  const [activeDragCursor, setActiveDragCursor] = useState<'A' | 'B' | null>(null);
  const [canvasCursorStyle, setCanvasCursorStyle] = useState<string>('crosshair');
  const snapEdgesRef = useRef<{ x: number; type: 'rising' | 'falling' }[]>([]);

  // Sync internal state when external analyzer changes
  useEffect(() => {
    setSelectedPort(analyzer.probeTarget.port);
    setSelectedPin(analyzer.probeTarget.pin);
  }, [analyzer.probeTarget.port, analyzer.probeTarget.pin]);

  // Read current primary metrics from analyzer
  const primaryMetrics: FrequencyAnalysisMetrics = analyzer.getMetrics(cpuCycles);
  const enabledTrackers = analyzer.getEnabledTrackers();

  // Format frequency with appropriate units
  const formatFrequency = (hz: number, isOscillating = true): string => {
    if (hz <= 0 || !isOscillating) return '0 Hz (DC)';
    if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
    if (hz >= 1_000) return `${(hz / 1_000).toFixed(3)} kHz`;
    if (hz >= 100) return `${hz.toFixed(1)} Hz`;
    return `${hz.toFixed(2)} Hz`;
  };

  // Format time in us / ms / s
  const formatTime = (us: number): string => {
    if (us <= 0) return '0.0 µs';
    if (us >= 1_000_000) return `${(us / 1_000_000).toFixed(3)} s`;
    if (us >= 1_000) return `${(us / 1_000).toFixed(2)} ms`;
    return `${us.toFixed(1)} µs`;
  };

  const handleSelectPrimaryPin = (port: number, pin: number, label?: string) => {
    setSelectedPort(port);
    setSelectedPin(pin);
    analyzer.setProbe(port, pin, label);
    if (onSelectPin) {
      onSelectPin(port, pin, label ?? `P${port}.${pin}`);
    }
    setForceUpdate((v) => v + 1);
  };

  const handleTogglePin = (port: number, pin: number) => {
    analyzer.togglePin(port, pin);
    setSelectedPort(analyzer.probeTarget.port);
    setSelectedPin(analyzer.probeTarget.pin);
    setForceUpdate((v) => v + 1);
  };

  const handleApplyPreset = (preset: 'single' | 'nibble' | 'byte') => {
    analyzer.setMultiPinPreset(preset);
    setSelectedPort(analyzer.probeTarget.port);
    setSelectedPin(analyzer.probeTarget.pin);
    setForceUpdate((v) => v + 1);
  };

  const handleToggleHold = () => {
    const nextHold = analyzer.toggleHold();
    setIsHold(nextHold);
  };

  const handleReset = () => {
    analyzer.reset();
    setIsHold(false);
    setForceUpdate((v) => v + 1);
  };

  // Export captured pin signal history as CSV file
  const handleExportCsv = () => {
    const csvContent = analyzer.generateCsvExport(clockHz, cpuCycles);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `micro8051-signal-history-P${selectedPort}_${selectedPin}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvDownloadCount((c) => c + 1);
  };

  // Screen timebase scaling for interactive vertical cursors
  const basePeriodUs = primaryMetrics.isOscillating && primaryMetrics.periodUs > 0 ? primaryMetrics.periodUs : 1000;
  const totalScreenUs = timeDivUs > 0 ? timeDivUs * 10 : basePeriodUs * 3.5;
  const cursorATimeUs = Math.max(0, cursorAFrac * totalScreenUs);
  const cursorBTimeUs = Math.max(0, cursorBFrac * totalScreenUs);
  const deltaUs = Math.abs(cursorBTimeUs - cursorATimeUs);
  const deltaCycles = (deltaUs * clockHz) / (12 * 1_000_000);
  const deltaFreqHz = deltaUs > 0.001 ? 1_000_000 / deltaUs : 0;
  const deltaFreqStr = formatFrequency(deltaFreqHz, deltaUs > 0.001);

  // Snap Cursor A and B to 1 full period of the signal
  const handleSnapPeriod = () => {
    const gutterWidth = 92;
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 640;
    const waveAreaWidth = width - gutterWidth;
    const edges = snapEdgesRef.current;

    const rising = edges.filter((e) => e.type === 'rising');
    if (rising.length >= 2) {
      const fracA = Math.max(0, Math.min(1, (rising[0].x - gutterWidth) / waveAreaWidth));
      const fracB = Math.max(0, Math.min(1, (rising[1].x - gutterWidth) / waveAreaWidth));
      setCursorAFrac(fracA);
      setCursorBFrac(fracB);
      setShowCursors(true);
      return;
    }

    if (primaryMetrics.isOscillating && totalScreenUs > 0) {
      const periodFrac = Math.min(0.8, primaryMetrics.periodUs / totalScreenUs);
      setCursorAFrac(0.1);
      setCursorBFrac(Math.min(1, 0.1 + periodFrac));
      setShowCursors(true);
    } else {
      setCursorAFrac(0.2);
      setCursorBFrac(0.7);
      setShowCursors(true);
    }
  };

  // Snap Cursor A and B to high pulse width
  const handleSnapPulse = () => {
    const gutterWidth = 92;
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 640;
    const waveAreaWidth = width - gutterWidth;
    const edges = snapEdgesRef.current;

    const rising = edges.find((e) => e.type === 'rising');
    const falling = edges.find((e) => e.type === 'falling' && (!rising || e.x > rising.x));

    if (rising && falling) {
      const fracA = Math.max(0, Math.min(1, (rising.x - gutterWidth) / waveAreaWidth));
      const fracB = Math.max(0, Math.min(1, (falling.x - gutterWidth) / waveAreaWidth));
      setCursorAFrac(fracA);
      setCursorBFrac(fracB);
      setShowCursors(true);
      return;
    }

    if (primaryMetrics.isOscillating && totalScreenUs > 0) {
      const highFrac = Math.min(0.8, primaryMetrics.highTimeUs / totalScreenUs);
      setCursorAFrac(0.1);
      setCursorBFrac(Math.min(1, 0.1 + highFrac));
      setShowCursors(true);
    }
  };

  // Reset cursors to standard default positions
  const handleResetCursors = () => {
    setCursorAFrac(0.2);
    setCursorBFrac(0.7);
    setShowCursors(true);
  };

  const handleNudgeCursorA = (delta: number) => {
    setCursorAFrac((prev) => Math.max(0, Math.min(1, prev + delta)));
  };

  const handleNudgeCursorB = (delta: number) => {
    setCursorBFrac((prev) => Math.max(0, Math.min(1, prev + delta)));
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent<HTMLCanvasElement>).clientX;
      clientY = (e as React.MouseEvent<HTMLCanvasElement>).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!showCursors) return;
    const { x } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gutterWidth = commMode === 'logic-traces' ? 92 : 24;
    const waveAreaWidth = canvas.width - gutterWidth;
    if (x < gutterWidth) return;

    const xA = gutterWidth + cursorAFrac * waveAreaWidth;
    const xB = gutterWidth + cursorBFrac * waveAreaWidth;

    const distA = Math.abs(x - xA);
    const distB = Math.abs(x - xB);

    if (distA <= 16 && distA <= distB) {
      setActiveDragCursor('A');
    } else if (distB <= 16) {
      setActiveDragCursor('B');
    } else {
      const newFrac = Math.max(0, Math.min(1, (x - gutterWidth) / waveAreaWidth));
      if (distA < distB) {
        setCursorAFrac(newFrac);
        setActiveDragCursor('A');
      } else {
        setCursorBFrac(newFrac);
        setActiveDragCursor('B');
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gutterWidth = commMode === 'logic-traces' ? 92 : 24;
    const waveAreaWidth = canvas.width - gutterWidth;

    if (activeDragCursor) {
      let rawFrac = Math.max(0, Math.min(1, (x - gutterWidth) / waveAreaWidth));
      const targetPx = gutterWidth + rawFrac * waveAreaWidth;
      for (const edge of snapEdgesRef.current) {
        if (Math.abs(targetPx - edge.x) < 8) {
          rawFrac = Math.max(0, Math.min(1, (edge.x - gutterWidth) / waveAreaWidth));
          break;
        }
      }

      if (activeDragCursor === 'A') {
        setCursorAFrac(rawFrac);
      } else {
        setCursorBFrac(rawFrac);
      }
    } else if (showCursors && x >= gutterWidth) {
      const xA = gutterWidth + cursorAFrac * waveAreaWidth;
      const xB = gutterWidth + cursorBFrac * waveAreaWidth;
      if (Math.abs(x - xA) <= 12 || Math.abs(x - xB) <= 12) {
        setCanvasCursorStyle('col-resize');
      } else {
        setCanvasCursorStyle('crosshair');
      }
    } else {
      setCanvasCursorStyle('default');
    }
  };

  const handleCanvasMouseUp = () => {
    setActiveDragCursor(null);
  };

  // Draw digital logic traces, Asynchronous UART frames, or Synchronous Clock+Data graphs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, width, height);

    // =========================================================================
    // MODE 1: MULTI-CHANNEL LOGIC TRACES
    // =========================================================================
    if (commMode === 'logic-traces') {
      if (enabledTrackers.length === 0) {
        ctx.fillStyle = '#78716c';
        ctx.font = '11px monospace';
        ctx.fillText('No channels active. Click pins above (e.g., P1.0 through P1.3) to enable signal view.', 20, height / 2);
        return;
      }

      const gutterWidth = 92;
      const waveAreaWidth = width - gutterWidth;
      const numChannels = enabledTrackers.length;
      const laneHeight = height / numChannels;

      // Draw vertical time grid lines across all channels
      ctx.strokeStyle = '#201d19';
      ctx.lineWidth = 1;
      const gridDivsX = 10;
      for (let x = 0; x <= gridDivsX; x++) {
        const gx = gutterWidth + (x / gridDivsX) * waveAreaWidth;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }

      // Draw gutter divider
      ctx.strokeStyle = '#38332c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gutterWidth, 0);
      ctx.lineTo(gutterWidth, height);
      ctx.stroke();

      // Render each channel's lane
      enabledTrackers.forEach((tracker, idx) => {
        const laneTop = idx * laneHeight;
        const laneBottom = (idx + 1) * laneHeight;
        const highY = laneTop + Math.max(6, Math.min(10, laneHeight * 0.22));
        const lowY = laneBottom - Math.max(6, Math.min(10, laneHeight * 0.22));
        const isPrimary = tracker.port === analyzer.probeTarget.port && tracker.pin === analyzer.probeTarget.pin;

        const metrics = tracker.getMetrics(cpuCycles, clockHz);

        // Horizontal channel separator
        if (idx > 0) {
          ctx.strokeStyle = '#272421';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, laneTop);
          ctx.lineTo(width, laneTop);
          ctx.stroke();
        }

        // Highlight active focused channel background subtly
        if (isPrimary) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
          ctx.fillRect(0, laneTop, width, laneHeight);
        }

        // 1. Gutter Info (Left sidebar)
        ctx.fillStyle = tracker.color;
        ctx.fillRect(0, laneTop, 4, laneHeight);

        // Channel Key (e.g., P1.0)
        ctx.fillStyle = tracker.color;
        ctx.font = `bold ${numChannels > 4 ? 9 : 11}px monospace`;
        ctx.fillText(tracker.key, 8, laneTop + (laneHeight > 34 ? 14 : laneHeight * 0.45));

        // Level Badge ([1] or [0])
        const isHigh = metrics.currentLevel === 1;
        ctx.fillStyle = isHigh ? '#22c55e' : '#78716c';
        ctx.font = `bold ${numChannels > 4 ? 9 : 10}px monospace`;
        ctx.fillText(isHigh ? '[1]' : '[0]', 46, laneTop + (laneHeight > 34 ? 14 : laneHeight * 0.45));

        // Frequency / Duty summary in gutter
        ctx.fillStyle = isPrimary ? '#fbbf24' : '#a8a29e';
        ctx.font = `${numChannels > 4 ? 7.5 : 8.5}px monospace`;
        if (metrics.isOscillating) {
          const freqStr = formatFrequency(metrics.frequencyHz);
          ctx.fillText(freqStr, 8, laneBottom - (laneHeight > 34 ? 6 : 4));
        } else {
          ctx.fillText(isHigh ? 'HIGH' : 'LOW', 8, laneBottom - (laneHeight > 34 ? 6 : 4));
        }

        // 2. Waveform Trace
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = '#25211c';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(gutterWidth, highY);
        ctx.lineTo(width, highY);
        ctx.moveTo(gutterWidth, lowY);
        ctx.lineTo(width, lowY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.lineWidth = numChannels > 4 ? 1.5 : 2;
        ctx.strokeStyle = tracker.color;

        if (!metrics.isOscillating) {
          // Flatline trace
          const y = isHigh ? highY : lowY;
          ctx.beginPath();
          ctx.moveTo(gutterWidth, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        } else {
          // Oscillating wave trace
          const periodCycles = metrics.periodCycles || 1000;
          const duty = (metrics.dutyCyclePercent || 50) / 100;

          let cyclesAcrossScreen: number;
          if (timeDivUs > 0) {
            const totalScreenUs = timeDivUs * 10;
            const usPerCycle = (12 * 1_000_000) / clockHz;
            cyclesAcrossScreen = totalScreenUs / usPerCycle;
          } else {
            cyclesAcrossScreen = periodCycles * 3.5;
          }

          if (cyclesAcrossScreen <= 0) cyclesAcrossScreen = 1000;
          const pxPerCycle = waveAreaWidth / cyclesAcrossScreen;
          const periodPx = Math.max(4, periodCycles * pxPerCycle);
          const highPx = periodPx * duty;
          const lowPx = periodPx * (1 - duty);

          const cyclePhase = (cpuCycles - tracker.lastRisingCycle) % periodCycles;
          const phasePx = (cyclePhase / periodCycles) * periodPx;

          ctx.beginPath();
          let currentX = gutterWidth - phasePx;

          while (currentX < width + periodPx) {
            const nextHighEnd = currentX + highPx;
            const nextLowEnd = nextHighEnd + lowPx;

            ctx.moveTo(Math.max(gutterWidth, currentX), highY);
            ctx.lineTo(Math.max(gutterWidth, nextHighEnd), highY);

            if (nextHighEnd >= gutterWidth && nextHighEnd <= width) {
              ctx.lineTo(nextHighEnd, lowY);
            }

            ctx.lineTo(Math.min(width, Math.max(gutterWidth, nextLowEnd)), lowY);

            if (nextLowEnd >= gutterWidth && nextLowEnd <= width) {
              ctx.lineTo(nextLowEnd, highY);
            }

            currentX += periodPx;
          }
          ctx.stroke();

          if (isPrimary && periodPx > 50 && numChannels <= 4) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = '8px monospace';
            ctx.fillText(`T=${formatTime(metrics.periodUs)}`, gutterWidth + 10, (highY + lowY) / 2);
          }

          // Collect snap edge coordinates for primary channel
          if (isPrimary) {
            const edges: { x: number; type: 'rising' | 'falling' }[] = [];
            let checkX = gutterWidth - phasePx;
            while (checkX < width + periodPx) {
              const riseX = checkX;
              const fallX = checkX + highPx;
              if (riseX >= gutterWidth && riseX <= width) {
                edges.push({ x: riseX, type: 'rising' });
              }
              if (fallX >= gutterWidth && fallX <= width) {
                edges.push({ x: fallX, type: 'falling' });
              }
              checkX += periodPx;
            }
            snapEdgesRef.current = edges;
          }
        }
      });
    }

    // =========================================================================
    // MODE 2: ASYNCHRONOUS UART COMMUNICATION GRAPH (8-N-1 FRAME)
    // =========================================================================
    if (commMode === 'async-uart') {
      const bitUs = 1000000 / uartBaudRate; // e.g. 104.17 us for 9600 baud
      const highY = 32;
      const lowY = height - 36;
      const marginX = 24;
      const totalBits = 11; // 1 Idle, 1 Start, 8 Data, 1 Stop
      const bitWidth = (width - marginX * 2) / totalBits;

      // Draw background bit cells and vertical dividers
      ctx.strokeStyle = '#221f1b';
      ctx.lineWidth = 1;
      for (let i = 0; i <= totalBits; i++) {
        const bx = marginX + i * bitWidth;
        ctx.beginPath();
        ctx.moveTo(bx, 18);
        ctx.lineTo(bx, height - 20);
        ctx.stroke();
      }

      // Rails
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = '#38332c';
      ctx.beginPath();
      ctx.moveTo(marginX, highY);
      ctx.lineTo(width - marginX, highY);
      ctx.moveTo(marginX, lowY);
      ctx.lineTo(width - marginX, lowY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#78716c';
      ctx.font = '9px monospace';
      ctx.fillText('+5V (MARK/1)', 4, highY + 3);
      ctx.fillText('0V (SPACE/0)', 4, lowY + 3);

      // Bit values array: [Idle=1, Start=0, D0, D1, D2, D3, D4, D5, D6, D7, Stop=1]
      const byteVal = asyncTestByte;
      const dataBits = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => (byteVal >> b) & 1);
      const frameBits: Array<{ name: string; val: number; color: string; bg?: string }> = [
        { name: 'IDLE', val: 1, color: '#a8a29e' },
        { name: 'START', val: 0, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        ...dataBits.map((v, i) => ({
          name: `D${i}`,
          val: v,
          color: v === 1 ? '#38bdf8' : '#64748b',
          bg: v === 1 ? 'rgba(56,189,248,0.06)' : undefined,
        })),
        { name: 'STOP', val: 1, color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
      ];

      // Highlight bit backgrounds
      frameBits.forEach((bit, idx) => {
        const bx = marginX + idx * bitWidth;
        if (bit.bg) {
          ctx.fillStyle = bit.bg;
          ctx.fillRect(bx, 20, bitWidth, height - 42);
        }

        // Bit cell title (Top)
        ctx.fillStyle = bit.color;
        ctx.font = 'bold 9px monospace';
        ctx.fillText(bit.name, bx + bitWidth / 2 - 8, 14);

        // Bit value label (Bottom)
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = bit.val === 1 ? '#38bdf8' : '#f87171';
        ctx.fillText(`[${bit.val}]`, bx + bitWidth / 2 - 7, height - 8);
      });

      // Draw the Asynchronous digital logic signal line
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 4;
      ctx.beginPath();

      let lastY = frameBits[0].val === 1 ? highY : lowY;
      ctx.moveTo(marginX, lastY);

      frameBits.forEach((bit, idx) => {
        const xStart = marginX + idx * bitWidth;
        const xEnd = xStart + bitWidth;
        const targetY = bit.val === 1 ? highY : lowY;

        // Vertical transition
        if (targetY !== lastY) {
          ctx.lineTo(xStart, targetY);
        }
        // Horizontal plateau
        ctx.lineTo(xEnd, targetY);
        lastY = targetY;
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Midpoint Receiver Sampling Strobes (50% Center Sampling)
      for (let i = 2; i <= 9; i++) {
        const sampleX = marginX + (i + 0.5) * bitWidth;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(sampleX, 22);
        ctx.lineTo(sampleX, height - 22);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sampling arrow head
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(sampleX, lowY - 1);
        ctx.lineTo(sampleX - 3, lowY - 6);
        ctx.lineTo(sampleX + 3, lowY - 6);
        ctx.fill();
      }

      // Collect snap edges for UART bit boundaries
      const uEdges: { x: number; type: 'rising' | 'falling' }[] = [];
      for (let i = 0; i <= totalBits; i++) {
        uEdges.push({ x: marginX + i * bitWidth, type: i % 2 === 0 ? 'rising' : 'falling' });
      }
      snapEdgesRef.current = uEdges;

      // Annotation banner
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(
        `DECODED: 0x${byteVal.toString(16).toUpperCase()} ('${String.fromCharCode(byteVal)}') | BIT TIME: ${bitUs.toFixed(1)} µs | BAUD: ${uartBaudRate} bps`,
        marginX,
        height - 24
      );
    }

    // =========================================================================
    // MODE 3: SYNCHRONOUS SERIAL COMMUNICATION GRAPH (CLOCK + DATA)
    // =========================================================================
    if (commMode === 'sync-serial') {
      const marginX = 64;
      const numBits = 8;
      const bitWidth = (width - marginX - 16) / numBits;

      const clkHighY = 24;
      const clkLowY = 56;
      const dataHighY = 82;
      const dataLowY = height - 26;

      // Channel Gutter / Labels on Left
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('CLK (P3.1)', 4, (clkHighY + clkLowY) / 2 + 3);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('DATA (P3.0)', 4, (dataHighY + dataLowY) / 2 + 3);

      // Bit boundary vertical dividers
      ctx.strokeStyle = '#221f1b';
      ctx.lineWidth = 1;
      for (let i = 0; i <= numBits; i++) {
        const bx = marginX + i * bitWidth;
        ctx.beginPath();
        ctx.moveTo(bx, 14);
        ctx.lineTo(bx, height - 16);
        ctx.stroke();

        if (i < numBits) {
          ctx.fillStyle = '#78716c';
          ctx.font = '9px monospace';
          ctx.fillText(`BIT ${i}`, bx + bitWidth / 2 - 12, 12);
        }
      }

      // Draw 8 Synchronous Clock Pulses on CLOCK trace
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginX, clkLowY);

      for (let i = 0; i < numBits; i++) {
        const xStart = marginX + i * bitWidth;
        const xMid = xStart + bitWidth * 0.5;
        const xEnd = xStart + bitWidth;

        // Low -> High rising edge
        ctx.lineTo(xStart + 4, clkLowY);
        ctx.lineTo(xStart + 4, clkHighY);
        // High pulse
        ctx.lineTo(xMid, clkHighY);
        // High -> Low falling edge
        ctx.lineTo(xMid, clkLowY);
        // Low rest
        ctx.lineTo(xEnd, clkLowY);
      }
      ctx.stroke();

      // Extract Synchronous Data bits for test byte
      const byteVal = syncTestByte;
      const bits = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => (byteVal >> b) & 1);

      // Draw DATA trace
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();

      let lastDataY = bits[0] === 1 ? dataHighY : dataLowY;
      ctx.moveTo(marginX, lastDataY);

      bits.forEach((b, i) => {
        const xStart = marginX + i * bitWidth;
        const xEnd = xStart + bitWidth;
        const targetY = b === 1 ? dataHighY : dataLowY;

        ctx.lineTo(xStart, targetY);
        ctx.lineTo(xEnd, targetY);
        lastDataY = targetY;
      });
      ctx.stroke();

      // Draw Synchronous Active Clock Edge Sampling Strobes (Vertical Green Arrows)
      for (let i = 0; i < numBits; i++) {
        const strobeX = marginX + i * bitWidth + 4; // exact rising edge of clock
        const b = bits[i];

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(strobeX, clkHighY);
        ctx.lineTo(strobeX, dataLowY + 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Latching strobe dot at the data line intersection
        const latchY = b === 1 ? dataHighY : dataLowY;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(strobeX, latchY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Bit value label
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = b === 1 ? '#38bdf8' : '#78716c';
        ctx.fillText(`b${i}=${b}`, strobeX + 4, latchY - 4);
      }

      const sEdges: { x: number; type: 'rising' | 'falling' }[] = [];
      for (let i = 0; i < numBits; i++) {
        sEdges.push({ x: marginX + i * bitWidth + 4, type: 'rising' });
        sEdges.push({ x: marginX + i * bitWidth + bitWidth * 0.5, type: 'falling' });
      }
      snapEdgesRef.current = sEdges;

      // Summary label at bottom
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(
        `8051 MODE 0 SYNCHRONOUS: 0x${byteVal.toString(16).toUpperCase()} (${byteVal.toString(2).padStart(8, '0')}b) | 8 CLOCK PULSES LATCH 8 DATA BITS`,
        marginX,
        height - 6
      );
    }

    // =========================================================================
    // OVERLAY: INTERACTIVE VERTICAL CURSORS (A & B) & DELTA TIME MEASUREMENT
    // =========================================================================
    if (showCursors) {
      const gutterWidth = commMode === 'logic-traces' ? 92 : (commMode === 'sync-serial' ? 64 : 24);
      const waveAreaWidth = width - gutterWidth - (commMode === 'sync-serial' ? 16 : (commMode === 'async-uart' ? 24 : 0));
      const xA = gutterWidth + cursorAFrac * waveAreaWidth;
      const xB = gutterWidth + cursorBFrac * waveAreaWidth;
      const minX = Math.min(xA, xB);
      const maxX = Math.max(xA, xB);

      // A. Translucent shaded delta region between Cursor A and B
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(minX, 0, maxX - minX, height);

      // B. Vertical Cursor A line (Cyan #38bdf8)
      ctx.save();
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(xA, 0);
      ctx.lineTo(xA, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Cursor A Top Handle Pill & Tag
      const tagW = 68;
      const tagH = 16;
      const tagXA = Math.max(gutterWidth + 2, Math.min(width - tagW - 2, xA - tagW / 2));
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(tagXA, 2, tagW, tagH, 3);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`A:${formatTime(cursorATimeUs)}`, tagXA + tagW / 2, 13);

      // Cursor A Bottom Triangular Handle
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(xA, height - 12);
      ctx.lineTo(xA - 5, height - 2);
      ctx.lineTo(xA + 5, height - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // C. Vertical Cursor B line (Amber #f59e0b)
      ctx.save();
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(xB, 0);
      ctx.lineTo(xB, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Cursor B Top Handle Pill & Tag
      const tagXB = Math.max(gutterWidth + 2, Math.min(width - tagW - 2, xB - tagW / 2));
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.roundRect(tagXB, 2, tagW, tagH, 3);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`B:${formatTime(cursorBTimeUs)}`, tagXB + tagW / 2, 13);

      // Cursor B Bottom Triangular Handle
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(xB, height - 12);
      ctx.lineTo(xB - 5, height - 2);
      ctx.lineTo(xB + 5, height - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // D. Horizontal Delta Measurement Dimension Line with double arrows
      if (maxX - minX > 20) {
        const dimY = height - 18;
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(minX, dimY);
        ctx.lineTo(maxX, dimY);
        ctx.stroke();

        // Arrow heads
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(minX, dimY);
        ctx.lineTo(minX + 4, dimY - 3);
        ctx.lineTo(minX + 4, dimY + 3);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(maxX, dimY);
        ctx.lineTo(maxX - 4, dimY - 3);
        ctx.lineTo(maxX - 4, dimY + 3);
        ctx.closePath();
        ctx.fill();

        // Centered delta text pill
        const midX = (minX + maxX) / 2;
        const deltaText = `ΔT=${formatTime(deltaUs)} (${deltaFreqStr})`;
        ctx.font = 'bold 9px monospace';
        const txtW = ctx.measureText(deltaText).width;
        const pillW = txtW + 10;
        const pillH = 14;

        ctx.fillStyle = '#141210';
        ctx.beginPath();
        ctx.roundRect(midX - pillW / 2, dimY - pillH / 2, pillW, pillH, 3);
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.textAlign = 'center';
        ctx.fillText(deltaText, midX, dimY + 3.5);
        ctx.restore();
      }
    }
  }, [
    enabledTrackers,
    primaryMetrics,
    cpuCycles,
    clockHz,
    timeDivUs,
    commMode,
    uartBaudRate,
    asyncTestByte,
    syncTestByte,
    showCursors,
    cursorAFrac,
    cursorBFrac,
  ]);

  // Code Presets for Testing
  const sample1KhzCode = `; 1.000 kHz Square Wave Generator (P1.0)
; Oscillator: 12.000 MHz (1 machine cycle = 1 us)
; Period: 1000 us (500 us HIGH, 500 us LOW) -> Frequency: 1.000 kHz
ORG 0000H

START:
LOOP:
    CPL P1.0          ; Toggle output pin P1.0 (1 cycle)
    ACALL DELAY_500US ; Wait 500 us (2 cycles for ACALL)
    SJMP LOOP         ; Repeat (2 cycles)

DELAY_500US:
    MOV R7,#247       ; 1 cycle
D1:
    DJNZ R7,D1        ; 247 * 2 = 494 cycles
    NOP               ; 1 cycle
    RET               ; 2 cycles
                      ; Total: ~500 cycles = 500 us

END
`;

  const sample4BitCounterCode = `; 4-Bit Binary Counter on P1.0 - P1.3
; Demonstrates simultaneous multi-channel logic analyzer viewing:
; - P1.0 toggles every step (Frequency = f)
; - P1.1 toggles every 2 steps (Frequency = f / 2)
; - P1.2 toggles every 4 steps (Frequency = f / 4)
; - P1.3 toggles every 8 steps (Frequency = f / 8)
ORG 0000H

START:
    MOV P1, #00H      ; Clear Port 1
COUNT_LOOP:
    ACALL DELAY_100US ; Delay between count increments
    INC P1            ; Increment Port 1 (advances P1.0..P1.3 counter)
    SJMP COUNT_LOOP

DELAY_100US:
    MOV R7, #48
D_WAIT:
    DJNZ R7, D_WAIT
    RET

END
`;

  const sampleUartAsyncCode = `; ============================================
; Asynchronous UART Transmitter (9600 Baud, P3.1)
; Demonstrates asynchronous serial byte framing:
; 1 Start bit (0) + 8 Data bits (LSB first) + 1 Stop bit (1)
; No clock line is transmitted!
; ============================================
ORG 0000H

START:
    MOV TMOD, #20H    ; Timer 1 Mode 2 (8-bit auto-reload)
    MOV TH1, #0FDH    ; Reload for 9600 baud (-3)
    MOV TL1, #0FDH
    SETB TR1          ; Start Timer 1
    MOV SCON, #50H    ; Mode 1, 8-bit UART, REN=1

TX_LOOP:
    MOV SBUF, #'A'    ; Transmit ASCII 'A' (0x41) on P3.1
WAIT_TX:
    JNB TI, WAIT_TX   ; Wait for transmission to complete
    CLR TI

    ACALL DELAY_1MS
    SJMP TX_LOOP

DELAY_1MS:
    MOV R7, #240
D1:
    DJNZ R7, D1
    RET

END
`;

  const sampleSyncMode0Code = `; ============================================
; Synchronous Shift Register Mode (8051 Mode 0)
; - Synchronous Clock: Pin P3.1 (TXD) - 8 clock pulses
; - Synchronous Data:  Pin P3.0 (RXD) - 8 data bits
; Shared clock synchronizes transmitter and receiver!
; ============================================
ORG 0000H

START:
    MOV SCON, #00H    ; Mode 0 (8-bit shift register)

SYNC_LOOP:
    MOV SBUF, #55H    ; Transmit 01010101b synchronously
WAIT_S0:
    JNB TI, WAIT_S0
    CLR TI

    ACALL DELAY_1MS
    SJMP SYNC_LOOP

DELAY_1MS:
    MOV R7, #240
D_WAIT:
    DJNZ R7, D_WAIT
    RET

END
`;

  const calculatedCanvasHeight =
    commMode === 'logic-traces'
      ? Math.max(90, Math.min(220, enabledTrackers.length * 36))
      : 130;

  if (compact && !isExpanded) {
    return (
      <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-2 shadow-sm font-mono text-xs select-none flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`w-2.5 h-2.5 rounded-full border border-white ${
              primaryMetrics.isOscillating
                ? 'bg-[#f59e0b] animate-pulse shadow-[0_0_8px_#f59e0b]'
                : primaryMetrics.currentLevel === 1
                ? 'bg-[#22c55e]'
                : 'bg-[#524d43]'
            }`}
          />
          <span className="font-black text-[#fbbf24] text-[11px] uppercase">
            ⌖ PROBE P{selectedPort}.{selectedPin}:
          </span>
          <span className="text-[#ffffff] font-black text-xs tabular-nums">
            {formatFrequency(primaryMetrics.frequencyHz, primaryMetrics.isOscillating)}
          </span>
          <span className="text-[#38bdf8] font-bold text-[11px] tabular-nums">
            ({primaryMetrics.isOscillating ? `${primaryMetrics.dutyCyclePercent.toFixed(1)}%` : primaryMetrics.currentLevel === 1 ? '100%' : '0%'} Duty)
          </span>

          {/* Multi-channel active chips */}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[10px] text-[#78716c]">CHANNELS ({enabledTrackers.length}):</span>
            {enabledTrackers.map((t) => (
              <span
                key={t.key}
                style={{ color: t.color, borderColor: t.color }}
                className="text-[9px] font-black px-1 py-0.2 rounded-xs border bg-[#141210]"
              >
                {t.key}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportCsv}
            className="px-2 py-0.5 text-[9px] font-black bg-[#141210] text-[#22c55e] hover:bg-[#22c55e] hover:text-black border border-[#22c55e] rounded-xs cursor-pointer transition-colors"
            title="Export captured signal history as CSV file"
          >
            💾 CSV
          </button>
          <button
            onClick={() => handleApplyPreset('nibble')}
            className="px-1.5 py-0.5 text-[9px] font-black bg-[#141210] text-[#38bdf8] hover:bg-[#38bdf8] hover:text-black border border-[#38bdf8] rounded-xs cursor-pointer transition-colors"
            title="Toggle P1.0 through P1.3 simultaneously"
          >
            4-CH (P1.0-P1.3)
          </button>
          <button
            onClick={() => {
              setSignalViewMode('comm-graph');
              setIsExpanded(true);
            }}
            className="px-2 py-0.5 text-[10px] font-black bg-[#141210] text-[#38bdf8] hover:bg-[#38bdf8] hover:text-black border border-[#38bdf8] rounded-xs cursor-pointer transition-colors"
            title="Open Communication Graph with State Machine Transition Diagrams"
          >
            🔀 COMM GRAPH
          </button>
          <button
            onClick={() => {
              setSignalViewMode('timeline');
              setIsExpanded(true);
            }}
            className="px-2 py-0.5 text-[10px] font-black bg-[#141210] text-[#fbbf24] hover:bg-[#f59e0b] hover:text-black border border-[#524d43] hover:border-[#fbbf24] rounded-xs cursor-pointer transition-colors"
          >
            📈 OPEN SCOPE & TRACE ▼
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1c1917] border border-[#524d43] rounded-sm p-2 shadow-sm font-mono text-xs select-none flex flex-col gap-2">
      {/* 1. Header & Probed Pin Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full border border-white ${
            primaryMetrics.isOscillating
              ? 'bg-[#f59e0b] animate-pulse shadow-[0_0_8px_#f59e0b]'
              : primaryMetrics.currentLevel === 1
              ? 'bg-[#22c55e]'
              : 'bg-[#524d43]'
          }`} />
          <span className="font-black text-[#fbbf24] text-xs uppercase tracking-wide">
            FREQUENCY & PROTOCOL TIMING ANALYZER
          </span>
          <span className="text-[10px] text-[#ffffff] font-bold bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#44403c]">
            FOCUS: <strong className="text-[#fbbf24]">P{selectedPort}.{selectedPin}</strong>
          </span>
          <span className="text-[10px] text-[#a8a29e] bg-[#141210] px-1.5 py-0.5 rounded-xs border border-[#38332c]">
            ACTIVE: <strong className="text-[#38bdf8]">{enabledTrackers.length} CH</strong>
          </span>
        </div>

        {/* Action buttons: EXPORT CSV, HOLD, RESET, MINIMIZE */}
        <div className="flex items-center gap-1.5">
          {/* CSV Export Button */}
          <button
            onClick={handleExportCsv}
            className="px-2 py-0.5 text-[10px] font-black uppercase rounded-xs bg-[#141210] text-[#22c55e] border border-[#22c55e] hover:bg-[#22c55e] hover:text-black cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
            title="Export all captured signal transitions and metrics as a CSV file for Excel / Python analysis"
          >
            <span>💾 EXPORT CSV</span>
            {csvDownloadCount > 0 && <span className="text-[9px]">({csvDownloadCount})</span>}
          </button>

          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="px-2 py-0.5 text-[10px] font-bold bg-[#141210] text-[#a8a29e] hover:text-white border border-[#44403c] rounded-xs cursor-pointer mr-1"
            >
              ▲ COLLAPSE
            </button>
          )}

          <button
            onClick={handleToggleHold}
            className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-xs cursor-pointer border transition-colors ${
              isHold
                ? 'bg-[#dc2626] text-white border-[#f87171]'
                : 'bg-[#141210] text-[#ffffff] border-[#524d43] hover:border-[#fbbf24]'
            }`}
            title="Freeze display measurements without stopping CPU"
          >
            {isHold ? '▶ UNFREEZE' : '⏸ FREEZE / HOLD'}
          </button>

          <button
            onClick={handleReset}
            className="px-2 py-0.5 text-[10px] font-black uppercase rounded-xs bg-[#141210] text-[#a8a29e] hover:text-white border border-[#524d43] hover:border-[#fbbf24] cursor-pointer"
            title="Reset edge counters and timing statistics"
          >
            ↺ RESET
          </button>
        </div>
      </div>

      {/* 2. Multi-Pin Channel Selector & Toggles (EdSim51 High-Contrast Simple UI) */}
      <div className="bg-[#141210] border border-[#38332c] p-2 rounded-xs flex flex-col gap-2">
        {/* Quick Multi-Pin Presets Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-[#2d2924]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#fbbf24] font-black uppercase">
              ⚡ MULTI-PIN PRESETS:
            </span>
            <button
              onClick={() => handleApplyPreset('nibble')}
              className="px-2 py-0.5 text-[10px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#38bdf8] hover:bg-[#38bdf8] hover:text-black rounded-xs cursor-pointer transition-colors shadow-xs"
              title="Display P1.0, P1.1, P1.2, and P1.3 simultaneously in signal view"
            >
              ★ P1.0 - P1.3 (4-CH NIBBLE)
            </button>
            <button
              onClick={() => handleApplyPreset('byte')}
              className="px-2 py-0.5 text-[10px] font-black bg-[#1c1917] text-[#4ade80] border border-[#4ade80] hover:bg-[#4ade80] hover:text-black rounded-xs cursor-pointer transition-colors"
              title="Display all 8 pins P1.0 through P1.7 simultaneously"
            >
              ALL P1 (8-CH BYTE)
            </button>
            <button
              onClick={() => handleApplyPreset('single')}
              className="px-2 py-0.5 text-[10px] font-black bg-[#1c1917] text-[#fbbf24] border border-[#fbbf24] hover:bg-[#fbbf24] hover:text-black rounded-xs cursor-pointer transition-colors"
              title="Probe single pin P1.0 only"
            >
              P1.0 ONLY
            </button>
          </div>

          {/* Active channels chips with 1-click focus or remove */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] text-[#78716c]">ACTIVE TRACES:</span>
            {enabledTrackers.map((t) => {
              const isPrimary = t.port === selectedPort && t.pin === selectedPin;
              return (
                <div
                  key={t.key}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-xs border text-[9px] font-black cursor-pointer transition-colors ${
                    isPrimary
                      ? 'bg-[#1c1917] text-white border-white shadow-[0_0_6px_rgba(255,255,255,0.2)]'
                      : 'bg-[#141210] text-[#a8a29e] border-[#44403c] hover:border-[#fbbf24]'
                  }`}
                  style={{ borderLeftColor: t.color, borderLeftWidth: '3px' }}
                  onClick={() => handleSelectPrimaryPin(t.port, t.pin, t.label)}
                  title={`Click to focus ${t.key} in detailed metrics`}
                >
                  <span style={{ color: t.color }}>{t.key}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(t.port, t.pin);
                    }}
                    className="text-[#78716c] hover:text-[#f87171] ml-0.5 text-[10px] font-black cursor-pointer"
                    title={`Remove ${t.key} from signal view`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Port Tabs + 8 Pin Toggle Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          {/* Port Selector Tabs */}
          <div className="flex items-center gap-1">
            {[
              { port: 1, label: 'PORT 1 [LEDs]' },
              { port: 3, label: 'PORT 3 [I/O]' },
              { port: 2, label: 'PORT 2 [Disp]' },
              { port: 0, label: 'PORT 0 [Bus]' },
            ].map((pt) => (
              <button
                key={pt.port}
                onClick={() => setSelectedPort(pt.port)}
                className={`px-1.5 py-0.5 text-[10px] font-black rounded-xs border cursor-pointer ${
                  selectedPort === pt.port
                    ? 'bg-[#f59e0b] text-black border-[#fbbf24]'
                    : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* 8 Pin Toggle Buttons for Selected Port */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] text-[#78716c] mr-1">TOGGLE PINS:</span>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((pin) => {
              const isEnabled = analyzer.isPinEnabled(selectedPort, pin);
              const isPrimary = selectedPort === analyzer.probeTarget.port && pin === analyzer.probeTarget.pin;
              const channelColor = CHANNEL_COLORS[pin % CHANNEL_COLORS.length];

              return (
                <button
                  key={pin}
                  onClick={() => handleTogglePin(selectedPort, pin)}
                  className={`h-6 px-1.5 flex items-center gap-1 text-[10px] font-black rounded-xs border cursor-pointer transition-colors ${
                    isEnabled
                      ? 'bg-[#1c1917] text-white border-2'
                      : 'bg-[#141210] text-[#78716c] border-[#38332c] hover:border-[#78716c] hover:text-white'
                  }`}
                  style={{
                    borderColor: isEnabled ? channelColor : undefined,
                    boxShadow: isPrimary ? `0 0 6px ${channelColor}` : undefined,
                  }}
                  title={`Toggle P${selectedPort}.${pin} on/off in signal view`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isEnabled ? channelColor : '#524d43' }}
                  />
                  <span>.{pin}</span>
                  {isEnabled && <span className="text-[9px] text-[#22c55e]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Primary Metrics Dashboard for Focused Channel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {/* Measured Frequency */}
        <div className="bg-[#141210] border border-[#f59e0b] p-2 rounded-xs flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#fbbf24] font-black uppercase tracking-wider">
              FREQUENCY (f):
            </span>
            <span className="text-[9px] text-[#ffffff] bg-[#1c1917] px-1 py-0.2 rounded-xs border border-[#44403c]">
              P{selectedPort}.{selectedPin}
            </span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#ffffff] tabular-nums tracking-tight py-1">
            {formatFrequency(primaryMetrics.frequencyHz, primaryMetrics.isOscillating)}
          </div>
          <span className="text-[9px] text-[#a8a29e]">
            {primaryMetrics.isOscillating
              ? `Target 8051 @ ${(clockHz / 1_000_000).toFixed(clockHz === 11059200 ? 4 : 0)} MHz`
              : 'Static DC level'}
          </span>
        </div>

        {/* Duty Cycle (%) */}
        <div className="bg-[#141210] border border-[#f59e0b] p-2 rounded-xs flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#fbbf24] font-black uppercase tracking-wider">
              DUTY CYCLE (%):
            </span>
            <span className="text-[9px] text-[#a8a29e]">
              Level: <strong className={primaryMetrics.currentLevel === 1 ? 'text-[#22c55e]' : 'text-[#78716c]'}>
                {primaryMetrics.currentLevel === 1 ? '1 (+5V)' : '0 (0V)'}
              </strong>
            </span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#ffffff] tabular-nums tracking-tight py-1">
            {primaryMetrics.isOscillating
              ? `${primaryMetrics.dutyCyclePercent.toFixed(1)}%`
              : primaryMetrics.currentLevel === 1
              ? '100.0% [HIGH]'
              : '0.0% [LOW]'}
          </div>
          {/* Duty Cycle Visual Bar */}
          <div className="w-full h-2 bg-[#2d2924] rounded-xs overflow-hidden border border-[#524d43] mt-1 relative">
            <div
              className="h-full bg-[#f59e0b] transition-all duration-100"
              style={{
                width: `${primaryMetrics.isOscillating ? primaryMetrics.dutyCyclePercent : primaryMetrics.currentLevel === 1 ? 100 : 0}%`,
              }}
            />
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white opacity-40 pointer-events-none" />
          </div>
        </div>

        {/* Period (T) */}
        <div className="bg-[#141210] border border-[#44403c] p-2 rounded-xs flex flex-col justify-between">
          <span className="text-[10px] text-[#a8a29e] font-bold uppercase tracking-wider">
            PERIOD (T):
          </span>
          <div className="text-lg md:text-xl font-black text-[#38bdf8] tabular-nums tracking-tight py-1">
            {primaryMetrics.isOscillating ? formatTime(primaryMetrics.periodUs) : '—'}
          </div>
          <span className="text-[9px] text-[#a8a29e]">
            {primaryMetrics.isOscillating
              ? `${primaryMetrics.periodCycles.toLocaleString()} machine cycles`
              : 'Infinite (DC level)'}
          </span>
        </div>

        {/* Pulse Widths (High / Low) */}
        <div className="bg-[#141210] border border-[#44403c] p-2 rounded-xs flex flex-col justify-between">
          <span className="text-[10px] text-[#a8a29e] font-bold uppercase tracking-wider">
            PULSE WIDTHS:
          </span>
          <div className="text-[11px] font-black text-[#ffffff] space-y-0.5 py-1">
            <div className="flex justify-between items-center">
              <span className="text-[#fbbf24]">T_HIGH:</span>
              <span className="text-[#38bdf8] tabular-nums">{formatTime(primaryMetrics.highTimeUs)}</span>
              <span className="text-[9px] text-[#78716c]">({primaryMetrics.highCycles} cyc)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#a8a29e]">T_LOW:</span>
              <span className="text-[#38bdf8] tabular-nums">{formatTime(primaryMetrics.lowTimeUs)}</span>
              <span className="text-[9px] text-[#78716c]">({primaryMetrics.lowCycles} cyc)</span>
            </div>
          </div>
          <span className="text-[9px] text-[#22c55e]">
            State: <strong>{primaryMetrics.statusText}</strong>
          </span>
        </div>
      </div>

      {/* 4. SIGNAL VIEW SELECTOR: Timeline/Time-domain vs Communication Graph Mode */}
      <div className="flex flex-col gap-1.5">
        {/* Primary Toggle Button Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-[#141210] border border-[#44403c] rounded-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#fbbf24] font-black uppercase tracking-wider">
              SIGNAL VIEW:
            </span>
            {/* Segmented Toggle Button */}
            <div className="inline-flex rounded-xs p-0.5 bg-[#1c1917] border border-[#524d43]">
              <button
                onClick={() => setSignalViewMode('timeline')}
                className={`px-3 py-1 text-[11px] font-black rounded-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                  signalViewMode === 'timeline'
                    ? 'bg-[#fbbf24] text-black shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
                title="Switch to Timeline / Time-domain multi-pin waveform view"
              >
                <span>⏱</span>
                <span>TIMELINE / TIME-DOMAIN</span>
              </button>
              <button
                onClick={() => setSignalViewMode('comm-graph')}
                className={`px-3 py-1 text-[11px] font-black rounded-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                  signalViewMode === 'comm-graph'
                    ? 'bg-[#38bdf8] text-black shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
                title="Switch to Communication Graph mode with State Machine Transition Diagrams"
              >
                <span>🔀</span>
                <span>COMMUNICATION GRAPH</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] text-[#78716c]">
            {signalViewMode === 'timeline' ? (
              <span>Digital logic transition waveform traces across machine cycles</span>
            ) : (
              <span className="text-[#38bdf8] font-bold">State Machine Transition Diagram for synchronous & asynchronous signals</span>
            )}
          </div>
        </div>

        {/* View Mode 1: Communication Graph (State Machine Transition Diagrams) */}
        {signalViewMode === 'comm-graph' ? (
          <CommunicationGraph
            analyzer={analyzer}
            cpuCycles={cpuCycles}
            clockHz={clockHz}
            selectedPort={selectedPort}
            selectedPin={selectedPin}
            onSelectPin={onSelectPin}
            onLoadCodePreset={onLoadCodePreset}
          />
        ) : (
          /* View Mode 2: Timeline / Time-Domain Digital Traces Canvas */
          <div className="bg-[#141210] border border-[#44403c] rounded-xs p-1.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] flex-wrap gap-1 pb-1 border-b border-[#2d2924]">
              {/* Waveform Sub-Modes */}
              <div className="flex items-center gap-1">
                <span className="text-[#78716c] font-bold">TRACE VIEW:</span>
                <button
                  onClick={() => setCommMode('logic-traces')}
                  className={`px-2 py-0.5 text-[10px] font-black rounded-xs border cursor-pointer transition-colors ${
                    commMode === 'logic-traces'
                      ? 'bg-[#fbbf24] text-black border-[#fbbf24]'
                      : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
                  }`}
                >
                  📊 MULTI-PIN LOGIC TRACES
                </button>
                <button
                  onClick={() => setCommMode('async-uart')}
                  className={`px-2 py-0.5 text-[10px] font-black rounded-xs border cursor-pointer transition-colors ${
                    commMode === 'async-uart'
                      ? 'bg-[#f59e0b] text-black border-[#f59e0b]'
                      : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
                  }`}
                  title="Display Asynchronous UART frame (Start Bit + 8 Data Bits + Stop Bit)"
                >
                  📡 ASYNC UART FRAME
                </button>
                <button
                  onClick={() => setCommMode('sync-serial')}
                  className={`px-2 py-0.5 text-[10px] font-black rounded-xs border cursor-pointer transition-colors ${
                    commMode === 'sync-serial'
                      ? 'bg-[#38bdf8] text-black border-[#38bdf8]'
                      : 'bg-[#1c1917] text-[#a8a29e] border-[#38332c] hover:text-white'
                  }`}
                  title="Display Synchronous Clock & Data timing graph with edge sampling"
                >
                  🔄 SYNC SERIAL TIMING
                </button>
              </div>

              {/* Mode-Specific Parameter Controls */}
              {commMode === 'logic-traces' && (
                <div className="flex items-center gap-1">
                  <span className="text-[#78716c]">TIMEBASE:</span>
                  {[
                    { id: 0, label: 'AUTO' },
                    { id: 10, label: '10 µs' },
                    { id: 100, label: '100 µs' },
                    { id: 1000, label: '1 ms' },
                    { id: 10000, label: '10 ms' },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      onClick={() => setTimeDivUs(tb.id)}
                      className={`px-1.5 py-0.5 text-[9px] font-black rounded-xs border cursor-pointer ${
                        timeDivUs === tb.id
                          ? 'bg-[#fbbf24] text-black border-[#fbbf24]'
                          : 'bg-[#1c1917] text-[#ffffff] border-[#44403c] hover:border-[#fbbf24]'
                      }`}
                    >
                      {tb.label}
                    </button>
                  ))}
                </div>
              )}

              {commMode === 'async-uart' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#78716c]">BAUD:</span>
                  {[9600, 4800, 2400].map((b) => (
                    <button
                      key={b}
                      onClick={() => setUartBaudRate(b)}
                      className={`px-1.5 py-0.5 text-[9px] font-black rounded-xs border cursor-pointer ${
                        uartBaudRate === b
                          ? 'bg-[#f59e0b] text-black border-[#f59e0b]'
                          : 'bg-[#1c1917] text-[#ffffff] border-[#38332c]'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                  <span className="text-[#78716c] ml-1">BYTE:</span>
                  <button
                    onClick={() => setAsyncTestByte(asyncTestByte === 0x41 ? 0x55 : 0x41)}
                    className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#38bdf8] rounded-xs cursor-pointer"
                  >
                    0x{asyncTestByte.toString(16).toUpperCase()} ('{String.fromCharCode(asyncTestByte)}')
                  </button>
                </div>
              )}

              {commMode === 'sync-serial' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#78716c]">TEST BYTE:</span>
                  {[0x55, 0xaa, 0xc3].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSyncTestByte(val)}
                      className={`px-1.5 py-0.5 text-[9px] font-black rounded-xs border cursor-pointer ${
                        syncTestByte === val
                          ? 'bg-[#38bdf8] text-black border-[#38bdf8]'
                          : 'bg-[#1c1917] text-[#ffffff] border-[#38332c]'
                      }`}
                    >
                      0x{val.toString(16).toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Vertical Cursors Measurement Dashboard */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-[#0e0d0c] border border-[#38332c] rounded-xs text-[10px]">
              {/* Left: Cursor A & B Readouts + Nudge Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setShowCursors(!showCursors)}
                  className={`px-2 py-0.5 text-[10px] font-black rounded-xs border cursor-pointer transition-colors flex items-center gap-1 ${
                    showCursors
                      ? 'bg-[#1c1917] text-[#22c55e] border-[#22c55e]'
                      : 'bg-[#141210] text-[#78716c] border-[#38332c] hover:text-white'
                  }`}
                  title="Toggle interactive vertical time measurement cursors"
                >
                  <span>📏</span>
                  <span>CURSORS: {showCursors ? 'ON' : 'OFF'}</span>
                </button>

                {showCursors && (
                  <>
                    {/* Cursor A Control & Readout (Cyan) */}
                    <div className="flex items-center bg-[#141210] border border-[#38bdf8] rounded-xs px-1.5 py-0.5 gap-1 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                      <span className="text-[#38bdf8] font-black">CUR A:</span>
                      <span className="text-white font-black tabular-nums">{formatTime(cursorATimeUs)}</span>
                      <button
                        onClick={() => handleNudgeCursorA(-0.01)}
                        className="text-[#78716c] hover:text-[#38bdf8] px-0.5 font-black cursor-pointer"
                        title="Nudge Cursor A left (-1%)"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => handleNudgeCursorA(0.01)}
                        className="text-[#78716c] hover:text-[#38bdf8] px-0.5 font-black cursor-pointer"
                        title="Nudge Cursor A right (+1%)"
                      >
                        ▶
                      </button>
                    </div>

                    {/* Cursor B Control & Readout (Amber) */}
                    <div className="flex items-center bg-[#141210] border border-[#f59e0b] rounded-xs px-1.5 py-0.5 gap-1 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      <span className="text-[#f59e0b] font-black">CUR B:</span>
                      <span className="text-white font-black tabular-nums">{formatTime(cursorBTimeUs)}</span>
                      <button
                        onClick={() => handleNudgeCursorB(-0.01)}
                        className="text-[#78716c] hover:text-[#f59e0b] px-0.5 font-black cursor-pointer"
                        title="Nudge Cursor B left (-1%)"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => handleNudgeCursorB(0.01)}
                        className="text-[#78716c] hover:text-[#f59e0b] px-0.5 font-black cursor-pointer"
                        title="Nudge Cursor B right (+1%)"
                      >
                        ▶
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Delta Time, Cycles, Frequency, and Snap Buttons */}
              {showCursors && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Delta Time Badge */}
                  <div className="flex items-center bg-[#141210] border border-[#22c55e] px-2 py-0.5 rounded-xs gap-1.5 shadow-xs">
                    <span className="text-[#22c55e] font-black">ΔT (DELTA):</span>
                    <span className="text-[#ffffff] font-black text-[11px] tabular-nums tracking-wide">
                      {formatTime(deltaUs)}
                    </span>
                    <span className="text-[#78716c] text-[9px]">
                      ({Math.round(deltaCycles)} cyc)
                    </span>
                  </div>

                  {/* Equivalent Frequency Badge */}
                  <div className="flex items-center bg-[#141210] border border-[#c084fc] px-2 py-0.5 rounded-xs gap-1 shadow-xs">
                    <span className="text-[#c084fc] font-black">1/ΔT:</span>
                    <span className="text-[#ffffff] font-black tabular-nums">
                      {deltaFreqStr}
                    </span>
                  </div>

                  {/* Transition Snapping Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSnapPeriod}
                      className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#38bdf8] hover:bg-[#38bdf8] hover:text-black rounded-xs cursor-pointer transition-colors"
                      title="Snap Cursor A and B across 1 complete signal period"
                    >
                      ⇥ 1 PERIOD
                    </button>
                    <button
                      onClick={handleSnapPulse}
                      className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#4ade80] border border-[#4ade80] hover:bg-[#4ade80] hover:text-black rounded-xs cursor-pointer transition-colors"
                      title="Snap Cursor A and B to measure high pulse width"
                    >
                      ⇥ PULSE
                    </button>
                    <button
                      onClick={handleResetCursors}
                      className="px-1 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#a8a29e] border border-[#38332c] hover:text-white rounded-xs cursor-pointer transition-colors"
                      title="Reset cursors to 20% and 70%"
                    >
                      ↺
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Container with Interactive Drag Handlers */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={640}
                height={calculatedCanvasHeight}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onTouchStart={handleCanvasMouseDown}
                onTouchMove={handleCanvasMouseMove}
                onTouchEnd={handleCanvasMouseUp}
                className="w-full bg-[#0a0908] rounded-xs border border-[#2d2924] select-none block"
                style={{ height: `${calculatedCanvasHeight}px`, cursor: canvasCursorStyle }}
              />
              {showCursors && (
                <div className="absolute top-1 right-2 text-[8px] text-[#78716c] pointer-events-none font-mono opacity-80">
                  [DRAG CURSOR A (CYAN) OR B (AMBER) TO MEASURE ΔT]
                </div>
              )}
            </div>

            {/* Educational Architecture & Comparison Panel for Synchronous vs Asynchronous */}
            {commMode === 'async-uart' && (
              <div className="bg-[#141210] border border-[#38332c] p-2 rounded-xs flex flex-col gap-1 text-[11px] font-mono text-[#a8a29e]">
                <div className="flex justify-between items-center text-[#fbbf24] font-black text-[10px]">
                  <span>📡 HOW ASYNCHRONOUS UART RECEPTION WORKS (NO CLOCK WIRE):</span>
                  <span className="text-[#38bdf8]">10 BITS / FRAME (20% OVERHEAD)</span>
                </div>
                <p className="text-[10px] leading-relaxed">
                  In <strong>asynchronous serial communication</strong>, the transmitter and receiver do <span className="text-[#f87171] font-bold">NOT share a clock wire</span>.
                  The line idles at logic 1 (+5V). When transmission begins, a <strong className="text-[#ef4444]">Start Bit (0)</strong> triggers the receiver's internal baud rate counter.
                  The receiver waits <span className="text-[#22c55e] font-bold">1.5 bit periods</span> to take its first sample right in the stable center of bit <strong>D0</strong>, and then samples every <span className="text-[#22c55e] font-bold">1.0 bit period</span> for D1 through D7, finally checking the <strong className="text-[#c084fc]">Stop Bit (1)</strong>.
                </p>
              </div>
            )}

            {commMode === 'sync-serial' && (
              <div className="bg-[#141210] border border-[#38332c] p-2 rounded-xs flex flex-col gap-1 text-[11px] font-mono text-[#a8a29e]">
                <div className="flex justify-between items-center text-[#38bdf8] font-black text-[10px]">
                  <span>🔄 HOW SYNCHRONOUS SERIAL WORKS (SHARED CLOCK WIRE):</span>
                  <span className="text-[#22c55e]">0% FRAMING OVERHEAD</span>
                </div>
                <p className="text-[10px] leading-relaxed">
                  In <strong>synchronous serial communication</strong> (such as 8051 Serial Mode 0 or SPI), both devices share a dedicated <strong className="text-[#fbbf24]">Clock Line (CLK)</strong>.
                  Data is latched strictly on the <span className="text-[#22c55e] font-bold">clock edge</span> (shown by the vertical green strobe lines). Because the clock dictates exact timing,
                  no start/stop framing bits or baud rate generators are required, and the transmission will never drift out of phase even at megahertz clock speeds.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Edge Counters & Quick Code Presets Row */}
      <div className="bg-[#141210] border border-[#38332c] px-2 py-1.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[#a8a29e]">PRIMARY EDGES:</span>
            <span className="text-[#ffffff] font-black tabular-nums">{primaryMetrics.totalEdges.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#22c55e]">↑ RISING:</span>
            <span className="text-[#ffffff] font-black tabular-nums">{primaryMetrics.risingEdges.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#f87171]">↓ FALLING:</span>
            <span className="text-[#ffffff] font-black tabular-nums">{primaryMetrics.fallingEdges.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#a8a29e]">CPU CYCLES:</span>
            <span className="text-[#fbbf24] font-black tabular-nums">{cpuCycles.toLocaleString()}</span>
          </div>
        </div>

        {/* 1-Click Code Presets for Quick Testing */}
        {onLoadCodePreset && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[#78716c] text-[9px]">LOAD CODE:</span>
            <button
              onClick={() => {
                setCommMode('async-uart');
                onLoadCodePreset(sampleUartAsyncCode, 'Async UART TX (9600 Baud, P3.1)');
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#f59e0b] border border-[#f59e0b] hover:bg-[#f59e0b] hover:text-black rounded-xs cursor-pointer"
              title="Loads Asynchronous UART TX program transmitting 'A' on P3.1"
            >
              📡 Async UART (9600)
            </button>
            <button
              onClick={() => {
                setCommMode('sync-serial');
                onLoadCodePreset(sampleSyncMode0Code, 'Sync Mode 0 Shift Register (P3.1/P3.0)');
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#38bdf8] border border-[#38bdf8] hover:bg-[#38bdf8] hover:text-black rounded-xs cursor-pointer"
              title="Loads Synchronous Mode 0 program generating 8 clock pulses on P3.1 with data on P3.0"
            >
              🔄 Sync Mode 0
            </button>
            <button
              onClick={() => {
                handleApplyPreset('nibble');
                onLoadCodePreset(sample4BitCounterCode, '4-Bit Counter (P1.0-P1.3)');
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#4ade80] border border-[#4ade80] hover:bg-[#4ade80] hover:text-black rounded-xs cursor-pointer"
              title="Loads 4-bit binary counter test code and enables P1.0 through P1.3"
            >
              4-Bit Counter
            </button>
            <button
              onClick={() => {
                handleApplyPreset('single');
                onLoadCodePreset(sample1KhzCode, '1 kHz Square Wave (P1.0)');
              }}
              className="px-1.5 py-0.5 text-[9px] font-black bg-[#1c1917] text-[#fbbf24] border border-[#f59e0b] hover:bg-[#f59e0b] hover:text-black rounded-xs cursor-pointer"
            >
              1 kHz Wave
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
