export type VehicleShape = "car" | "suv" | "big";

// Picks a silhouette for a vehicle type from its name: "Camioneta grande", "Pick up"...
export function vehicleShape(name: string): VehicleShape {
  if (/grande|pick ?up|\bvan\b|troca|\bcami[oó]n\b/i.test(name)) return "big";
  if (/camioneta|suv|crossover/i.test(name)) return "suv";
  return "car";
}
