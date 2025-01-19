import { BaseAIModel } from "../BaseAIModel";
import { GameState, Action } from "../../types";
import * as tf from "@tensorflow/tfjs-node";

interface Experience {
  state: number[];
  action: number;
  reward: number;
  nextState: number[];
}

export class ReinforcementLearningModel extends BaseAIModel {
  private experiences: Experience[] = [];
  private readonly BATCH_SIZE = 32;
  private readonly MEMORY_SIZE = 10000;
  private readonly GAMMA = 0.99;
  private readonly STATE_SIZE = 20;
  private readonly ACTION_SIZE = 4;

  protected async createModel(): Promise<void> {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 64,
          activation: "relu",
          inputShape: [this.STATE_SIZE],
        }),
        tf.layers.dense({
          units: 32,
          activation: "relu",
        }),
        tf.layers.dense({
          units: this.ACTION_SIZE,
          activation: "linear",
        }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(this.config.parameters.learningRate),
      loss: "meanSquaredError",
    });
  }

  async predict(state: GameState): Promise<number[]> {
    const processedState = this.preprocessState(state);
    const stateTensor = tf.tensor2d([processedState], [1, this.STATE_SIZE]);
    const prediction = this.model.predict(stateTensor) as tf.Tensor;
    return Array.from(prediction.dataSync());
  }

  async train(experiences: Experience[]): Promise<void> {
    if (experiences.length < this.BATCH_SIZE) return;

    const batch = this.sampleBatch(experiences);
    const states = tf.tensor2d(
      batch.map((exp) => exp.state),
      [this.BATCH_SIZE, this.STATE_SIZE]
    );
    const nextStates = tf.tensor2d(
      batch.map((exp) => exp.nextState),
      [this.BATCH_SIZE, this.STATE_SIZE]
    );

    const currentQs = this.model.predict(states) as tf.Tensor;
    const nextQs = this.model.predict(nextStates) as tf.Tensor;

    const updatedQs = currentQs.arraySync();
    
    batch.forEach((exp, index) => {
      const nextQ = Math.max(...(nextQs.arraySync()[index] as number[]));
      updatedQs[index][exp.action] = exp.reward + this.GAMMA * nextQ;
    });

    await this.model.fit(states, tf.tensor2d(updatedQs), {
      epochs: 1,
      verbose: 0,
    });

    states.dispose();
    nextStates.dispose();
    currentQs.dispose();
    nextQs.dispose();
  }

  addExperience(
    state: GameState,
    action: Action,
    reward: number,
    nextState: GameState
  ): void {
    const experience: Experience = {
      state: this.preprocessState(state),
      action: this.actionToIndex(action),
      reward,
      nextState: this.preprocessState(nextState),
    };

    this.experiences.push(experience);
    if (this.experiences.length > this.MEMORY_SIZE) {
      this.experiences.shift();
    }
  }

  private preprocessState(state: GameState): number[] {
    // Convert game state to normalized feature vector
    const features = [
      state.timestamp / 1000000000,
      state.players.size / 100,
      // Add more relevant features...
    ];

    // Pad or truncate to STATE_SIZE
    while (features.length < this.STATE_SIZE) {
      features.push(0);
    }
    return features.slice(0, this.STATE_SIZE);
  }

  private actionToIndex(action: Action): number {
    const actionMap: { [key: string]: number } = {
      MOVE: 0,
      ATTACK: 1,
      GATHER: 2,
      TRADE: 3,
    };
    return actionMap[action.type] || 0;
  }

  private sampleBatch(experiences: Experience[]): Experience[] {
    const batch: Experience[] = [];
    for (let i = 0; i < this.BATCH_SIZE; i++) {
      const randomIndex = Math.floor(Math.random() * experiences.length);
      batch.push(experiences[randomIndex]);
    }
    return batch;
  }
} 