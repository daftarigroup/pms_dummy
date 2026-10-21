import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut as LogOutIcon,
  X,
  Building2,
  Truck,
  FileUp,
  FileSpreadsheet,
  ShieldCheck,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Receipt,
  History,
  FileText,
  Share2,
  ShoppingCart,
  FilePlus,
  CheckSquare,
  Clock,
  Send,
  FileCode,
  ShieldAlert,
  Percent,
  UserCheck,
  FileCheck2,
  Hourglass,
  PackageCheck,
  Archive,
  PlusCircle,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getRMBills } from '../utils/storageManager';
import companyLogo from '../Assets/Pooja Logo.png';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const location = useLocation();

  const [procurementOpen, setProcurementOpen] = useState<boolean>(() => {
    return location.pathname.startsWith('/indent-to-po') ||
      ['/create-indent', '/approve-indent', '/vendor-update', '/technical-approval', '/management-approval', '/rate-approval', '/create-po', '/pending-po', '/po-history', '/po-master'].some(p => location.pathname.startsWith(p));
  });

  useEffect(() => {
    if (location.pathname.startsWith('/indent-to-po') ||
      ['/create-indent', '/approve-indent', '/vendor-update', '/technical-approval', '/management-approval', '/rate-approval', '/create-po', '/pending-po', '/po-history', '/po-master'].some(p => location.pathname.startsWith(p))) {
      setProcurementOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const indentPoStages = [
    { path: '/indent-to-po/create', icon: PlusCircle, label: 'Create Indent' },
    { path: '/indent-to-po/approve', icon: CheckSquare, label: 'Indent Approval' },
    { path: '/indent-to-po/vendor-update', icon: UserCheck, label: 'Vendor Rate Update' },
    { path: '/indent-to-po/technical-approval', icon: Users, label: 'Technical Approval' },
    { path: '/indent-to-po/management-approval', icon: ShieldCheck, label: 'Management Approval' },
    { path: '/indent-to-po/pending-po', icon: Clock, label: 'Pending PO to Make' },
    { path: '/indent-to-po/create-po', icon: FilePlus, label: 'Create PO' },
    { path: '/indent-to-po/po-history', icon: History, label: 'PO History' },
  ];

  const menuItems = [
    { path: '/add-project', icon: Building2, label: 'New Project' },
    { path: '/mobilization', icon: Truck, label: 'Contractor' },
    { path: '/final-approval', icon: ShieldCheck, label: 'Final Approval' },
    { path: '/drawing-upload', icon: FileUp, label: 'Drawing & Design Upload' },
    { path: '/upload-design', icon: FileSpreadsheet, label: 'Execution & Actual Report' },
    { path: '/rm1', icon: Receipt, label: 'Department Billing' },
    { path: '/rm2', icon: History, label: 'Sub Contractor Billings' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/share-logs', icon: Share2, label: 'Share Logs' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const isProcurementActive = () => {
    return location.pathname.startsWith('/indent-to-po') ||
      indentPoStages.some(stage => location.pathname === stage.path || location.pathname === stage.path.replace('/indent-to-po/', '/'));
  };

  const isItemActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/documentation') {
      return location.pathname.startsWith('/documentation');
    }
    if (path === '/share-logs') {
      return location.pathname.startsWith('/share-logs') || location.pathname.startsWith('/email-logs');
    }
    if (path === '/mobilization') {
      return location.pathname === '/sent-po' || location.pathname === '/survey';
    }
    if (path === '/drawing-upload') {
      return location.pathname === '/upload-drawing';
    }
    if (path === '/rm1') {
      if (location.pathname.startsWith('/rm1') || location.pathname.startsWith('/department-billing')) return true;
      if (location.pathname.startsWith('/rm-bill/')) {
        const billId = decodeURIComponent(location.pathname.split('/rm-bill/')[1] || '');
        const bill = (getRMBills() || []).find((b: any) => b.id === billId);
        return !bill || bill.billType === 'Execution';
      }
    }
    if (path === '/rm2') {
      if (location.pathname.startsWith('/rm2') || location.pathname.startsWith('/subcontractor-billing')) return true;
      if (location.pathname.startsWith('/rm-bill/')) {
        const billId = decodeURIComponent(location.pathname.split('/rm-bill/')[1] || '');
        const bill = (getRMBills() || []).find((b: any) => b.id === billId);
        return bill?.billType === 'Actual';
      }
    }
    if (path === '/upload-design') {
      const designSubPages = [
        '/project-minors',
        '/view-design',
        '/execution-details',
        '/actual-details',
        '/auto-comparison',
        '/excavation-murum',
        '/murum',
        '/process-flow',
        '/material-requirement',
        '/product-imf',
        '/valve-report',
        '/back-filling-report'
      ];
      return designSubPages.some(sub => location.pathname.startsWith(sub));
    }
    return false;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-indigo-100 z-50 transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-72'}
        `}
      >
        <div className="flex flex-col h-full relative">

          {/* Logo Section */}
          <div className="p-4 border-b border-indigo-100 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white border border-indigo-100">
                <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain" />
              </div>
              {!collapsed && (
                <span className="text-xl font-bold text-indigo-600 tracking-tight truncate min-w-0">
                  Pooja Construction
                </span>
              )}
            </div>
            {/* Mobile close button */}
            <button onClick={onClose} className="lg:hidden p-2 hover:bg-indigo-100/50 rounded-lg flex-shrink-0">
              <X size={20} className="text-indigo-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
            {/* Standard Item: New Project (At Top) */}
            <div className="relative group">
              <NavLink
                to="/add-project"
                onClick={onClose}
                className={() => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group overflow-hidden
                  ${collapsed ? 'justify-center' : ''}
                  ${isItemActive('/add-project')
                    ? 'bg-indigo-100/50 text-indigo-600 border-l-4 border-indigo-600'
                    : 'text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 border-l-4 border-transparent'}
                `}
              >
                <Building2 size={20} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
                {!collapsed && (
                  <span className="font-bold text-xs sm:text-[13px] 2xl:text-sm leading-tight truncate">
                    New Project
                  </span>
                )}
              </NavLink>
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg hidden lg:block">
                  New Project
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              )}
            </div>

            {/* Indent to PO Stages Section / Accordion - Placed below New Project */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (collapsed) {
                    navigate('/indent-to-po/create');
                  } else {
                    setProcurementOpen(prev => !prev);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group overflow-hidden
                  ${collapsed ? 'justify-center' : ''}
                  ${isProcurementActive()
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border-l-4 border-indigo-600'
                    : 'text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 border-l-4 border-transparent'}
                `}
                title="Indent to PO Stages"
              >
                <div className={`flex items-center gap-3 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
                  <ShoppingCart size={20} className="flex-shrink-0 text-indigo-600 group-hover:scale-110 transition-transform" />
                  {!collapsed && (
                    <span className="font-bold text-xs sm:text-[13px] 2xl:text-sm leading-tight truncate">
                      Indent to PO Stages
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${procurementOpen ? 'rotate-180 text-indigo-600' : ''}`}
                  />
                )}
              </button>

              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg hidden lg:block">
                  Indent to PO Stages (10)
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              )}

              {/* Submenu for Stages */}
              {!collapsed && procurementOpen && (
                <div className="mt-1 ml-3 pl-3 border-l-2 border-indigo-100 space-y-0.5">
                  {indentPoStages.map((stage) => {
                    const isStageActive = location.pathname === stage.path || location.pathname === stage.path.replace('/indent-to-po/', '/');
                    const StageIcon = stage.icon;
                    return (
                      <NavLink
                        key={stage.path}
                        to={stage.path}
                        onClick={onClose}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                          ${isStageActive
                            ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                            : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}
                        `}
                      >
                        <StageIcon size={14} className="flex-shrink-0" />
                        <span className="truncate">{stage.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Remaining Menu Items */}
            {menuItems.slice(1).map((item) => (
              <div key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={() => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group overflow-hidden
                    ${collapsed ? 'justify-center' : ''}
                    ${isItemActive(item.path)
                      ? 'bg-indigo-100/50 text-indigo-600 border-l-4 border-indigo-600'
                      : 'text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 border-l-4 border-transparent'}
                  `}
                >
                  <item.icon size={20} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
                  {!collapsed && (
                    <span className="font-bold text-xs sm:text-[13px] 2xl:text-sm leading-tight truncate" title={item.label}>
                      {item.label}
                    </span>
                  )}
                </NavLink>

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                    opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg
                    hidden lg:block">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Sign Out */}
          <div className="p-3 border-t border-indigo-100 bg-indigo-50/50">
            {collapsed ? (
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-full p-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                >
                  <LogOutIcon size={18} />
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg hidden lg:block">
                  Sign Out
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all font-semibold shadow-sm"
              >
                <LogOutIcon size={18} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2
            w-7 h-7 bg-white border border-indigo-200 rounded-full
            items-center justify-center shadow-md
            hover:bg-indigo-600 hover:text-white hover:border-indigo-600
            text-indigo-600 transition-all duration-200 z-[60]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronLeft size={14} />
          }
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
