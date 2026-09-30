export interface BIMHealthReport {
  id: string;
  projectName: string;
  projectPath?: string;
  generatedDate: string;
  revitVersion: string;
  uploadedDate: string;
  statistics: ModelStatistics;
  issues: HealthIssue[];
  warnings: Warning[];
  performance: PerformanceMetrics;
  quality: QualityMetrics;
  worksetCount?: number;
  designOptionsCount?: number;
  linkedRevitFiles?: number;
  linkedCADFiles?: number;
}

export interface ModelStatistics {
  totalElements: number;
  walls: number;
  floors: number;
  ceilings: number;
  doors: number;
  windows: number;
  columns: number;
  beams: number;
  rooms: number;
  spaces: number;
  views: number;
  sheets: number;
  families: number;
  materials: number;
  modelSize: number;
}

export interface HealthIssue {
  category: string;
  severity: string;
  description: string;
  recommendation: string;
  count: number;
  elementIds?: string[];
}

export interface Warning {
  description: string;
  category: string;
  elementIds: string[];
}

export interface PerformanceMetrics {
  fileSize: number;
  viewCount: number;
  unusedFamilies: number;
  duplicateElements?: number;
  complexGeometry?: number;
  performanceRating: string;
}

export interface QualityMetrics {
  modelCompleteness: number;
  geometricAccuracy: number;
  informationRichness: number;
  overallGrade: string;
  recommendations?: string[];
}
