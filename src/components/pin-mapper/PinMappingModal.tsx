/**
 * Micro8051SiM Pin Mapping Configuration Interface (High Contrast & Clean Borders)
 */

import React, { useState } from 'react';
import { PinMapping } from '../../core/types.ts';
import { DEFAULT_PIN_MAPPING, detectPinConflicts } from '../../peripherals/pin-manager.ts';
import { InstrumentButton } from '../common/InstrumentButton.tsx';

interface PinMappingModalProps {
  currentMapping: PinMapping;
  isOpen: boolean;
  onClose: () => void;
  onSaveMapping: (mapping: PinMapping) => void;
}

export const PinMappingModal: React.FC<PinMappingModalProps> = ({
  currentMapping,
  isOpen,
  onClose,
  onSaveMapping,
}) => {
  const [draft, setDraft] = useState<PinMapping>(JSON.parse(JSON.stringify(currentMapping)));

  if (!isOpen) return null;

  const conflicts = detectPinConflicts(draft);

  const handlePortChange = (
    updater: (prev: PinMapping, val: number) => PinMapping,
    val: number
  ) => {
    setDraft((prev) => updater(prev, val));
  };

  const handleReset = () => {
    setDraft(JSON.parse(JSON.stringify(DEFAULT_PIN_MAPPING)));
  };

  const handleApply = () => {
    onSaveMapping(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs select-none">
      <div className="bg-[#1c1917] border-2 border-[#524d43] rounded-sm w-full max-w-3xl max-h-[90vh] flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#141210] border-b border-[#44403c]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-[#fbbf24]">
              Hardware Pin Mapping Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#a8a29e] hover:text-[#ffffff] text-sm font-black px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Conflicts Warning Banner */}
        {conflicts.length > 0 && (
          <div className="bg-[#381414] border-b border-[#7f1d1d] px-4 py-2.5 text-[#fca5a5] flex flex-col gap-1 text-[11px]">
            <div className="font-black flex items-center gap-1.5 text-[#ef4444]">
              <span>⚠</span> Pin Conflicts Detected ({conflicts.length}):
            </div>
            <div className="max-h-20 overflow-y-auto font-medium">
              {conflicts.map((c, i) => (
                <div key={i} className="text-[11px]">
                  • Pin <strong className="text-[#ffffff]">{c.pinName}</strong> is assigned to: {c.functions.join(', ')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* LED Array Mapping */}
          <div className="bg-[#141210] border border-[#38332c] p-3 rounded-sm">
            <div className="text-xs font-black text-[#fbbf24] mb-2 uppercase">
              1. 8-Channel Output LEDs
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="text-[#e7e5e4]">Port for LEDs (0-7):</span>
              <select
                value={draft.leds[0]?.port ?? 1}
                onChange={(e) => {
                  const portNum = parseInt(e.target.value, 10);
                  setDraft((prev) => ({
                    ...prev,
                    leds: prev.leds.map((l) => ({ ...l, port: portNum })),
                  }));
                }}
                className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-2.5 py-1 rounded-sm font-bold"
              >
                <option value={0}>Port 0 (P0.0 - P0.7)</option>
                <option value={1}>Port 1 (P1.0 - P1.7)</option>
                <option value={2}>Port 2 (P2.0 - P2.7)</option>
                <option value={3}>Port 3 (P3.0 - P3.7)</option>
              </select>
            </div>
          </div>

          {/* DIP Switches Mapping */}
          <div className="bg-[#141210] border border-[#38332c] p-3 rounded-sm">
            <div className="text-xs font-black text-[#fbbf24] mb-2 uppercase">
              2. 8-Channel Input DIP Switches
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="text-[#e7e5e4]">Port for Switches (0-7):</span>
              <select
                value={draft.switches[0]?.port ?? 3}
                onChange={(e) => {
                  const portNum = parseInt(e.target.value, 10);
                  setDraft((prev) => ({
                    ...prev,
                    switches: prev.switches.map((s) => ({ ...s, port: portNum })),
                  }));
                }}
                className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-2.5 py-1 rounded-sm font-bold"
              >
                <option value={0}>Port 0 (P0.0 - P0.7)</option>
                <option value={1}>Port 1 (P1.0 - P1.7)</option>
                <option value={2}>Port 2 (P2.0 - P2.7)</option>
                <option value={3}>Port 3 (P3.0 - P3.7)</option>
              </select>
            </div>
          </div>

          {/* LCD 16x2 Mapping */}
          <div className="bg-[#141210] border border-[#38332c] p-3 rounded-sm">
            <div className="text-xs font-black text-[#fbbf24] mb-2 uppercase">
              3. HD44780 16×2 LCD Screen
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
              <div>
                <label className="text-[#a8a29e] block mb-1">Data Port:</label>
                <select
                  value={draft.lcd.dataPort}
                  onChange={(e) =>
                    handlePortChange(
                      (p, v) => ({ ...p, lcd: { ...p.lcd, dataPort: v } }),
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="w-full bg-[#292524] border border-[#524d43] text-[#ffffff] px-2 py-1 rounded-sm font-bold"
                >
                  <option value={0}>Port 0</option>
                  <option value={1}>Port 1</option>
                  <option value={2}>Port 2</option>
                  <option value={3}>Port 3</option>
                </select>
              </div>

              <div>
                <label className="text-[#a8a29e] block mb-1">RS Pin:</label>
                <div className="flex gap-1">
                  <select
                    value={draft.lcd.rs.port}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        lcd: { ...p.lcd, rs: { ...p.lcd.rs, port: parseInt(e.target.value, 10) } },
                      }))
                    }
                    className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-1 py-1 rounded-sm font-bold"
                  >
                    <option value={0}>P0</option>
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={draft.lcd.rs.pin}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        lcd: { ...p.lcd, rs: { ...p.lcd.rs, pin: parseInt(e.target.value, 10) } },
                      }))
                    }
                    className="w-10 bg-[#292524] border border-[#524d43] text-center text-[#ffffff] rounded-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#a8a29e] block mb-1">RW Pin:</label>
                <div className="flex gap-1">
                  <select
                    value={draft.lcd.rw.port}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        lcd: { ...p.lcd, rw: { ...p.lcd.rw, port: parseInt(e.target.value, 10) } },
                      }))
                    }
                    className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-1 py-1 rounded-sm font-bold"
                  >
                    <option value={0}>P0</option>
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={draft.lcd.rw.pin}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        lcd: { ...p.lcd, rw: { ...p.lcd.rw, pin: parseInt(e.target.value, 10) } },
                      }))
                    }
                    className="w-10 bg-[#292524] border border-[#524d43] text-center text-[#ffffff] rounded-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#a8a29e] block mb-1">EN Pin:</label>
                <div className="flex gap-1">
                  <select
                    value={draft.lcd.en.port}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        lcd: { ...p.lcd, en: { ...p.lcd.en, port: parseInt(e.target.value, 10) } },
                      }))
                    }
                    className="bg-[#292524] border border-[#524d43] text-[#ffffff] px-1 py-1 rounded-sm font-bold"
                  >
                    <option value={0}>P0</option>
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={draft.lcd.en.pin}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        lcd: { ...p.lcd, en: { ...p.lcd.en, pin: parseInt(e.target.value, 10) } },
                      }))
                    }
                    className="w-10 bg-[#292524] border border-[#524d43] text-center text-[#ffffff] rounded-sm font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#141210] border-t border-[#44403c]">
          <InstrumentButton variant="secondary" onClick={handleReset}>
            Reset to Defaults
          </InstrumentButton>
          <div className="flex gap-2">
            <InstrumentButton variant="ghost" onClick={onClose}>
              Cancel
            </InstrumentButton>
            <InstrumentButton variant="amber" onClick={handleApply}>
              Apply & Save
            </InstrumentButton>
          </div>
        </div>
      </div>
    </div>
  );
};
