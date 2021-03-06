
import * as humanize from "humanize-plus";
import * as ospath from "path";

import mklog from "./log";
const log = mklog("util/extract");

const verbose = (process.env.THE_DEPTHS_OF_THE_SOUL === "1");

import noop from "./noop";
import sf from "./sf";
import spawn from "./spawn";
import butler from "./butler";

import {Logger} from "./log";
import {IProgressListener} from "../types";
import {EventEmitter} from "events";

interface ISizeMap {
  [entryName: string]: number;
}

interface IListResult {
  sizes: ISizeMap;
  totalSize: number;
}

interface IExtractOpts {
  logger?: Logger;
  emitter: EventEmitter;
  onProgress?: IProgressListener;
  archivePath: string;
  destPath: string;
}

interface IEntryDoneListener {
  (entryPath: string): void;
}

const self = {
  unarchiverList: async function (logger: Logger, archivePath: string): Promise<IListResult> {
    const opts = {logger};

    const sizes = {} as ISizeMap;
    let totalSize = 0;

    const contents = await spawn.getOutput({
      command: "lsar",
      args: [
        // enable JSON output
        "-j",
        archivePath,
      ],
      logger,
    });
    const info = JSON.parse(contents);

    if (verbose) {
      log(opts, `${info.lsarContents.length} lsarContent entries`);
    }
    
    for (const entry of info.lsarContents) {
      if (verbose) {
        log(opts, `${entry.XADFileName} ${entry.XADFileSize}`);
      }
      sizes[ospath.normalize(entry.XADFileName)] = entry.XADFileSize;
      totalSize += entry.XADFileSize;
    }

    return {sizes, totalSize};
  },

  unarchiverExtract: async function (logger: Logger, archivePath: string, destPath: string,
                                     onItemDone: IEntryDoneListener) {
    const opts = {logger};

    let EXTRACT_RE = /^ {2}(.+) {2}\(.+\)\.\.\. OK\.$/;

    await sf.mkdir(destPath);

    const args = [
      // Always overwrite files when a file to be unpacked already exists on disk.
      // By default, the program asks the user if possible, otherwise skips the file.
      "-force-overwrite",
      // Never create a containing directory for the contents of the unpacked archive.
      "-no-directory",
      // The directory to write the contents of the archive to. Defaults to the
      // current directory. If set to a single dash (-), no files will be created,
      // and all data will be output to stdout.
      "-output-directory", destPath,
      // file to unpack
      archivePath,
    ];

    let out = "";

    const code = await spawn({
      command: "unar",
      args,
      split: "\n",
      onToken: (token) => {
        if (verbose) {
          log(opts, `extract: ${token}`);
        }
        out += token;

        let matches = EXTRACT_RE.exec(token);
        if (verbose) {
          log(opts, `matches: ${matches}`);
        }
        if (!matches) {
          return;
        }

        let itemPath = ospath.normalize(matches[1]);
        if (verbose) {
          log(opts, `itemPath: ${itemPath}`);
        }
        onItemDone(itemPath);
      },
      logger,
    });

    if (code !== 0) {
      throw new Error(`unarchiver failed: ${out}`);
    }
  },

  unarchiver: async function (opts: IExtractOpts) {
    const {archivePath, destPath, onProgress = noop, logger} = opts;

    let extractedSize = 0;
    let totalSize = 0;

    const info = await self.unarchiverList(logger, archivePath);
    totalSize = info.totalSize;
    log(opts, `archive contains ${Object.keys(info.sizes).length} files, ${humanize.fileSize(totalSize)} total`);

    const onEntryDone: IEntryDoneListener = (f) => {
      if (verbose) {
        log(opts, `progress!: ${f} ${info.sizes[f]}`);
      }
      extractedSize += (info.sizes[f] || 0);
      const progress = extractedSize / totalSize;
      onProgress({progress});
    };
    await self.unarchiverExtract(logger, archivePath, destPath, onEntryDone);
  },

  extract: async function (opts: IExtractOpts): Promise<void> {
    const {archivePath, destPath} = opts;

    const isZip = /\.zip$/i.test(archivePath);
    if (isZip) {
      const hasButler = await butler.sanityCheck();
      if (hasButler) {
        log(opts, "Using butler to extract zip");
        await butler.unzip(opts);
        return;
      } else {
        log(opts, "No sane butler around, using unar to extract zip");
      }
    }

    return await self.unarchiver(opts);
  },
};

export default self;
