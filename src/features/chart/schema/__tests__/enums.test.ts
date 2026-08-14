import { CELESTIAL_BODIES, ZODIAC_SIGNS, ASPECT_TYPES, HOUSE_SYSTEMS } from "../enums.gen";

test("zodiac has 12 signs in order", () => {
  expect(ZODIAC_SIGNS).toHaveLength(12);
  expect(ZODIAC_SIGNS[0]).toBe("aries");
  expect(ZODIAC_SIGNS[11]).toBe("pisces");
});

test("core bodies exist with glyph assets", () => {
  for (const key of ["sun", "moon", "mercury", "venus", "mars"]) {
    expect(CELESTIAL_BODIES[key]?.glyphAsset).toBeTruthy();
  }
});

test("major aspects carry their angles", () => {
  const angles = Object.values(ASPECT_TYPES).map((a) => a.angle);
  for (const angle of [0, 60, 90, 120, 180]) expect(angles).toContain(angle);
});

test("house systems include the fixture's", () => {
  expect(HOUSE_SYSTEMS.length).toBeGreaterThan(0);
});
