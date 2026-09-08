import { buildRouteUtility, ROUTER } from './routing'

const adminRoutes = ROUTER({
  profile: {
    path: '/admin/profile',
    label: 'โปรไฟล์',
    children: {
      logging: {
        path: '/admin/profile/logging',
        label: 'ประวัติการทำรายการ'
      }
    }
  },
  dashboard: {
    path: '/admin',
    label: 'แดชบอร์ด',
    permission: 'viewDashboard'
  },
  login: {
    path: '/admin/login',
    label: 'เข้าสู่ระบบ'
  },
  system: {
    path: '/admin/system',
    label: 'ระบบ',
    hiddenBreadcrumb: true,
    children: {
      users: {
        path: '/admin/users',
        label: 'ผู้ใช้งาน',
        permission: 'manageUsers',
        children: {
          profile: {
            path: '/admin/users/:userId/profile',
            label: 'รายละเอียดผู้ใช้งาน',
            permission: 'manageUsers'
          },
          logging: {
            path: '/admin/users/:userId/logging',
            label: 'ประวัติการทำรายการ',
            permission: 'manageUsers'
          }
        }
      },
      auditLogs: {
        path: '/admin/audit-logs',
        label: 'ประวัติการทำรายการ',
        permission: 'viewAuditLogs'
      }
    }
  }
})

export const { getRoute, getPath, findRouteTrail } =
  buildRouteUtility(adminRoutes)
