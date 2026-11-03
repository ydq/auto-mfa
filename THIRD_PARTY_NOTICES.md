# Third-party notices

The project's own code and artwork use 0BSD. This does not replace the licenses of its dependencies.

| Bundled dependency | License |
| --- | --- |
| Vue / @vue runtime packages | MIT |
| qrcode | MIT |
| dijkstrajs | MIT |
| jsQR | Apache-2.0 |

Full package license texts are recorded in [docs/licenses/THIRD_PARTY_LICENSES.md](docs/licenses/THIRD_PARTY_LICENSES.md). Every production build also generates `dist/THIRD_PARTY_LICENSES.md` from the packages actually bundled. Distribute that file, this notice, and `LICENSE` with the extension. Upstream terms and attribution remain applicable; 0BSD is not a relicensing of third-party code.

Additional source attribution retained by node-qrcode:

- Copyright (c) 2011 Ryan Day. Modified for Node.js support; MIT.
- Copyright (c) 2009 Kazuhiko Arase, QRCode for JavaScript; MIT.
- The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

Vite and @vitejs/plugin-vue are MIT-licensed development tools. Dependencies installed for development retain their own licenses; consult each package when redistributing development tooling rather than only the built extension.

References: [0BSD](https://opensource.org/license/0bsd), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).
