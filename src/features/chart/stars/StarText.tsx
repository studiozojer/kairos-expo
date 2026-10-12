import { forwardRef } from 'react';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
/** Refresh native measurement when Dynamic Type changes, including while backgrounded.
 * Native font scaling remains enabled; a fresh text host avoids stale custom-font bounds. */
export const StarText = forwardRef<Text, TextProps>(function StarText(props, ref) {
  const { fontScale } = useWindowDimensions();
  return <Text key={fontScale} ref={ref} {...props} />;
});
