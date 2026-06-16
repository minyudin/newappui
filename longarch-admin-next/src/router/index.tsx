import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/shell/AppShell'
import AuthBootstrap from '@/components/shell/AuthBootstrap'
import NavigateBridge from '@/components/shell/NavigateBridge'
import RouteGuard from '@/components/shell/RouteGuard'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import UiKitPage from '@/pages/UiKitPage'
import DashboardPage from '@/pages/DashboardPage'
import UsersPage from '@/pages/UsersPage'
import OrdersPage from '@/pages/OrdersPage'
import CodesPage from '@/pages/CodesPage'
import AdoptionWizardPage from '@/pages/AdoptionWizardPage'
import PlotsPage from '@/pages/PlotsPage'
import DeviceOverviewPage from '@/pages/DeviceOverviewPage'
import CamerasPage from '@/pages/CamerasPage'
import DevicesPage from '@/pages/DevicesPage'
import ScreensPage from '@/pages/ScreensPage'
import TasksPage from '@/pages/TasksPage'
import OperatorScopesPage from '@/pages/OperatorScopesPage'
import SensorDataPage from '@/pages/SensorDataPage'

/**
 * AppRouter · 顶层 Router
 * ============================================================
 *   /login              §0 Entry      裸页 · 无 AppShell
 *   /                   重定向到 /dashboard
 *   /dashboard          §1  仪表盘
 *   /users              §2  用户
 *   /orders             §3  认养订单
 *   /codes              §4  认养码
 *   /plots              §5  地块
 *   /device-overview    §6  设备总览
 *   /cameras            §7  摄像头
 *   /devices            §8  执行设备
 *   /screens            §9  大屏
 *   /tasks              §10 操作任务
 *   /sensor-data        §11 传感器数据 (hidden in sidebar)
 *   /ui-kit             UI Kit 展示 (hidden in sidebar)
 *   *                   404
 *
 *  NavigateBridge 在 BrowserRouter 内部把 useNavigate 注册给
 *  http 拦截器, 用于 code===40002 时自动跳 /login
 * ============================================================ */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <NavigateBridge />
      <AuthBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RouteGuard>
                <AppShell />
              </RouteGuard>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/adoptions/new" element={<AdoptionWizardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/codes" element={<CodesPage />} />
            <Route path="/plots" element={<PlotsPage />} />
            <Route path="/device-overview" element={<DeviceOverviewPage />} />
            <Route path="/cameras" element={<CamerasPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/screens" element={<ScreensPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/operator-scopes" element={<OperatorScopesPage />} />
            <Route path="/sensor-data" element={<SensorDataPage />} />
            <Route path="/ui-kit" element={<UiKitPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  )
}
