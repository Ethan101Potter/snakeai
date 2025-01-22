import { AIAgent } from "./AIAgent";
import { GameState, AgentType, Action, GameEvent } from "../types";
import { GameEventType, GameEventData } from "../types/events";
import { EventManager } from "../core/EventManager";
import { DatabaseManager } from "../db/DatabaseManager";
import { Vector2D } from "../types/common";
import { MarketAnalyzer } from "./analysis/MarketAnalyzer";
import { EventAnalyzer } from "./analysis/EventAnalyzer";

interface AgentLocation {
  position: Vector2D;
  lastUpdate: number;
}

export class AIAgentManager {
  private agents: Map<string, AIAgent> = new Map();
  private agentLocations: Map<string, AgentLocation> = new Map();
  private eventManager: EventManager;
  private db: DatabaseManager;
  private marketAnalyzer: MarketAnalyzer;
  private eventAnalyzer: EventAnalyzer;
  private lastUpdate: number = 0;
  private readonly UPDATE_INTERVAL = 1000;
  private readonly LOCATION_UPDATE_INTERVAL = 5000;

  constructor(eventManager: EventManager) {
    this.eventManager = eventManager;
    this.db = DatabaseManager.getInstance();
    this.marketAnalyzer = new MarketAnalyzer();
    this.eventAnalyzer = new EventAnalyzer();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventManager.subscribe(GameEventType.PLAYER_ATTACK, 
      (event: GameEvent & { data: GameEventData["PLAYER_ATTACK"] }) => {
        this.handleCombatEvent(event);
    });

    this.eventManager.subscribe(GameEventType.MARKET_CHANGE,
      (event: GameEvent & { data: GameEventData["MARKET_CHANGE"] }) => {
        this.handleMarketEvent(event);
    });

    this.eventManager.subscribe(GameEventType.RESOURCE_CHANGE,
      (event: GameEvent & { data: GameEventData["RESOURCE_CHANGE"] }) => {
        this.handleResourceEvent(event);
    });

    this.eventManager.subscribe(GameEventType.TERRITORY_CONTROL,
      (event: GameEvent & { data: GameEventData["TERRITORY_CONTROL"] }) => {
        this.handleTerritoryEvent(event);
    });
  }

  private subscribeToAgentEvents(agent: AIAgent): void {
    this.eventManager.subscribe(`AGENT_${agent.id}_UPDATE`, 
      (event: GameEvent) => {
        this.handleAgentUpdate(agent.id, event);
    });
  }

  async addAgent(agent: AIAgent, initialPosition?: Vector2D): Promise<void> {
    this.agents.set(agent.id, agent);
    
    if (initialPosition) {
      this.agentLocations.set(agent.id, {
        position: initialPosition,
        lastUpdate: Date.now()
      });
      agent.state.position = initialPosition;
    }

    // Initialize agent's knowledge base
    await this.initializeAgentKnowledge(agent);
    
    // Store agent in database
    await this.db.getRepository("Agent").save({
      id: agent.id,
      type: agent.type,
      state: agent.state,
      modelConfig: (agent as any).aiModel?.config
    });

    this.subscribeToAgentEvents(agent);
  }

  private async initializeAgentKnowledge(agent: AIAgent): Promise<void> {
    // Initialize market knowledge
    if (agent.type === AgentType.TRADER) {
      agent.state.marketKnowledge = {
        priceHistory: new Map(),
        tradingVolume: new Map(),
        lastTrades: [],
      };
    }

    // Initialize combat knowledge
    if (agent.type === AgentType.NPC) {
      agent.state.combatKnowledge = {
        knownThreats: new Set(),
        battleHistory: [],
        combatStyle: this.determineCombatStyle(agent),
      };
    }

    // Initialize resource knowledge
    if (agent.type === AgentType.RESOURCE_MANAGER) {
      agent.state.resourceKnowledge = {
        resourceLocations: new Map(),
        gatheringEfficiency: new Map(),
        resourcePriorities: this.calculateResourcePriorities(),
      };
    }
  }

  async updateAgents(gameState: GameState): Promise<Map<string, Action>> {
    const currentTime = Date.now();
    if (currentTime - this.lastUpdate < this.UPDATE_INTERVAL) {
      return new Map();
    }

    // Update global market analysis
    const marketTrends = await this.marketAnalyzer.predictTrends(
      gameState.marketHistory || [],
      gameState.marketPrices || new Map()
    );

    // Analyze recent events
    const eventImpacts = this.eventAnalyzer.analyzeRecentEvents(
      gameState.recentEvents || []
    );

    const actions = new Map<string, Action>();
    const updatePromises: Promise<void>[] = [];

    for (const agent of this.agents.values()) {
      updatePromises.push(
        this.updateSingleAgent(agent, gameState, marketTrends, eventImpacts)
          .then(action => {
            if (action) {
              actions.set(agent.id, action);
            }
          })
          .catch(error => {
            console.error(`Failed to update agent ${agent.id}:`, error);
          })
      );
    }

    await Promise.all(updatePromises);
    this.lastUpdate = currentTime;
    
    // Update agent locations
    this.updateAgentLocations(actions);
    
    return actions;
  }

