<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
</script>

<template>
  <div class="grid min-h-dvh place-items-center px-4 py-10">
    <Card class="w-full max-w-lg">
      <h1 class="text-lg font-semibold tracking-tight">Falta ligar o Supabase</h1>
      <p class="mt-2 text-muted-foreground">
        O app precisa saber onde está o banco. Copie <code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">.env.example</code> para
        <code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">.env</code> e preencha as duas variáveis.
      </p>
      <ol class="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>Suba o Supabase local: <code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">npx supabase start</code></li>
        <li>Copie a URL e a <b>anon key</b> que ele mostra (ou rode <code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">npx supabase status</code>).</li>
        <li>Cole em <code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">VITE_SUPABASE_URL</code> e <code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">VITE_SUPABASE_ANON_KEY</code>.</li>
        <li>Reinicie o servidor (<code class="rounded bg-muted px-1.5 py-0.5 text-[13px]">npm run dev</code>).</li>
      </ol>
      <p class="mt-4 text-xs text-muted-foreground">O passo a passo completo está no README.</p>
    </Card>
  </div>
</template>
