import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Search, BookOpen, Calculator, AlertTriangle, FileText, Shield, Info, Layers, Activity } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  category: string;
  name: string;
  content: any;
  tags: string[];
}

const KNOWLEDGE_BASE: KnowledgeItem[] = [
  // 1. Rock Mass Classification
  {
    id: 'rock-q',
    category: 'Rock Mass Classification',
    name: 'Q-System (Barton et al.)',
    content: {
      description: 'Numerical assessment of rock mass quality for tunnel support design.',
      key_points: ['RQD/Jn: Block size', 'Jr/Ja: Inter-block shear strength', 'Jw/SRF: Active stress'],
      usage: 'Primary tool for support intensity determination in GeoField AU.'
    },
    tags: ['rock', 'classification', 'support']
  },
  {
    id: 'rock-rmr',
    category: 'Rock Mass Classification',
    name: 'RMR (Bieniawski)',
    content: {
      description: 'Rock Mass Rating system for general engineering characterization.',
      key_points: ['UCS', 'RQD', 'Discontinuity Spacing', 'Condition', 'Groundwater', 'Orientation'],
      usage: 'Used for overall rock mass quality wording and preliminary stability assessment.'
    },
    tags: ['rock', 'classification', 'quality']
  },
  {
    id: 'rock-gsi',
    category: 'Rock Mass Classification',
    name: 'GSI (Hoek-Brown)',
    content: {
      description: 'Geological Strength Index for rock mass strength estimation.',
      key_points: ['Structure (Blockiness)', 'Surface Condition'],
      usage: 'Supplementary tool for Hoek-Brown parameter estimation.'
    },
    tags: ['rock', 'classification', 'strength']
  },

  // 2. Structural / Failure Mechanisms
  {
    id: 'fail-planar',
    category: 'Structural / Failure Mechanisms',
    name: 'Planar Failure (Rock)',
    content: {
      definition: 'Sliding along a single persistent discontinuity dipping out of the face.',
      indicators: ['Daylighting joints', 'Continuous trace', 'Dip > friction angle'],
      significance: 'Can lead to sudden large-scale instability.',
      responses: ['Bolting', 'Drainage', 'Scaling']
    },
    tags: ['rock', 'failure', 'planar']
  },
  {
    id: 'fail-wedge',
    category: 'Structural / Failure Mechanisms',
    name: 'Wedge Failure (Rock)',
    content: {
      definition: 'Sliding of a block defined by two intersecting discontinuities.',
      indicators: ['Intersecting traces', 'Line of intersection daylighting'],
      significance: 'Common in jointed rock masses; localized falls.',
      responses: ['Spot bolting', 'Mesh']
    },
    tags: ['rock', 'failure', 'wedge']
  },
  {
    id: 'fail-circular',
    category: 'Structural / Failure Mechanisms',
    name: 'Circular Failure (Soil)',
    content: {
      definition: 'Rotational slide along a curved surface.',
      indicators: ['Tension cracks at crest', 'Bulging at toe', 'Scarps'],
      significance: 'Deep-seated instability in homogeneous soils or highly weathered rock.',
      responses: ['Flattening', 'Benching', 'Toe weighting']
    },
    tags: ['soil', 'failure', 'circular']
  },

  // 3. Soil Description & Logging
  {
    id: 'soil-clay',
    category: 'Soil Description & Logging',
    name: 'Clay',
    content: {
      definition: 'Fine-grained soil (< 0.002mm) with plasticity.',
      consistency: ['Very Soft', 'Soft', 'Firm', 'Stiff', 'Very Stiff', 'Hard'],
      significance: 'Low permeability, high compressibility, potential for creep.',
      wording: 'CLAY: [Consistency], [Plasticity], [Color], [Secondary components].'
    },
    tags: ['soil', 'logging', 'clay']
  },
  {
    id: 'soil-sand',
    category: 'Soil Description & Logging',
    name: 'Sand',
    content: {
      definition: 'Coarse-grained soil (0.06 - 2.0mm).',
      density: ['Very Loose', 'Loose', 'Medium Dense', 'Dense', 'Very Dense'],
      significance: 'High permeability, frictional strength, potential for liquefaction if saturated/loose.',
      wording: 'SAND: [Density], [Grain size], [Color], [Secondary components].'
    },
    tags: ['soil', 'logging', 'sand']
  },

  // 4. Formula Library
  {
    id: 'form-q',
    category: 'Formula Library',
    name: 'Q-System Equation',
    content: {
      formula: 'Q = (RQD / Jn) * (Jr / Ja) * (Jw / SRF)',
      variables: [
        'RQD: Rock Quality Designation',
        'Jn: Joint set number',
        'Jr: Joint roughness number',
        'Ja: Joint alteration number',
        'Jw: Joint water reduction factor',
        'SRF: Stress Reduction Factor'
      ],
      assumptions: 'Isotropic rock mass behavior at scale.',
      limitations: 'Not suitable for structurally controlled failures (wedges).',
      module: 'Rock Classification (Q)'
    },
    tags: ['formula', 'rock', 'q']
  },
  {
    id: 'form-bearing',
    category: 'Formula Library',
    name: 'Terzaghi Bearing Capacity',
    content: {
      formula: 'q_ult = c\'Nc + qNq + 0.5γBNγ',
      variables: [
        'c\': Cohesion',
        'q: Overburden pressure (γD)',
        'γ: Unit weight',
        'B: Foundation width',
        'Nc, Nq, Nγ: Bearing capacity factors (f(φ\'))'
      ],
      assumptions: 'General shear failure, shallow foundation.',
      limitations: 'Does not account for settlement limits.',
      module: 'Bearing Capacity'
    },
    tags: ['formula', 'soil', 'bearing']
  },
  {
    id: 'form-rankine-active',
    category: 'Formula Library',
    name: 'Rankine Active Pressure',
    content: {
      formula: 'Pa = 0.5 * Ka * γ * H² - 2c\' * √Ka * H',
      variables: [
        'Ka: tan²(45 - φ\'/2)',
        'γ: Unit weight',
        'H: Wall height',
        'c\': Cohesion'
      ],
      assumptions: 'Smooth vertical wall, horizontal backfill, wall moves away.',
      module: 'Earth Pressure'
    },
    tags: ['formula', 'soil', 'pressure']
  },

  // 5. Engineering Rule Library
  {
    id: 'rule-rock-rmr',
    category: 'Engineering Rule Library',
    name: 'Rock: RMR Controls Quality Wording',
    content: {
      rule: 'RMR values should be used to drive the descriptive quality of the rock mass (e.g., "Good", "Fair", "Poor").',
      logic: 'RMR is more intuitive for general communication than Q.',
      application: 'Handover summaries and Project Dashboards.'
    },
    tags: ['rule', 'rock', 'rmr']
  },
  {
    id: 'rule-soil-bearing',
    category: 'Engineering Rule Library',
    name: 'Soil: Bearing = Founding Suitability',
    content: {
      rule: 'Bearing capacity screening is used to flag if the founding material is adequate for the intended load.',
      logic: 'If q_allowable < q_applied, founding level review is required.',
      application: 'Settlement Screening and Bearing Capacity modules.'
    },
    tags: ['rule', 'soil', 'bearing']
  },
  {
    id: 'rule-quick-wet',
    category: 'Engineering Rule Library',
    name: 'Quick Log: Wet Patch -> Drainage',
    content: {
      rule: 'Observation of a "wet patch" or seepage should trigger a drainage review.',
      logic: 'Increased pore pressure reduces effective stress and stability.',
      application: 'Quick Log and Slope Assessment.'
    },
    tags: ['rule', 'quick-log', 'drainage']
  },

  // 6. Treatment / Support Library
  {
    id: 'treat-scaling',
    category: 'Treatment / Support Library',
    name: 'Scaling (Rock)',
    content: {
      when: 'Immediately after excavation or when loose blocks are observed.',
      why: 'Remove immediate fall hazards.',
      risks: 'Over-scaling can destabilize larger blocks; safety of personnel.',
      wording: 'Scaling of loose blocks required at [Location].'
    },
    tags: ['treatment', 'rock', 'scaling']
  },
  {
    id: 'treat-drainage',
    category: 'Treatment / Support Library',
    name: 'Drainage (Soil/Slope)',
    content: {
      when: 'Seepage observed or high pore pressures suspected.',
      why: 'Reduce pore water pressure to increase effective strength.',
      measures: ['Horizontal drains', 'Weep holes', 'Crest drains'],
      wording: 'Install horizontal drains at [Location] to manage seepage.'
    },
    tags: ['treatment', 'soil', 'drainage']
  },

  // 7. Guidance Notes / Writing Library
  {
    id: 'guide-disclaimer',
    category: 'Guidance Notes / Writing Library',
    name: 'Indicative Disclaimer',
    content: {
      text: 'This assessment is indicative and preliminary in nature, based on field observations and screening-level calculations. It does not constitute a final design.',
      usage: 'Include in all handover reports and summary notes.'
    },
    tags: ['guidance', 'writing', 'disclaimer']
  },
  {
    id: 'guide-monitoring',
    category: 'Guidance Notes / Writing Library',
    name: 'Monitoring Suggestion',
    content: {
      text: 'Recommend implementation of [Type] monitoring (e.g., prisms, inclinometers) to verify stability trends at [Location].',
      usage: 'When uncertainty exists or movement is suspected.'
    },
    tags: ['guidance', 'writing', 'monitoring']
  },

  // 8. Standards / Reference Mapping
  {
    id: 'std-as1726',
    category: 'Standards / Reference Mapping',
    name: 'AS 1726: Geotechnical Site Investigations',
    content: {
      topic: 'Soil and Rock Logging',
      usage: 'GeoField AU follows AS 1726 terminology for consistency and density classes.',
      status: 'Core reference for all logging modules.'
    },
    tags: ['standard', 'logging']
  },
  {
    id: 'std-as4678',
    category: 'Standards / Reference Mapping',
    name: 'AS 4678: Earth-Retaining Structures',
    content: {
      topic: 'Retaining Walls',
      usage: 'GeoField AU uses AS 4678 principles for screening-level wall checks.',
      status: 'Screening only; full design requires comprehensive analysis.'
    },
    tags: ['standard', 'retaining-wall']
  }
];

