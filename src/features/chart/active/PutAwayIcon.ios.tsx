import { Host, Image } from '@expo/ui/swift-ui';

export function PutAwayIcon({ color }: { color: string }) {
  return <Host style={{ width: 28, height: 28 }}><Image systemName="trash.fill" size={24} color={color} /></Host>;
}
