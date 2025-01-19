import { GameEvent, GameEventType, GameEventData } from "../../types/events";

interface EventImpact {
  type: GameEventType;
  severity: number;
  urgency: number;
  opportunity: number;
}

export class EventAnalyzer {
  private readonly ANALYSIS_WINDOW = 1000 * 60 * 5; // 5 minutes
  private readonly SEVERITY_WEIGHTS = {
    [GameEventType.PLAYER_ATTACK]: 0.8,
    [GameEventType.MARKET_CHANGE]: 0.6,
    [GameEventType.RESOURCE_CHANGE]: 0.4,
    [GameEventType.TERRITORY_CONTROL]: 0.7,
    [GameEventType.BATTLE_START]: 0.9,
    [GameEventType.BATTLE_END]: 0.5,
  };

  analyzeRecentEvents(events: GameEvent[]): EventImpact[] {
    const currentTime = Date.now();
    const recentEvents = events.filter(
      (event) => currentTime - event.timestamp < this.ANALYSIS_WINDOW
    );

    return recentEvents.map((event) => this.analyzeEvent(event));
  }

  private analyzeEvent(event: GameEvent): EventImpact {
    const baseWeight = this.SEVERITY_WEIGHTS[event.type as GameEventType] || 0.3;

    switch (event.type as GameEventType) {
      case GameEventType.PLAYER_ATTACK:
        return this.analyzeAttackEvent(event.data as GameEventData["PLAYER_ATTACK"], baseWeight);
      
      case GameEventType.MARKET_CHANGE:
        return this.analyzeMarketEvent(event.data as GameEventData["MARKET_CHANGE"], baseWeight);
      
      case GameEventType.RESOURCE_CHANGE:
        return this.analyzeResourceEvent(event.data as GameEventData["RESOURCE_CHANGE"], baseWeight);
      
      case GameEventType.TERRITORY_CONTROL:
        return this.analyzeTerritoryEvent(event.data as GameEventData["TERRITORY_CONTROL"], baseWeight);
      
      default:
        return {
          type: event.type as GameEventType,
          severity: baseWeight,
          urgency: 0.3,
          opportunity: 0.2,
        };
    }
  }

  private analyzeAttackEvent(
    data: GameEventData["PLAYER_ATTACK"],
    baseWeight: number
  ): EventImpact {
    return {
      type: GameEventType.PLAYER_ATTACK,
      severity: baseWeight * (data.damage / 100),
      urgency: 0.8,
      opportunity: 0.4,
    };
  }

  private analyzeMarketEvent(
    data: GameEventData["MARKET_CHANGE"],
    baseWeight: number
  ): EventImpact {
    const priceChangeImpact = data.trend === "up" ? 0.6 : 0.4;
    
    return {
      type: GameEventType.MARKET_CHANGE,
      severity: baseWeight,
      urgency: 0.5,
      opportunity: data.trend === "up" ? 0.8 : 0.3,
    };
  }

  private analyzeResourceEvent(
    data: GameEventData["RESOURCE_CHANGE"],
    baseWeight: number
  ): EventImpact {
    return {
      type: GameEventType.RESOURCE_CHANGE,
      severity: baseWeight * Math.abs(data.amount) / 1000,
      urgency: 0.4,
      opportunity: data.amount > 0 ? 0.7 : 0.3,
    };
  }

  private analyzeTerritoryEvent(
    data: GameEventData["TERRITORY_CONTROL"],
    baseWeight: number
  ): EventImpact {
    return {
      type: GameEventType.TERRITORY_CONTROL,
      severity: baseWeight,
      urgency: 0.6,
      opportunity: 0.7,
    };
  }

  private calculateEventRecency(timestamp: number): number {
    const age = Date.now() - timestamp;
    return Math.max(0, 1 - age / this.ANALYSIS_WINDOW);
  }
} 