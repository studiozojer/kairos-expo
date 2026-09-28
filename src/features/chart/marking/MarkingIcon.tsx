import { Canvas, Path } from '@shopify/react-native-skia';
import type { MarkingIconName } from './iconNames';
const paths: Record<MarkingIconName, string> = {
  rotateLeft: 'M4 3V10H11L8 7A6 6 0 1 1 6 13H3A9 9 0 1 0 6 5Z',
  rotateRight: 'M20 3V10H13L16 7A6 6 0 1 0 18 13H21A9 9 0 1 1 18 5Z',
  add: 'M11 3H13V11H21V13H13V21H11V13H3V11H11Z',
  now: 'M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2ZM12 4A8 8 0 1 1 12 20A8 8 0 1 1 12 4ZM11 6H13V11H17V13H11Z',
  backward: 'M15 4L7 12L15 20L17 18L11 12L17 6Z',
  forward: 'M9 4L17 12L9 20L7 18L13 12L7 6Z',
  reset: 'M4 3V10H11L8 7A6 6 0 1 1 6 13H3A9 9 0 1 0 6 5Z',
  settings: 'M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.5-2.3 1a8 8 0 0 0-1.7-1L15 3h-4l-.4 3a8 8 0 0 0-1.7 1L6.6 6l-2 3.5 2 1.5a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z',
  lock: 'M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM9 6a3 3 0 0 1 6 0v2H9V6Zm4 10v2h-2v-2a2 2 0 1 1 2 0Z',
  unlock: 'M18 8H9V6a3 3 0 0 1 5.8-1h2.1A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-5 8v2h-2v-2a2 2 0 1 1 2 0Z',
  screenshot: 'M9 3 7 5H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4l-2-2H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  display: 'M12 2a10 10 0 1 0 0 20h1a3 3 0 0 0 2-5c-.5-.5 0-1 1-1h2a4 4 0 0 0 4-4A10 10 0 0 0 12 2ZM6 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
};
export function MarkingIcon({ name, color }: { name: MarkingIconName; color: string }) {
  return <Canvas style={{ width: 24, height: 24 }}><Path path={paths[name]} color={color} fillType="evenOdd" /></Canvas>;
}
