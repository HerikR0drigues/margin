import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { hasSupabaseEnv } from './lib/supabase'
import { useAuth } from './stores/auth'
import './style.css'

async function boot() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  // Descobre se já existe sessão antes de montar as rotas, para não piscar a tela de login.
  if (hasSupabaseEnv) await useAuth(pinia).init()
  app.use(router)
  app.mount('#app')
}

void boot()
