export interface Vector2D {
  x: number;
  y: number;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface GameMap {
  width: number;
  height: number;
  obstacles: Obstacle[];
  spawnPoints: Vector2D[];
  resources: ResourcePoint[];
}

export interface ResourcePoint {
  id: string;
  position: Vector2D;
  type: string;
  amount: number;
  respawnTime?: number;
}

export interface Territory {
  id: string;
  position: Vector2D;
  radius: number;
  controller?: string;
  contestedBy?: string[];
  captureProgress?: number;
} 