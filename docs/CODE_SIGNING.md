# Code Signing Setup Guide

This guide covers how to set up code signing for AutoTest AI on macOS and Windows.

## Overview

Code signing is essential for:
- **macOS**: Apps must be signed and notarized to run without security warnings
- **Windows**: Signed apps avoid SmartScreen warnings and build user trust
- **Auto-updates**: Tauri's updater requires signed binaries

## macOS Code Signing

### Prerequisites

1. Apple Developer Program membership ($99/year)
2. Xcode installed on your Mac
3. Valid Developer ID certificates

### Step 1: Create Certificates

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list)
2. Create a new certificate: **Developer ID Application**
3. Download and install in Keychain Access

### Step 2: Set Up Notarization

Create an app-specific password:
1. Go to [Apple ID](https://appleid.apple.com)
2. Sign in → Security → App-Specific Passwords
3. Generate a new password for "AutoTest AI"

### Step 3: Configure GitHub Secrets

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_SIGNING_IDENTITY` | e.g., "Developer ID Application: Your Name (TEAM_ID)" |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Your 10-character Team ID |

### Export Certificate

```bash
# Export certificate from Keychain
security find-certificate -c "Developer ID Application" -p > cert.pem
security find-key -c "Developer ID Application" -p > key.pem

# Create .p12 file
openssl pkcs12 -export -out certificate.p12 -inkey key.pem -in cert.pem

# Base64 encode for GitHub secret
base64 -i certificate.p12 | pbcopy
```

## Windows Code Signing

### Prerequisites

1. Code signing certificate from a trusted CA (DigiCert, Sectigo, etc.)
2. Windows SDK (for signtool)

### Step 1: Obtain Certificate

Options for Windows code signing certificates:
- **EV Certificate** ($400-500/year): Instant SmartScreen reputation
- **Standard OV Certificate** ($100-200/year): Builds reputation over time

Recommended providers:
- DigiCert
- Sectigo (Comodo)
- GlobalSign

### Step 2: Configure GitHub Secrets

| Secret | Description |
|--------|-------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password |

### Export Certificate

```powershell
# Export certificate as .pfx
$cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Subject -like "*Your Company*"}
Export-PfxCertificate -Cert $cert -FilePath certificate.pfx -Password (ConvertTo-SecureString -String "password" -Force -AsPlainText)

# Base64 encode for GitHub secret
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
```

## Tauri Update Signing

For Tauri's built-in updater, generate a signing key pair:

```bash
# Generate a new keypair
npm run tauri signer generate -- -w ~/.tauri/autotest-ai.key

# This creates:
# - ~/.tauri/autotest-ai.key (private key - keep secret!)
# - ~/.tauri/autotest-ai.key.pub (public key - embed in app)
```

### Configure Updater Keys

Add to GitHub secrets:
- `TAURI_SIGNING_PRIVATE_KEY`: Content of the private key file
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password used during generation

Add public key to `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": ["https://your-server.com/updates/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

## Local Development

For local development and testing, you can skip code signing:

```bash
# macOS: Allow unsigned apps in System Preferences > Security
# Or run with:
xattr -cr "/Applications/AutoTest AI.app"

# Windows: Right-click → Properties → Unblock
```

## Verification

### Verify macOS Signature

```bash
codesign -dv --verbose=4 "/Applications/AutoTest AI.app"
spctl -a -v "/Applications/AutoTest AI.app"
```

### Verify Windows Signature

```powershell
Get-AuthenticodeSignature ".\AutoTest AI.exe"
```

## Troubleshooting

### macOS: "App is damaged"

```bash
xattr -cr "/Applications/AutoTest AI.app"
```

### macOS: Notarization Failed

Check the notarization log:
```bash
xcrun notarytool log <submission-id> --apple-id <your-id> --team-id <team-id>
```

### Windows: SmartScreen Warning

- Ensure you're using an EV certificate, or
- Wait for your OV certificate to build reputation (may take weeks)

## Resources

- [Apple Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Tauri Code Signing Docs](https://tauri.app/v1/guides/distribution/sign-macos)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage)
