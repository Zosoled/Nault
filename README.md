# Gnault

![GitHub release (latest by date)](https://img.shields.io/github/v/release/Zosoled/Gnault)
[![GitHub All Releases](https://img.shields.io/github/downloads/Zosoled/Gnault/total)](https://github.com/Zosoled/Gnault/releases/latest)
[![Discord](https://img.shields.io/badge/discord-join%20chat-orange.svg?logo=discord&color=7289DA)](https://chat.nano.org)

Gnault is a fork of the popular nano wallet Nault which is a fork of the popular nano wallet [NanoVault](https://github.com/cronoh/nanovault) 💙

It's a fully client-side signing wallet for sending and receiving nano either directly in your browser at [gnault.cc](https://gnault.cc) or with the [desktop app](https://github.com/Zosoled/Gnault/releases/latest).

Seamless integration with any nano compatible RPC backend/websocket and the aim to be more frequently maintained are some of the main features. Those together will greatly increase the stability, performance and uptime.

## Usage

Gnault comes in different flavors to suit your needs.

#### Desktop App

Available for Windows/Mac/Linux – just head over to the [latest release](https://github.com/Zosoled/Gnault/releases/latest) and download the version for your OS. Arch Linux users may [install it from the (unofficial) AUR](https://aur.archlinux.org/packages/gnault-bin/).

If you want to verify the binary checksum there are plenty of apps to do this. One way is using a powershell or bash terminal:

* **Powershell:** `Get-FileHash -Path '.\Gnault-Setup-x.x.x-Windows.exe' -Algorithm SHA256`
* **Bash:** `openssl sha256 Gnault-x.x.x-Linux.AppImage`

Then compare the output hash with the one listed in the corresponding checksums file that you download.

#### Web App

You can also use Gnault from any device on the web at [gnault.cc](https://gnault.cc).

Both the desktop (recommended) and web version supports the Ledger Nano hardware wallet. For help using it, please refer to [this guide](https://docs.nault.cc/2020/08/04/ledger-guide.html).

The web version can additionally be pulled from the [dockerhub repo](https://hub.docker.com/r/zosoled/gnault) using: docker pull zosoled/gnault:latest

A full security guide and other useful articles can be found in [the original Nault docs](https://docs.nault.cc).

#### Mobile App

There is no native mobile app but the web wallet contains a Progressive Web App (PWA). That allows you to run it in offline mode for remote-signing.

If you visit [gnault.cc](https://gnault.cc) in your phone you will be given the option to install it.

* Android: Click on "Install Gnault for Android" in the menu
* iOS (Safari only): 1 - Tap the share button. 2 - Select "+ Add to home screen". 3 - Open Gnault from the home screen

## How To Help

Thanks for your interest in contributing! There are many ways to contribute to this project. [Get started here at CONTRIBUTING.md](CONTRIBUTING.md).

If you want to know how to setup the development environment head over to [DEVELOPMENT.md](DEVELOPMENT.md).

## Support

If you are looking for more interactive and quick support compared to creating a new Github issue, visit the [Nano Discord server](https://chat.nano.org/).

## Acknowledgements

Special thanks to the following!

- [Nault](https://github.com/Nault/Nault) - The original one
- [NanoVault](https://github.com/cronoh/nanovault) - The original original one
- [NanoPow](https://npmjs.com/package/nano-pow) - PoW Implementation
- [jaimehgb/RaiBlocksWebAssemblyPoW](https://github.com/jaimehgb/RaiBlocksWebAssemblyPoW) - CPU PoW Implementation
- [dcposch/blakejs](https://github.com/dcposch/blakejs) - Blake2b Implementation
- [dchest/tweetnacl-js](https://github.com/dchest/tweetnacl-js) - Cryptography Implementation

## Donations

If you have found Gnault useful and are feeling generous, you can donate at
`nano_1zosoqs47yt47bnfg7sdf46kj7asn58b7uzm9ek95jw7ccatq37898u1zoso`

Thanks a lot!
