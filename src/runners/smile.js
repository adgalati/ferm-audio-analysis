
import { execa } from 'execa';

export async function runOpenSmile({ exe, config, audioPath, csvOutPath, frameModeInclude, signal }) {
  const args = [
    '-C', config,
    '-I', audioPath,
    '-O', csvOutPath
  ];
  
  // Add frame mode configuration if provided
  if (frameModeInclude) {
    args.push('-frameModeFunctionalsConf', frameModeInclude);
  }
  
  console.log('[SMILE Runner] Running:', exe, args.join(' '));
  
  const { stdout } = await execa(exe, args, { windowsHide: true, cancelSignal: signal });
  return { stdout, csv: csvOutPath };
}
