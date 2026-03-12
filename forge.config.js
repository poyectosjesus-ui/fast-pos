module.exports = {
  packagerConfig: {
    icon: './public/icon-512x512', // Electron Forge añade la extensión automáticamente según la plataforma
    name: 'FastPOS',
    executableName: 'fast-pos',
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: './public/icon-512x512.png',
        name: 'FastPOS-Installer',
      },
    },
  ],
};
