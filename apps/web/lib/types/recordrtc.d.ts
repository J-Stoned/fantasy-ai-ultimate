declare module 'recordrtc' {
  export default class RecordRTC {
    constructor(stream: MediaStream, config?: any);
    startRecording(): void;
    stopRecording(callback?: () => void): void;
    getBlob(): Blob;
    getDataURL(callback: (dataURL: string) => void): void;
    destroy(): void;
    state: string;
  }
}