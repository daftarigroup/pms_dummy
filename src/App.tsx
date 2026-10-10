import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import AddProject from './pages/NewProject/Add_Project';
import AllProject from './pages/NewProject/All_Project';
import ViewDesign from './pages/ExecutionActualReport/ViewDesign';
import ProjectMinors from './pages/ExecutionActualReport/ProjectMinors';
import ExecutionDetails from './pages/ExecutionActualReport/ExecutionDetails';
import ActualDetails from './pages/ExecutionActualReport/ActualDetails';
import AutoComparison from './pages/ExecutionActualReport/AutoComparison';
import ExcavationMurum from './pages/ExecutionActualReport/Excavation&Murum';
import MurumDetails from './pages/ExecutionActualReport/MurumDetails';
import ValveReport from './pages/ExecutionActualReport/ValveReport';
import BackFillingReport from './pages/ExecutionActualReport/BackFillingReport';
import ProductIMF from './pages/ExecutionActualReport/ProductIMF';
import RM1 from './pages/DepartmentBilling/RM1';
import RM2 from './pages/SubContractorBillings/RM2';
import RMBillDetail from './pages/DepartmentBilling/RMBillDetail';
import Documentation from './pages/Documentation/Documentation';
import ShareDocument from './pages/Documentation/ShareDocument';
import ShareLogs from './pages/ShareLogs/ShareLogs';
import AllReqMaterial from './pages/ExecutionActualReport/Allreqmaterial';
import ProcessFlow from './pages/ExecutionActualReport/ProcessFlow';
import StageDetail from './pages/ExecutionActualReport/StageDetail';
import Mobilization from './pages/Contractor/Mobilization';
import DrawingUpload from './pages/DrawingDesignUpload/DrawingUpload';
import FinalApproval from './pages/FinalApproval/FinalApproval';
import UploadDesignPage from './pages/ExecutionActualReport/UploadDesignPage';
import Settings from './pages/Settings/Settings';
import UploadDrawing from './pages/DrawingDesignUpload/UploadDrawing';

// Indent to PO Stage Pages
import CreateIndent from './pages/IndentToPO/CreateIndent';
import ApproveIndent from './pages/IndentToPO/ApproveIndent';
import PendingIndents from './pages/IndentToPO/PendingIndents';
import VendorBidding from './pages/IndentToPO/VendorBidding';
import Quotation from './pages/IndentToPO/Quotation';
import TechnicalApproval from './pages/IndentToPO/TechnicalApproval';
import RateApproval from './pages/IndentToPO/RateApproval';
import VendorUpdate from './pages/IndentToPO/VendorUpdate';
import CreatePO from './pages/IndentToPO/CreatePO';
import PendingPo from './pages/IndentToPO/PendingPo';
import Order from './pages/IndentToPO/Order';
import POMaster from './pages/IndentToPO/POMaster';

import ProtectedRoute from './components/ProtectedRoute';
import { initializeStorage } from './utils/storageManager';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { SheetsProvider } from './context/SheetsContext';

