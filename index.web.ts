import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Skia must be initialized before any module importing its drawing API loads.
void LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
  const { DesktopApp } = require('./src/web/DesktopApp');
  registerRootComponent(DesktopApp);
}).catch((error: unknown) => {
  document.body.textContent = `Could not start the chart viewer: ${String(error)}`;
});
