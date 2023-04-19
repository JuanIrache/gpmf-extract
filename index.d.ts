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

  function GPMFExtract(
	file: Buffer | File,
	options?: GPMFExtractOptions,
  ): Promise<GPMFExtractResult>;

  export default GPMFExtract;
  export { GPMFExtract };