function App() {
  useEffect(() => {
    initializeStorage();
  }, []);

  return (
    <AuthProvider>
      <ProjectProvider>
        <SheetsProvider>
          <div className="bg-white min-h-screen">
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
              <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/add-project" replace />} />
                  <Route path="add-project" element={<AddProject />} />
                  <Route path="mobilization" element={<Mobilization />} />
                  <Route path="sent-po" element={<Navigate to="/mobilization?tab=sent-po" replace />} />
                  <Route path="survey" element={<Navigate to="/mobilization?tab=survey" replace />} />
                  <Route path="drawing-upload" element={<DrawingUpload />} />
                  <Route path="final-approval" element={<FinalApproval />} />
                  <Route path="upload-drawing" element={<UploadDrawing />} />
                  <Route path="upload-design" element={<UploadDesignPage />} />
                  <Route path="all-project" element={<AllProject />} />
                  <Route path="project-minors/:projectNo" element={<ProjectMinors />} />
                  <Route path="view-design/:projectNo" element={<ViewDesign />} />
                  <Route path="product-imf/:projectNo" element={<ProductIMF />} />
                  <Route path="valve-report/:projectNo" element={<ValveReport />} />
                  <Route path="back-filling-report/:projectNo" element={<BackFillingReport />} />
                  <Route path="execution-details/:projectNo" element={<ExecutionDetails />} />
                  <Route path="actual-details/:projectNo" element={<ActualDetails />} />
                  <Route path="auto-comparison/:projectNo" element={<AutoComparison />} />
                  <Route path="excavation-murum/:projectNo" element={<ExcavationMurum />} />
                  <Route path="murum/:projectNo" element={<MurumDetails />} />
                  <Route path="process-flow/:projectNo" element={<ProcessFlow />} />
                  <Route path="process-flow/:projectNo/:stageNumber" element={<StageDetail />} />
                  <Route path="material-requirement" element={<AllReqMaterial />} />
                  <Route path="material-requirement/:projectNo" element={<AllReqMaterial />} />
                  <Route path="rm1" element={<RM1 />} />
                  <Route path="documentation" element={<Documentation />} />
                  <Route path="documentation/share" element={<ShareDocument />} />
                  <Route path="documentation/share/:docId" element={<ShareDocument />} />
                  <Route path="share-logs" element={<ShareLogs />} />
                  <Route path="email-logs" element={<Navigate to="/share-logs" replace />} />
                  <Route path="rm2" element={<RM2 />} />
                  <Route path="rm-bill/:billId" element={<RMBillDetail />} />
                  <Route path="settings" element={<Settings />} />

                  {/* Indent to PO Stages Routes */}
                  <Route path="indent-to-po/create" element={<CreateIndent />} />
                  <Route path="indent-to-po/approve" element={<ApproveIndent />} />
                  <Route path="indent-to-po/vendor-update" element={<VendorUpdate />} />
                  <Route path="indent-to-po/technical-approval" element={<TechnicalApproval />} />
                  <Route path="indent-to-po/management-approval" element={<RateApproval />} />
                  <Route path="indent-to-po/rate-approval" element={<Navigate to="/indent-to-po/management-approval" replace />} />
                  <Route path="indent-to-po/pending-po" element={<PendingPo />} />
                  <Route path="indent-to-po/create-po" element={<CreatePO />} />
                  <Route path="indent-to-po/po-history" element={<POMaster />} />
                  <Route path="indent-to-po/po-master" element={<Navigate to="/indent-to-po/po-history" replace />} />
                  <Route path="indent-to-po/pending-indents" element={<PendingIndents />} />
                  <Route path="indent-to-po/vendor-bidding" element={<VendorBidding />} />
                  <Route path="indent-to-po/quotation" element={<Quotation />} />
                  <Route path="indent-to-po/order" element={<Order />} />

                  {/* Direct shortcuts for convenience */}
                  <Route path="create-indent" element={<Navigate to="/indent-to-po/create" replace />} />
                  <Route path="approve-indent" element={<Navigate to="/indent-to-po/approve" replace />} />
                  <Route path="vendor-update" element={<Navigate to="/indent-to-po/vendor-update" replace />} />
                  <Route path="technical-approval" element={<Navigate to="/indent-to-po/technical-approval" replace />} />
                  <Route path="management-approval" element={<Navigate to="/indent-to-po/management-approval" replace />} />
                  <Route path="rate-approval" element={<Navigate to="/indent-to-po/management-approval" replace />} />
                  <Route path="pending-po" element={<Navigate to="/indent-to-po/pending-po" replace />} />
                  <Route path="create-po" element={<Navigate to="/indent-to-po/create-po" replace />} />
                  <Route path="po-history" element={<Navigate to="/indent-to-po/po-history" replace />} />
                  <Route path="po-master" element={<Navigate to="/indent-to-po/po-history" replace />} />
                  <Route path="pending-indents" element={<Navigate to="/indent-to-po/pending-indents" replace />} />
                  <Route path="vendor-bidding" element={<Navigate to="/indent-to-po/vendor-bidding" replace />} />
                  <Route path="quotation" element={<Navigate to="/indent-to-po/quotation" replace />} />
                  <Route path="order" element={<Navigate to="/indent-to-po/order" replace />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </div>
        </SheetsProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
