# WSL Migration Guide

This guide moves PharmaCare Pro from Windows filesystem to WSL and sets up Linux-native development.

## Current target path
`/home/sourav/workspace/pharmacare-pro`

## 1. Open WSL terminal
Use Ubuntu terminal or run:
```powershell
wsl
```

## 2. Verify repo exists in Linux filesystem
```bash
ls -la /home/sourav/workspace/pharmacare-pro
```

## 3. Run bootstrap script
From Windows (PowerShell):
```powershell
wsl bash -lc "cd /home/sourav/workspace/pharmacare-pro && chmod +x scripts/wsl-bootstrap.sh && ./scripts/wsl-bootstrap.sh"
```

Or directly inside WSL:
```bash
cd /home/sourav/workspace/pharmacare-pro
chmod +x scripts/wsl-bootstrap.sh
./scripts/wsl-bootstrap.sh
```

## 4. Open project in VS Code WSL mode
From WSL terminal:
```bash
cd /home/sourav/workspace/pharmacare-pro
code .
```

If prompted, install the "WSL" extension in VS Code.

## 5. Daily workflow in WSL
```bash
cd /home/sourav/workspace/pharmacare-pro
git pull
npm run typecheck
npm run lint
npm run test -- --run
npm run tauri:dev
```

## 6. Git operations in WSL
```bash
git checkout develop
git checkout -b feature/mvp0-stabilize-build
```

## 7. Notes
- Do development from Linux path (`/home/...`), not `/mnt/d/...`.
- Keep secrets only in GitHub Secrets, never in repo files.
- For PowerShell policy issues on Windows, prefer WSL terminal for npm usage.
