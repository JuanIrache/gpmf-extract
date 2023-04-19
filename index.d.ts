interface GPMFExtractCommonOptions {
  /** Default: false. Change behavior to use in browser. This is optional for debugging reasons */
  browserMode?: boolean;
  /** Default: true. In browser mode, use a web worker to avoid locking the browser. This is optional as it seems to crash on some recent browsers */
  useWorker?: boolean;
  /** Pass a function to read the processed percentage updates */
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

type GPMFExtractOptions = GPMFExtractBrowserOptions | GPMFExtractNodeOptions;

interface GPMFExtractResult {
  rawData: Buffer;
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

/** `ISOFile` is declared inside `mp4box`, use function `appendBuffer` to append to buffer and `flush` to complete it */
type ISOFile = {
  appendBuffer: (buffer: Buffer) => void;
  flush: () => void;
};
declare function GPMFExtract(
  file:
    | Buffer
    | Blob
    | File
    | (
      (
        /** `ISOFile` is declared inside `mp4box`, use function `appendBuffer` to append to buffer and `flush` to complete it */
        file: ISOFile,
      ) => void
    ),
  options?: GPMFExtractOptions,
): Promise<GPMFExtractResult>;

export default GPMFExtract;
export { GPMFExtract };
