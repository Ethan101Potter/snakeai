import { Vector2D } from "../../types/common";
import { GameState, AgentState, Action } from "../../types";
import { ResourceTask } from "../resource/ResourceManager";

interface Task {
  id: string;
  type: TaskType;
  priority: number;
  status: TaskStatus;
  assignedAgent?: string;
  dependencies: string[];
  subtasks: string[];
  data: any;
  startTime?: number;
  deadline?: number;
  progress: number;
}

enum TaskType {
  COMBAT = "COMBAT",
  GATHER = "GATHER",
  TRADE = "TRADE",
  PATROL = "PATROL",
  ESCORT = "ESCORT",
  DEFEND = "DEFEND",
  CAPTURE = "CAPTURE"
}

enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private agentTasks: Map<string, string[]> = new Map();
  private readonly MAX_AGENT_TASKS = 3;

  constructor() {}

  createTask(
    type: TaskType,
    priority: number,
    data: any,
    dependencies: string[] = []
  ): Task {
    const task: Task = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      priority,
      status: TaskStatus.PENDING,
      dependencies,
      subtasks: [],
      data,
      progress: 0
    };

    this.tasks.set(task.id, task);
    return task;
  }

  assignTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    const agentTasks = this.agentTasks.get(agentId) || [];

    if (!task || 
        task.assignedAgent || 
        task.status !== TaskStatus.PENDING ||
        agentTasks.length >= this.MAX_AGENT_TASKS) {
      return false;
    }

    // Check dependencies
    if (!this.areDependenciesMet(task)) {
      return false;
    }

    task.assignedAgent = agentId;
    task.status = TaskStatus.IN_PROGRESS;
    task.startTime = Date.now();

    agentTasks.push(taskId);
    this.agentTasks.set(agentId, agentTasks);

    return true;
  }

  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      
      if (task.progress >= 100) {
        this.completeTask(taskId);
      }
    }
  }

  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = TaskStatus.COMPLETED;
    
    if (task.assignedAgent) {
      const agentTasks = this.agentTasks.get(task.assignedAgent) || [];
      const index = agentTasks.indexOf(taskId);
      if (index > -1) {
        agentTasks.splice(index, 1);
        this.agentTasks.set(task.assignedAgent, agentTasks);
      }
    }

    // Update dependent tasks
    this.tasks.forEach(t => {
      if (t.dependencies.includes(taskId)) {
        this.checkAndUpdateDependentTask(t);
      }
    });
  }

  private areDependenciesMet(task: Task): boolean {
    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && depTask.status === TaskStatus.COMPLETED;
    });
  }

  private checkAndUpdateDependentTask(task: Task): void {
    if (this.areDependenciesMet(task) && task.status === TaskStatus.PENDING) {
      // Task is ready to be assigned
      this.findSuitableAgent(task);
    }
  }

  private findSuitableAgent(task: Task): void {
    // Implementation depends on agent selection strategy
    // This is a placeholder for the agent selection logic
  }

  getAgentTasks(agentId: string): Task[] {
    const taskIds = this.agentTasks.get(agentId) || [];
    return taskIds
      .map(id => this.tasks.get(id))
      .filter((task): task is Task => task !== undefined)
      .sort((a, b) => b.priority - a.priority);
  }

  getPendingTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter(task => task.status === TaskStatus.PENDING)
      .sort((a, b) => b.priority - a.priority);
  }

  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = TaskStatus.CANCELLED;
    
    if (task.assignedAgent) {
      const agentTasks = this.agentTasks.get(task.assignedAgent) || [];
      const index = agentTasks.indexOf(taskId);
      if (index > -1) {
        agentTasks.splice(index, 1);
        this.agentTasks.set(task.assignedAgent, agentTasks);
      }
    }

    // Cancel dependent tasks
    this.tasks.forEach(t => {
      if (t.dependencies.includes(taskId)) {
        this.cancelTask(t.id);
      }
    });
  }
} 