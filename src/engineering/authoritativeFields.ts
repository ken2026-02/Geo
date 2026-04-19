/**
 * Authoritative Engineering Field Map
 * Defines the source of truth for engineering metrics across the application.
 */

export const AUTHORITATIVE_FIELDS = {
  Q_SYSTEM: {
    table: 'q_assessments',
    field: 'computed_q',
    label: 'Q-system'
  },
  RMR: {
    table: 'rmr_assessments',
    field: 'total_rmr',
    label: 'RMR'
  },
  GSI: {
    table: 'gsi_assessments',
    field: 'gsi_mid',
    label: 'GSI'
  },
  STRUCTURAL: {
    table: 'structural_assessments',
    field: 'dominant_failure_mode',
    label: 'Structural'
  },
  SUPPORT_CALCULATOR: {
    table: 'support_design_calculations',
    field: 'support_class',
    label: 'Support Calculator'
  },
  SUPPORT_DESIGN: {
    table: 'support_designs',
    field: 'support_class',
    label: 'Support Design'
  }
} as const;
