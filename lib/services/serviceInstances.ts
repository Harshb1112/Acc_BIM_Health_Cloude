import { ACCService } from './accService';
import { ForgeService } from './forgeService';

// Singleton instances cache
const accServiceInstances = new Map<string, ACCService>();
const forgeServiceInstances = new Map<string, ForgeService>();

/**
 * Get or create a singleton ACCService instance for given credentials
 */
export function getACCService(clientId: string, clientSecret: string): ACCService {
  const key = `${clientId}:${clientSecret}`;
  
  if (!accServiceInstances.has(key)) {
    accServiceInstances.set(key, new ACCService(clientId, clientSecret));
  }
  
  return accServiceInstances.get(key)!;
}

/**
 * Get or create a singleton ForgeService instance for given credentials
 */
export function getForgeService(clientId?: string, clientSecret?: string): ForgeService {
  const key = `${clientId || 'default'}:${clientSecret || 'default'}`;
  
  if (!forgeServiceInstances.has(key)) {
    forgeServiceInstances.set(key, new ForgeService(clientId, clientSecret));
  }
  
  return forgeServiceInstances.get(key)!;
}

/**
 * Clear all cached service instances (useful for testing or credential updates)
 */
export function clearServiceInstances(): void {
  accServiceInstances.clear();
  forgeServiceInstances.clear();
}
