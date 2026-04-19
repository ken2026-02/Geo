import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './screens/Home';
import { QuickLog } from './screens/QuickLog';
import { Mapping } from './screens/Mapping';
import { EntryDetail } from './screens/EntryDetail';
import { Handover } from './screens/Handover';
import { SlopeAssessment } from './screens/SlopeAssessment';
import { RockClassification } from './screens/RockClassification';
import { RockMassRating } from './screens/RockMassRating';
import GSIAssessment from './screens/GSIAssessment';
import StructuralAssessment from './screens/StructuralAssessment';
import StereonetView from './screens/StereonetView';
import WedgeFoSView from './screens/WedgeFoSView';
import SupportDesignScreen from './screens/SupportDesign';
import SupportDesignCalculator from './screens/SupportDesignCalculator';
import RockEngineeringDashboard from './screens/RockEngineeringDashboard';
import RockEngineeringAssistant from './screens/RockEngineeringAssistant';
import { RockEngineeringBrain } from './screens/RockEngineeringBrain';
import { SoilEngineeringBrain } from './screens/SoilEngineeringBrain';
import { SoilEngineeringDashboard } from './screens/SoilEngineeringDashboard';
import { InvestigationLog } from './screens/InvestigationLog';
import { Records } from './screens/Records';
import { Projects } from './screens/Projects';
import { Locations } from './screens/Locations';
import { LocationDetail } from './screens/LocationDetail';
import { PhotoGallery } from './screens/PhotoGallery';
import { Diagnostics } from './screens/Diagnostics';
import { BearingCapacity } from './screens/BearingCapacity';
import { EarthPressure } from './screens/EarthPressure';
import { SettlementScreening } from './screens/SettlementScreening';
import { RetainingWallCheck } from './screens/RetainingWallCheck';
import { SoilSlopeStability } from './screens/SoilSlopeStability';
import { EntryEdit } from './screens/EntryEdit';
import { SiteLogging } from './screens/SiteLogging';
import { SiteLoggingElement } from './screens/SiteLoggingElement';
import { SiteLoggingReport } from './screens/SiteLoggingReport';
import { SiteLoggingLibrary } from './screens/SiteLoggingLibrary';

import { LocationOverview } from './screens/LocationOverview';
import { LocationEdit } from './screens/LocationEdit';
import { LocationTimeline } from './screens/LocationTimeline';
import { EngineeringKnowledge } from './screens/EngineeringKnowledge';
import { ROUTES, entryDetailRoute, entryEditRoute, locationDetailRoute, locationEditRoute, locationOverviewRoute, locationTimelineRoute } from './routes';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path={ROUTES.home} element={<Home />} />
        <Route path={ROUTES.quickLog} element={<QuickLog />} />
        <Route path={ROUTES.mapping} element={<Mapping />} />
        <Route path={entryDetailRoute(':id')} element={<EntryDetail />} />
        <Route path={entryEditRoute(':id')} element={<EntryEdit />} />
        <Route path={ROUTES.handover} element={<Handover />} />
        <Route path={ROUTES.slopeAssessment} element={<SlopeAssessment />} />
        <Route path={ROUTES.rockClassification} element={<RockClassification />} />
        <Route path={ROUTES.rockMassRating} element={<RockMassRating />} />
        <Route path={ROUTES.gsiAssessment} element={<GSIAssessment />} />
        <Route path={ROUTES.structuralAssessment} element={<StructuralAssessment />} />
        <Route path={ROUTES.structuralStereonet} element={<StereonetView />} />
        <Route path={ROUTES.stereonetView} element={<StereonetView />} />
        <Route path={ROUTES.wedgeFoS} element={<WedgeFoSView />} />
        <Route path={ROUTES.supportDesign} element={<SupportDesignScreen />} />
        <Route path={ROUTES.supportDesignCalculator} element={<SupportDesignCalculator />} />
        <Route path={ROUTES.rockEngineeringDashboard} element={<RockEngineeringDashboard />} />
        <Route path={ROUTES.rockEngineeringAssistant} element={<RockEngineeringAssistant />} />
        <Route path={ROUTES.rockEngineeringBrain} element={<RockEngineeringBrain />} />
        <Route path={ROUTES.soilEngineeringBrain} element={<SoilEngineeringBrain />} />
        <Route path={ROUTES.soilEngineeringDashboard} element={<SoilEngineeringDashboard />} />
        <Route path={ROUTES.investigationLog} element={<InvestigationLog />} />
        <Route path={ROUTES.siteLogging} element={<SiteLogging />} />
        <Route path={'/site-logging/library'} element={<SiteLoggingLibrary />} />
        <Route path={'/site-logging/element/:id'} element={<SiteLoggingElement />} />
        <Route path={'/site-logging/element/:id/report'} element={<SiteLoggingReport />} />
        <Route path={ROUTES.records} element={<Records />} />
        <Route path={ROUTES.projects} element={<Projects />} />
        <Route path={ROUTES.locations} element={<Locations />} />
        <Route path={locationDetailRoute(':id')} element={<LocationDetail />} />
        <Route path={locationOverviewRoute(':locationId')} element={<LocationOverview />} />
        <Route path={locationTimelineRoute(':locationId')} element={<LocationTimeline />} />
        <Route path={locationEditRoute(':id')} element={<LocationEdit />} />
        <Route path={ROUTES.photoGallery} element={<PhotoGallery />} />
        <Route path={ROUTES.bearingCapacity} element={<BearingCapacity />} />
        <Route path={ROUTES.earthPressure} element={<EarthPressure />} />
        <Route path={ROUTES.settlementScreening} element={<SettlementScreening />} />
        <Route path={ROUTES.retainingWallCheck} element={<RetainingWallCheck />} />
        <Route path={ROUTES.soilSlopeStability} element={<SoilSlopeStability />} />
        <Route path={ROUTES.engineeringKnowledge} element={<EngineeringKnowledge />} />
        <Route path={ROUTES.diagnostics} element={<Diagnostics />} />
      </Routes>
    </Router>
  );
}
