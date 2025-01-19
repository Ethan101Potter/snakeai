import { GameState, Action } from "../../types";

export enum NodeStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  RUNNING = "RUNNING",
}

export interface BehaviorNode {
  execute(context: any): Promise<NodeStatus>;
}

export class Sequence implements BehaviorNode {
  constructor(private children: BehaviorNode[]) {}

  async execute(context: any): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.execute(context);
      if (status !== NodeStatus.SUCCESS) {
        return status;
      }
    }
    return NodeStatus.SUCCESS;
  }
}

export class Selector implements BehaviorNode {
  constructor(private children: BehaviorNode[]) {}

  async execute(context: any): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.execute(context);
      if (status === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }
    }
    return NodeStatus.FAILURE;
  }
}

export class Condition implements BehaviorNode {
  constructor(private predicate: (context: any) => Promise<boolean>) {}

  async execute(context: any): Promise<NodeStatus> {
    return (await this.predicate(context)) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class Action implements BehaviorNode {
  constructor(private action: (context: any) => Promise<boolean>) {}

  async execute(context: any): Promise<NodeStatus> {
    return (await this.action(context)) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class BehaviorTree {
  private root: BehaviorNode;

  constructor() {
    this.root = this.buildTree();
  }

  private buildTree(): BehaviorNode {
    return new Selector([
      // Combat behavior
      new Sequence([
        new Condition(async (context) => this.isInDanger(context)),
        new Selector([
          new Sequence([
            new Condition(async (context) => this.canFight(context)),
            new Action(async (context) => this.performAttack(context)),
          ]),
          new Action(async (context) => this.retreat(context)),
        ]),
      ]),

      // Resource gathering behavior
      new Sequence([
        new Condition(async (context) => this.needsResources(context)),
        new Selector([
          new Sequence([
            new Condition(async (context) => this.isResourceNearby(context)),
            new Action(async (context) => this.gatherResource(context)),
          ]),
          new Action(async (context) => this.searchForResources(context)),
        ]),
      ]),

      // Trading behavior
      new Sequence([
        new Condition(async (context) => this.hasTradeOpportunity(context)),
        new Action(async (context) => this.executeTrade(context)),
      ]),

      // Exploration behavior
      new Action(async (context) => this.explore(context)),
    ]);
  }

  async execute(context: any): Promise<Action> {
    await this.root.execute(context);
    return context.selectedAction;
  }

  private async isInDanger(context: any): Promise<boolean> {
    const { gameState, agentState } = context;
    return agentState.health < 50 || this.hasNearbyThreats(gameState, agentState);
  }

  private async canFight(context: any): Promise<boolean> {
    const { agentState } = context;
    return agentState.health > 30 && this.hasWeapon(agentState);
  }

  private async needsResources(context: any): Promise<boolean> {
    const { agentState } = context;
    return this.calculateResourceNeed(agentState) > 0.7;
  }

  private async hasTradeOpportunity(context: any): Promise<boolean> {
    const { gameState, marketAnalysis } = context;
    return marketAnalysis.opportunities.length > 0;
  }

  private hasNearbyThreats(gameState: GameState, agentState: any): boolean {
    // Implementation of threat detection
    return false;
  }

  private hasWeapon(agentState: any): boolean {
    // Implementation of weapon check
    return true;
  }

  private calculateResourceNeed(agentState: any): number {
    // Implementation of resource need calculation
    return 0;
  }

  private async performAttack(context: any): Promise<boolean> {
    context.selectedAction = {
      type: "ATTACK",
      payload: { targetId: context.nearestEnemy.id },
    };
    return true;
  }

  private async retreat(context: any): Promise<boolean> {
    context.selectedAction = {
      type: "MOVE",
      payload: this.calculateRetreatPosition(context),
    };
    return true;
  }

  private async gatherResource(context: any): Promise<boolean> {
    context.selectedAction = {
      type: "GATHER",
      payload: {
        resourceId: context.nearestResource.id,
        amount: 100,
      },
    };
    return true;
  }

  private async searchForResources(context: any): Promise<boolean> {
    context.selectedAction = {
      type: "MOVE",
      payload: this.findResourceLocation(context),
    };
    return true;
  }

  private async executeTrade(context: any): Promise<boolean> {
    const bestOpportunity = context.marketAnalysis.opportunities[0];
    context.selectedAction = {
      type: "TRADE",
      payload: {
        resourceType: bestOpportunity.resource,
        amount: bestOpportunity.amount,
        price: bestOpportunity.price,
      },
    };
    return true;
  }

  private async explore(context: any): Promise<boolean> {
    context.selectedAction = {
      type: "MOVE",
      payload: this.generateExplorationPoint(context),
    };
    return true;
  }

  private calculateRetreatPosition(context: any): { x: number; y: number } {
    // Implementation of retreat position calculation
    return { x: 0, y: 0 };
  }

  private findResourceLocation(context: any): { x: number; y: number } {
    // Implementation of resource location finding
    return { x: 0, y: 0 };
  }

  private generateExplorationPoint(context: any): { x: number; y: number } {
    // Implementation of exploration point generation
    return {
      x: Math.random() * 100,
      y: Math.random() * 100,
    };
  }
} 