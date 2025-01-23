import { Vector2D } from "../../types/common";
import { GameState } from "../../types";

interface Node {
  x: number;
  y: number;
  f: number;
  g: number;
  h: number;
  parent?: Node;
  walkable: boolean;
}

interface GridOptions {
  width: number;
  height: number;
  nodeSize: number;
}

export class PathFinder {
  private grid: Node[][];
  private openList: Node[];
  private closedList: Node[];
  private readonly DIAGONAL_COST = 1.4;
  private readonly STRAIGHT_COST = 1.0;

  constructor(private options: GridOptions) {
    this.initializeGrid();
  }

  private initializeGrid(): void {
    this.grid = [];
    for (let x = 0; x < this.options.width; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.options.height; y++) {
        this.grid[x][y] = {
          x,
          y,
          f: 0,
          g: 0,
          h: 0,
          walkable: true
        };
      }
    }
  }

  updateObstacles(gameState: GameState): void {
    // Reset grid
    this.initializeGrid();

    // Mark obstacles
    gameState.obstacles?.forEach(obstacle => {
      const gridX = Math.floor(obstacle.x / this.options.nodeSize);
      const gridY = Math.floor(obstacle.y / this.options.nodeSize);
      if (this.isValidPosition(gridX, gridY)) {
        this.grid[gridX][gridY].walkable = false;
      }
    });

    // Mark other agents as obstacles
    gameState.players.forEach((state, id) => {
      if (state.position) {
        const gridX = Math.floor(state.position.x / this.options.nodeSize);
        const gridY = Math.floor(state.position.y / this.options.nodeSize);
        if (this.isValidPosition(gridX, gridY)) {
          this.grid[gridX][gridY].walkable = false;
        }
      }
    });
  }

  findPath(start: Vector2D, end: Vector2D): Vector2D[] {
    const startNode = this.getNodeFromWorldPosition(start);
    const endNode = this.getNodeFromWorldPosition(end);

    if (!startNode || !endNode || !startNode.walkable || !endNode.walkable) {
      return this.findAlternativePath(start, end);
    }

    this.openList = [startNode];
    this.closedList = [];

    for (let x = 0; x < this.options.width; x++) {
      for (let y = 0; y < this.options.height; y++) {
        const node = this.grid[x][y];
        node.f = 0;
        node.g = 0;
        node.h = 0;
        node.parent = undefined;
      }
    }

    while (this.openList.length > 0) {
      const currentNode = this.getLowestFCostNode();
      if (currentNode === endNode) {
        return this.retracePath(startNode, endNode);
      }

      this.openList = this.openList.filter(node => node !== currentNode);
      this.closedList.push(currentNode);

      const neighbors = this.getNeighbors(currentNode);
      for (const neighbor of neighbors) {
        if (!neighbor.walkable || this.closedList.includes(neighbor)) {
          continue;
        }

        const newCostToNeighbor = currentNode.g + this.getDistance(currentNode, neighbor);
        if (newCostToNeighbor < neighbor.g || !this.openList.includes(neighbor)) {
          neighbor.g = newCostToNeighbor;
          neighbor.h = this.getDistance(neighbor, endNode);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = currentNode;

          if (!this.openList.includes(neighbor)) {
            this.openList.push(neighbor);
          }
        }
      }
    }

    return this.findAlternativePath(start, end);
  }

  private findAlternativePath(start: Vector2D, end: Vector2D): Vector2D[] {
    // Implement RRT (Rapidly-exploring Random Trees) as fallback
    const path: Vector2D[] = [];
    const maxIterations = 100;
    let currentPos = { ...start };

    for (let i = 0; i < maxIterations; i++) {
      const randomPoint = this.getRandomPoint();
      const direction = this.normalizeVector({
        x: randomPoint.x - currentPos.x,
        y: randomPoint.y - currentPos.y
      });

      const nextPos = {
        x: currentPos.x + direction.x * 5,
        y: currentPos.y + direction.y * 5
      };

      if (this.isValidWorldPosition(nextPos)) {
        path.push(nextPos);
        currentPos = nextPos;

        if (this.getDistance(currentPos, end) < 10) {
          path.push(end);
          break;
        }
      }
    }

    return this.smoothPath(path);
  }

  private smoothPath(path: Vector2D[]): Vector2D[] {
    if (path.length <= 2) return path;

    const smoothed: Vector2D[] = [path[0]];
    let currentIndex = 0;

    while (currentIndex < path.length - 1) {
      let furthestVisible = currentIndex + 1;
      
      for (let i = currentIndex + 2; i < path.length; i++) {
        if (this.hasLineOfSight(path[currentIndex], path[i])) {
          furthestVisible = i;
        }
      }

      smoothed.push(path[furthestVisible]);
      currentIndex = furthestVisible;
    }

    return smoothed;
  }

  private hasLineOfSight(start: Vector2D, end: Vector2D): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / (this.options.nodeSize / 2));

    for (let i = 1; i < steps; i++) {
      const point = {
        x: start.x + (dx * i) / steps,
        y: start.y + (dy * i) / steps
      };

      const node = this.getNodeFromWorldPosition(point);
      if (!node || !node.walkable) {
        return false;
      }
    }

    return true;
  }

  private getNodeFromWorldPosition(position: Vector2D): Node | null {
    const gridX = Math.floor(position.x / this.options.nodeSize);
    const gridY = Math.floor(position.y / this.options.nodeSize);
    
    return this.isValidPosition(gridX, gridY) ? this.grid[gridX][gridY] : null;
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.options.width && y >= 0 && y < this.options.height;
  }

  private isValidWorldPosition(position: Vector2D): boolean {
    const node = this.getNodeFromWorldPosition(position);
    return node !== null && node.walkable;
  }

  private getLowestFCostNode(): Node {
    return this.openList.reduce((lowest, node) => 
      node.f < lowest.f ? node : lowest
    );
  }

  private getNeighbors(node: Node): Node[] {
    const neighbors: Node[] = [];
    
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        if (x === 0 && y === 0) continue;

        const checkX = node.x + x;
        const checkY = node.y + y;

        if (this.isValidPosition(checkX, checkY)) {
          neighbors.push(this.grid[checkX][checkY]);
        }
      }
    }

    return neighbors;
  }

  private getDistance(nodeA: Node, nodeB: Node): number {
    const distX = Math.abs(nodeA.x - nodeB.x);
    const distY = Math.abs(nodeA.y - nodeB.y);

    if (distX > distY) {
      return this.DIAGONAL_COST * distY + this.STRAIGHT_COST * (distX - distY);
    }
    return this.DIAGONAL_COST * distX + this.STRAIGHT_COST * (distY - distX);
  }

  private getRandomPoint(): Vector2D {
    return {
      x: Math.random() * this.options.width * this.options.nodeSize,
      y: Math.random() * this.options.height * this.options.nodeSize
    };
  }

  private normalizeVector(vector: Vector2D): Vector2D {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  private retracePath(startNode: Node, endNode: Node): Vector2D[] {
    const path: Vector2D[] = [];
    let currentNode: Node | undefined = endNode;

    while (currentNode && currentNode !== startNode) {
      path.push(this.getWorldPositionFromNode(currentNode));
      currentNode = currentNode.parent;
    }

    path.push(this.getWorldPositionFromNode(startNode));
    return path.reverse();
  }

  private getWorldPositionFromNode(node: Node): Vector2D {
    return {
      x: (node.x + 0.5) * this.options.nodeSize,
      y: (node.y + 0.5) * this.options.nodeSize
    };
  }
} 