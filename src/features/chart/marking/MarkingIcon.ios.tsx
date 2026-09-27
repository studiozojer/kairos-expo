import { Host, Image } from '@expo/ui/swift-ui';
import type { MarkingIconName } from './iconNames';
const symbols = { add: 'plus', now: 'clock', backward: 'backward.fill', forward: 'forward.fill', reset: 'arrow.counterclockwise', settings: 'gearshape.fill', lock: 'lock.fill', unlock: 'lock.open.fill', screenshot: 'camera.fill', display: 'paintpalette.fill' } as const;
export function MarkingIcon({ name, color }: { name: MarkingIconName; color: string }) {
  return <Host style={{ width: 24, height: 24 }}><Image systemName={symbols[name]} size={20} color={color} /></Host>;
}
