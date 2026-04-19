export const ROUTES = {
  home: '/',
  quickLog: '/quick-log',
  mapping: '/mapping',
  siteLogging: '/site-logging',
  handover: '/handover',
  slopeAssessment: '/slope-assessment',
  rockClassification: '/rock-classification',
  rockMassRating: '/rock-mass-rating',
  gsiAssessment: '/gsi-assessment',
  structuralAssessment: '/structural-assessment',
  structuralStereonet: '/structural-stereonet',
  stereonetView: '/stereonet-view',
  wedgeFoS: '/wedge-fos',
  supportDesign: '/support-design',
  supportDesignCalculator: '/support-design-calculator',
  rockEngineeringDashboard: '/rock-engineering-dashboard',
  rockEngineeringAssistant: '/rock-engineering-assistant',
  rockEngineeringBrain: '/rock-engineering-brain',
  soilEngineeringBrain: '/soil-engineering-brain',
  soilEngineeringDashboard: '/soil-engineering-dashboard',
  investigationLog: '/investigation-log',
  records: '/records',
  projects: '/projects',
  locations: '/locations',
  photoGallery: '/photo-gallery',
  diagnostics: '/diagnostics',
  bearingCapacity: '/bearing-capacity',
  earthPressure: '/earth-pressure',
  settlementScreening: '/settlement-screening',
  retainingWallCheck: '/retaining-wall-check',
  soilSlopeStability: '/soil-slope-stability',
  engineeringKnowledge: '/engineering-knowledge',
} as const;

export const entryDetailRoute = (id: string) => `/entry/${id}`;
export const entryEditRoute = (id: string) => `/entry/${id}/edit`;
export const locationDetailRoute = (id: string) => `/location/${id}`;
export const locationOverviewRoute = (locationId: string) => `/location-overview/${locationId}`;
export const locationTimelineRoute = (locationId: string) => `/location-timeline/${locationId}`;
export const locationEditRoute = (id: string) => `/location/edit/${id}`;
