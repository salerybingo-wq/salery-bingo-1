type BallReference = number | string | { letter?: string; number?: number | string; call?: string };

const FILE_OVERRIDES: Record<string, string> = {
  'i-23': 'i-23 (1)',
  'o-71': 'o-71 (1)',
};

class SoundEffects {
  public soundEnabled = true;
  public voiceEnabled = true;
  private audioCache = new Map<string, HTMLAudioElement>();
  private currentAudio: HTMLAudioElement | null = null;
  private lastBingoPlayedTimestamp = 0;

  private getAudio(file: string): HTMLAudioElement {
    const existing = this.audioCache.get(file);
    if (existing) return existing;

    const actualFile = FILE_OVERRIDES[file] || file;
    const audio = new Audio(`/bingo%20sound/${encodeURIComponent(actualFile)}.mp3`);
    audio.preload = 'auto';
    this.audioCache.set(file, audio);
    return audio;
  }

  private resolveCallFileName(input: BallReference): string | null {
    let number: number;
    if (typeof input === 'number') {
      number = input;
    } else if (typeof input === 'string') {
      const match = input.trim().match(/^[a-zA-Z]\s*[-_\s]?\s*(\d{1,2})$/);
      if (!match) return null;
      number = Number(match[1]);
    } else {
      const callMatch = input?.call?.trim().match(/^[a-zA-Z]\s*[-_\s]?\s*(\d{1,2})$/);
      number = Number(input?.number ?? callMatch?.[1]);
    }

    if (!Number.isInteger(number) || number < 1 || number > 75) return null;
    const letter = number <= 15 ? 'b' : number <= 30 ? 'i' : number <= 45 ? 'n' : number <= 60 ? 'g' : 'o';
    return `${letter}-${number}`;
  }

  private playFile(file: string) {
    if (!this.soundEnabled || typeof window === 'undefined') return;

    this.stopAllAudio();
    try {
      const audio = this.getAudio(file);
      audio.currentTime = 0;
      audio.volume = 1;
      this.currentAudio = audio;
      void audio.play().catch((error: unknown) => {
        console.warn(`Could not play bingo audio file "${file}":`, error);
      });
    } catch (error) {
      console.warn(`Could not load bingo audio file "${file}":`, error);
    }
  }

  public unlockAudio() {}
  public playTone(_freq?: number, _duration?: number, _gainVal?: number) {}
  public playDaub() {}
  public playBeep(_success = true) {}

  public stopAllAudio() {
    if (!this.currentAudio) return;
    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.currentAudio = null;
  }

  public playWinFanfare() {
    this.playBingo();
  }

  public playBingo() {
    const now = Date.now();
    if (now - this.lastBingoPlayedTimestamp < 7000) return;
    this.lastBingoPlayedTimestamp = now;
    this.playFile('bingo');
  }

  public playCalledNumber(input: BallReference) {
    if (!this.soundEnabled && !this.voiceEnabled) return;
    const fileName = this.resolveCallFileName(input);
    if (fileName) this.playFile(fileName);
  }

  public speakBall(letter: string, num: number | string) {
    this.playCalledNumber({ letter, number: num });
  }

  public startBGM() {}
  public stopBGM() {}
}

export const sounds = new SoundEffects();
