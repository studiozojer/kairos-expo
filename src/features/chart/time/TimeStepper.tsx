import { View } from 'react-native';
import { useChartTime } from './ChartTimeContext';
import { TIME_STEPS, timeOffset } from './timeSteps';
import { TimeStepButton } from './TimeStepButton';
import { IntervalCarousel } from './IntervalCarousel';

/** Swift layout: two 44pt arrows flank the horizontal interval/offset stack. */
export function TimeStepper() {
  const clock = useChartTime();
  const original = clock.kind === 'saved' && clock.time === clock.origin;
  const offset = original ? 'Origin' : timeOffset(clock.time, clock.origin);
  const enabled = clock.canStepBackward || clock.canStepForward;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
    <TimeStepButton direction={-1} enabled={clock.canStepBackward} interval={TIME_STEPS[clock.unit].label.toLowerCase()} onStep={clock.step} />
    <IntervalCarousel unit={clock.unit} onChange={clock.selectUnit} onReset={clock.reset} enabled={enabled}
      offsetLabel={offset} differential={offset !== 'Now' && offset !== 'Origin'}
      resetLabel={clock.kind === 'saved' ? 'Return to original time' : 'Return to now'} />
    <TimeStepButton direction={1} enabled={clock.canStepForward} interval={TIME_STEPS[clock.unit].label.toLowerCase()} onStep={clock.step} />
  </View>;
}
