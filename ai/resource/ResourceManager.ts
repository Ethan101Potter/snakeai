import { ResourcePoint, Vector2D } from "../../types/common";
import { GameState, AgentState } from "../../types";

export interface ResourceTask {
  id: string;
  resourceId: string;
  type: "GATHER" | "TRANSPORT" | "TRADE";
  priority: number;
  assignedAgent?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  startTime: number;
  deadline?: number;
}

interface ResourceAllocation {
  resourceId: string;
  amount: number;
  allocatedTo: string;
  purpose: string;
  timestamp: number;
}

export class ResourceManager {
  private tasks: Map<string, ResourceTask> = new Map();
  private allocations: Map<string, ResourceAllocation[]> = new Map();
  private resourceStates: Map<string, {
    available: number;
    reserved: number;
    lastUpdate: number;
  }> = new Map();

  constructor(private readonly MIN_RESOURCE_THRESHOLD = 100) {}

  analyzeSituation(gameState: GameState): void {
    this.updateResourceStates(gameState);
    this.generateTasks(gameState);
    this.optimizeAllocations();
  }

  assignTask(agentId: string, task: ResourceTask): boolean {
    if (task.assignedAgent || task.status !== "PENDING") {
      return false;
    }

    const allocation = this.allocateResources(task.resourceId, agentId, task.type);
    if (!allocation) {
      return false;
    }

    task.assignedAgent = agentId;
    task.status = "IN_PROGRESS";
    task.startTime = Date.now();
    this.tasks.set(task.id, task);

    return true;
  }

  private updateResourceStates(gameState: GameState): void {
    if (!gameState.resources) return;

    for (const [id, resource] of gameState.resources.entries()) {
      const current = this.resourceStates.get(id) || {
        available: 0,
        reserved: 0,
        lastUpdate: 0
      };

      this.resourceStates.set(id, {
        available: resource - current.reserved,
        reserved: current.reserved,
        lastUpdate: Date.now()
      });
    }
  }

  private generateTasks(gameState: GameState): void {
    this.resourceStates.forEach((state, resourceId) => {
      if (state.available < this.MIN_RESOURCE_THRESHOLD) {
        this.createGatheringTask(resourceId, gameState);
      }
    });

    this.identifyTradingOpportunities(gameState);
  }

  private createGatheringTask(resourceId: string, gameState: GameState): void {
    if (!gameState.resources?.has(resourceId)) return;

    const task: ResourceTask = {
      id: `gather_${resourceId}_${Date.now()}`,
      resourceId,
      type: "GATHER",
      priority: this.calculateGatheringPriority(resourceId),
      status: "PENDING",
      startTime: Date.now()
    };

    this.tasks.set(task.id, task);
  }

  private calculateGatheringPriority(resourceId: string): number {
    const state = this.resourceStates.get(resourceId);
    if (!state) return 0;

    const scarcityFactor = 1 - (state.available / this.MIN_RESOURCE_THRESHOLD);
    return Math.min(100, scarcityFactor * 50);
  }

  private identifyTradingOpportunities(gameState: GameState): void {
    this.resourceStates.forEach((state, resourceId) => {
      if (state.available > this.MIN_RESOURCE_THRESHOLD * 2) {
        this.createTradingTask(resourceId, gameState);
      }
    });
  }

  private createTradingTask(resourceId: string, gameState: GameState): void {
    const task: ResourceTask = {
      id: `trade_${resourceId}_${Date.now()}`,
      resourceId,
      type: "TRADE",
      priority: this.calculateTradingPriority(resourceId),
      status: "PENDING",
      startTime: Date.now()
    };

    this.tasks.set(task.id, task);
  }

  private calculateTradingPriority(resourceId: string): number {
    const state = this.resourceStates.get(resourceId);
    if (!state) return 0;

    const surplusFactor = Math.max(0, (state.available - this.MIN_RESOURCE_THRESHOLD) / this.MIN_RESOURCE_THRESHOLD);
    return Math.min(100, surplusFactor * 30);
  }

  private optimizeAllocations(): void {
    const now = Date.now();
    this.allocations.forEach((allocs, resourceId) => {
      const validAllocs = allocs.filter(a => now - a.timestamp < 300000);
      if (validAllocs.length !== allocs.length) {
        this.allocations.set(resourceId, validAllocs);
        this.updateReservedAmount(resourceId);
      }
    });
  }

  private updateReservedAmount(resourceId: string): void {
    const allocs = this.allocations.get(resourceId) || [];
    const totalReserved = allocs.reduce((sum, a) => sum + a.amount, 0);
    
    const state = this.resourceStates.get(resourceId);
    if (state) {
      state.reserved = totalReserved;
      this.resourceStates.set(resourceId, state);
    }
  }

  private allocateResources(
    resourceId: string,
    agentId: string,
    purpose: string
  ): ResourceAllocation | null {
    const state = this.resourceStates.get(resourceId);
    if (!state || state.available <= 0) {
      return null;
    }

    const allocation: ResourceAllocation = {
      resourceId,
      amount: Math.min(state.available, 100),
      allocatedTo: agentId,
      purpose,
      timestamp: Date.now()
    };

    const allocs = this.allocations.get(resourceId) || [];
    allocs.push(allocation);
    this.allocations.set(resourceId, allocs);
    this.updateReservedAmount(resourceId);

    return allocation;
  }
} 