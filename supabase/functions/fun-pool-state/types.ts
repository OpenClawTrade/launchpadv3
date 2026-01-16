export interface PoolState {
  priceSol: number;
  marketCapSol: number;
  holderCount: number;
  bondingProgress: number;
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  isGraduated: boolean;
  volume24h: number;
}

export interface MeteoraReserves {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
}
