# Evergreen Connect

Evergreen Connect is an iPad-friendly Progressive Web App for starting and accessing a Windows virtual machine hosted on your own PC.

## Planned architecture

- iPad PWA: React + Vite, deployed on Vercel.
- Source control: GitHub.
- Host controller: a small Windows service/API running on the physical PC.
- Virtualisation: Oracle VirtualBox.
- Private networking: Tailscale.
- Remote desktop: Chrome Remote Desktop Host installed and paired inside the Windows guest.

## Current status

This repository contains the initial project scaffold. The host controller and secure connection are not yet configured, so the Connect action remains unavailable. Never commit passwords, PINs, API tokens, or Tailscale auth keys.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Security principles

- Keep the host controller reachable only over the private network.
- Authenticate and validate every host-control request.
- Keep VM startup, remote desktop access, and VM shutdown as separate operations.