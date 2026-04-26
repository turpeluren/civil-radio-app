import { requireNativeModule } from 'expo-modules-core';

export interface PaletteMode {
  /** Most-vibrant hue bucket's colour, lightness-clamped for this theme. `#RRGGBB`. */
  primary: string;
  /** Most-common hue bucket's colour (if sufficiently distinct from primary), else `null`. */
  secondary: string | null;
}

export interface Palette {
  /** Suitable for dark-mode backgrounds — always dark enough for white icons. */
  dark: PaletteMode;
  /** Suitable for light-mode backgrounds — always light enough for black icons. */
  light: PaletteMode;
}

interface ExpoImageColorsNativeModule {
  /**
   * Extract the palette from a local image.
   * Returns `null` when the image can't be decoded or contains no usable colour
   * (e.g. fully transparent, pure black, or pure white).
   */
  getImagePaletteAsync(uri: string): Promise<Palette | null>;
}

let module: ExpoImageColorsNativeModule;

try {
  module = requireNativeModule('ExpoImageColors');
} catch {
  console.warn(
    '[expo-image-colors] Native module not found. ' +
      'Run `npx expo run:ios` or `npx expo run:android` to rebuild with the native module.',
  );

  module = {
    getImagePaletteAsync: () => Promise.resolve(null),
  } as unknown as ExpoImageColorsNativeModule;
}

export default module;
