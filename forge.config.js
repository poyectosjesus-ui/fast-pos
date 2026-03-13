module.exports = {
  packagerConfig: {
    icon: './public/icon-512x512',
    name: 'FastPOS Native',
    executableName: 'fast-pos-native',
    asar: true, // Empaquetado comprimido
    extraResource: [
      // Aquí irían recursos extras si fueran necesarios
    ]
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
