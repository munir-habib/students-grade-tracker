import { createBrowserRouter } from 'react-router'

import { AdminAccountsPage } from '../features/admin/AdminAccountsPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { UpdatePasswordPage } from '../features/auth/UpdatePasswordPage'
import { CourseDetailPage } from '../features/courses/CourseDetailPage'
import { CoursesPage } from '../features/courses/CoursesPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AdminRoute, ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from './AppLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/update-password', element: <UpdatePasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/courses', element: <CoursesPage /> },
          { path: '/courses/:courseId', element: <CourseDetailPage /> },
          { path: '/settings', element: <SettingsPage /> },
          {
            element: <AdminRoute />,
            children: [{ path: '/admin', element: <AdminAccountsPage /> }],
          },
        ],
      },
    ],
  },
])
