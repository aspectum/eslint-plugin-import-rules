import path from "path";

/** Handle windows and linux paths */
export const toPosix = (inputPath: string) =>
  inputPath.split(path.sep).join(path.posix.sep).toLowerCase();
