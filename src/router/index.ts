import { createRouter, createWebHistory } from 'vue-router'
import { hasSupabaseEnv } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** exige login */
    auth?: boolean
    /** exige perfil admin */
    admin?: boolean
    /** só para quem ainda não entrou */
    guest?: boolean
    /** desenha a barra de navegação */
    shell?: boolean
    title?: string
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { guest: true, title: 'Entrar' } },
    { path: '/convite/:token', component: () => import('@/views/InviteView.vue'), meta: { title: 'Convite' } },
    { path: '/', component: () => import('@/views/MonthView.vue'), meta: { auth: true, shell: true, title: 'Mês' } },
    { path: '/recorrentes', component: () => import('@/views/RecurringView.vue'), meta: { auth: true, shell: true, title: 'Recorrentes' } },
    { path: '/planejamento', component: () => import('@/views/GoalsView.vue'), meta: { auth: true, shell: true, title: 'Planejamento' } },
    { path: '/admin', component: () => import('@/views/AdminView.vue'), meta: { auth: true, admin: true, shell: true, title: 'Admin' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  if (!hasSupabaseEnv) return true
  const auth = useAuth()
  if (to.meta.auth && !auth.isLoggedIn) return { path: '/login' }
  if (to.meta.guest && auth.isLoggedIn) return { path: '/' }
  if (to.meta.admin && !auth.isAdmin) return { path: '/' }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Contas do Mês` : 'Contas do Mês'
})

export default router
