import { spawnSync } from 'node:child_process';

function hasCommand(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

if (!hasCommand('cargo')) {
  console.error(`\nMissing Rust/Cargo. Tauri desktop development requires Rust.\n\nInstall on macOS:\n  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh\n  source "$HOME/.cargo/env"\n\nThen rerun:\n  npm run tauri:dev\n`);
  process.exit(1);
}

if (!hasCommand('rustc')) {
  console.error('\nMissing rustc. Please install Rust from https://www.rust-lang.org/tools/install and rerun npm run tauri:dev.\n');
  process.exit(1);
}