const CATEGORIES = [
  'All',
  'Rock Mass Classification',
  'Structural / Failure Mechanisms',
  'Soil Description & Logging',
  'Formula Library',
  'Engineering Rule Library',
  'Treatment / Support Library',
  'Guidance Notes / Writing Library',
  'Standards / Reference Mapping'
];

export const EngineeringKnowledge: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredItems = useMemo(() => {
    return KNOWLEDGE_BASE.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase())) ||
        JSON.stringify(item.content).toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const getIcon = (category: string) => {
    switch (category) {
      case 'Rock Mass Classification': return <Layers size={16} />;
      case 'Structural / Failure Mechanisms': return <AlertTriangle size={16} />;
      case 'Soil Description & Logging': return <FileText size={16} />;
      case 'Formula Library': return <Calculator size={16} />;
      case 'Engineering Rule Library': return <Shield size={16} />;
      case 'Treatment / Support Library': return <Activity size={16} />;
      case 'Guidance Notes / Writing Library': return <BookOpen size={16} />;
      case 'Standards / Reference Mapping': return <Info size={16} />;
      default: return <BookOpen size={16} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PageHeader title="Engineering Knowledge Base" />
      
      {/* Search and Filter Header */}
      <div className="sticky top-0 z-10 bg-slate-50 p-4 shadow-sm border-b border-zinc-200">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search formulas, rules, terminology..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                activeCategory === cat 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 pb-24">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p>No matching knowledge entries found.</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600">
                    {getIcon(item.category)}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.category}</span>
                  </div>
                  <div className="flex gap-1">
                    {item.tags.map(tag => (
                      <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[8px] font-bold text-zinc-500 uppercase">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                <h3 className="mb-2 text-lg font-bold text-zinc-900">{item.name}</h3>
                
                <div className="space-y-3">
                  {Object.entries(item.content).map(([key, value]) => {
                    if (key === 'formula') {
                      return (
                        <div key={key} className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
                          <code className="text-sm font-mono font-bold text-indigo-900">{value as string}</code>
                        </div>
                      );
                    }
                    if (Array.isArray(value)) {
                      return (
                        <div key={key}>
                          <span className="text-[10px] font-bold uppercase text-zinc-400">{key.replace('_', ' ')}</span>
                          <ul className="mt-1 list-inside list-disc space-y-1">
                            {value.map((v, idx) => (
                              <li key={idx} className="text-xs text-zinc-600">{v}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <span className="text-[10px] font-bold uppercase text-zinc-400">{key.replace('_', ' ')}</span>
                        <p className="mt-0.5 text-xs text-zinc-600 leading-relaxed">{value as string}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
