interface GPMFExtractCommonOptions {
  /** Default: false. Change behavior to use in browser. This is optional for debugging reasons */
  browserMode?: boolean;
  /** Default: false. Opt into a worker; failures retry once on the main thread, except cancellation. */
  useWorker?: boolean;
  /** Processed percentage. Stops on settlement and may not reach 100 on success. */
  progress?: (progress: number) => void;
}

interface GPMFExtractBrowserOptions extends GPMFExtractCommonOptions {
  browserMode: true;
  /**
   * An object that allows for cancelling the extraction process.
   * Currently only supported in browser mode.
   * If cancelled, the extraction process will fail with the error message "Canceled by user".
   */
  cancellationToken?: { cancelled: boolean };
}

interface GPMFExtractNodeOptions extends GPMFExtractCommonOptions {
  browserMode: false;
}

interface GPMFExtractResult<P extends 'node' | 'browser'> {
  rawData: P extends 'node' ? Buffer : Uint8Array;
  timing: {
    /** Duration of video in seconds */
    videoDuration: number;
    /** Duration of frame in mili-seconds */
    frameDuration: number;
    /** Date when the video capture started */
    start: Date;
    samples: {
      /** Offset */
      cts: number;
      duration: number;
    }[];
  }
}

/** Use appendBuffer with a fileStart byte offset; call flush once the producer reaches EOF. */
type ISOFile = {
  appendBuffer: (buffer: ArrayBuffer & { fileStart: number }) => number | undefined;
  flush: () => void;
};

type GPMFExtractErrorCode = 'INVALID_MP4' | 'TRACK_NOT_FOUND' | 'EMPTY_TELEMETRY' |
  'INCOMPLETE_TELEMETRY' | 'CANCELLED' | 'READ_ERROR' | 'PARSE_ERROR';

declare class GPMFExtractError extends Error {
  constructor(code: GPMFExtractErrorCode, cause?: unknown);
  code: GPMFExtractErrorCode;
  cause?: unknown;
  /** Original failure when a worker attempt and its main-thread retry both fail. */
  workerError?: GPMFExtractError;
}
/**
 * Finds the metadata track in GoPro (Hero5 and later) video files (or any other camera that implements GPMF) and extracts it for later analysis and processing.
 * Rejects with GPMFExtractError. Missing file arguments throw TypeError synchronously.
 */
declare function GPMFExtract(
  file: Blob | File,
  options?: GPMFExtractBrowserOptions,
): Promise<GPMFExtractResult<'browser'>>;
declare function GPMFExtract(
  file: Buffer | ((file: ISOFile) => void),
  options?: GPMFExtractNodeOptions,
): Promise<GPMFExtractResult<'node'>>;

export default GPMFExtract;
export { GPMFExtract, GPMFExtractError, GPMFExtractErrorCode };
