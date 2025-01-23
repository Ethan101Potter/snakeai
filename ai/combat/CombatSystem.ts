import { Vector2D } from "../../types/common";
import { GameState, AgentState } from "../../types";
import { GameEventType, GameEventData } from "../../types/events";

interface WeaponStats {
  damage: number;
  range: number;
  accuracy: number;
  cooldown: number;
  energyCost: number;
}

interface DefenseStats {
  armor: number;
  shield: number;
  evasion: number;
  regeneration: number;
}

export interface CombatStats {
  weapons: Map<string, WeaponStats>;
  defense: DefenseStats;
  energy: number;
  maxEnergy: number;
  lastAttackTime: number;
}

export class CombatSystem {
  private readonly BASE_ACCURACY = 0.8;
  private readonly CRITICAL_MULTIPLIER = 1.5;
  private readonly EVASION_FACTOR = 0.5;
  private readonly ARMOR_REDUCTION = 0.05;
  private readonly MIN_DAMAGE = 1;

  calculateDamage(
    attacker: AgentState,
    defender: AgentState,
    weaponId: string
  ): number {
    const combat = attacker.combat as CombatStats;
    const weapon = combat.weapons.get(weaponId);
    
    if (!weapon || !this.canUseWeapon(combat, weapon)) {
      return 0;
    }

    const accuracy = this.calculateAccuracy(attacker, defender, weapon);
    if (!this.hitSuccessful(accuracy)) {
      return 0;
    }

    const baseDamage = weapon.damage;
    const critical = this.isCriticalHit(accuracy);
    const defenseReduction = this.calculateDefenseReduction(defender);
    
    let finalDamage = baseDamage * (critical ? this.CRITICAL_MULTIPLIER : 1);
    finalDamage *= (1 - defenseReduction);

    return Math.max(this.MIN_DAMAGE, Math.floor(finalDamage));
  }

  private canUseWeapon(combat: CombatStats, weapon: WeaponStats): boolean {
    const now = Date.now();
    const timeSinceLastAttack = now - combat.lastAttackTime;
    
    return timeSinceLastAttack >= weapon.cooldown && 
           combat.energy >= weapon.energyCost;
  }

  private calculateAccuracy(
    attacker: AgentState,
    defender: AgentState,
    weapon: WeaponStats
  ): number {
    const distance = this.getDistance(attacker.position!, defender.position!);
    const rangeModifier = 1 - Math.min(1, distance / weapon.range);
    
    const defenderCombat = defender.combat as CombatStats;
    const evasionModifier = 1 - (defenderCombat.defense.evasion * this.EVASION_FACTOR);
    
    return this.BASE_ACCURACY * weapon.accuracy * rangeModifier * evasionModifier;
  }

  private hitSuccessful(accuracy: number): boolean {
    return Math.random() <= accuracy;
  }

  private isCriticalHit(accuracy: number): boolean {
    return Math.random() <= accuracy * 0.2; // 20% of accuracy is crit chance
  }

  private calculateDefenseReduction(defender: AgentState): number {
    const combat = defender.combat as CombatStats;
    const totalDefense = combat.defense.armor + combat.defense.shield;
    return Math.min(0.8, totalDefense * this.ARMOR_REDUCTION);
  }

  private getDistance(a: Vector2D, b: Vector2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  updateCombatState(agent: AgentState, deltaTime: number): void {
    const combat = agent.combat as CombatStats;
    
    // Regenerate energy
    combat.energy = Math.min(
      combat.maxEnergy,
      combat.energy + (deltaTime / 1000) * 10
    );

    // Regenerate shield
    combat.defense.shield = Math.min(
      100,
      combat.defense.shield + (deltaTime / 1000) * combat.defense.regeneration
    );
  }

  generateCombatEvent(
    attackerId: string,
    targetId: string,
    damage: number,
    weaponId: string
  ): GameEvent {
    return {
      type: GameEventType.PLAYER_ATTACK,
      data: {
        attackerId,
        targetId,
        damage,
        weaponId
      } as GameEventData["PLAYER_ATTACK"],
      timestamp: Date.now()
    };
  }
} 