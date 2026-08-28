import {
  cutClipOverwrite,
  cutClipToNewFile,
} from "../../shared/clips/index.js";
import type { CutClipResult, CutRange, ScaleTarget } from "../../shared/ipc.js";
import { getAppDataDir, getConfig } from "../session.js";
import { sendClipsChanged } from "./notify.js";
import { withClipUrls } from "./urls.js";

let cutting = false;

export async function runCutClip(
  id: string,
  ranges: CutRange[],
  overwrite?: boolean,
  scale?: ScaleTarget | null,
  name?: string | null,
): Promise<CutClipResult> {
  if (cutting) {
    return { ok: false, error: "Ein Clip wird bereits geschnitten." };
  }
  cutting = true;
  try {
    const options = {
      appDataDir: getAppDataDir(),
      outputDir: getConfig().CLIP_OUTPUT_DIR,
    };
    const result = overwrite
      ? await cutClipOverwrite(options, id, ranges, scale, name)
      : await cutClipToNewFile(options, id, ranges, scale, name);
    if (result.ok) {
      sendClipsChanged();
      return { ok: true, clip: withClipUrls([result.clip])[0]! };
    }
    return result;
  } finally {
    cutting = false;
  }
}
