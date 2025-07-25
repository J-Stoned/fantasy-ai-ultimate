declare module 'recordrtc' {
  export interface RecordRTCConfig {
    type?: 'audio' | 'video' | 'canvas' | 'gif';
    mimeType?: string;
    audioBitsPerSecond?: number;
    videoBitsPerSecond?: number;
    bitsPerSecond?: number;
    frameInterval?: number;
    numberOfAudioChannels?: number;
    video?: HTMLVideoElement;
    canvas?: {
      width?: number;
      height?: number;
    };
    sampleRate?: number;
    desiredSampRate?: number;
    bufferSize?: number;
    frameRate?: number;
    bitrate?: number;
    onTimeStamp?: (timestamp: number) => void;
    disableLogs?: boolean;
    recorderType?: any; // This could be MediaStreamRecorder, CanvasRecorder, etc.
    checkForInactiveTracks?: boolean;
    initCallback?: () => void;
  }

  export type RecordRTCState = 'inactive' | 'recording' | 'stopped' | 'paused';

  export default class RecordRTC {
    constructor(stream: MediaStream, config?: RecordRTCConfig);
    startRecording(): void;
    stopRecording(callback?: () => void): void;
    pauseRecording(): void;
    resumeRecording(): void;
    reset(): void;
    getBlob(): Blob;
    getDataURL(callback: (dataURL: string) => void): void;
    toURL(): string;
    save(fileName?: string): void;
    getFromDisk(callback: (dataURL: string) => void): void;
    setAdvertisementArray(webPImages: Array<{ duration: number; image: string }>): void;
    clearRecordedData(): void;
    destroy(): void;
    
    // Properties
    state: RecordRTCState;
    blob: Blob | null;
    bufferSize: number;
    sampleRate: number;
    width: number;
    height: number;
    video: HTMLVideoElement;
    
    // Static properties
    static version: string;
    static workerPath: string;
  }

  export class MultiStreamRecorder {
    constructor(streams: MediaStream[], config?: RecordRTCConfig);
    startRecording(): void;
    stopRecording(callback?: () => void): void;
    pauseRecording(): void;
    resumeRecording(): void;
    clearRecordedData(): void;
    getBlob(): Blob;
  }

  export class RecordRTCPromisesHandler {
    constructor(stream: MediaStream, config?: RecordRTCConfig);
    startRecording(): Promise<void>;
    stopRecording(): Promise<string>;
    pauseRecording(): Promise<void>;
    resumeRecording(): Promise<void>;
    getBlob(): Blob;
    getDataURL(): Promise<string>;
    getBase64(): Promise<string>;
    blob: Blob | null;
    recordRTC: RecordRTC;
  }
}