// Shared with Display so every offered asteroid is calculated at each step.
export const SKY_ASTEROIDS = ['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Eros', 'Pholus'] as const;

// Calculate independently of display visibility: toggles only change rendering.
export const SKY_BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'MeanNode', 'MeanApogee',
  ...SKY_ASTEROIDS,
] as const;