  private async updateSingleAgent(
    agent: AIAgent,
    gameState: GameState,
    marketTrends: any,
    eventImpacts: any
  ): Promise<Action | null> {
    // Update agent's knowledge based on their type
    await this.updateAgentKnowledge(agent, gameState, marketTrends, eventImpacts);

    // Get agent's decision
    const action = await agent.decide(gameState);

    // Validate and optimize action
    const optimizedAction = this.optimizeAction(action, agent, gameState);

    // Update agent state in database
    await this.db.getRepository("Agent").update(
      agent.id,
      { state: agent.state }
    );

    return optimizedAction;
  }

  private optimizeAction(action: Action, agent: AIAgent, gameState: GameState): Action {
    switch (action.type) {
      case "MOVE":
        return this.optimizeMovement(action, agent, gameState);
      case "ATTACK":
        return this.optimizeCombat(action, agent, gameState);
      case "TRADE":
        return this.optimizeTrade(action, agent, gameState);
      default:
        return action;
    }
  }

  private optimizeMovement(action: Action, agent: AIAgent, gameState: GameState): Action {
    const target = action.payload;
    const currentPos = agent.state.position;
    
    // Check for obstacles and adjust path
    const adjustedPath = this.pathfinding(currentPos, target, gameState);
    
    // Limit movement speed based on agent type
    const maxSpeed = this.getAgentMaxSpeed(agent);
    const optimizedTarget = this.limitMovementSpeed(currentPos, adjustedPath[0], maxSpeed);

    return {
      ...action,
      payload: optimizedTarget
    };
  }

  private pathfinding(start: Vector2D, end: Vector2D, gameState: GameState): Vector2D[] {
    // Implement A* pathfinding algorithm
    // This is a simplified version
    return [end];
  }

  private getAgentMaxSpeed(agent: AIAgent): number {
    switch (agent.type) {
      case AgentType.NPC:
        return 5;
      case AgentType.TRADER:
        return 3;
      case AgentType.RESOURCE_MANAGER:
        return 4;
      default:
        return 4;
    }
  }

  private limitMovementSpeed(
    current: Vector2D,
    target: Vector2D,
    maxSpeed: number
  ): Vector2D {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= maxSpeed) return target;
    
    const ratio = maxSpeed / distance;
    return {
      x: current.x + dx * ratio,
      y: current.y + dy * ratio
    };
  }

  getAgent(id: string): AIAgent | undefined {
    return this.agents.get(id);
  }

  async removeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      this.agents.delete(id);
      await this.db.getRepository("Agent").delete(id);
    }
  }

  private async handleCombatEvent(event: any): Promise<void> {
    const affectedAgents = Array.from(this.agents.values()).filter(
      agent => this.isAgentAffectedByCombat(agent, event)
    );

    for (const agent of affectedAgents) {
      await this.updateAgentCombatBehavior(agent, event);
    }
  }

  private async handleMarketEvent(event: any): Promise<void> {
    const tradingAgents = Array.from(this.agents.values()).filter(
      agent => agent.type === AgentType.TRADER
    );

    for (const agent of tradingAgents) {
      await this.updateAgentTradingStrategy(agent, event);
    }
  }

  private async handleResourceEvent(event: any): Promise<void> {
    const resourceManagers = Array.from(this.agents.values()).filter(
      agent => agent.type === AgentType.RESOURCE_MANAGER
    );

    for (const agent of resourceManagers) {
      await this.updateAgentResourceStrategy(agent, event);
    }
  }

  private async handleAgentUpdate(agentId: string, event: any): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.update(event);
      await this.db.getRepository("Agent").update(
        agentId,
        { state: agent.state }
      );
    }
  }

  private isAgentAffectedByCombat(agent: AIAgent, event: any): boolean {
    return (
      event.data.targetId === agent.id ||
      event.data.attackerId === agent.id ||
      this.isAgentInRange(agent, event.data.location, 50) // 50 units combat awareness range
    );
  }

  private isAgentInRange(agent: AIAgent, location: any, range: number): boolean {
    if (!agent.state.position || !location) return false;
    
    const dx = agent.state.position.x - location.x;
    const dy = agent.state.position.y - location.y;
    return Math.sqrt(dx * dx + dy * dy) <= range;
  }

  private async updateAgentCombatBehavior(agent: AIAgent, event: any): Promise<void> {
    // Update agent's combat-related behavior and state
    if (agent.state.health && event.data.damage) {
      agent.state.health = Math.max(0, agent.state.health - event.data.damage);
    }
  }

  private async updateAgentTradingStrategy(agent: AIAgent, event: any): Promise<void> {
    // Update agent's trading strategy based on market changes
    if (agent.state.marketPrices) {
      agent.state.marketPrices.set(event.data.resourceType, event.data.price);
    }
  }

  private async updateAgentResourceStrategy(agent: AIAgent, event: any): Promise<void> {
    // Update agent's resource management strategy
    if (agent.state.resources) {
      const currentAmount = agent.state.resources.get(event.data.resourceType) || 0;
      agent.state.resources.set(
        event.data.resourceType,
        currentAmount + event.data.amount
      );
    }
  }
} 