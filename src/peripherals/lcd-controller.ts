/**
 * Micro8051SiM HD44780 LCD Controller Simulation
 * Real 16x2 Character LCD driven by simulated 8051 port signals.
 */

export class LCD16x2Controller {
  // DDRAM: 80 bytes (0x00 - 0x27 for Line 1, 0x40 - 0x67 for Line 2)
  public ddram: Uint8Array = new Uint8Array(0x80);

  // Address Counter (AC)
  public addressCounter = 0x00;

  // Configuration flags
  public displayOn = true;
  public cursorOn = false;
  public blinkOn = false;
  public incrementMode = true; // Entry mode: 1 = increment, 0 = decrement
  public displayShift = false;
  public is4BitMode = false;

  // 4-bit mode state
  private upperNibbleReceived = false;
  private pendingNibble = 0;

  // Track previous EN pin level for falling edge detection
  private prevEnLevel = 0;

  // 16x2 Display lines rendered for UI
  public line1 = ' '.repeat(16);
  public line2 = ' '.repeat(16);

  // Raw history log for debugging LCD commands
  public recentLogs: string[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.ddram.fill(0x20); // fill with ASCII space (' ')
    this.addressCounter = 0x00;
    this.displayOn = true;
    this.cursorOn = false;
    this.blinkOn = false;
    this.incrementMode = true;
    this.displayShift = false;
    this.is4BitMode = false;
    this.upperNibbleReceived = false;
    this.pendingNibble = 0;
    this.prevEnLevel = 0;
    this.updateDisplayStrings();
    this.recentLogs = ['LCD: Power-on initialized'];
  }

  /**
   * Process port inputs for LCD: rs, rw, en, and raw byte on data bus
   */
  public step(rs: number, rw: number, en: number, dataBus: number): void {
    // Detect falling edge on Enable (1 -> 0)
    if (this.prevEnLevel === 1 && en === 0) {
      if (rw === 0) {
        // Write Operation
        if (this.is4BitMode) {
          const nibble = (dataBus >> 4) & 0x0F;
          if (!this.upperNibbleReceived) {
            this.pendingNibble = nibble << 4;
            this.upperNibbleReceived = true;
          } else {
            const byteVal = this.pendingNibble | nibble;
            this.upperNibbleReceived = false;
            if (rs === 0) {
              this.executeCommand(byteVal);
            } else {
              this.writeData(byteVal);
            }
          }
        } else {
          // 8-bit mode
          if (rs === 0) {
            this.executeCommand(dataBus & 0xFF);
          } else {
            this.writeData(dataBus & 0xFF);
          }
        }
      }
    }

    this.prevEnLevel = en & 1;
  }

  private executeCommand(cmd: number): void {
    if (cmd === 0x01) {
      // Clear Display
      this.ddram.fill(0x20);
      this.addressCounter = 0x00;
      this.log('CMD: Clear Display');
    } else if (cmd === 0x02) {
      // Return Home
      this.addressCounter = 0x00;
      this.log('CMD: Return Home');
    } else if ((cmd & 0xFC) === 0x04) {
      // Entry Mode Set
      this.incrementMode = (cmd & 0x02) !== 0;
      this.displayShift = (cmd & 0x01) !== 0;
      this.log(`CMD: Entry Mode (Inc: ${this.incrementMode})`);
    } else if ((cmd & 0xF8) === 0x08) {
      // Display Control
      this.displayOn = (cmd & 0x04) !== 0;
      this.cursorOn = (cmd & 0x02) !== 0;
      this.blinkOn = (cmd & 0x01) !== 0;
      this.log(`CMD: Display Control (On: ${this.displayOn})`);
    } else if ((cmd & 0xE0) === 0x20) {
      // Function Set: 001 DL N F * *
      const is8Bit = (cmd & 0x10) !== 0;
      this.is4BitMode = !is8Bit;
      this.log(`CMD: Function Set (${is8Bit ? '8-bit' : '4-bit'} mode)`);
    } else if ((cmd & 0x80) === 0x80) {
      // Set DDRAM Address
      this.addressCounter = cmd & 0x7F;
      this.log(`CMD: Set DDRAM Addr 0x${this.addressCounter.toString(16).toUpperCase()}`);
    }

    this.updateDisplayStrings();
  }

  private writeData(data: number): void {
    const char = data >= 32 && data <= 126 ? String.fromCharCode(data) : '.';
    this.log(`DATA: '${char}' (0x${data.toString(16).toUpperCase().padStart(2, '0')}) at 0x${this.addressCounter.toString(16)}`);

    if (this.addressCounter < 0x80) {
      this.ddram[this.addressCounter] = data;
    }

    if (this.incrementMode) {
      this.addressCounter = (this.addressCounter + 1) & 0x7F;
      // Auto-wrap line 1 (0x10 -> 0x40) or line 2 (0x50 -> 0x00) for standard convenience
      if (this.addressCounter === 0x10) {
        this.addressCounter = 0x40;
      } else if (this.addressCounter === 0x50) {
        this.addressCounter = 0x00;
      }
    } else {
      this.addressCounter = (this.addressCounter - 1) & 0x7F;
    }

    this.updateDisplayStrings();
  }

  private updateDisplayStrings(): void {
    let l1 = '';
    for (let i = 0x00; i < 0x10; i++) {
      const b = this.ddram[i];
      l1 += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
    }

    let l2 = '';
    for (let i = 0x40; i < 0x50; i++) {
      const b = this.ddram[i];
      l2 += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
    }

    this.line1 = l1;
    this.line2 = l2;
  }

  private log(msg: string): void {
    this.recentLogs.push(msg);
    if (this.recentLogs.length > 50) {
      this.recentLogs.shift();
    }
  }
}
