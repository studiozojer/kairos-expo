/** Tuple encoding avoids collisions even when user/generated IDs contain separators. */
export function placementIdentifier(instanceId: string, nodeId: string): string {
  return JSON.stringify(['body', instanceId, nodeId]);
}
export function houseIdentifier(instanceId: string | undefined, house: number): string {
  return instanceId === undefined ? `house:${house}` : JSON.stringify(['house', instanceId, house]);
}
