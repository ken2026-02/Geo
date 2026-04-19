import { MAPPING_TEMPLATE, SLOPE_TEMPLATE, Q_TEMPLATE, QA_TEMPLATE, INVESTIGATION_TEMPLATE, LOGGING_ASSISTANT_TEMPLATE } from './phraseTemplates';
import { getSupportDesign } from '../rules/supportDesignRules';
import { predictFailureModes } from '../rules/failureRules';
import { applyQualifiers } from '../utils/loggingStyle';

export interface RefLookup {
  getLabel: (table: string, id: string | null | undefined) => string;
}

export const phraseBuilder = {
  buildMappingParagraph: (mapping: any, sets: any[], lookup: RefLookup): string => {
    const parts = [MAPPING_TEMPLATE.header];
    
    const lith = lookup.getLabel('ref_lithology', mapping.lithology_id);
    const weather = lookup.getLabel('ref_weathering', mapping.weathering_id);
    const strength = lookup.getLabel('ref_rock_strength', mapping.strength_id);
    
    if (lith && weather && strength) {
      parts.push(MAPPING_TEMPLATE.lithology(lith, weather, strength));
    }

    const struct = lookup.getLabel('ref_structure', mapping.structure_id);
    if (struct) parts.push(MAPPING_TEMPLATE.structure(struct));

    const gw = lookup.getLabel('ref_groundwater', mapping.groundwater_id);
    if (gw) parts.push(MAPPING_TEMPLATE.groundwater(gw));

    if (sets && sets.length > 0) {
      sets.forEach(set => {
        const spacing = lookup.getLabel('ref_joint_spacing', set.spacing_id);
        const roughness = lookup.getLabel('ref_roughness', set.roughness_id);
        const infill = lookup.getLabel('ref_infill', set.infill_id);
        parts.push(MAPPING_TEMPLATE.jointSet(set.set_number, set.dip, set.dip_dir, spacing, roughness, infill));
      });
    }

    return parts.join(' ');
  },

  buildSlopeParagraph: (slope: any, controls: string[], indicators: string[], lookup: RefLookup): string => {
    const type = lookup.getLabel('ref_slope_type', slope.slope_type_id);
    const parts = [SLOPE_TEMPLATE.header(type || 'Unknown', slope.height, slope.angle)];

    const mode = lookup.getLabel('ref_failure_mode', slope.failure_mode_id);
    if (mode) parts.push(SLOPE_TEMPLATE.failureMode(mode));

    const bench = lookup.getLabel('ref_bench_condition', slope.bench_condition_id);
    const toe = lookup.getLabel('ref_toe_condition', slope.toe_condition_id);
    const drainage = lookup.getLabel('ref_drainage_condition', slope.drainage_condition_id);
    parts.push(SLOPE_TEMPLATE.conditions(bench, toe, drainage));

    const likelihood = lookup.getLabel('ref_likelihood', slope.likelihood_id);
    const consequence = lookup.getLabel('ref_consequence', slope.consequence_id);
    parts.push(SLOPE_TEMPLATE.risk(likelihood, consequence));

    if (indicators.length > 0) parts.push(SLOPE_TEMPLATE.indicators(indicators));
    if (controls.length > 0) parts.push(SLOPE_TEMPLATE.controls(controls));

    // Failure Prediction
    if (slope.discontinuitySets && slope.discontinuitySets.length > 0) {
      const predictions = predictFailureModes(
        { dip: slope.angle, dipDirection: slope.dip_direction },
        slope.discontinuitySets.map((s: any) => ({ dip: s.dip, dipDirection: s.dipDirection }))
      );
      if (predictions.length > 0) {
        const uniqueModes = Array.from(new Set(predictions.map(p => p.type)));
        parts.push(SLOPE_TEMPLATE.prediction(uniqueModes));
      }
    }

    return parts.join(' ');
  },

  buildQParagraph: (q: any, lookup: RefLookup): string => {
    const jn = lookup.getLabel('ref_q_jn', q.jn_id);
    const jr = lookup.getLabel('ref_q_jr', q.jr_id);
    const ja = lookup.getLabel('ref_q_ja', q.ja_id);
    const jw = lookup.getLabel('ref_q_jw', q.jw_id);
    const srf = lookup.getLabel('ref_q_srf', q.srf_id);
    
    let quality = 'Unknown';
    const val = q.computed_q;
    if (val > 40) quality = 'Very Good';
    else if (val >= 10) quality = 'Good';
    else if (val >= 4) quality = 'Fair';
    else if (val >= 1) quality = 'Poor';
    else if (val >= 0.1) quality = 'Very Poor';
    else quality = 'Extremely Poor';

    const summary = Q_TEMPLATE.summary(q.computed_q, q.rqd, quality, jn, jr, ja, jw, srf);
    const rec = getSupportDesign(val);
    const recommendation = Q_TEMPLATE.recommendation(val, quality, rec.label);
    const design = Q_TEMPLATE.supportDesign(rec.label, rec.boltSpacing, rec.meshRequired, rec.shotcreteThickness);
    
    return `${summary} ${recommendation} ${design}`;
  },

  buildQAParagraph: (type: 'anchor' | 'bolt' | 'shotcrete' | 'retaining', data: any, lookup: RefLookup): string => {
    const result = lookup.getLabel('ref_qa_result', data.result_id);
    switch (type) {
      case 'anchor':
        const aType = lookup.getLabel('ref_anchor_type', data.anchor_type_id);
        return QA_TEMPLATE.anchor(data.anchor_id, aType, data.test_load, result);
      case 'bolt':
        const bType = lookup.getLabel('ref_bolt_type', data.bolt_type_id);
        return QA_TEMPLATE.bolt(data.bolt_id, bType, data.length_m, result);
      case 'shotcrete':
        return QA_TEMPLATE.shotcrete(data.panel_id, data.thickness_mm, result);
      case 'retaining':
        const wType = lookup.getLabel('ref_wall_type', data.wall_type_id);
        const wCond = lookup.getLabel('ref_wall_condition', data.condition_id);
        return QA_TEMPLATE.retaining(wType, wCond, result);
      default:
        return 'QA inspection recorded.';
    }
  },

  buildSoilParagraph: (soil: any, lookup: RefLookup): string => {
    const material = lookup.getLabel('ref_soil_material_type', soil.material_type_id);
    const plasticity = lookup.getLabel('ref_soil_plasticity', soil.plasticity_id);
    const moisture = lookup.getLabel('ref_soil_moisture', soil.moisture_id);
    const consistency = lookup.getLabel('ref_soil_consistency', soil.consistency_id);
    const structure = lookup.getLabel('ref_soil_structure', soil.structure_id);
    const origin = lookup.getLabel('ref_origin_soil', soil.origin_id);
    const secondary = lookup.getLabel('ref_soil_secondary_components', soil.secondary_component_id);

    return INVESTIGATION_TEMPLATE.soil(material, plasticity, moisture, consistency, structure, origin, secondary);
  },

  buildGranularParagraph: (granular: any, lookup: RefLookup): string => {
    const material = lookup.getLabel('ref_soil_material_type', granular.material_type_id);
    const grading = lookup.getLabel('ref_soil_grading', granular.grading_id);
    const moisture = lookup.getLabel('ref_soil_moisture', granular.moisture_id);
    const density = lookup.getLabel('ref_soil_density', granular.density_id);
    const structure = lookup.getLabel('ref_soil_structure', granular.structure_id);
    const origin = lookup.getLabel('ref_origin_soil', granular.origin_id);
    const secondary = lookup.getLabel('ref_soil_secondary_components', granular.secondary_component_id);

    return INVESTIGATION_TEMPLATE.granular(material, grading, moisture, density, structure, origin, secondary);
  },

  buildFillParagraph: (fill: any, lookup: RefLookup): string => {
    const type = lookup.getLabel('ref_fill_type', fill.fill_type_id);
    const composition = lookup.getLabel('ref_fill_composition', fill.composition_id);
    const moisture = lookup.getLabel('ref_soil_moisture', fill.moisture_id);
    const density = lookup.getLabel('ref_soil_density', fill.density_id);
    const inclusions = lookup.getLabel('ref_fill_inclusions', fill.inclusion_id);
    const contaminants = lookup.getLabel('ref_fill_contaminants', fill.contaminant_id);

    return INVESTIGATION_TEMPLATE.fill(type, composition, moisture, density, inclusions, contaminants);
  },

  buildTransitionParagraph: (transition: any, lookup: RefLookup): string => {
    const material = lookup.getLabel('ref_transition_material', transition.material_id);
    const moisture = lookup.getLabel('ref_soil_moisture', transition.moisture_id);
    const consistency = lookup.getLabel('ref_soil_consistency', transition.consistency_id);
    const structure = lookup.getLabel('ref_soil_structure', transition.structure_id);
    const origin = lookup.getLabel('ref_origin_soil', transition.origin_id);

    return INVESTIGATION_TEMPLATE.transition(material, moisture, consistency, structure, origin);
  },

  buildRockLoggingParagraph: (style: "SHORT" | "FULL", rock: any, sets: any[], lookup: RefLookup, notes?: string, qualifiers?: string[]): string => {
    const lith = lookup.getLabel('ref_lithology', rock.lithology_id);
    const weather = lookup.getLabel('ref_weathering', rock.weathering_id);
    const strength = lookup.getLabel('ref_rock_strength', rock.strength_id);
    const colour = lookup.getLabel('ref_colour', rock.colour_id);
    const structure = lookup.getLabel('ref_structure', rock.structure_id);
    const gw = lookup.getLabel('ref_groundwater', rock.groundwater_id);

    let setsSummary = '';
    if (sets && sets.length > 0) {
      setsSummary = sets.map(set => {
        const spacing = lookup.getLabel('ref_joint_spacing', set.spacing_id);
        const persistence = lookup.getLabel('ref_persistence', set.persistence_id);
        const aperture = lookup.getLabel('ref_aperture', set.aperture_id);
        const roughness = lookup.getLabel('ref_roughness', set.roughness_id);
        const infill = lookup.getLabel('ref_infill', set.infill_id);
        const jointWater = lookup.getLabel('ref_joint_water', set.water_id);
        const orientation = (set.dip !== null && !isNaN(set.dip) && set.dip_dir !== null && !isNaN(set.dip_dir)) 
          ? `${set.dip}/${set.dip_dir.toString().padStart(3, '0')}` 
          : '';

        const descriptors = [
          spacing && `${spacing.toLowerCase()} spacing`,
          persistence && `${persistence.toLowerCase()} persistence`,
          aperture && `${aperture.toLowerCase()} aperture`,
          roughness && `${roughness.toLowerCase()} roughness`,
          infill && `${infill.toLowerCase()} infill`,
          jointWater && `${jointWater.toLowerCase()} water condition`
        ].filter(Boolean).join(', ');

        const label = descriptors || 'descriptor not recorded';
        return `Joint Set ${set.set_number}: ${orientation} ${label}`.trim();
      }).join('; ');
    }

    const baseText = LOGGING_ASSISTANT_TEMPLATE.rock(style, lith, weather, strength, colour, structure, setsSummary, gw, notes);
    return applyQualifiers(baseText, qualifiers || []);
  },

  buildSoilLoggingParagraph: (style: "SHORT" | "FULL", soil: any, lookup: RefLookup, notes?: string, qualifiers?: string[]): string => {
    const material = lookup.getLabel('ref_soil_material_type', soil.material_type_id);
    const plasticity = lookup.getLabel('ref_soil_plasticity', soil.plasticity_id);
    const grading = lookup.getLabel('ref_soil_grading', soil.grading_id);
    const moisture = lookup.getLabel('ref_soil_moisture', soil.moisture_id);
    const consistency = lookup.getLabel('ref_soil_consistency', soil.consistency_id);
    const density = lookup.getLabel('ref_soil_density', soil.density_id);
    const structure = lookup.getLabel('ref_soil_structure', soil.structure_id);
    const origin = lookup.getLabel('ref_origin_soil', soil.origin_id);
    const secondary = lookup.getLabel('ref_soil_secondary_components', soil.secondary_component_id);

    const plasticityOrGrading = plasticity || grading;
    const consistencyOrDensity = consistency || density;

    const baseText = LOGGING_ASSISTANT_TEMPLATE.soil(style, material, plasticityOrGrading, moisture, consistencyOrDensity, structure, origin, secondary, notes);
    return applyQualifiers(baseText, qualifiers || []);
  },


  buildInvestigationLoggingParagraph: (
    style: "SHORT" | "FULL",
    type: 'Cohesive' | 'Granular' | 'Fill' | 'Transition',
    data: any,
    lookup: RefLookup,
    notes?: string,
    qualifiers?: string[]
  ): string => {
    const withNotes = (baseText: string) => {
      const text = notes ? `${baseText} Notes: ${notes}` : baseText;
      return applyQualifiers(text, qualifiers || []);
    };

    if (type === 'Fill') {
      const fillType = lookup.getLabel('ref_fill_type', data.fill_type_id);
      const composition = lookup.getLabel('ref_fill_composition', data.composition_id);
      const moisture = lookup.getLabel('ref_soil_moisture', data.moisture_id);
      const density = lookup.getLabel('ref_soil_density', data.density_id);
      const consistency = lookup.getLabel('ref_soil_consistency', data.consistency_id);
      const structure = lookup.getLabel('ref_soil_structure', data.structure_id);
      const inclusions = lookup.getLabel('ref_fill_inclusions', data.inclusion_id);
      const contaminants = lookup.getLabel('ref_fill_contaminants', data.contaminant_id);

      const parts = [fillType || 'Fill'];
      if (composition) parts.push(composition.toLowerCase());
      if (moisture) parts.push(moisture.toLowerCase());
      if (density || consistency) parts.push((density || consistency).toLowerCase());
      if (structure) parts.push(structure.toLowerCase());
      if (inclusions) parts.push(`with ${inclusions.toLowerCase()}`);
      if (contaminants) parts.push(`contaminants: ${contaminants.toLowerCase()}`);
      return withNotes(parts.join(', ') + '.');
    }

    if (type === 'Transition') {
      const material = lookup.getLabel('ref_transition_material', data.material_id || data.transition_material_id);
      const moisture = lookup.getLabel('ref_soil_moisture', data.moisture_id);
      const consistency = lookup.getLabel('ref_soil_consistency', data.consistency_id);
      const structure = lookup.getLabel('ref_soil_structure', data.structure_id);
      const origin = lookup.getLabel('ref_origin_soil', data.origin_id);

      const parts = [material || 'Transition material'];
      if (moisture) parts.push(moisture.toLowerCase());
      if (consistency) parts.push(consistency.toLowerCase());
      if (structure) parts.push(structure.toLowerCase());
      if (origin) parts.push(origin.toLowerCase());
      return withNotes(parts.join(', ') + '.');
    }

    return phraseBuilder.buildSoilLoggingParagraph(style, data, lookup, notes, qualifiers);
  },

  buildRMRParagraph: (rmr: any): string => {
    return `Rock Mass Rating (RMR) Assessment:
Total RMR = ${rmr.total_rmr} (${rmr.rock_class}).
Inputs: UCS Rating = ${rmr.ucs_rating}, RQD Rating = ${rmr.rqd_rating}, Spacing Rating = ${rmr.spacing_rating}, Condition Rating = ${rmr.condition_rating}, Groundwater Rating = ${rmr.groundwater_rating}, Orientation Adjustment = ${rmr.orientation_adjustment}.
Notes: ${rmr.notes || 'None'}`;
  },

  buildGSIParagraph: (gsi: any): string => {
    return `Geological Strength Index (GSI) Assessment:
GSI Range = ${gsi.gsi_min} - ${gsi.gsi_max} (Midpoint: ${gsi.gsi_mid}).
Structure: ${gsi.structure_class}.
Surface Condition: ${gsi.surface_condition_class}.
Confidence Level: ${gsi.confidence_level}.
Notes: ${gsi.notes || 'None'}.
* GSI is provided as guidance only and requires engineering judgement.`;
  },

  buildStructuralParagraph: (data: any): string => {
    const modes = [];
    if (data.planar_possible) modes.push('planar');
    if (data.wedge_possible) modes.push('wedge');
    if (data.toppling_possible) modes.push('toppling');
    
    let text = `Structural assessment indicates `;
    
    if (modes.length > 0) {
      text += `potential ${modes.join(', ')} failure `;
      
      const control = data.controlling_pair || data.controlling_set;
      if (control) {
        text += `controlled by ${control}, `;
      }
      
      text += `with ${data.hazard_level?.toLowerCase() || 'unknown'} hazard and ${data.confidence_level?.toLowerCase() || 'unknown'} confidence. `;
    } else {
      text += `no dominant failure modes based on current inputs. `;
    }
    
    if (data.engineering_note) {
      text += `${data.engineering_note} `;
    }

    text += `\nInputs: Slope ${data.slope_dip || '?'} / ${data.slope_dip_dir || '?'}`;
    const joints = [];
    if (data.joint1_dip !== null && data.joint1_dip_dir !== null) joints.push(`J1: ${data.joint1_dip}/${data.joint1_dip_dir}`);
    if (data.joint2_dip !== null && data.joint2_dip_dir !== null) joints.push(`J2: ${data.joint2_dip}/${data.joint2_dip_dir}`);
    if (data.joint3_dip !== null && data.joint3_dip_dir !== null) joints.push(`J3: ${data.joint3_dip}/${data.joint3_dip_dir}`);
    
    if (joints.length > 0) {
      text += `, Joints: ${joints.join(', ')}.`;
    } else {
      text += `.`;
    }
    
    return text.trim();
  },

  buildSupportDesignParagraph: (data: any): string => {
    let summary = `Support Design Recommendation: ${data.support_class || 'Unknown'}\n`;
    summary += `Bolting: ${data.bolt_length_m || '?'}m length @ ${data.bolt_spacing_m || '?'}m spacing.\n`;
    summary += `Surface Support: ${data.shotcrete_thickness_mm ? data.shotcrete_thickness_mm + 'mm shotcrete' : 'No shotcrete'}`;
    if (data.mesh_required) summary += ` with mesh.\n`;
    else summary += `.\n`;
    if (data.drainage_required) summary += `Drainage: Required.\n`;
    
    const inputs = [];
    if (data.source_q_value) inputs.push(`Q=${data.source_q_value}`);
    if (data.source_rmr) inputs.push(`RMR=${data.source_rmr}`);
    if (data.source_gsi) inputs.push(`GSI=${data.source_gsi}`);
    if (data.source_failure_mode && data.source_failure_mode !== 'none') inputs.push(`Failure Mode=${data.source_failure_mode}`);
    
    if (inputs.length > 0) {
      summary += `Based on: ${inputs.join(', ')}.\n`;
    }
    
    if (data.support_notes) {
      summary += `Notes: ${data.support_notes}`;
    }
    
    return summary.trim();
  },

  buildSupportCalculatorParagraph: (data: any): string => {
    let summary = `Indicative Support Calculator Output: ${data.support_class || 'Unknown'}\n`;
    summary += `Bolting: ${data.bolt_length_m || 0}m length @ ${data.bolt_spacing_m || 0}m spacing.\n`;
    summary += `Surface Support: ${data.shotcrete_thickness_mm ? data.shotcrete_thickness_mm + 'mm shotcrete' : 'No shotcrete'}`;
    if (data.mesh_required) summary += ` with mesh.\n`;
    else summary += `.\n`;
    if (data.drainage_required) summary += `Drainage: Required.\n`;
    
    const inputs = [];
    if (data.source_q_value) inputs.push(`Q=${data.source_q_value}`);
    if (data.source_rmr) inputs.push(`RMR=${data.source_rmr}`);
    if (data.source_gsi) inputs.push(`GSI=${data.source_gsi}`);
    if (data.source_failure_mode && data.source_failure_mode !== 'none') inputs.push(`Failure Mode=${data.source_failure_mode}`);
    if (data.groundwater_severity) inputs.push(`Groundwater=${data.groundwater_severity}`);
    if (data.excavation_span) inputs.push(`Span=${data.excavation_span}m`);
    if (data.batter_height) inputs.push(`Batter=${data.batter_height}m`);
    
    if (inputs.length > 0) {
      summary += `Based on inputs: ${inputs.join(', ')}.\n`;
    }
    
    if (data.design_note) {
      summary += `Notes: ${data.design_note}\n`;
    }
    
    summary += `* Indicative support guidance only. Final support design requires engineering verification.`;
    
    return summary.trim();
  }
};
