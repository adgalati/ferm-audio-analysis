
import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runSonicAnnotator({ exe, pluginPath, pluginId, audioPath, csvOutPath, extraArgs = [], signal }) {
  const args = [
    '-d', pluginId,
    '-w', 'csv',
    '--csv-stdout',
    audioPath,
    ...extraArgs
  ];

  console.log('[Sonic Runner] Running:', exe, args.join(' '));
  console.log('[Sonic Runner] VAMP_PATH:', pluginPath);

  // Set VAMP_PATH environment variable for this process
  const env = {
    ...process.env,
    VAMP_PATH: pluginPath
  };

  try {
    const { stdout, stderr } = await execa(exe, args, {
      windowsHide: true,
      env,
      cancelSignal: signal
    });

    if (stderr && stderr.trim().length > 0) {
      // Some plugins log warnings to stderr; surface for diagnostics
      console.log('[Sonic Runner] Stderr (non-fatal):', stderr.slice(0, 500));
    }

    console.log('[Sonic Runner] Output length:', stdout.length);

    if (csvOutPath) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(csvOutPath, stdout, 'utf-8');
    }
    return stdout;
  } catch (error) {
    const errStderr = error.stderr || '';
    const errMsg = [
      '[Sonic Runner] sonic-annotator failed',
      `  exe: ${exe}`,
      `  pluginId: ${pluginId}`,
      `  audioPath: ${audioPath}`,
      `  VAMP_PATH: ${pluginPath}`,
      `  args: ${args.join(' ')}`,
      `  code: ${error.code || 'n/a'}`,
      `  stderr: ${errStderr.slice(0, 1000)}`
    ].join('\n');
    console.error(errMsg);
    if (errStderr.includes('No plugin with identifier') || errStderr.includes('No plugin')) {
      console.error('[Sonic Runner] Hint: Plugin ID not found. Ensure pyin.dll is inside VAMP_PATH and confirm with: sonic-annotator -l');
    }
    throw error;
  }
}
