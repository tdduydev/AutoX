/**
 * @xclaw-ai/ml — Core types for ML/AutoML engine.
 */

// ─── Dataset Types ──────────────────────────────────────────

export type DataType = 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean' | 'id';

export interface ColumnSchema {
  name: string;
  dataType: DataType;
  nullable: boolean;
  unique: number;
  missing: number;
  /** For numeric: min, max, mean, std */
  stats?: NumericStats;
  /** For categorical: top categories */
  topValues?: Array<{ value: string; count: number }>;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  q25: number;
  q75: number;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnSchema[];
  memoryUsageMB: number;
  duplicateRows: number;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  /** Source format: csv, json, parquet, database */
  source: 'csv' | 'json' | 'parquet' | 'database' | 'api';
  /** Column-oriented data */
  columns: string[];
  rows: unknown[][];
  profile?: DatasetProfile;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface DataSplit {
  train: { rows: unknown[][]; indices: number[] };
  test: { rows: unknown[][]; indices: number[] };
  validation?: { rows: unknown[][]; indices: number[] };
  /** Ratio used, e.g. [0.7, 0.2, 0.1] */
  ratios: number[];
}

// ─── Feature Engineering ────────────────────────────────────

export type FeatureTransform =
  | { type: 'normalize'; method: 'min-max' | 'z-score' | 'robust' }
  | { type: 'encode'; method: 'one-hot' | 'label' | 'target' | 'ordinal' }
  | { type: 'impute'; method: 'mean' | 'median' | 'mode' | 'constant'; value?: unknown }
  | { type: 'bin'; bins: number; method: 'equal-width' | 'equal-frequency' | 'kmeans' }
  | { type: 'log' }
  | { type: 'polynomial'; degree: number }
  | { type: 'interaction'; columns: string[] }
  | { type: 'drop' }
  | { type: 'custom'; fn: string };

export interface FeaturePipeline {
  id: string;
  name: string;
  transforms: Array<{
    column: string;
    transform: FeatureTransform;
  }>;
  targetColumn: string;
  createdAt: Date;
}

// ─── Model Types ────────────────────────────────────────────

export type TaskType =
  | 'classification'
  | 'regression'
  | 'clustering'
  | 'anomaly-detection'
  | 'time-series'
  | 'recommendation'
  | 'nlp-classification'
  | 'nlp-generation';

export type AlgorithmFamily =
  | 'linear'
  | 'tree'
  | 'ensemble'
  | 'svm'
  | 'knn'
  | 'naive-bayes'
  | 'neural-network'
  | 'clustering'
  | 'dimensionality-reduction';

export interface Algorithm {
  id: string;
  name: string;
  family: AlgorithmFamily;
  supportedTasks: TaskType[];
  hyperparameters: HyperparameterDef[];
  description: string;
}

export interface HyperparameterDef {
  name: string;
  type: 'int' | 'float' | 'categorical' | 'boolean';
  default: unknown;
  min?: number;
  max?: number;
  choices?: unknown[];
  description: string;
}

export interface Hyperparameters {
  [key: string]: unknown;
}

// ─── Model Metrics ──────────────────────────────────────────

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc?: number;
  confusionMatrix?: number[][];
  classReport?: Record<string, { precision: number; recall: number; f1: number; support: number }>;
}

export interface RegressionMetrics {
  mse: number;
  rmse: number;
  mae: number;
  r2: number;
  mape?: number;
  medianAbsoluteError?: number;
}

export interface ClusteringMetrics {
  silhouetteScore: number;
  daviesBouldinIndex?: number;
  calinskiHarabaszIndex?: number;
  inertia?: number;
  nClusters: number;
}

export type ModelMetrics = ClassificationMetrics | RegressionMetrics | ClusteringMetrics;

// ─── Trained Model ──────────────────────────────────────────

export type ModelStatus = 'training' | 'trained' | 'failed' | 'deployed' | 'archived';

export interface TrainedModel {
  id: string;
  name: string;
  taskType: TaskType;
  algorithmId: string;
  algorithmName: string;
  hyperparameters: Hyperparameters;
  metrics: ModelMetrics;
  featurePipelineId?: string;
  datasetId: string;
  status: ModelStatus;
  /** Serialized model weights/params (base64 or path) */
  artifactPath?: string;
  featureImportance?: Array<{ feature: string; importance: number }>;
  trainingDurationMs: number;
  trainedAt: Date;
  version: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ─── AutoML Pipeline ────────────────────────────────────────

export type AutoMLStrategy = 'grid-search' | 'random-search' | 'bayesian' | 'evolutionary';

export interface AutoMLConfig {
  /** Task to optimize for */
  taskType: TaskType;
  /** Target column name */
  targetColumn: string;
  /** Which metric to optimize */
  optimizeMetric: string;
  /** Max number of model trials */
  maxTrials: number;
  /** Max training time in seconds */
  maxTimeSec: number;
  /** Algorithms to consider (empty = all applicable) */
  algorithms?: string[];
  /** Search strategy */
  strategy: AutoMLStrategy;
  /** Cross-validation folds */
  cvFolds: number;
  /** Whether to auto-engineer features */
  autoFeatureEngineering: boolean;
  /** Train/test split ratio */
  trainTestSplit: number;
}

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AutoMLTrial {
  trialNumber: number;
  algorithmId: string;
  hyperparameters: Hyperparameters;
  metrics: ModelMetrics;
  durationMs: number;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
}

export interface AutoMLPipeline {
  id: string;
  name: string;
  datasetId: string;
  config: AutoMLConfig;
  status: PipelineStatus;
  trials: AutoMLTrial[];
  bestTrialIndex?: number;
  bestModelId?: string;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  logs: string[];
}

// ─── Prediction ─────────────────────────────────────────────

export interface PredictionRequest {
  modelId: string;
  input: Record<string, unknown> | Record<string, unknown>[];
  /** Return prediction probabilities for classification */
  returnProbabilities?: boolean;
}

export interface PredictionResult {
  modelId: string;
  predictions: unknown[];
  probabilities?: Record<string, number>[];
  latencyMs: number;
}

// ─── ML Engine Interface ────────────────────────────────────

export interface MLEngineEvents {
  'pipeline:started': (pipeline: AutoMLPipeline) => void;
  'pipeline:progress': (pipelineId: string, progress: number, trial?: AutoMLTrial) => void;
  'pipeline:completed': (pipeline: AutoMLPipeline) => void;
  'pipeline:failed': (pipelineId: string, error: string) => void;
  'model:trained': (model: TrainedModel) => void;
}
